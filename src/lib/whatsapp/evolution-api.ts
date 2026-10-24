// Thin, low-level HTTP client for a self-hosted Evolution API server
// (https://github.com/EvolutionAPI/evolution-api). Server-only — this file
// reads EVOLUTION_API_KEY from process.env and must never be imported from a
// route component or anything bundled to the client. Only whatsapp-service.ts
// (also server-only) talks to this module.
//
// Every function here maps 1:1 to one Evolution API REST call. Endpoint
// paths/payload shapes below match the documented v2 contract as of this
// writing; self-hosted Evolution API versions do drift on field names
// (e.g. some deployments nest the webhook config directly, others under a
// "webhook" key) — if a call starts failing after pointing this at a real
// server, the fix is almost always adjusting the body shape in the one
// function below that builds it, not the calling code.

export class EvolutionApiError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = "EvolutionApiError";
  }
}

type EvolutionConfig = { baseUrl: string; apiKey: string; instancePrefix: string };

function configuracao(): EvolutionConfig | null {
  const baseUrl = process.env["EVOLUTION_API_URL"];
  const apiKey = process.env["EVOLUTION_API_KEY"];
  const instancePrefix = process.env["EVOLUTION_INSTANCE"] || "spacetech";
  if (!baseUrl || !apiKey) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey, instancePrefix };
}

/** Whether EVOLUTION_API_URL/EVOLUTION_API_KEY are set — safe to call to gate UI/logic without attempting a request. */
export function evolutionConfigurado(): boolean {
  return configuracao() !== null;
}

/** Deterministic per-empresa instance name: `<prefix>_<userId sem hifens>`. */
export function nomeInstancia(userId: string): string {
  const { instancePrefix } = configuracao() ?? { instancePrefix: "spacetech" };
  return `${instancePrefix}_${userId.replace(/-/g, "")}`;
}

async function chamar<T>(
  config: EvolutionConfig,
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers: {
        apikey: config.apiKey,
        "content-type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : null,
    });
  } catch {
    throw new EvolutionApiError("Não foi possível conectar ao servidor Evolution API.");
  }

  // Only 401 unambiguously means "the API key itself was rejected" — Evolution
  // API also uses 403 for ordinary validation failures (e.g. "instance name
  // already in use"), which criarInstancia() needs to see the real message
  // for so it can tell that case apart from an actual failure.
  if (res.status === 401) {
    throw new EvolutionApiError(
      "Evolution API recusou a chave configurada (EVOLUTION_API_KEY inválida).",
    );
  }
  if (!res.ok) {
    const corpo = await res.text().catch(() => "");
    throw new EvolutionApiError(
      `Evolution API retornou um erro (${res.status}): ${corpo.slice(0, 300) || "sem detalhes"}`,
    );
  }

  return (await res.json()) as T;
}

export type EvolutionCreateInstanceResult = {
  qrcodeBase64: string | null;
};

/**
 * Creates (or, if it already exists on the Evolution server, no-ops on) the
 * instance for this empresa and points its webhook at our server. Safe to
 * call every time a connect is requested — Evolution treats a duplicate
 * instanceName as a normal "already exists" error, which is swallowed here.
 */
export async function criarInstancia(
  instanceName: string,
  webhookUrl: string,
): Promise<EvolutionCreateInstanceResult> {
  const config = configuracao();
  if (!config) throw new EvolutionApiError("Evolution API não configurada no servidor.");

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await chamar<any>(config, "POST", "/instance/create", {
      instanceName,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      webhook: {
        url: webhookUrl,
        byEvents: false,
        base64: true,
        // QRCODE_UPDATED matters as much as CONNECTION_UPDATE here: Baileys
        // rotates the pairing QR every ~20-60s, and without this event our
        // stored qr_code goes stale — the modal keeps showing an expired
        // code that WhatsApp silently rejects on scan.
        events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
      },
    });
    const base64 = data?.qrcode?.base64 ?? data?.qrcode ?? null;
    return { qrcodeBase64: typeof base64 === "string" ? base64 : null };
  } catch (e) {
    // Instance already exists on the Evolution server — not an error for
    // our purposes, just means we should fall through to /instance/connect.
    if (e instanceof EvolutionApiError && /already|exist|duplicat/i.test(e.message)) {
      return { qrcodeBase64: null };
    }
    throw e;
  }
}

export type EvolutionConnectResult = { qrcodeBase64: string | null };

/** Requests a fresh QR code / pairing code for an already-created instance. */
export async function conectarInstancia(instanceName: string): Promise<EvolutionConnectResult> {
  const config = configuracao();
  if (!config) throw new EvolutionApiError("Evolution API não configurada no servidor.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await chamar<any>(
    config,
    "GET",
    `/instance/connect/${encodeURIComponent(instanceName)}`,
  );
  const base64 = data?.base64 ?? data?.qrcode?.base64 ?? data?.qrcode ?? null;
  return { qrcodeBase64: typeof base64 === "string" ? base64 : null };
}

export type EvolutionConnectionState = "open" | "connecting" | "close";

export type EvolutionStatusResult = {
  state: EvolutionConnectionState;
  phoneNumber: string | null;
};

/**
 * Live connection state straight from Evolution/Baileys for this instance.
 * Uses /instance/fetchInstances (filtered by name) rather than
 * /instance/connectionState — confirmed against a real running server that
 * connectionState returns only `{ instance: { state } }` with no owner
 * info, while fetchInstances returns both `connectionStatus` and
 * `ownerJid` (the connected phone number) in a single call.
 */
export async function statusInstancia(instanceName: string): Promise<EvolutionStatusResult> {
  const config = configuracao();
  if (!config) throw new EvolutionApiError("Evolution API não configurada no servidor.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await chamar<any[]>(
    config,
    "GET",
    `/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`,
  );
  const registro = Array.isArray(data) ? data[0] : null;
  const state: string = registro?.connectionStatus ?? "close";
  const ownerJid = registro?.ownerJid;
  const phoneNumber = typeof ownerJid === "string" ? (ownerJid.split("@")[0] ?? null) : null;
  const normalizado: EvolutionConnectionState =
    state === "open" ? "open" : state === "connecting" ? "connecting" : "close";
  return { state: normalizado, phoneNumber };
}

/** Logs the instance out of WhatsApp (keeps the instance registered on Evolution, just disconnects the session). */
/**
 * Reinicia a sessão da instância sem sair da conta: reabre o socket com as
 * credenciais salvas, então não precisa ler o QR Code de novo. Resolve o
 * caso em que a instância diz "open" mas todo envio volta "Connection Closed".
 */
export async function reiniciarInstancia(instanceName: string): Promise<void> {
  const config = configuracao();
  if (!config) throw new EvolutionApiError("Evolution API não configurada no servidor.");
  await chamar(config, "POST", `/instance/restart/${encodeURIComponent(instanceName)}`);
}

/** Apaga a instância no servidor Evolution (usado quando o logout falha). */
export async function apagarInstancia(instanceName: string): Promise<void> {
  const config = configuracao();
  if (!config) throw new EvolutionApiError("Evolution API não configurada no servidor.");
  await chamar(config, "DELETE", `/instance/delete/${encodeURIComponent(instanceName)}`);
}

export async function desconectarInstancia(instanceName: string): Promise<void> {
  const config = configuracao();
  if (!config) throw new EvolutionApiError("Evolution API não configurada no servidor.");
  await chamar(config, "DELETE", `/instance/logout/${encodeURIComponent(instanceName)}`);
}

export type EvolutionSendResult = { messageId: string | null };

/** Sends a plain text message through the instance. */
/**
 * Celular brasileiro com e sem o 9 da frente: 55 + DDD + 9XXXXXXXX ↔
 * 55 + DDD + XXXXXXXX. Contas antigas (comum no Nordeste) continuam
 * registradas no WhatsApp sem o 9, e a Evolution responde "exists: false"
 * para o número com 9.
 */
function numeroAlternativoBR(numero: string): string | null {
  const m = /^55(\d{2})(\d+)$/.exec(numero);
  if (!m) return null;
  const ddd = m[1] ?? "";
  const resto = m[2] ?? "";
  if (resto.length === 9 && resto.startsWith("9")) return `55${ddd}${resto.slice(1)}`;
  if (resto.length === 8 && /^[6-9]/.test(resto)) return `55${ddd}9${resto}`;
  return null;
}

/**
 * Envia e, se falhar, tenta de novo uma vez: com o número sem/com o 9 quando
 * o WhatsApp diz que o número não existe, ou depois de 3 s quando a sessão
 * acabou de cair ("Connection Closed" — o Baileys costuma reconectar sozinho).
 */
async function enviarComNovaTentativa<T>(
  numero: string,
  enviar: (numero: string) => Promise<T>,
): Promise<T> {
  try {
    return await enviar(numero);
  } catch (e) {
    if (!(e instanceof EvolutionApiError)) throw e;
    if (/"exists"\s*:\s*false/.test(e.message)) {
      const alternativo = numeroAlternativoBR(numero);
      if (alternativo) return enviar(alternativo);
    } else if (/Connection Closed/i.test(e.message)) {
      await new Promise((r) => setTimeout(r, 3000));
      return enviar(numero);
    }
    throw e;
  }
}

export async function enviarMensagemTexto(
  instanceName: string,
  numero: string,
  texto: string,
): Promise<EvolutionSendResult> {
  const config = configuracao();
  if (!config) throw new EvolutionApiError("Evolution API não configurada no servidor.");

  const data = await enviarComNovaTentativa(numero, (n) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chamar<any>(config, "POST", `/message/sendText/${encodeURIComponent(instanceName)}`, {
      number: n,
      text: texto,
    }),
  );
  const messageId = data?.key?.id ?? null;
  return { messageId: typeof messageId === "string" ? messageId : null };
}

/** Sends a document (PDF, ...) as base64 through the instance's /message/sendMedia endpoint. */
export async function enviarMensagemMidia(
  instanceName: string,
  numero: string,
  params: { mediaBase64: string; mimetype: string; fileName: string; caption?: string },
): Promise<EvolutionSendResult> {
  const config = configuracao();
  if (!config) throw new EvolutionApiError("Evolution API não configurada no servidor.");

  const data = await enviarComNovaTentativa(numero, (n) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chamar<any>(config, "POST", `/message/sendMedia/${encodeURIComponent(instanceName)}`, {
      number: n,
      mediatype: "document",
      mimetype: params.mimetype,
      fileName: params.fileName,
      media: params.mediaBase64,
      ...(params.caption ? { caption: params.caption } : {}),
    }),
  );
  const messageId = data?.key?.id ?? null;
  return { messageId: typeof messageId === "string" ? messageId : null };
}
