// Thin, low-level HTTP client for Mercado Pago's Subscriptions API
// (https://api.mercadopago.com/preapproval) — the SPACE TECH platform's OWN
// Mercado Pago account, used to charge empresas for their SaaS
// subscription. Server-only, never imported from a route component.
//
// Not to be confused with src/lib/pix/mercadopago-api.ts, which talks to
// the classic Payments API (/v1/payments) using EACH EMPRESA's OWN Access
// Token (pagamento_config) so they can charge their own customers — that
// module is reused as-is for the Pix-per-cycle path here (see
// subscription-service.ts), since its functions already take the Access
// Token as a parameter rather than assuming a source for it.
import { MercadoPagoError } from "./errors";

const BASE_URL = "https://api.mercadopago.com";

async function chamar<T>(
  accessToken: string,
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown,
  idempotencyKey?: string,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : null,
    });
  } catch {
    throw new MercadoPagoError("Não foi possível conectar ao Mercado Pago.");
  }

  if (res.status === 401 || res.status === 403) {
    throw new MercadoPagoError("Mercado Pago recusou o Access Token configurado.");
  }
  if (!res.ok) {
    const corpo = await res.text().catch(() => "");
    throw new MercadoPagoError(
      `Mercado Pago retornou um erro (${res.status}): ${corpo.slice(0, 300) || "sem detalhes"}`,
    );
  }
  return (await res.json()) as T;
}

export type CriarPreapprovalInput = {
  accessToken: string;
  reason: string;
  externalReference: string;
  payerEmail: string;
  backUrl: string;
  frequency: number;
  frequencyType: "months";
  transactionAmount: number;
};

export type PreapprovalResultado = {
  mpId: string;
  status: string;
  initPoint: string | null;
};

export async function criarPreapproval(
  input: CriarPreapprovalInput,
): Promise<PreapprovalResultado> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await chamar<any>(
    input.accessToken,
    "POST",
    "/preapproval",
    {
      reason: input.reason,
      external_reference: input.externalReference,
      payer_email: input.payerEmail,
      back_url: input.backUrl,
      auto_recurring: {
        frequency: input.frequency,
        frequency_type: input.frequencyType,
        transaction_amount: input.transactionAmount,
        currency_id: "BRL",
      },
    },
    // Mercado Pago dedupes creates by this key — one real preapproval per
    // subscription attempt even if the request is retried.
    input.externalReference,
  );

  return {
    mpId: String(data.id),
    status: String(data.status),
    initPoint: data.init_point ?? null,
  };
}

export type PreapprovalConsultado = {
  mpId: string;
  status: string;
  externalReference: string | null;
};

export async function buscarPreapproval(
  accessToken: string,
  mpId: string,
): Promise<PreapprovalConsultado> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await chamar<any>(accessToken, "GET", `/preapproval/${encodeURIComponent(mpId)}`);
  return {
    mpId: String(data.id),
    status: String(data.status),
    externalReference: data.external_reference ?? null,
  };
}

export async function cancelarPreapproval(accessToken: string, mpId: string): Promise<void> {
  await chamar(accessToken, "PUT", `/preapproval/${encodeURIComponent(mpId)}`, {
    status: "cancelled",
  });
}
