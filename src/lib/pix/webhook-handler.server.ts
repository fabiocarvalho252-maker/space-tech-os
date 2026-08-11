// Handles POST /api/pix/webhook — Mercado Pago's payment notification
// callback. Like the WhatsApp webhook (see
// src/lib/whatsapp/webhook-handler.server.ts), this is wired directly into
// src/server.ts rather than going through a createServerFn: Mercado Pago's
// servers have no Supabase session and aren't same-origin, so they can't
// pass this app's CSRF middleware.
//
// Security model: the *authoritative* source of truth is always Mercado
// Pago's own GET /v1/payments/{id} (see reconciliarPagamento), called with
// our own securely stored Access Token — never the webhook body's claimed
// status. That means even an unsigned/forged webhook call can only ever
// cause us to re-check a real payment's real status early; it can't inject
// a fake "paid" state. x-signature validation (when the empresa has
// configured a webhook secret) is still applied as defense in depth against
// request spam, but its absence is a logged warning, not a hard failure —
// see obterSegredoWebhook's doc comment on why that's an intentional
// trade-off, not an oversight.
import { createHmac, timingSafeEqual } from "node:crypto";
import { obterEmpresaDoPagamento, obterSegredoWebhook, reconciliarPagamento } from "./pix-service";

function extrairDataId(url: URL, corpo: Record<string, unknown>): string | null {
  const daQuery = url.searchParams.get("data.id");
  if (daQuery) return daQuery;
  const data = corpo["data"];
  if (data && typeof data === "object" && "id" in data) {
    const id = (data as Record<string, unknown>)["id"];
    if (typeof id === "string" || typeof id === "number") return String(id);
  }
  return null;
}

function assinaturaValida(
  header: string,
  requestId: string,
  dataId: string,
  secret: string,
): boolean {
  const partes = Object.fromEntries(
    header.split(",").map((par) => {
      const [chave, valor] = par.split("=");
      return [chave?.trim(), valor?.trim()];
    }),
  );
  const ts = partes["ts"];
  const v1 = partes["v1"];
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const esperado = createHmac("sha256", secret).update(manifest).digest("hex");

  const a = Buffer.from(esperado, "hex");
  const b = Buffer.from(v1, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function handlePixWebhook(request: Request): Promise<Response> {
  const url = new URL(request.url);

  let corpo: Record<string, unknown> = {};
  try {
    corpo = (await request.json()) as Record<string, unknown>;
  } catch {
    // Mercado Pago also sends test pings with an empty body — not an error.
  }

  const dataId = extrairDataId(url, corpo);
  if (!dataId) return new Response("ok", { status: 200 });

  try {
    const empresaId = await obterEmpresaDoPagamento(dataId);
    if (!empresaId) return new Response("ok", { status: 200 }); // not one of ours

    const secret = await obterSegredoWebhook(empresaId);
    if (secret) {
      const assinatura = request.headers.get("x-signature");
      const requestId = request.headers.get("x-request-id");
      if (!assinatura || !requestId || !assinaturaValida(assinatura, requestId, dataId, secret)) {
        return new Response("Forbidden", { status: 403 });
      }
    } else {
      console.warn(
        `[Pix] Webhook recebido sem mercado_pago_webhook_secret configurado para a empresa ${empresaId} — validação de assinatura pulada.`,
      );
    }

    await reconciliarPagamento(dataId);
    return new Response("ok", { status: 200 });
  } catch (erro) {
    console.error(
      "Falha ao processar webhook do Mercado Pago:",
      erro instanceof Error ? erro.message : erro,
    );
    // 200 anyway — a 4xx/5xx makes Mercado Pago retry aggressively, and the
    // failure is already logged; the next real status change (or a manual
    // refresh in Cobranças) will reconcile it.
    return new Response("ok", { status: 200 });
  }
}
