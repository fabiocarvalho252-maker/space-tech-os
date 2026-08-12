// Handles POST /api/whatsapp/webhook — the one WhatsApp endpoint that is NOT
// a createServerFn. Every other endpoint in src/lib/whatsapp/whatsapp.functions.ts
// is same-origin RPC called by our own authenticated frontend, protected by
// this app's CSRF middleware (src/start.ts) and requireSupabaseAuth. This
// one is the opposite: it must be reachable by the external Evolution API
// server, which has no Supabase session and no same-origin browser context,
// so it can't go through either of those. It is wired directly into
// src/server.ts (see the comment there) and authenticates the caller with
// its own shared-secret token instead.
//
// SECURITY: never log the raw request body (may contain message content)
// beyond what's needed for a terse error, and never log EVOLUTION_WEBHOOK_TOKEN.
import {
  registrarMensagemRecebida,
  aplicarAtualizacaoConexaoWebhook,
  aplicarQrCodeWebhook,
} from "./whatsapp-service";
import {
  SYSTEM_INSTANCE_NAME,
  aplicarAtualizacaoWebhookSistema,
  aplicarQrCodeWebhookSistema,
} from "./system-instance";

function tokenValido(url: URL): boolean {
  const esperado = process.env["EVOLUTION_WEBHOOK_TOKEN"];
  // If no token is configured, fail closed — an unauthenticated webhook
  // would let anyone inject fake "received" messages tied to a guessed
  // instance name.
  if (!esperado) return false;
  return url.searchParams.get("token") === esperado;
}

// Evolution API's webhook payload shape isn't in our control and drifts
// across self-hosted versions — these two helpers read it defensively
// (unknown in, narrowed out) instead of trusting/typing it as `any`.
function objeto(valor: unknown): Record<string, unknown> {
  return valor != null && typeof valor === "object" ? (valor as Record<string, unknown>) : {};
}

function texto(valor: unknown): string | undefined {
  return typeof valor === "string" ? valor : undefined;
}

function extrairTextoMensagem(mensagem: unknown): string | null {
  const m = objeto(mensagem);
  return (
    texto(m["conversation"]) ??
    texto(objeto(m["extendedTextMessage"])["text"]) ??
    texto(m["body"]) ??
    null
  );
}

export async function handleWhatsappWebhook(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (!tokenValido(url)) {
    return new Response("Forbidden", { status: 403 });
  }

  const instanceFromQuery = url.searchParams.get("instance");
  if (!instanceFromQuery) {
    return new Response("Missing instance", { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const raiz = objeto(payload);

  // Belt-and-suspenders: the query string identifies which of our
  // registered webhooks this is, but the payload's own "instance" field
  // (when present) must agree — otherwise reject rather than guess.
  const instanceFromPayload = texto(raiz["instance"]);
  if (instanceFromPayload && instanceFromPayload !== instanceFromQuery) {
    return new Response("Instance mismatch", { status: 400 });
  }
  const instanceName = instanceFromQuery;

  try {
    const event = texto(raiz["event"]) ?? "";

    if (event.toUpperCase().includes("MESSAGES_UPSERT") || event === "messages.upsert") {
      const data = objeto(raiz["data"]);
      const key = objeto(data["key"]);
      if (key["fromMe"] === true) {
        // Echo of our own outgoing message — already logged by
        // enviarMensagem(), skip to avoid a duplicate row.
        return new Response("ok", { status: 200 });
      }
      const remoteJid = texto(key["remoteJid"]);
      const numero = remoteJid?.split("@")[0] ?? "desconhecido";
      const conteudo = extrairTextoMensagem(data["message"]);
      const evolutionMessageId = texto(key["id"]) ?? null;
      const nomeContato = texto(data["pushName"]) ?? null;

      await registrarMensagemRecebida({
        instanceName,
        numero,
        nomeContato,
        texto: conteudo,
        evolutionMessageId,
        metadata: { event },
      });
    } else if (event.toUpperCase().includes("CONNECTION_UPDATE") || event === "connection.update") {
      const data = objeto(raiz["data"]);
      const stateRaw = texto(data["state"]) ?? texto(objeto(data["instance"])["state"]) ?? "close";
      const state =
        stateRaw === "open" ? "open" : stateRaw === "connecting" ? "connecting" : "close";
      const wuid = texto(data["wuid"]);
      const phoneNumber = (wuid ? wuid.split("@")[0] : texto(data["number"])) ?? null;
      if (instanceName === SYSTEM_INSTANCE_NAME) {
        await aplicarAtualizacaoWebhookSistema(state, phoneNumber);
      } else {
        await aplicarAtualizacaoConexaoWebhook(instanceName, state, phoneNumber);
      }
    } else if (event.toUpperCase().includes("QRCODE_UPDATED") || event === "qrcode.updated") {
      // Baileys rotates the pairing QR every ~20-60s — without applying
      // this event, whatever QR was stored at connect-time goes stale and
      // every scan after that first window silently fails.
      const data = objeto(raiz["data"]);
      const base64 =
        texto(objeto(data["qrcode"])["base64"]) ?? texto(data["base64"]) ?? texto(data["qrcode"]);
      if (base64) {
        if (instanceName === SYSTEM_INSTANCE_NAME) {
          await aplicarQrCodeWebhookSistema(base64);
        } else {
          await aplicarQrCodeWebhook(instanceName, base64);
        }
      }
    }

    return new Response("ok", { status: 200 });
  } catch (erro) {
    console.error(
      "Falha ao processar webhook do WhatsApp:",
      erro instanceof Error ? erro.message : erro,
    );
    // Still 200 — returning an error status makes most webhook senders
    // retry indefinitely, and we've already logged the failure.
    return new Response("ok", { status: 200 });
  }
}
