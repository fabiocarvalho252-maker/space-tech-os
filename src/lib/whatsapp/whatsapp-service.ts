// Orchestrates the Evolution API client (evolution-api.ts) with our own
// whatsapp_connections/whatsapp_messages tables. Server-only. Every function
// here takes an already-authenticated `userId` (the empresa identifier, same
// convention as every other table in this project) resolved by the caller
// from the Supabase session — this module never trusts a caller-supplied
// empresa id, and always uses supabaseAdmin (service role) scoped by an
// explicit `.eq("user_id", userId)` rather than relying on a user JWT, since
// some callers (the webhook) have no user session at all.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SITE_ADMIN_EMAIL } from "@/lib/site-admin";
import { salvarPdfOsNoStorage } from "@/lib/os-pdf.server";
import {
  EvolutionApiError,
  conectarInstancia,
  criarInstancia,
  apagarInstancia,
  desconectarInstancia,
  reiniciarInstancia,
  enviarMensagemMidia,
  enviarMensagemTexto,
  evolutionConfigurado,
  nomeInstancia,
  statusInstancia,
} from "./evolution-api";
import type { JsonValue, WhatsappAnexoRegistro, WhatsappConexao, WhatsappMensagem } from "./types";
import { avaliarRespostaPesquisa, escreverPesquisaPosOs } from "./ia-pesquisa.server";

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

    .from("whatsapp_connections")
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

    .from("whatsapp_connections")
    .upsert({ user_id: userId, instance_name: instanceName, ...patch }, { onConflict: "user_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as WhatsappConexao;
}

// A Evolution continua dizendo "open" quando a sessão do Baileys morreu
// (todo envio volta "Connection Closed"). Quando um envio dá esse erro, a
// conexão vira "erro" com esta mensagem e fica assim — mesmo que a Evolution
// diga "open" — até reiniciar, reconectar ou um envio dar certo.
export const SESSAO_CAIDA =
  "A sessão do WhatsApp caiu: as mensagens não estão saindo. Clique em Reiniciar conexão; se continuar, desconecte e leia o QR Code de novo.";

async function registrarSaudeEnvio(
  conexao: { id: string; status: string },
  erro: string | null,
): Promise<void> {
  const caiu = !!erro && /Connection Closed/i.test(erro);
  if (caiu && conexao.status !== "erro") {
    await supabaseAdmin

      .from("whatsapp_connections")
      .update({ status: "erro", last_error: SESSAO_CAIDA })
      .eq("id", conexao.id);
  } else if (!erro && conexao.status === "erro") {
    await supabaseAdmin

      .from("whatsapp_connections")
      .update({ status: "conectado", last_error: null })
      .eq("id", conexao.id);
  }
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
  if (
    resultado.state === "open" &&
    existente.status === "erro" &&
    existente.last_error === SESSAO_CAIDA
  ) {
    return existente;
  }
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

/** Reinicia a sessão (sem novo QR Code) e devolve o status depois de alguns segundos. */
export async function reiniciar(userId: string): Promise<WhatsappConexao | null> {
  if (!evolutionConfigurado()) throw new WhatsappNaoConfiguradoError();
  const existente = await obterConexao(userId);
  if (!existente) return null;
  await reiniciarInstancia(existente.instance_name);
  await new Promise((r) => setTimeout(r, 5000));
  // Reiniciar zera a marca de sessão caída; se o próximo envio falhar de
  // novo, registrarSaudeEnvio volta a marcar.
  if (existente.status === "erro") {
    await upsertConexao(userId, existente.instance_name, { status: "conectado", last_error: null });
  }
  return atualizarStatus(userId);
}

export async function desconectar(userId: string): Promise<WhatsappConexao | null> {
  if (!evolutionConfigurado()) throw new WhatsappNaoConfiguradoError();

  const existente = await obterConexao(userId);
  if (!existente) return null;

  // Com a sessão morta a Evolution recusa o logout; aí apaga a instância
  // (o próximo "Conectar" cria de novo e mostra o QR Code). Em qualquer caso
  // o sistema marca como desconectado — senão o botão nunca funcionaria.
  try {
    await desconectarInstancia(existente.instance_name);
  } catch (e) {
    console.error("Logout da instância WhatsApp falhou, apagando a instância:", e);
    await apagarInstancia(existente.instance_name).catch((erro) =>
      console.error("Também não foi possível apagar a instância:", erro),
    );
  }
  return upsertConexao(userId, existente.instance_name, {
    last_error: null,
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
  let erroEnvio: string | null = null;
  try {
    const resultado = await enviarMensagemTexto(conexao.instance_name, numeroCompleto, texto);
    evolutionMessageId = resultado.messageId;
  } catch (e) {
    status = "falhou";
    if (!(e instanceof EvolutionApiError)) throw e;
    erroEnvio = e.message;
    console.error("Falha ao enviar mensagem WhatsApp via Evolution API:", e.message);
  }
  await registrarSaudeEnvio(conexao, erroEnvio);

  const { data, error } = await supabaseAdmin

    .from("whatsapp_messages")
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

    .from("os_historico")
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
    await registrarSaudeEnvio(params.conexao, erroTexto);
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

      .from("whatsapp_messages")
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

    .from("whatsapp_messages")
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
 * opportunistically every 10 minutes while the system is open (AppShell). Silently
 * no-ops (leaves rows as "agendado") if the empresa's WhatsApp isn't
 * connected, so nothing is lost — it just waits for the next run.
 */
export async function processarNotificacoesAgendadasOs(userId: string): Promise<number> {
  if (!evolutionConfigurado()) return 0;

  const { data: pendentes, error } = await supabaseAdmin

    .from("whatsapp_messages")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "agendado")
    .lte("scheduled_at", new Date().toISOString());
  if (error || !pendentes?.length) return 0;

  const conexao = await obterConexao(userId);
  if (!conexao || conexao.status !== "conectado") return 0;

  let processadas = 0;
  for (const msg of pendentes) {
    if (!msg.os_id) continue;
    // Reserva a mensagem (agendado → pendente) antes de enviar: com duas
    // telas abertas, só quem conseguir a reserva envia.
    const { data: reservada } = await supabaseAdmin

      .from("whatsapp_messages")
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

      .from("whatsapp_messages")
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
  direcao: "todas" | "inbound" | "outbound" = "todas",
  limite = 50,
): Promise<WhatsappMensagem[]> {
  let consulta = supabaseAdmin

    .from("whatsapp_messages")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limite);
  if (direcao !== "todas") consulta = consulta.eq("direction", direcao);
  const { data, error } = await consulta;
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

    .from("whatsapp_connections")
    .select("id, user_id")
    .eq("instance_name", params.instanceName)
    .maybeSingle();
  if (erroConexao) throw erroConexao;
  if (!conexao) return { ok: false, motivo: "Instância desconhecida — nenhuma empresa vinculada." };

  const row = conexao as unknown as { id: string; user_id: string };
  const { data: inserida, error } = await supabaseAdmin

    .from("whatsapp_messages")
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
    })
    .select("id, created_at")
    .single();
  // Idempotent on evolution_message_id: a duplicate webhook delivery hits
  // the partial unique index and is silently ignored, not an error.
  if (error && error.code !== "23505") throw error;

  // Resposta a uma pesquisa de satisfação? O Gemini pode levar alguns
  // segundos, então roda depois de responder ao webhook (o Evolution não
  // espera nem reenvia por isso).
  const recebida = inserida as unknown as { id: string; created_at: string } | null;
  if (recebida && params.texto?.trim()) {
    void processarRespostaPesquisa({
      empresaId: row.user_id,
      mensagemId: recebida.id,
      recebidaEm: recebida.created_at,
      numero: params.numero,
      texto: params.texto,
    }).catch((e) =>
      console.error(
        "[ia-pesquisa] falha ao processar resposta:",
        e instanceof Error ? e.message : e,
      ),
    );
  }
  return { ok: true };
}

// Mesmo telefone mesmo com/sem 55 e com/sem o nono dígito: o WhatsApp
// devolve 557498125994 para o número cadastrado como 74 99812-5994.
function chaveTelefone(numero: string): string {
  let d = numero.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  return d.length >= 10 ? `${d.slice(0, 2)}${d.slice(-8)}` : d;
}

// Até quantos dias depois da pesquisa uma mensagem do cliente conta como
// resposta a ela.
const RESPOSTA_PESQUISA_DIAS = 7;

/**
 * Agente de IA da pesquisa (Configurações > WhatsApp, "IA: agradecer quem
 * responde a pesquisa", desligado por padrão). Quando o cliente responde à
 * última pesquisa que recebeu (pós-OS ou pós-venda, automática ou manual):
 *   - o Gemini classifica a resposta e ela fica gravada na mensagem e na OS;
 *   - elogio ou neutra: agradece uma única vez por pesquisa;
 *   - reclamação: não responde nada — vira aviso no sininho para a loja;
 *   - outro assunto: ignora e espera a próxima mensagem.
 * Não entra se a loja já mandou outra mensagem a esse cliente depois da
 * pesquisa (aí a conversa é com uma pessoa).
 */
export async function processarRespostaPesquisa(params: {
  empresaId: string;
  mensagemId: string;
  recebidaEm: string;
  numero: string;
  texto: string;
}): Promise<void> {
  const { data: config } = await supabaseAdmin

    .from("whatsapp_config")
    .select("ia_agradecer_pesquisa")
    .eq("user_id", params.empresaId)
    .maybeSingle();
  if (!(config as unknown as { ia_agradecer_pesquisa: boolean } | null)?.ia_agradecer_pesquisa) {
    return;
  }

  const chave = chaveTelefone(params.numero);
  const desde = new Date(
    new Date(params.recebidaEm).getTime() - RESPOSTA_PESQUISA_DIAS * 86400_000,
  ).toISOString();
  const { data: enviadas } = await supabaseAdmin

    .from("whatsapp_messages")
    .select("id, phone_number, contact_name, content, template_id, os_id, status, created_at")
    .eq("user_id", params.empresaId)
    .eq("direction", "outbound")
    .gte("created_at", desde)
    .lt("created_at", params.recebidaEm)
    .order("created_at", { ascending: false })
    .limit(500);
  type Enviada = {
    id: string;
    phone_number: string;
    contact_name: string | null;
    content: string | null;
    template_id: string | null;
    os_id: string | null;
    status: string;
    created_at: string;
  };
  const paraEsteCliente = ((enviadas ?? []) as unknown as Enviada[]).filter(
    (m) => m.status === "enviado" && chaveTelefone(m.phone_number) === chave,
  );
  const ultima = paraEsteCliente[0];
  const ehPesquisa = (t: string | null) =>
    t === "pesquisa_auto" || t === "pos_atendimento" || !!t?.startsWith("pos_venda_");
  if (!ultima || !ehPesquisa(ultima.template_id)) return;
  const pesquisa = ultima;

  const { data: jaRespondida } = await supabaseAdmin

    .from("whatsapp_messages")
    .select("id")
    .eq("pesquisa_msg_id", pesquisa.id)
    .maybeSingle();
  if (jaRespondida) return;

  // Primeiro nome: do cadastro da OS, senão o nome do contato no WhatsApp.
  let nomeCliente = pesquisa.contact_name ?? "";
  if (pesquisa.os_id) {
    const { data: os } = await supabaseAdmin
      .from("ordens_servico")
      .select("clientes(nome)")
      .eq("id", pesquisa.os_id)
      .maybeSingle();
    nomeCliente = os?.clientes?.nome ?? nomeCliente;
  }
  const primeiroNome = nomeCliente.trim().split(/\s+/)[0] ?? "";

  const loja = await nomeDaLoja(params.empresaId);
  const resultado = await avaliarRespostaPesquisa(params.empresaId, {
    loja,
    cliente: primeiroNome,
    pesquisa: pesquisa.content ?? "",
    resposta: params.texto,
  });
  if (!resultado || resultado.avaliacao === "outro") return;

  // Liga a resposta à pesquisa; o índice único barra um segundo webhook ou
  // uma segunda mensagem do cliente processada ao mesmo tempo.
  const { error: erroVinculo } = await supabaseAdmin

    .from("whatsapp_messages")
    .update({ avaliacao: resultado.avaliacao, pesquisa_msg_id: pesquisa.id })
    .eq("id", params.mensagemId);
  if (erroVinculo) {
    if (erroVinculo.code === "23505") return;
    throw erroVinculo;
  }

  const rotulo =
    resultado.avaliacao === "positiva"
      ? "elogio"
      : resultado.avaliacao === "neutra"
        ? "resposta neutra"
        : "reclamação";
  await registrarHistoricoOs(
    params.empresaId,
    pesquisa.os_id,
    "pesquisa_respondida",
    `Cliente respondeu à pesquisa (IA: ${rotulo}): "${params.texto.slice(0, 200)}"`,
    params.empresaId,
  );

  if (resultado.avaliacao === "reclamacao" || !resultado.agradecimento) return;
  const conexao = await obterConexao(params.empresaId);
  if (!conexao || conexao.status !== "conectado") return;
  const status = await enviarAutomatico({
    empresaId: params.empresaId,
    conexao,
    numeroCompleto: pesquisa.phone_number,
    nome: nomeCliente || null,
    mensagem: resultado.agradecimento,
    templateId: `agradecimento_${pesquisa.id}`,
    osId: pesquisa.os_id,
  });
  if (status === "enviado") {
    await registrarHistoricoOs(
      params.empresaId,
      pesquisa.os_id,
      "whatsapp_enviado",
      "Agradecimento pela pesquisa enviado pela IA",
      params.empresaId,
    );
  }
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
    .from("whatsapp_connections")
    .update({
      status,
      ...(phoneNumber != null ? { phone_number: phoneNumber } : {}),
      ...(status === "conectado"
        ? { qr_code: null, last_connected_at: new Date().toISOString() }
        : {}),
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

    .from("whatsapp_connections")
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

    .from("whatsapp_config")
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
  const cliente = os.clientes;
  const telefone = (cliente?.telefone ?? "").replace(/\D/g, "");
  if (telefone.length < 10) return { enviado: false, motivo: "sem_telefone" };

  const { count } = await supabaseAdmin

    .from("whatsapp_messages")
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
    .replace(/\{\{\s*loja\s*\}\}/g, await nomeDaLoja(params.empresaId))
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
// Brasília, porque o envio acontece com o sistema aberto (AppShell).
const PESQUISA_HORAS_MIN = 20;
const PESQUISA_DIAS_MAX = 7;

// Nome da loja (Configurações > Empresa) para a variável {{loja}}.
async function nomeDaLoja(empresaId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("loja, nome")
    .eq("id", empresaId)
    .maybeSingle();
  return (data?.loja || data?.nome || "nossa loja").trim();
}

function horaDeBrasilia(): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "America/Sao_Paulo",
    }).format(new Date()),
  );
}

const IA_PESQUISAS_POR_RODADA = 5;

// Serviços lançados em cada OS (os_itens tipo "servico"), para a IA citar.
async function servicosDasOrdens(osIds: string[]): Promise<Map<string, string>> {
  const { data } = await supabaseAdmin

    .from("os_itens")
    .select("os_id, descricao")
    .in("os_id", osIds)
    .eq("tipo", "servico");
  const mapa = new Map<string, string>();
  for (const item of (data ?? []) as unknown as { os_id: string; descricao: string | null }[]) {
    if (!item.descricao) continue;
    const atual = mapa.get(item.os_id);
    mapa.set(item.os_id, atual ? `${atual}, ${item.descricao}` : item.descricao);
  }
  return mapa;
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

    .from("whatsapp_config")
    .select(
      "notif_pesquisa_auto, notif_pesquisa_auto_desde, pesquisa_pos_os_texto, ia_pesquisa_personalizada",
    )
    .eq("user_id", empresaId)
    .maybeSingle();
  const cfg = config as unknown as {
    notif_pesquisa_auto: boolean;
    notif_pesquisa_auto_desde: string | null;
    pesquisa_pos_os_texto: string | null;
    ia_pesquisa_personalizada: boolean;
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

    .from("whatsapp_messages")
    .select("os_id")
    .in(
      "os_id",
      ordens.map((o) => o.id),
    )
    .in("template_id", ["pesquisa_auto", "pos_atendimento"]);
  const enviadas = new Set(
    ((jaEnviadas ?? []) as unknown as { os_id: string }[]).map((m) => m.os_id),
  );

  const loja = await nomeDaLoja(empresaId);
  const servicosPorOs = cfg.ia_pesquisa_personalizada
    ? await servicosDasOrdens(ordens.map((o) => o.id))
    : new Map<string, string>();
  // Cada pesquisa personalizada é uma chamada ao Gemini (limite gratuito por
  // minuto): poucas por rodada; as demais saem nas próximas, 10 min depois.
  let escritasPelaIA = 0;
  let enfileiradas = 0;
  for (const os of ordens) {
    if (enviadas.has(os.id)) continue;
    const cliente = os.clientes;
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
      .replace(/\{\{\s*loja\s*\}\}/g, loja)
      .replace(/Olá\s+([,!])/g, "Olá$1");

    let texto = mensagem;
    if (cfg.ia_pesquisa_personalizada) {
      if (escritasPelaIA >= IA_PESQUISAS_POR_RODADA) continue;
      escritasPelaIA++;
      const daIA = await escreverPesquisaPosOs(empresaId, {
        loja,
        cliente: primeiroNome,
        aparelho,
        servico: servicosPorOs.get(os.id) ?? "",
        numeroOs: os.numero,
        textoBase: mensagem,
      }).catch((e) => {
        console.error("[ia-pesquisa] falha ao escrever:", e instanceof Error ? e.message : e);
        return null;
      });
      // Sem IA (chave ausente, limite, erro) vai o texto fixo da loja.
      if (daIA) texto = daIA;
    }

    const { error } = await supabaseAdmin.from("whatsapp_messages").insert({
      user_id: empresaId,
      direction: "outbound",
      phone_number: paraE164BR(telefone),
      content: texto,
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
 * Brasília, com o sistema aberto (AppShell); uma por número por ano —
 * a linha é gravada antes do envio e o índice único barra a segunda tela.
 * Quem faz aniversário em 29/02 recebe em 28/02 nos anos não bissextos.
 */
export async function enviarAniversarios(empresaId: string): Promise<number> {
  if (!evolutionConfigurado()) return 0;
  const hora = horaDeBrasilia();
  if (hora < 9 || hora >= 20) return 0;

  const { data: config } = await supabaseAdmin

    .from("whatsapp_config")
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

  const loja = await nomeDaLoja(empresaId);
  let enviadas = 0;
  for (const cliente of aniversariantes.slice(0, 30)) {
    const telefone = (cliente.telefone ?? "").replace(/\D/g, "");
    if (telefone.length < 10) continue;
    const numeroCompleto = paraE164BR(telefone);
    const primeiroNome = (cliente.nome ?? "").trim().split(/\s+/)[0] || "";
    const mensagem = cfg.feliz_aniversario_texto
      .replace(/\{\{\s*cliente\s*\}\}/g, primeiroNome)
      .replace(/\{\{\s*(numero|status|tecnico)\s*\}\}/g, "")
      .replace(/\{\{\s*loja\s*\}\}/g, loja)
      .replace(/Parabéns\s*,?\s*!/g, "Parabéns!");

    const resultado = await enviarAutomatico({
      empresaId,
      conexao,
      numeroCompleto,
      nome: cliente.nome,
      mensagem,
      templateId: `aniversario_${ano}`,
    });
    if (resultado === "enviado") enviadas++;
  }
  return enviadas;
}

/**
 * Envio das mensagens automáticas sem OS (aniversário, pós-venda): grava a
 * linha como "pendente" antes de enviar — o índice único do template barra
 * a segunda tela aberta — e depois registra o resultado.
 */
async function enviarAutomatico(params: {
  empresaId: string;
  conexao: { id: string; instance_name: string; status: string };
  numeroCompleto: string;
  nome: string | null;
  mensagem: string;
  templateId: string;
  osId?: string | null;
}): Promise<"enviado" | "falhou" | "repetida"> {
  const { data: reserva, error } = await supabaseAdmin

    .from("whatsapp_messages")
    .insert({
      user_id: params.empresaId,
      connection_id: params.conexao.id,
      direction: "outbound",
      phone_number: params.numeroCompleto,
      contact_name: params.nome,
      content: params.mensagem,
      status: "pendente",
      template_id: params.templateId,
      os_id: params.osId ?? null,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return "repetida";
    throw error;
  }

  let status: "enviado" | "falhou" = "enviado";
  let evolutionMessageId: string | null = null;
  let erro: string | null = null;
  try {
    const resultado = await enviarMensagemTexto(
      params.conexao.instance_name,
      params.numeroCompleto,
      params.mensagem,
    );
    evolutionMessageId = resultado.messageId;
  } catch (e) {
    status = "falhou";
    erro = e instanceof Error ? e.message : String(e);
  }
  await registrarSaudeEnvio(params.conexao, erro);
  await supabaseAdmin

    .from("whatsapp_messages")
    .update({ status, evolution_message_id: evolutionMessageId, error: erro })
    .eq("id", (reserva as unknown as { id: string }).id);
  return status;
}

/**
 * Pesquisa pós-venda automática (Configurações > WhatsApp, desligada por
 * padrão): uma mensagem por venda finalizada/faturada com cliente, entre 20 h
 * e 7 dias depois da venda e só para vendas feitas depois de ligar a opção.
 * Das 9h às 20h de Brasília, com o sistema aberto (AppShell).
 */
export async function enviarPesquisasPosVenda(empresaId: string): Promise<number> {
  if (!evolutionConfigurado()) return 0;
  const hora = horaDeBrasilia();
  if (hora < 9 || hora >= 20) return 0;

  const { data: config } = await supabaseAdmin

    .from("whatsapp_config")
    .select("notif_pesquisa_venda_auto, notif_pesquisa_venda_auto_desde, pesquisa_pos_venda_texto")
    .eq("user_id", empresaId)
    .maybeSingle();
  const cfg = config as unknown as {
    notif_pesquisa_venda_auto: boolean;
    notif_pesquisa_venda_auto_desde: string | null;
    pesquisa_pos_venda_texto: string | null;
  } | null;
  if (
    !cfg?.notif_pesquisa_venda_auto ||
    !cfg.notif_pesquisa_venda_auto_desde ||
    !cfg.pesquisa_pos_venda_texto?.trim()
  ) {
    return 0;
  }

  const agora = Date.now();
  const limiteRecente = new Date(agora - PESQUISA_HORAS_MIN * 3600_000).toISOString();
  const limiteAntigo = new Date(
    Math.max(
      agora - PESQUISA_DIAS_MAX * 86400_000,
      new Date(cfg.notif_pesquisa_venda_auto_desde).getTime(),
    ),
  ).toISOString();

  const { data: vendas } = await supabaseAdmin
    .from("vendas")
    .select("id, numero, clientes(nome, telefone)")
    .eq("user_id", empresaId)
    .in("status", ["finalizado", "faturado"])
    .not("cliente_id", "is", null)
    .gte("created_at", limiteAntigo)
    .lte("created_at", limiteRecente)
    .limit(30);
  if (!vendas?.length) return 0;

  const { data: jaEnviadas } = await supabaseAdmin

    .from("whatsapp_messages")
    .select("template_id")
    .eq("user_id", empresaId)
    .in(
      "template_id",
      vendas.map((v) => `pos_venda_${v.id}`),
    );
  const enviadas = new Set(
    ((jaEnviadas ?? []) as unknown as { template_id: string }[]).map((m) => m.template_id),
  );

  const conexao = await obterConexao(empresaId);
  if (!conexao || conexao.status !== "conectado") return 0;

  const loja = await nomeDaLoja(empresaId);
  let total = 0;
  for (const venda of vendas) {
    const templateId = `pos_venda_${venda.id}`;
    if (enviadas.has(templateId)) continue;
    const cliente = venda.clientes;
    const telefone = (cliente?.telefone ?? "").replace(/\D/g, "");
    if (telefone.length < 10) continue;
    const primeiroNome = (cliente?.nome ?? "").trim().split(/\s+/)[0] || "";
    const mensagem = cfg.pesquisa_pos_venda_texto
      .replace(/\{\{\s*cliente\s*\}\}/g, primeiroNome)
      .replace(/\{\{\s*numero\s*\}\}/g, String(venda.numero ?? ""))
      .replace(/\{\{\s*(status|tecnico)\s*\}\}/g, "")
      .replace(/\{\{\s*loja\s*\}\}/g, loja)
      .replace(/Olá\s+([,!])/g, "Olá$1");
    const resultado = await enviarAutomatico({
      empresaId,
      conexao,
      numeroCompleto: paraE164BR(telefone),
      nome: cliente?.nome ?? null,
      mensagem,
      templateId,
    });
    if (resultado === "enviado") total++;
  }
  return total;
}

/**
 * Boas-vindas automáticas (Configurações > WhatsApp, desligada por padrão)
 * para clientes cadastrados com telefone depois de ligar a opção — de
 * qualquer tela (Clientes, OS, PDV). Uma por cliente, das 9h às 20h, quando
 * o sistema está aberto; quem foi cadastrado à noite recebe no dia
 * seguinte, até 7 dias depois do cadastro.
 */
export async function enviarBoasVindas(empresaId: string): Promise<number> {
  if (!evolutionConfigurado()) return 0;
  const hora = horaDeBrasilia();
  if (hora < 9 || hora >= 20) return 0;

  const { data: config } = await supabaseAdmin

    .from("whatsapp_config")
    .select("notif_boas_vindas_auto, notif_boas_vindas_auto_desde, boas_vindas_texto")
    .eq("user_id", empresaId)
    .maybeSingle();
  const cfg = config as unknown as {
    notif_boas_vindas_auto: boolean;
    notif_boas_vindas_auto_desde: string | null;
    boas_vindas_texto: string | null;
  } | null;
  if (
    !cfg?.notif_boas_vindas_auto ||
    !cfg.notif_boas_vindas_auto_desde ||
    !cfg.boas_vindas_texto?.trim()
  ) {
    return 0;
  }

  const limiteAntigo = new Date(
    Math.max(
      Date.now() - PESQUISA_DIAS_MAX * 86400_000,
      new Date(cfg.notif_boas_vindas_auto_desde).getTime(),
    ),
  ).toISOString();
  const { data: clientes } = await supabaseAdmin
    .from("clientes")
    .select("id, nome, telefone")
    .eq("user_id", empresaId)
    .not("telefone", "is", null)
    .gte("created_at", limiteAntigo)
    .order("created_at", { ascending: false })
    .limit(30);
  if (!clientes?.length) return 0;

  const { data: jaEnviadas } = await supabaseAdmin

    .from("whatsapp_messages")
    .select("template_id")
    .eq("user_id", empresaId)
    .in(
      "template_id",
      clientes.map((c) => `boas_vindas_${c.id}`),
    );
  const enviadas = new Set(
    ((jaEnviadas ?? []) as unknown as { template_id: string }[]).map((m) => m.template_id),
  );

  const conexao = await obterConexao(empresaId);
  if (!conexao || conexao.status !== "conectado") return 0;

  const loja = await nomeDaLoja(empresaId);
  let total = 0;
  for (const cliente of clientes) {
    const templateId = `boas_vindas_${cliente.id}`;
    if (enviadas.has(templateId)) continue;
    const telefone = (cliente.telefone ?? "").replace(/\D/g, "");
    if (telefone.length < 10) continue;
    const primeiroNome = (cliente.nome ?? "").trim().split(/\s+/)[0] || "";
    const mensagem = cfg.boas_vindas_texto
      .replace(/\{\{\s*cliente\s*\}\}/g, primeiroNome)
      .replace(/\{\{\s*loja\s*\}\}/g, loja)
      .replace(/\{\{\s*(numero|status|tecnico)\s*\}\}/g, "")
      .replace(/Olá\s+([,!])/g, "Olá$1");
    const resultado = await enviarAutomatico({
      empresaId,
      conexao,
      numeroCompleto: paraE164BR(telefone),
      nome: cliente.nome,
      mensagem,
      templateId,
    });
    if (resultado === "enviado") total++;
  }
  return total;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Resumo semanal da loja (Configurações > WhatsApp, desligado por padrão)
 * para o número do dono — o informado na configuração ou o WhatsApp do
 * cadastro da empresa. Cobre a semana anterior (segunda a domingo, horário
 * de Brasília) e sai a partir de segunda às 9h, na primeira rodada da semana; um por semana.
 */
export async function enviarRelatorioSemanal(empresaId: string): Promise<boolean> {
  if (!evolutionConfigurado()) return false;
  const hora = horaDeBrasilia();
  if (hora < 9 || hora >= 20) return false;

  const { data: config } = await supabaseAdmin

    .from("whatsapp_config")
    .select("notif_relatorio_auto, relatorio_numero")
    .eq("user_id", empresaId)
    .maybeSingle();
  const cfg = config as unknown as {
    notif_relatorio_auto: boolean;
    relatorio_numero: string | null;
  } | null;
  if (!cfg?.notif_relatorio_auto) return false;

  // Segunda-feira 00:00 desta semana em Brasília (UTC-3, sem horário de verão).
  const { ano, mesDia } = hojeEmBrasilia();
  const hoje = new Date(`${ano}-${mesDia}T00:00:00-03:00`);
  const diasDesdeSegunda = (hoje.getUTCDay() + 6) % 7; // 03:00 UTC cai no mesmo dia
  const fim = new Date(hoje.getTime() - diasDesdeSegunda * 86400_000);
  const inicio = new Date(fim.getTime() - 7 * 86400_000);
  const segunda = new Date(fim.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
  const templateId = `relatorio_semanal_${segunda}`;

  const { count } = await supabaseAdmin

    .from("whatsapp_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", empresaId)
    .eq("template_id", templateId);
  if (count) return false;

  const { data: perfil } = await supabaseAdmin
    .from("profiles")
    .select("whatsapp")
    .eq("id", empresaId)
    .maybeSingle();
  const telefone = (cfg.relatorio_numero || perfil?.whatsapp || "").replace(/\D/g, "");
  if (telefone.length < 10) return false;

  const conexao = await obterConexao(empresaId);
  if (!conexao || conexao.status !== "conectado") return false;

  const { data: dados, error } = await supabaseAdmin.rpc("relatorio_semanal_dados", {
    p_empresa_id: empresaId,
    p_inicio: inicio.toISOString(),
    p_fim: fim.toISOString(),
  });
  if (error) throw error;
  const d = dados as Record<string, number>;
  const n = (k: string) => Number(d?.[k] ?? 0);

  const dia = (t: Date) =>
    t.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
  const ultimoDia = new Date(fim.getTime() - 86400_000);
  const resultado = n("receitas") - n("despesas");
  const linhas = [
    `📊 *Resumo da semana — ${await nomeDaLoja(empresaId)}*`,
    `${dia(inicio)} a ${dia(ultimoDia)}`,
    "",
    "*Ordens de serviço*",
    `• Abertas na semana: ${n("os_abertas")}`,
    `• Entregues: ${n("os_entregues")}`,
    `• Faturado em OS: ${brl(n("faturamento_os"))}`,
    `• Em andamento agora: ${n("os_em_andamento")} (prontas para retirar: ${n("os_prontas")})`,
    "",
    "*Vendas*",
    `• ${n("vendas_qtd")} venda(s): ${brl(n("vendas_total"))}`,
    "",
    "*Financeiro (pago)*",
    `• Entradas: ${brl(n("receitas"))}`,
    `• Saídas: ${brl(n("despesas"))}`,
    `• Resultado: ${brl(resultado)}`,
  ];
  if (n("a_receber_vencido") > 0)
    linhas.push(`• A receber vencido: ${brl(n("a_receber_vencido"))}`);
  linhas.push("", `👥 Clientes novos: ${n("clientes_novos")}`);
  if (n("estoque_baixo") > 0) linhas.push(`📦 Produtos no estoque mínimo: ${n("estoque_baixo")}`);

  const envio = await enviarAutomatico({
    empresaId,
    conexao,
    numeroCompleto: paraE164BR(telefone),
    nome: null,
    mensagem: linhas.join("\n"),
    templateId,
  });
  return envio === "enviado";
}

// A empresa do operador do site (conta do /admin): é por ela que saem os
// avisos da plataforma (pedidos e pagamentos de plano). Resolvida uma vez.
let empresaDoOperador: string | null = null;
async function obterEmpresaDoOperador(): Promise<string | null> {
  if (empresaDoOperador) return empresaDoOperador;
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  empresaDoOperador = data.users.find((u) => u.email === SITE_ADMIN_EMAIL)?.id ?? null;
  return empresaDoOperador;
}

/**
 * Avisa o dono da plataforma no WhatsApp (pedido de plano, plano pago,
 * renovação). Sai pela conexão de WhatsApp da empresa do operador para o
 * "número do dono" de Configurações > WhatsApp (o mesmo do resumo semanal).
 * `templateId` único por acontecimento evita aviso repetido quando o
 * Mercado Pago reenvia o webhook. Nunca lança: o aviso não pode atrapalhar o
 * pedido ou o pagamento que o originou.
 */
export async function avisarDonoDaPlataforma(templateId: string, mensagem: string): Promise<void> {
  try {
    if (!evolutionConfigurado()) return;
    const empresaId = await obterEmpresaDoOperador();
    if (!empresaId) return;

    const [{ data: config }, { data: perfil }] = await Promise.all([
      supabaseAdmin
        .from("whatsapp_config")
        .select("relatorio_numero")
        .eq("user_id", empresaId)
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("whatsapp").eq("id", empresaId).maybeSingle(),
    ]);
    const telefone = (config?.relatorio_numero || perfil?.whatsapp || "").replace(/\D/g, "");
    if (telefone.length < 10) {
      console.warn("[Aviso plataforma] Sem número do dono em Configurações > WhatsApp.");
      return;
    }

    const conexao = await obterConexao(empresaId);
    if (!conexao || conexao.status !== "conectado") {
      console.warn("[Aviso plataforma] WhatsApp da empresa do operador desconectado.");
      return;
    }

    const envio = await enviarAutomatico({
      empresaId,
      conexao,
      numeroCompleto: paraE164BR(telefone),
      nome: null,
      mensagem,
      templateId,
    });
    if (envio === "falhou") console.warn(`[Aviso plataforma] Falha ao enviar ${templateId}.`);
  } catch (erro) {
    console.error("[Aviso plataforma] Erro ao avisar o dono:", erro);
  }
}

export type ReclamacaoPesquisa = {
  id: string;
  phone_number: string;
  contact_name: string | null;
  content: string | null;
  created_at: string;
};

/**
 * Reclamações recebidas na pesquisa (classificadas pela IA) que ainda pedem
 * atenção: some do sininho quando marcada como resolvida ou quando a loja
 * manda qualquer mensagem a esse cliente depois da reclamação.
 */
export async function listarReclamacoesPesquisa(empresaId: string): Promise<ReclamacaoPesquisa[]> {
  const desde = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data } = await supabaseAdmin

    .from("whatsapp_messages")
    .select("id, phone_number, contact_name, content, created_at")
    .eq("user_id", empresaId)
    .eq("avaliacao", "reclamacao")
    .eq("avaliacao_resolvida", false)
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(20);
  const reclamacoes = (data ?? []) as unknown as ReclamacaoPesquisa[];
  if (!reclamacoes.length) return [];

  const { data: respostas } = await supabaseAdmin

    .from("whatsapp_messages")
    .select("phone_number, created_at")
    .eq("user_id", empresaId)
    .eq("direction", "outbound")
    .eq("status", "enviado")
    .gte("created_at", reclamacoes[reclamacoes.length - 1]!.created_at)
    .limit(500);
  const ultimaResposta = new Map<string, string>();
  for (const r of (respostas ?? []) as unknown as { phone_number: string; created_at: string }[]) {
    const chave = chaveTelefone(r.phone_number);
    if ((ultimaResposta.get(chave) ?? "") < r.created_at) ultimaResposta.set(chave, r.created_at);
  }
  return reclamacoes.filter(
    (r) => (ultimaResposta.get(chaveTelefone(r.phone_number)) ?? "") <= r.created_at,
  );
}

export async function resolverReclamacaoPesquisa(empresaId: string, id: string): Promise<void> {
  const { error } = await supabaseAdmin

    .from("whatsapp_messages")
    .update({ avaliacao_resolvida: true })
    .eq("id", id)
    .eq("user_id", empresaId)
    .eq("avaliacao", "reclamacao");
  if (error) throw error;
}
