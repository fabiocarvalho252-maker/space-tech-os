import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { handleWhatsappWebhook } from "./lib/whatsapp/webhook-handler.server";
import { handlePixWebhook } from "./lib/pix/webhook-handler.server";
import { handleMercadoPagoSubscriptionWebhook } from "./lib/mercadopago/webhook-handler.server";
import { handleCrediarioCron } from "./lib/crediario/cron-handler.server";
import { handleContasInativasCron } from "./lib/contas-inativas-cron.server";
import { handleBackupDriveCron, handleGoogleDriveCallback } from "./lib/backup/rotas.server";
import { handleWhatsappFilaCron } from "./lib/whatsapp/fila-cron.server";

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

// Same reasoning as the webhooks above — Mercado Pago's servers can't pass
// the same-origin CSRF check either. This one is the SaaS subscription
// webhook (SPACE TECH's own Mercado Pago account), distinct from
// /api/pix/webhook above (each empresa's own account, used in Cobranças).
// See src/lib/mercadopago/webhook-handler.server.ts for this endpoint's own
// (signature-based) authentication.
function isMercadoPagoSubscriptionWebhookRequest(request: Request): boolean {
  if (request.method !== "POST") return false;
  return new URL(request.url).pathname === "/api/subscriptions/mercadopago/webhook";
}

// Chamado pelo pg_cron (via pg_net) de hora em hora — também não tem
// sessão nem mesma origem. Autenticado por token; ver
// src/lib/crediario/cron-handler.server.ts.
function isCrediarioCronRequest(request: Request): boolean {
  if (request.method !== "POST") return false;
  return new URL(request.url).pathname === "/api/crediario/cron";
}

// Chamado uma vez por dia pelo cron do servidor (scripts/contas-inativas.sh)
// — sem sessão. Autenticado por token; ver
// src/lib/contas-inativas-cron.server.ts.
function isContasInativasCronRequest(request: Request): boolean {
  if (request.method !== "POST") return false;
  return new URL(request.url).pathname === "/api/contas-inativas/cron";
}

// Volta do Google (navegação vinda de accounts.google.com, sem a mesma
// origem) e a rotina diária chamada por scripts/backup-banco.sh. Ver
// src/lib/backup/rotas.server.ts.
function isGoogleDriveCallbackRequest(request: Request): boolean {
  if (request.method !== "GET") return false;
  return new URL(request.url).pathname === "/api/google-drive/callback";
}

function isBackupDriveCronRequest(request: Request): boolean {
  if (request.method !== "POST") return false;
  return new URL(request.url).pathname === "/api/backup-drive/cron";
}

// Worker da Fila WhatsApp, chamado a cada minuto por scripts/whatsapp-fila.sh
// — sem sessão. Autenticado por token; ver src/lib/whatsapp/fila-cron.server.ts.
function isWhatsappFilaCronRequest(request: Request): boolean {
  if (request.method !== "POST") return false;
  return new URL(request.url).pathname === "/api/whatsapp/fila/cron";
}

// Cabeçalhos de segurança em toda resposta. Sem CSP de propósito: o app
// carrega scripts/estilos inline do SSR e uma CSP errada quebra o site.
// camera/microphone=(self) porque as fotos da OS, o leitor de código de
// barras e a voz da IA usam esses recursos.
const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), microphone=(self), geolocation=()",
};

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    return withSecurityHeaders(await handleRequest(request, env, ctx));
  },
};

async function handleRequest(request: Request, env: unknown, ctx: unknown): Promise<Response> {
  try {
    if (isWhatsappWebhookRequest(request)) {
      return await handleWhatsappWebhook(request);
    }
    if (isPixWebhookRequest(request)) {
      return await handlePixWebhook(request);
    }
    if (isMercadoPagoSubscriptionWebhookRequest(request)) {
      return await handleMercadoPagoSubscriptionWebhook(request);
    }
    if (isCrediarioCronRequest(request)) {
      return await handleCrediarioCron(request);
    }
    if (isContasInativasCronRequest(request)) {
      return await handleContasInativasCron(request);
    }
    if (isGoogleDriveCallbackRequest(request)) {
      return await handleGoogleDriveCallback(request);
    }
    if (isBackupDriveCronRequest(request)) {
      return await handleBackupDriveCron(request);
    }
    if (isWhatsappFilaCronRequest(request)) {
      return await handleWhatsappFilaCron(request);
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
}
