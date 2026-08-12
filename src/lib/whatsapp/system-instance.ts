// The platform-owned Evolution API instance used only to send WhatsApp
// activation codes (see src/lib/auth/ativacao-whatsapp.functions.ts) —
// distinct from whatsapp-service.ts, which manages one instance per empresa
// (nomeInstancia()). This one has a single fixed name, is paired once by the
// SPACE TECH operator from the site-admin screen (/admin), and its
// connection state lives in whatsapp_system_connection (a singleton row),
// not whatsapp_connections. Server-only.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  EvolutionApiError,
  conectarInstancia,
  criarInstancia,
  desconectarInstancia,
  enviarMensagemTexto,
  evolutionConfigurado,
  statusInstancia,
} from "./evolution-api";

export const SYSTEM_INSTANCE_ID = "spacetech_system";
export const SYSTEM_INSTANCE_NAME = "spacetech_system";

export type WhatsappSistemaConexao = {
  id: string;
  instance_name: string;
  status: "desconectado" | "conectando" | "conectado" | "erro";
  phone_number: string | null;
  qr_code: string | null;
  last_connected_at: string | null;
  last_error: string | null;
};

export class WhatsappSistemaNaoConfiguradoError extends Error {
  constructor() {
    super(
      "Integração com a Evolution API ainda não foi configurada no servidor (veja .env.example).",
    );
    this.name = "WhatsappSistemaNaoConfiguradoError";
  }
}

async function obterConexao(): Promise<WhatsappSistemaConexao | null> {
  const { data, error } = await supabaseAdmin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in the generated Database type yet
    .from("whatsapp_system_connection" as any)
    .select("*")
    .eq("id", SYSTEM_INSTANCE_ID)
    .maybeSingle();
  if (error) throw error;
  return (data as WhatsappSistemaConexao | null) ?? null;
}

async function atualizarConexao(
  patch: Partial<WhatsappSistemaConexao>,
): Promise<WhatsappSistemaConexao> {
  const { data, error } = await supabaseAdmin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in the generated Database type yet
    .from("whatsapp_system_connection" as any)
    .update(patch)
    .eq("id", SYSTEM_INSTANCE_ID)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as WhatsappSistemaConexao;
}

export async function obterStatusSistemaSalvo(): Promise<WhatsappSistemaConexao | null> {
  return obterConexao();
}

function webhookUrlPara(origin: string): string {
  const token = process.env["EVOLUTION_WEBHOOK_TOKEN"] ?? "";
  const base = process.env["EVOLUTION_WEBHOOK_BASE_URL"] || origin;
  const url = new URL("/api/whatsapp/webhook", base);
  url.searchParams.set("instance", SYSTEM_INSTANCE_NAME);
  if (token) url.searchParams.set("token", token);
  return url.toString();
}

/** Starts (or resumes) pairing the system instance — same shape as whatsapp-service.ts's conectar(). */
export async function conectarSistema(origin: string): Promise<WhatsappSistemaConexao> {
  if (!evolutionConfigurado()) throw new WhatsappSistemaNaoConfiguradoError();

  const webhookUrl = webhookUrlPara(origin);
  try {
    const criado = await criarInstancia(SYSTEM_INSTANCE_NAME, webhookUrl);
    let qrcode = criado.qrcodeBase64;
    if (!qrcode) {
      const conectado = await conectarInstancia(SYSTEM_INSTANCE_NAME);
      qrcode = conectado.qrcodeBase64;
    }
    return atualizarConexao({ status: "conectando", qr_code: qrcode, last_error: null });
  } catch (e) {
    const motivo =
      e instanceof EvolutionApiError ? e.message : "Falha ao conectar com a Evolution API.";
    await atualizarConexao({ status: "erro", last_error: motivo });
    throw e;
  }
}

/** Refreshes live status from Evolution and syncs it into whatsapp_system_connection. */
export async function atualizarStatusSistema(): Promise<WhatsappSistemaConexao | null> {
  if (!evolutionConfigurado()) throw new WhatsappSistemaNaoConfiguradoError();

  const existente = await obterConexao();
  if (!existente) return null;

  const resultado = await statusInstancia(existente.instance_name);
  const status =
    resultado.state === "open"
      ? "conectado"
      : resultado.state === "connecting"
        ? "conectando"
        : "desconectado";

  return atualizarConexao({
    status,
    phone_number: resultado.phoneNumber ?? existente.phone_number,
    qr_code: status === "conectado" ? null : existente.qr_code,
    last_connected_at:
      status === "conectado" ? new Date().toISOString() : existente.last_connected_at,
    last_error: null,
  });
}

export async function desconectarSistema(): Promise<WhatsappSistemaConexao | null> {
  if (!evolutionConfigurado()) throw new WhatsappSistemaNaoConfiguradoError();

  const existente = await obterConexao();
  if (!existente) return null;

  await desconectarInstancia(existente.instance_name);
  return atualizarConexao({ status: "desconectado", qr_code: null, phone_number: null });
}

function paraE164BR(numero: string): string {
  return numero.startsWith("55") && numero.length > 11 ? numero : `55${numero}`;
}

/**
 * Applies a CONNECTION_UPDATE webhook event for the system instance — called
 * from the raw HTTP webhook handler, which routes here (rather than to
 * whatsapp-service.ts's per-empresa equivalent) whenever instanceName is
 * SYSTEM_INSTANCE_NAME.
 */
export async function aplicarAtualizacaoWebhookSistema(
  state: "open" | "connecting" | "close",
  phoneNumber: string | null,
): Promise<void> {
  const status =
    state === "open" ? "conectado" : state === "connecting" ? "conectando" : "desconectado";
  const patch: Partial<WhatsappSistemaConexao> = { status };
  if (phoneNumber) patch.phone_number = phoneNumber;
  if (status === "conectado") {
    patch.qr_code = null;
    patch.last_connected_at = new Date().toISOString();
  }
  await atualizarConexao(patch);
}

/**
 * Applies a QRCODE_UPDATED webhook event for the system instance — see
 * whatsapp-service.ts's aplicarQrCodeWebhook for why this matters (Baileys
 * rotates the pairing QR every ~20-60s).
 */
export async function aplicarQrCodeWebhookSistema(qrcodeBase64: string): Promise<void> {
  await atualizarConexao({ qr_code: qrcodeBase64, status: "conectando" });
}

/**
 * Sends a plain-text WhatsApp message (the activation OTP) through the
 * system instance. Throws WhatsappSistemaNaoConfiguradoError /
 * EvolutionApiError on failure — callers map that to the friendly "não foi
 * possível enviar o código" message, never surfacing raw backend errors.
 */
export async function enviarMensagemSistema(numero: string, texto: string): Promise<void> {
  if (!evolutionConfigurado()) throw new WhatsappSistemaNaoConfiguradoError();

  const conexao = await obterConexao();
  if (!conexao || conexao.status !== "conectado") {
    throw new Error("WhatsApp do sistema não está conectado.");
  }

  await enviarMensagemTexto(conexao.instance_name, paraE164BR(numero), texto);
}
