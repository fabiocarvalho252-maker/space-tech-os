// Orchestrates the Evolution API client (evolution-api.ts) with our own
// whatsapp_connections/whatsapp_messages tables. Server-only. Every function
// here takes an already-authenticated `userId` (the empresa identifier, same
// convention as every other table in this project) resolved by the caller
// from the Supabase session — this module never trusts a caller-supplied
// empresa id, and always uses supabaseAdmin (service role) scoped by an
// explicit `.eq("user_id", userId)` rather than relying on a user JWT, since
// some callers (the webhook) have no user session at all.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { salvarPdfOsNoStorage } from "@/lib/os-pdf.server";
import {
  EvolutionApiError,
  conectarInstancia,
  criarInstancia,
  desconectarInstancia,
  enviarMensagemMidia,
  enviarMensagemTexto,
  evolutionConfigurado,
  nomeInstancia,
  statusInstancia,
} from "./evolution-api";
import type { JsonValue, WhatsappAnexoRegistro, WhatsappConexao, WhatsappMensagem } from "./types";

export class WhatsappNaoConfiguradoError extends Error {
  constructor() {
    super(
      "Integração com a Evolution API ainda não foi configurada no servidor (veja .env.example).",
    );
    this.name = "WhatsappNaoConfiguradoError";
  }
}

function webhookUrlPara(instanceName: string, origin: string): string {
  const token = process.env["EVOLUTION_WEBHOOK_TOKEN"] ?? "";
  // The Evolution API server calls this URL from wherever it itself runs —
  // for a self-hosted/containerized Evolution instance that isn't the same
  // origin the browser used to reach this app (e.g. a Docker container
  // calling back to the host, where "localhost" means the container
  // itself), EVOLUTION_WEBHOOK_BASE_URL overrides the derived request
  // origin. Unset in normal production deployments, where the app's public
  // origin is reachable by Evolution API directly.
  const base = process.env["EVOLUTION_WEBHOOK_BASE_URL"] || origin;
  const url = new URL("/api/whatsapp/webhook", base);
  url.searchParams.set("instance", instanceName);
  if (token) url.searchParams.set("token", token);
  return url.toString();
}

async function obterConexao(userId: string): Promise<WhatsappConexao | null> {
  const { data, error } = await supabaseAdmin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in the generated Database type yet, see types.ts header
    .from("whatsapp_connections" as any)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as WhatsappConexao | null) ?? null;
}

async function upsertConexao(
  userId: string,
  instanceName: string,
  patch: Partial<WhatsappConexao>,
): Promise<WhatsappConexao> {
  const { data, error } = await supabaseAdmin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in the generated Database type yet, see types.ts header
    .from("whatsapp_connections" as any)
    .upsert({ user_id: userId, instance_name: instanceName, ...patch }, { onConflict: "user_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as WhatsappConexao;
}

/** Current connection row for this empresa (creates none — just reads). */
export async function obterStatusSalvo(userId: string): Promise<WhatsappConexao | null> {
  return obterConexao(userId);
}

/**
 * Starts (or resumes) a connection: ensures the instance exists on the
 * Evolution server with our webhook configured, requests a QR code, and
 * persists it. `origin` is the public origin of this app (derived from the
 * incoming request by the caller) used to build the webhook URL.
 */
export async function conectar(userId: string, origin: string): Promise<WhatsappConexao> {
  if (!evolutionConfigurado()) throw new WhatsappNaoConfiguradoError();

  const instanceName = nomeInstancia(userId);
  const webhookUrl = webhookUrlPara(instanceName, origin);

  try {
    const criado = await criarInstancia(instanceName, webhookUrl);
    let qrcode = criado.qrcodeBase64;
    if (!qrcode) {
      const conectado = await conectarInstancia(instanceName);
      qrcode = conectado.qrcodeBase64;
    }
    return upsertConexao(userId, instanceName, {
      status: "conectando",
      qr_code: qrcode,
      last_error: null,
    });
  } catch (e) {
    const motivo =
      e instanceof EvolutionApiError ? e.message : "Falha ao conectar com a Evolution API.";
    await upsertConexao(userId, instanceName, { status: "erro", last_error: motivo });
    throw e;
  }
}

/** Refreshes live status from Evolution and syncs it into our table. */
export async function atualizarStatus(userId: string): Promise<WhatsappConexao | null> {
  if (!evolutionConfigurado()) throw new WhatsappNaoConfiguradoError();

  const existente = await obterConexao(userId);
  if (!existente) return null;

  const resultado = await statusInstancia(existente.instance_name);
  const status =
    resultado.state === "open"
      ? "conectado"
      : resultado.state === "connecting"
        ? "conectando"
        : "desconectado";

  return upsertConexao(userId, existente.instance_name, {
    status,
    phone_number: resultado.phoneNumber ?? existente.phone_number,
    qr_code: status === "conectado" ? null : existente.qr_code,
    last_connected_at:
      status === "conectado" ? new Date().toISOString() : existente.last_connected_at,
    last_error: null,
  });
}

/** Just the currently-stored QR (no live Evolution call) — cheap to poll while a connect modal is open. */
export async function obterQrCodeSalvo(userId: string): Promise<string | null> {
  const existente = await obterConexao(userId);
  return existente?.qr_code ?? null;
}

export async function desconectar(userId: string): Promise<WhatsappConexao | null> {
  if (!evolutionConfigurado()) throw new WhatsappNaoConfiguradoError();

  const existente = await obterConexao(userId);
  if (!existente) return null;

  await desconectarInstancia(existente.instance_name);
  return upsertConexao(userId, existente.instance_name, {
    status: "desconectado",
    qr_code: null,
    phone_number: null,
  });
}

// Evolution/Baileys validates numbers as full E.164 (with country code) —
// confirmed against a real server: sending the bare 11-digit BR national
// number gets a 400 "exists: false", prefixing "55" makes the exact same
// number go through. Same convention src/lib/whatsapp.ts's buildWaMeLink
// already uses for wa.me links.
function paraE164BR(numero: string): string {
  return numero.startsWith("55") && numero.length > 11 ? numero : `55${numero}`;
}

export async function enviarMensagem(
  userId: string,
  numero: string,
  texto: string,
): Promise<WhatsappMensagem> {
  if (!evolutionConfigurado()) throw new WhatsappNaoConfiguradoError();

  const conexao = await obterConexao(userId);
  if (!conexao || conexao.status !== "conectado") {
    throw new Error("WhatsApp não está conectado — conecte antes de enviar mensagens.");
  }

  const numeroCompleto = paraE164BR(numero);
  let status: "enviado" | "falhou" = "enviado";
  let evolutionMessageId: string | null = null;
  try {
    const resultado = await enviarMensagemTexto(conexao.instance_name, numeroCompleto, texto);
    evolutionMessageId = resultado.messageId;
  } catch (e) {
    status = "falhou";
    if (!(e instanceof EvolutionApiError)) throw e;
    console.error("Falha ao enviar mensagem WhatsApp via Evolution API:", e.message);
  }

  const { data, error } = await supabaseAdmin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in the generated Database type yet, see types.ts header
    .from("whatsapp_messages" as any)
    .insert({
      user_id: userId,
      connection_id: conexao.id,
      direction: "outbound",
      phone_number: numeroCompleto,
      content: texto,
      status,
      evolution_message_id: evolutionMessageId,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as WhatsappMensagem;
}

export type AnexosSolicitados = { os: boolean; orcamento: boolean };
export type AgendamentoInput = { tipo: "agora" } | { tipo: "fila"; scheduledAt: string };

async function registrarHistoricoOs(
  userId: string,
  osId: string | null,
  evento: string,
  descricao: string,
  createdBy: string,
): Promise<void> {
  if (!osId) return;
  await supabaseAdmin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- os_historico not in the generated Database type yet
    .from("os_historico" as any)
    .insert({ user_id: userId, os_id: osId, evento, descricao, created_by: createdBy });
}

function anexosPendentes(anexos: AnexosSolicitados, osNumero: number): WhatsappAnexoRegistro[] {
  const lista: WhatsappAnexoRegistro[] = [];
  if (anexos.os) lista.push({ tipo: "os", nome: `OS-${osNumero}.pdf`, status: "pendente" });
  if (anexos.orcamento)
    lista.push({ tipo: "orcamento", nome: `Orcamento-OS-${osNumero}.pdf`, status: "pendente" });
  return lista;
}

type ResultadoEnvio = {
  status: "enviado" | "falhou";
  attachments: WhatsappAnexoRegistro[];
  error: string | null;
  evolutionMessageId: string | null;
};

/**
 * Talks to Evolution for real: the text message first (if any), then each
 * requested attachment as its own document message (PDF generated fresh via
 * os-pdf.server.ts and uploaded to the os-fotos bucket alongside the OS's
 * photos). Partial success (e.g. text sent but one attachment failed) still
 * counts as "enviado" overall — the client did receive something — with the
 * failure surfaced in `error` instead of hiding it.
 */
async function executarEnvio(params: {
  conexao: WhatsappConexao;
  numeroCompleto: string;
  mensagem: string;
  osId: string;
  empresaId: string;
  osNumero: number;
  anexos: AnexosSolicitados;
}): Promise<ResultadoEnvio> {
  let evolutionMessageId: string | null = null;
  let erroTexto: string | null = null;
  if (params.mensagem.trim()) {
    try {
      const r = await enviarMensagemTexto(
        params.conexao.instance_name,
        params.numeroCompleto,
        params.mensagem,
      );
      evolutionMessageId = r.messageId;
    } catch (e) {
      if (!(e instanceof EvolutionApiError)) throw e;
      erroTexto = e.message;
    }
  }

  const attachments: WhatsappAnexoRegistro[] = [];
  for (const tipo of ["os", "orcamento"] as const) {
    if (!params.anexos[tipo]) continue;
    const nome =
      tipo === "os" ? `OS-${params.osNumero}.pdf` : `Orcamento-OS-${params.osNumero}.pdf`;
    try {
      const { bytes } = await salvarPdfOsNoStorage({
        osId: params.osId,
        empresaId: params.empresaId,
        modo: tipo,
      });
      await enviarMensagemMidia(params.conexao.instance_name, params.numeroCompleto, {
        mediaBase64: Buffer.from(bytes).toString("base64"),
        mimetype: "application/pdf",
        fileName: nome,
      });
      attachments.push({ tipo, nome, status: "enviado" });
    } catch {
      attachments.push({ tipo, nome, status: "falhou" });
    }
  }

  const anexosFalhos = attachments.filter((a) => a.status === "falhou");
  const teveSucesso =
    (!!params.mensagem.trim() && !erroTexto) || attachments.some((a) => a.status === "enviado");
  const partesErro: string[] = [];
  if (erroTexto) partesErro.push(erroTexto);
  if (anexosFalhos.length)
    partesErro.push(`Falha ao enviar anexo(s): ${anexosFalhos.map((a) => a.nome).join(", ")}.`);

  return {
    status: teveSucesso ? "enviado" : "falhou",
    attachments,
    error: partesErro.length ? partesErro.join(" ") : null,
    evolutionMessageId,
  };
}

/**
 * Entry point for "Enviar notificação por WhatsApp" from the OS screen —
 * either sends immediately through the empresa's Evolution connection, or
 * (agendamento.tipo === "fila") just records the intent as status='agendado'
 * for processarNotificacoesAgendadasOs to pick up later, since this project
 * has no cron/worker to fire it at the exact scheduled time.
 */
export async function enviarNotificacaoOs(params: {
  userId: string;
  osId: string;
  numero: string;
  mensagem: string;
  templateId: string | null;
  anexos: AnexosSolicitados;
  agendamento: AgendamentoInput;
  sentBy: string;
}): Promise<WhatsappMensagem> {
  const { data: osRow, error: erroOs } = await supabaseAdmin
    .from("ordens_servico")
    .select("numero")
    .eq("id", params.osId)
    .eq("user_id", params.userId)
    .single();
  if (erroOs || !osRow) throw new Error("OS não encontrada.");

  const numeroCompleto = paraE164BR(params.numero);

  if (params.agendamento.tipo === "fila") {
    const { data, error } = await supabaseAdmin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in the generated Database type yet, see types.ts header
      .from("whatsapp_messages" as any)
      .insert({
        user_id: params.userId,
        direction: "outbound",
        phone_number: numeroCompleto,
        content: params.mensagem,
        status: "agendado",
        os_id: params.osId,
        template_id: params.templateId,
        attachments: anexosPendentes(params.anexos, osRow.numero),
        scheduled_at: params.agendamento.scheduledAt,
        sent_by: params.sentBy,
      })
      .select("*")
      .single();
    if (error) throw error;

    await registrarHistoricoOs(
      params.userId,
      params.osId,
      "whatsapp_agendado",
      `Notificação WhatsApp agendada para ${new Date(params.agendamento.scheduledAt).toLocaleString("pt-BR")}`,
      params.sentBy,
    );
    return data as unknown as WhatsappMensagem;
  }

  if (!evolutionConfigurado()) throw new WhatsappNaoConfiguradoError();
  const conexao = await obterConexao(params.userId);
  if (!conexao || conexao.status !== "conectado") {
    throw new Error("WhatsApp não está conectado — conecte antes de enviar mensagens.");
  }

  const resultado = await executarEnvio({
    conexao,
    numeroCompleto,
    mensagem: params.mensagem,
    osId: params.osId,
    empresaId: params.userId,
    osNumero: osRow.numero,
    anexos: params.anexos,
  });

  const { data, error } = await supabaseAdmin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in the generated Database type yet, see types.ts header
    .from("whatsapp_messages" as any)
    .insert({
      user_id: params.userId,
      connection_id: conexao.id,
      direction: "outbound",
      phone_number: numeroCompleto,
      content: params.mensagem,
      status: resultado.status,
      evolution_message_id: resultado.evolutionMessageId,
      os_id: params.osId,
      template_id: params.templateId,
      attachments: resultado.attachments,
      error: resultado.error,
      sent_by: params.sentBy,
    })
    .select("*")
    .single();
  if (error) throw error;

  if (resultado.status === "enviado") {
    await registrarHistoricoOs(
      params.userId,
      params.osId,
      "whatsapp_enviado",
      "Notificação WhatsApp enviada",
      params.sentBy,
    );
  }

  return data as unknown as WhatsappMensagem;
}

/**
 * Flushes any "agendado" notification whose scheduled_at has already
 * passed — the closest thing to a queue worker this project has, run
 * opportunistically whenever someone loads Ordens (see ordens.tsx). Silently
 * no-ops (leaves rows as "agendado") if the empresa's WhatsApp isn't
 * connected, so nothing is lost — it just waits for the next visit.
 */
export async function processarNotificacoesAgendadasOs(userId: string): Promise<number> {
  if (!evolutionConfigurado()) return 0;

  const { data: pendentes, error } = await supabaseAdmin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in the generated Database type yet, see types.ts header
    .from("whatsapp_messages" as any)
    .select("*")
    .eq("user_id", userId)
    .eq("status", "agendado")
    .lte("scheduled_at", new Date().toISOString());
  if (error || !pendentes?.length) return 0;

  const conexao = await obterConexao(userId);
  if (!conexao || conexao.status !== "conectado") return 0;

  let processadas = 0;
  for (const msg of pendentes as any[]) {
    if (!msg.os_id) continue;
    // Reserva a mensagem (agendado → pendente) antes de enviar: com duas
    // telas abertas, só quem conseguir a reserva envia.
    const { data: reservada } = await supabaseAdmin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in the generated Database type yet, see types.ts header
      .from("whatsapp_messages" as any)
      .update({ status: "pendente" })
      .eq("id", msg.id)
      .eq("status", "agendado")
      .select("id");
    if (!reservada?.length) continue;
    const { data: osRow } = await supabaseAdmin
      .from("ordens_servico")
      .select("numero")
      .eq("id", msg.os_id)
      .maybeSingle();
    if (!osRow) continue;

    const anexosAtuais = (msg.attachments ?? []) as WhatsappAnexoRegistro[];
    const anexos: AnexosSolicitados = {
      os: anexosAtuais.some((a) => a.tipo === "os"),
      orcamento: anexosAtuais.some((a) => a.tipo === "orcamento"),
    };
    const resultado = await executarEnvio({
      conexao,
      numeroCompleto: msg.phone_number,
      mensagem: msg.content ?? "",
      osId: msg.os_id,
      empresaId: userId,
      osNumero: osRow.numero,
      anexos,
    });

    await supabaseAdmin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in the generated Database type yet, see types.ts header
      .from("whatsapp_messages" as any)
      .update({
        status: resultado.status,
        evolution_message_id: resultado.evolutionMessageId,
        attachments: resultado.attachments,
        error: resultado.error,
      })
      .eq("id", msg.id);

    if (resultado.status === "enviado") {
      await registrarHistoricoOs(
        userId,
        msg.os_id,
        "whatsapp_enviado",
        "Notificação WhatsApp enviada (agendada)",
        msg.sent_by ?? userId,
      );
    }
    processadas++;
  }
  return processadas;
}

export async function listarMensagensRecentes(
  userId: string,
  limite = 50,
): Promise<WhatsappMensagem[]> {
  const { data, error } = await supabaseAdmin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in the generated Database type yet, see types.ts header
    .from("whatsapp_messages" as any)
    .select("*")
    .eq("user_id", userId)
    // Mensagens de grupo gravadas antes do filtro do webhook: o id do grupo
    // começa com 120363 (novos) ou tem hífen (antigos).
    .not("phone_number", "like", "120363%")
    .not("phone_number", "like", "%-%")
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data as unknown as WhatsappMensagem[]) ?? [];
}

/**
 * Records an inbound message coming from the Evolution API webhook. Looks up
 * the owning empresa strictly by `instance_name` (never trusts anything else
 * in the payload to decide whose data this is) and is idempotent on
 * `evolutionMessageId` so webhook retries don't duplicate rows.
 */
export async function registrarMensagemRecebida(params: {
  instanceName: string;
  numero: string;
  nomeContato: string | null;
  texto: string | null;
  evolutionMessageId: string | null;
  metadata?: JsonValue;
}): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const { data: conexao, error: erroConexao } = await supabaseAdmin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in the generated Database type yet, see types.ts header
    .from("whatsapp_connections" as any)
    .select("id, user_id")
    .eq("instance_name", params.instanceName)
    .maybeSingle();
  if (erroConexao) throw erroConexao;
  if (!conexao) return { ok: false, motivo: "Instância desconhecida — nenhuma empresa vinculada." };

  const row = conexao as unknown as { id: string; user_id: string };
  const { error } = await supabaseAdmin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in the generated Database type yet, see types.ts header
    .from("whatsapp_messages" as any)
    .insert({
      user_id: row.user_id,
      connection_id: row.id,
      direction: "inbound",
      phone_number: params.numero,
      contact_name: params.nomeContato,
      content: params.texto,
      status: "recebido",
      evolution_message_id: params.evolutionMessageId,
      metadata: params.metadata ?? null,
    });
  // Idempotent on evolution_message_id: a duplicate webhook delivery hits
  // the partial unique index and is silently ignored, not an error.
  if (error && error.code !== "23505") throw error;
  return { ok: true };
}

/**
 * Applies a CONNECTION_UPDATE webhook event (no user session — called from
 * the raw HTTP webhook handler) to the matching empresa's connection row.
 */
export async function aplicarAtualizacaoConexaoWebhook(
  instanceName: string,
  state: "open" | "connecting" | "close",
  phoneNumber: string | null,
): Promise<void> {
  const status =
    state === "open" ? "conectado" : state === "connecting" ? "conectando" : "desconectado";
  const { error } = await supabaseAdmin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in the generated Database type yet, see types.ts header
    .from("whatsapp_connections" as any)
    .update({
      status,
      phone_number: phoneNumber ?? undefined,
      qr_code: status === "conectado" ? null : undefined,
      last_connected_at: status === "conectado" ? new Date().toISOString() : undefined,
    })
    .eq("instance_name", instanceName);
  if (error) throw error;
}

/**
 * Applies a QRCODE_UPDATED webhook event — Baileys rotates the pairing QR
 * every ~20-60s, so without this the qr_code stored at connect-time goes
 * stale and every scan after the first window silently fails.
 */
export async function aplicarQrCodeWebhook(
  instanceName: string,
  qrcodeBase64: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in the generated Database type yet, see types.ts header
    .from("whatsapp_connections" as any)
    .update({ qr_code: qrcodeBase64, status: "conectando" })
    .eq("instance_name", instanceName);
  if (error) throw error;
}

export type ResultadoAvisoPronta =
  | { enviado: true }
  | {
      enviado: false;
      motivo:
        "desligado" | "sem_telefone" | "ja_enviado" | "nao_pronta" | "desconectado" | "falhou";
    };

/**
 * Aviso automático "sua OS está pronta" (Configurações > WhatsApp, desligado
 * por padrão). Chamado pela tela de OS depois que o status vira "pronto";
 * manda uma vez por OS — voltar para "em reparo" e de novo para "pronto" não
 * repete a mensagem. O acesso do usuário à OS é conferido antes, em
 * whatsapp.functions.ts; aqui `empresaId` é o dono da OS.
 */
export async function avisarOsPronta(params: {
  empresaId: string;
  osId: string;
  sentBy: string;
  origem: string;
}): Promise<ResultadoAvisoPronta> {
  const { data: config } = await supabaseAdmin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colunas novas fora do Database type
    .from("whatsapp_config" as any)
    .select("notif_os_pronta, notif_os_pronta_texto")
    .eq("user_id", params.empresaId)
    .maybeSingle();
  const cfg = config as unknown as {
    notif_os_pronta: boolean;
    notif_os_pronta_texto: string;
  } | null;
  if (!cfg?.notif_os_pronta) return { enviado: false, motivo: "desligado" };

  const { data: os } = await supabaseAdmin
    .from("ordens_servico")
    .select("numero, status, aparelho, marca, modelo, clientes(nome, telefone)")
    .eq("id", params.osId)
    .eq("user_id", params.empresaId)
    .maybeSingle();
  if (!os || os.status !== "pronto") return { enviado: false, motivo: "nao_pronta" };
  const cliente = (os as any).clientes as { nome: string | null; telefone: string | null } | null;
  const telefone = (cliente?.telefone ?? "").replace(/\D/g, "");
  if (telefone.length < 10) return { enviado: false, motivo: "sem_telefone" };

  const { count } = await supabaseAdmin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in the generated Database type yet
    .from("whatsapp_messages" as any)
    .select("id", { count: "exact", head: true })
    .eq("os_id", params.osId)
    .eq("template_id", "os_pronta")
    .in("status", ["enviado", "agendado"]);
  if (count) return { enviado: false, motivo: "ja_enviado" };

  const conexao = await obterConexao(params.empresaId);
  if (!evolutionConfigurado() || !conexao || conexao.status !== "conectado") {
    return { enviado: false, motivo: "desconectado" };
  }

  const aparelho =
    [os.marca, os.modelo].filter(Boolean).join(" ").trim() || os.aparelho || "aparelho";
  const primeiroNome = (cliente?.nome ?? "").trim().split(/\s+/)[0] || "";
  const mensagem = (cfg.notif_os_pronta_texto || "")
    .replace(/\{\{\s*cliente\s*\}\}/g, primeiroNome)
    .replace(/\{\{\s*numero\s*\}\}/g, String(os.numero))
    .replace(/\{\{\s*aparelho\s*\}\}/g, aparelho)
    .replace(/\{\{\s*status\s*\}\}/g, "Pronto")
    .replace(/\{\{\s*link\s*\}\}/g, `${params.origem}/consulta/${params.osId}`)
    .replace(/Olá\s+!/g, "Olá!");

  const msg = await enviarNotificacaoOs({
    userId: params.empresaId,
    osId: params.osId,
    numero: telefone,
    mensagem,
    templateId: "os_pronta",
    anexos: { os: false, orcamento: false },
    agendamento: { tipo: "agora" },
    sentBy: params.sentBy,
  });
  return msg.status === "enviado" ? { enviado: true } : { enviado: false, motivo: "falhou" };
}

// Janela do envio automático da pesquisa: entregue há pelo menos 20 h (o
// cliente já usou o aparelho) e no máximo há 7 dias; só sai das 9h às 20h de
// Brasília, porque o envio acontece quando alguém abre Ordens de Serviço.
const PESQUISA_HORAS_MIN = 20;
const PESQUISA_DIAS_MAX = 7;

function horaDeBrasilia(): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "America/Sao_Paulo",
    }).format(new Date()),
  );
}

/**
 * Pesquisa de satisfação automática (Configurações > WhatsApp, desligada por
 * padrão): coloca na fila uma mensagem por OS entregue dentro da janela acima
 * e depois que a opção foi ligada. O envio em si fica com
 * processarNotificacoesAgendadasOs. Não repete se a OS já recebeu a pesquisa,
 * automática ou manual.
 */
export async function enfileirarPesquisasPosOs(empresaId: string): Promise<number> {
  const hora = horaDeBrasilia();
  if (hora < 9 || hora >= 20) return 0;

  const { data: config } = await supabaseAdmin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colunas novas fora do Database type
    .from("whatsapp_config" as any)
    .select("notif_pesquisa_auto, notif_pesquisa_auto_desde, pesquisa_pos_os_texto")
    .eq("user_id", empresaId)
    .maybeSingle();
  const cfg = config as unknown as {
    notif_pesquisa_auto: boolean;
    notif_pesquisa_auto_desde: string | null;
    pesquisa_pos_os_texto: string | null;
  } | null;
  if (!cfg?.notif_pesquisa_auto || !cfg.notif_pesquisa_auto_desde || !cfg.pesquisa_pos_os_texto) {
    return 0;
  }

  const agora = Date.now();
  const limiteRecente = new Date(agora - PESQUISA_HORAS_MIN * 3600_000).toISOString();
  const limiteAntigo = new Date(
    Math.max(
      agora - PESQUISA_DIAS_MAX * 86400_000,
      new Date(cfg.notif_pesquisa_auto_desde).getTime(),
    ),
  ).toISOString();

  const { data: ordens } = await supabaseAdmin
    .from("ordens_servico")
    .select("id, numero, aparelho, marca, modelo, clientes(nome, telefone)")
    .eq("user_id", empresaId)
    .in("status", ["entregue", "faturado"])
    .gte("data_entrega", limiteAntigo)
    .lte("data_entrega", limiteRecente)
    .limit(30);
  if (!ordens?.length) return 0;

  const { data: jaEnviadas } = await supabaseAdmin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in the generated Database type yet
    .from("whatsapp_messages" as any)
    .select("os_id")
    .in(
      "os_id",
      ordens.map((o) => o.id),
    )
    .in("template_id", ["pesquisa_auto", "pos_atendimento"]);
  const enviadas = new Set(
    ((jaEnviadas ?? []) as unknown as { os_id: string }[]).map((m) => m.os_id),
  );

  let enfileiradas = 0;
  for (const os of ordens) {
    if (enviadas.has(os.id)) continue;
    const cliente = (os as any).clientes as { nome: string | null; telefone: string | null } | null;
    const telefone = (cliente?.telefone ?? "").replace(/\D/g, "");
    if (telefone.length < 10) continue;

    const aparelho =
      [os.marca, os.modelo].filter(Boolean).join(" ").trim() || os.aparelho || "aparelho";
    const primeiroNome = (cliente?.nome ?? "").trim().split(/\s+/)[0] || "";
    const mensagem = cfg.pesquisa_pos_os_texto
      .replace(/\{\{\s*cliente\s*\}\}/g, primeiroNome)
      .replace(/\{\{\s*numero\s*\}\}/g, String(os.numero))
      .replace(/\{\{\s*aparelho\s*\}\}/g, aparelho)
      .replace(/\{\{\s*status\s*\}\}/g, "Entregue")
      .replace(/\{\{\s*tecnico\s*\}\}/g, "")
      .replace(/Olá\s+([,!])/g, "Olá$1");

    const { error } = await supabaseAdmin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in the generated Database type yet
      .from("whatsapp_messages" as any)
      .insert({
        user_id: empresaId,
        direction: "outbound",
        phone_number: paraE164BR(telefone),
        content: mensagem,
        status: "agendado",
        os_id: os.id,
        template_id: "pesquisa_auto",
        attachments: [],
        scheduled_at: new Date().toISOString(),
      });
    // 23505: outra tela já colocou a pesquisa desta OS na fila.
    if (error && error.code !== "23505") throw error;
    if (!error) enfileiradas++;
  }
  return enfileiradas;
}

function hojeEmBrasilia(): { ano: number; mesDia: string } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date()); // AAAA-MM-DD
  return { ano: Number(partes.slice(0, 4)), mesDia: partes.slice(5) };
}

/**
 * Mensagem de aniversário automática (Configurações > WhatsApp, desligada por
 * padrão) para os clientes com data de nascimento hoje. Sai das 9h às 20h de
 * Brasília, quando alguém abre Ordens de Serviço; uma por número por ano —
 * a linha é gravada antes do envio e o índice único barra a segunda tela.
 * Quem faz aniversário em 29/02 recebe em 28/02 nos anos não bissextos.
 */
export async function enviarAniversarios(empresaId: string): Promise<number> {
  if (!evolutionConfigurado()) return 0;
  const hora = horaDeBrasilia();
  if (hora < 9 || hora >= 20) return 0;

  const { data: config } = await supabaseAdmin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colunas novas fora do Database type
    .from("whatsapp_config" as any)
    .select("notif_aniversario_auto, feliz_aniversario_texto")
    .eq("user_id", empresaId)
    .maybeSingle();
  const cfg = config as unknown as {
    notif_aniversario_auto: boolean;
    feliz_aniversario_texto: string | null;
  } | null;
  if (!cfg?.notif_aniversario_auto || !cfg.feliz_aniversario_texto?.trim()) return 0;

  const { ano, mesDia } = hojeEmBrasilia();
  const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
  const datasHoje = mesDia === "02-28" && !bissexto ? ["02-28", "02-29"] : [mesDia];

  const { data: clientes } = await supabaseAdmin
    .from("clientes")
    .select("nome, telefone, data_nascimento")
    .eq("user_id", empresaId)
    .not("data_nascimento", "is", null);
  const aniversariantes = (clientes ?? []).filter((c) =>
    datasHoje.includes((c.data_nascimento ?? "").slice(5, 10)),
  );
  if (!aniversariantes.length) return 0;

  const conexao = await obterConexao(empresaId);
  if (!conexao || conexao.status !== "conectado") return 0;

  let enviadas = 0;
  for (const cliente of aniversariantes.slice(0, 30)) {
    const telefone = (cliente.telefone ?? "").replace(/\D/g, "");
    if (telefone.length < 10) continue;
    const numeroCompleto = paraE164BR(telefone);
    const primeiroNome = (cliente.nome ?? "").trim().split(/\s+/)[0] || "";
    const mensagem = cfg.feliz_aniversario_texto
      .replace(/\{\{\s*cliente\s*\}\}/g, primeiroNome)
      .replace(/\{\{\s*(numero|status|tecnico)\s*\}\}/g, "")
      .replace(/Parabéns\s*,?\s*!/g, "Parabéns!");

    const { data: reserva, error } = await supabaseAdmin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in the generated Database type yet
      .from("whatsapp_messages" as any)
      .insert({
        user_id: empresaId,
        connection_id: conexao.id,
        direction: "outbound",
        phone_number: numeroCompleto,
        contact_name: cliente.nome,
        content: mensagem,
        status: "pendente",
        template_id: `aniversario_${ano}`,
      })
      .select("id")
      .single();
    // 23505: já enviado este ano (ou outra tela está enviando agora).
    if (error) {
      if (error.code === "23505") continue;
      throw error;
    }

    let status: "enviado" | "falhou" = "enviado";
    let evolutionMessageId: string | null = null;
    let erro: string | null = null;
    try {
      const resultado = await enviarMensagemTexto(conexao.instance_name, numeroCompleto, mensagem);
      evolutionMessageId = resultado.messageId;
    } catch (e) {
      status = "falhou";
      erro = e instanceof Error ? e.message : String(e);
    }
    await supabaseAdmin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in the generated Database type yet
      .from("whatsapp_messages" as any)
      .update({ status, evolution_message_id: evolutionMessageId, error: erro })
      .eq("id", (reserva as unknown as { id: string }).id);
    if (status === "enviado") enviadas++;
  }
  return enviadas;
}
