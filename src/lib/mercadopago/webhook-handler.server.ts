// Handles POST /api/subscriptions/mercadopago/webhook — Mercado Pago's
// notification callback for the SaaS subscription (preapproval + the
// Pix-per-cycle payment). Wired directly into src/server.ts rather than a
// createServerFn, same reasoning as src/lib/pix/webhook-handler.server.ts:
// Mercado Pago's servers have no Supabase session and aren't same-origin,
// so they can't pass this app's CSRF middleware.
//
// Security model: identical to the Pix webhook — the *authoritative*
// source of truth is always Mercado Pago's own GET (never the webhook
// body's claimed status), reached via reconciliarAssinatura/
// reconciliarPagamentoAssinatura, which re-fetch before writing anything.
// x-signature validation uses MERCADOPAGO_WEBHOOK_SECRET (platform-level,
// process.env — not a per-empresa secret like the Pix webhook's).
import { createHmac, timingSafeEqual } from "node:crypto";
import { reconciliarAssinatura, reconciliarPagamentoAssinatura } from "./subscription-service";

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

function extrairTipo(url: URL, corpo: Record<string, unknown>): string | null {
  return (
    url.searchParams.get("type") ??
    url.searchParams.get("topic") ??
    (typeof corpo["type"] === "string" ? (corpo["type"] as string) : null)
  );
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

export async function handleMercadoPagoSubscriptionWebhook(request: Request): Promise<Response> {
  const url = new URL(request.url);

  let corpo: Record<string, unknown> = {};
  try {
    corpo = (await request.json()) as Record<string, unknown>;
  } catch {
    // Mercado Pago also sends test pings with an empty body — not an error.
  }

  const dataId = extrairDataId(url, corpo);
  const tipo = extrairTipo(url, corpo);
  if (!dataId || !tipo) return new Response("ok", { status: 200 });

  const secret = process.env["MERCADOPAGO_WEBHOOK_SECRET"];
  if (secret) {
    const assinatura = request.headers.get("x-signature");
    const requestId = request.headers.get("x-request-id");
    if (!assinatura || !requestId || !assinaturaValida(assinatura, requestId, dataId, secret)) {
      return new Response("Forbidden", { status: 403 });
    }
  } else {
    console.warn(
      "[MercadoPago/Assinatura] Webhook recebido sem MERCADOPAGO_WEBHOOK_SECRET configurado — validação de assinatura pulada.",
    );
  }

  try {
    if (tipo === "subscription_preapproval") {
      await reconciliarAssinatura(dataId);
    } else if (tipo === "subscription_authorized_payment" || tipo === "payment") {
      await reconciliarPagamentoAssinatura(dataId);
    }
    return new Response("ok", { status: 200 });
  } catch (erro) {
    console.error(
      "Falha ao processar webhook de assinatura do Mercado Pago:",
      erro instanceof Error ? erro.message : erro,
    );
    // 200 mesmo assim — um 4xx/5xx faz o Mercado Pago reenviar
    // agressivamente; a falha já foi logada e a próxima mudança real de
    // status (ou um refresh manual) reconcilia.
    return new Response("ok", { status: 200 });
  }
}
