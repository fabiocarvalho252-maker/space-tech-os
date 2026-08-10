// Orchestrates the Evolution API client (evolution-api.ts) with our own
// whatsapp_connections/whatsapp_messages tables. Server-only. Every function
// here takes an already-authenticated `userId` (the empresa identifier, same
// convention as every other table in this project) resolved by the caller
// from the Supabase session — this module never trusts a caller-supplied
// empresa id, and always uses supabaseAdmin (service role) scoped by an
// explicit `.eq("user_id", userId)` rather than relying on a user JWT, since
// some callers (the webhook) have no user session at all.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  EvolutionApiError,
  conectarInstancia,
  criarInstancia,
  desconectarInstancia,
  enviarMensagemTexto,
  evolutionConfigurado,
  nomeInstancia,
  statusInstancia,
} from "./evolution-api";
import type { JsonValue, WhatsappConexao, WhatsappMensagem } from "./types";

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

export async function listarMensagensRecentes(
  userId: string,
  limite = 50,
): Promise<WhatsappMensagem[]> {
  const { data, error } = await supabaseAdmin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in the generated Database type yet, see types.ts header
    .from("whatsapp_messages" as any)
    .select("*")
    .eq("user_id", userId)
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
