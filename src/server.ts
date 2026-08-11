import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { handleWhatsappWebhook } from "./lib/whatsapp/webhook-handler.server";
import { handlePixWebhook } from "./lib/pix/webhook-handler.server";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// The Evolution API webhook (external server, no browser/Supabase session)
// is handled here, before the TanStack Start router/server-function
// dispatcher, because that dispatcher enforces same-origin CSRF checks on
// every request (see src/start.ts) that a legitimate server-to-server
// webhook call can never satisfy. See webhook-handler.server.ts for the
// endpoint's own (token-based) authentication.
function isWhatsappWebhookRequest(request: Request): boolean {
  if (request.method !== "POST") return false;
  return new URL(request.url).pathname === "/api/whatsapp/webhook";
}

// Same reasoning as the WhatsApp webhook above — Mercado Pago's servers
// can't pass the same-origin CSRF check either. See
// src/lib/pix/webhook-handler.server.ts for this endpoint's own
// (signature-based) authentication.
function isPixWebhookRequest(request: Request): boolean {
  if (request.method !== "POST") return false;
  return new URL(request.url).pathname === "/api/pix/webhook";
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      if (isWhatsappWebhookRequest(request)) {
        return await handleWhatsappWebhook(request);
      }
      if (isPixWebhookRequest(request)) {
        return await handlePixWebhook(request);
      }
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
