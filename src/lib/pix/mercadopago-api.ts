// Thin, low-level HTTP client for Mercado Pago's classic Payments API
// (https://api.mercadopago.com/v1/payments). Server-only — never imported
// from a route component. Every empresa brings its own Access Token
// (stored in pagamento_config, entered in Configurações → Mercado Pago),
// so every function here takes it as a parameter rather than reading a
// single global env var — this is a per-tenant integration, not a
// platform-wide one.

export class MercadoPagoApiError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = "MercadoPagoApiError";
  }
}

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
    throw new MercadoPagoApiError("Não foi possível conectar ao Mercado Pago.");
  }

  if (res.status === 401 || res.status === 403) {
    throw new MercadoPagoApiError("Mercado Pago recusou o Access Token configurado.");
  }
  if (!res.ok) {
    const corpo = await res.text().catch(() => "");
    throw new MercadoPagoApiError(
      `Mercado Pago retornou um erro (${res.status}): ${corpo.slice(0, 300) || "sem detalhes"}`,
    );
  }
  return (await res.json()) as T;
}

export type CriarPagamentoPixInput = {
  accessToken: string;
  valor: number;
  descricao: string;
  externalReference: string;
  notificationUrl: string;
  payerEmail: string;
  cpfCnpj?: string | null;
  expiraEm: Date;
};

export type PagamentoPixResultado = {
  mpId: string;
  status: string;
  qrCode: string | null;
  qrCodeBase64: string | null;
};

export async function criarPagamentoPix(
  input: CriarPagamentoPixInput,
): Promise<PagamentoPixResultado> {
  const documento = (input.cpfCnpj ?? "").replace(/\D/g, "");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await chamar<any>(
    input.accessToken,
    "POST",
    "/v1/payments",
    {
      transaction_amount: input.valor,
      description: input.descricao,
      payment_method_id: "pix",
      external_reference: input.externalReference,
      notification_url: input.notificationUrl,
      date_of_expiration: input.expiraEm.toISOString(),
      payer: {
        email: input.payerEmail,
        ...(documento
          ? { identification: { type: documento.length > 11 ? "CNPJ" : "CPF", number: documento } }
          : {}),
      },
    },
    // Mercado Pago dedupes creates by this key — one real charge per
    // cobranca even if the request is retried.
    input.externalReference,
  );

  return {
    mpId: String(data.id),
    status: String(data.status),
    qrCode: data.point_of_interaction?.transaction_data?.qr_code ?? null,
    qrCodeBase64: data.point_of_interaction?.transaction_data?.qr_code_base64 ?? null,
  };
}

export type PagamentoConsultado = { mpId: string; status: string; valor: number };

export async function buscarPagamento(
  accessToken: string,
  mpId: string,
): Promise<PagamentoConsultado> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await chamar<any>(accessToken, "GET", `/v1/payments/${encodeURIComponent(mpId)}`);
  return {
    mpId: String(data.id),
    status: String(data.status),
    valor: Number(data.transaction_amount ?? 0),
  };
}

export async function cancelarPagamento(accessToken: string, mpId: string): Promise<void> {
  await chamar(accessToken, "PUT", `/v1/payments/${encodeURIComponent(mpId)}`, {
    status: "cancelled",
  });
}
