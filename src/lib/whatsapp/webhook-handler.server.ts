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
  aplicarStatusEntrega,
  guardarMidiaRecebida,
  registrarEnviadaPeloCelular,
  tratarPedidoParar,
} from "./central.server";
import { foiEnviadoPorEsteServidor } from "./evolution-api";
import { processarMensagemRobo } from "./robo.server";
import { lerMensagem, lerStatus, objeto, texto } from "./webhook-parse";
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
      const mensagem = lerMensagem(objeto(raiz["data"]));
      // Grupos, status e canais não são conversa com cliente — só enchiam a
      // tabela (eram ~86% das mensagens guardadas) e a lista de recentes.
      if (!mensagem.numero) {
        return new Response("ok", { status: 200 });
      }
      if (mensagem.fromMe) {
        // Eco de envio deste servidor: já está gravado por quem enviou.
        // O resto foi digitado no celular da loja — entra na conversa, mas
        // só depois de alguns segundos, para não disputar o índice único
        // com o envio que ainda vai gravar o próprio id.
        if (mensagem.id && !foiEnviadoPorEsteServidor(mensagem.id)) {
          setTimeout(() => {
            if (mensagem.id && foiEnviadoPorEsteServidor(mensagem.id)) return;
            registrarEnviadaPeloCelular({ instanceName, mensagem }).catch((e) =>
              console.error(
                "[whatsapp-central] falha ao gravar mensagem do celular:",
                e instanceof Error ? e.message : e,
              ),
            );
          }, 8000);
        }
        return new Response("ok", { status: 200 });
      }

      await registrarMensagemRecebida({
        instanceName,
        numero: mensagem.numero,
        nomeContato: mensagem.nomeContato,
        texto: mensagem.texto,
        evolutionMessageId: mensagem.id,
        metadata: { event },
        extras: async (conexao) => ({
          resposta_a: mensagem.respostaA,
          ...((await guardarMidiaRecebida({
            empresaId: conexao.user_id,
            instanceName,
            mensagem,
          })) ?? {}),
        }),
      });
      await tratarPedidoParar({ instanceName, numero: mensagem.numero, texto: mensagem.texto });
      // Robô de atendimento (se ligado): responde depois do 200, como a IA da
      // pesquisa — o envio leva alguns segundos e o Evolution não espera.
      void processarMensagemRobo({
        instanceName,
        numero: mensagem.numero,
        texto: mensagem.texto,
        temMidia: !!mensagem.midia,
      });
    } else if (event.toUpperCase().includes("MESSAGES_UPDATE") || event === "messages.update") {
      // Entregue/lido. Pode vir um objeto ou uma lista, conforme a versão.
      const data = raiz["data"];
      for (const item of Array.isArray(data) ? data : [data]) {
        const status = lerStatus(objeto(item));
        if (status) await aplicarStatusEntrega(instanceName, status.id, status.entrega);
      }
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
