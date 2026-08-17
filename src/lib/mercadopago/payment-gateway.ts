// Abstraction so subscription-service.ts (and nothing else) is the only
// caller of a payment gateway's HTTP API — there's a single implementation
// today (MercadoPagoProvider), but the interface exists so a future
// provider swap doesn't mean rewriting subscription-service.ts.
import { criarPagamentoPix, buscarPagamento } from "@/lib/pix/mercadopago-api";
import { criarPreapproval, buscarPreapproval, cancelarPreapproval } from "./mercadopago-api";
import { mapMercadoPagoPaymentStatus, mapMercadoPagoSubscriptionStatus } from "./status";

export type CreatePixPaymentInput = {
  valor: number;
  descricao: string;
  externalReference: string;
  notificationUrl: string;
  payerEmail: string;
  expiraEm: Date;
};

export type PixPaymentResult = {
  mpId: string;
  status: string;
  qrCode: string | null;
  qrCodeBase64: string | null;
};

export type CreateCardSubscriptionInput = {
  reason: string;
  externalReference: string;
  payerEmail: string;
  backUrl: string;
  frequency: number;
  frequencyType: "months";
  transactionAmount: number;
};

export type CreateCardSubscriptionResult = {
  mpId: string;
  status: string;
  initPoint: string | null;
};

export interface PaymentGateway {
  createPixPayment(input: CreatePixPaymentInput): Promise<PixPaymentResult>;
  getPixPaymentStatus(mpId: string): Promise<string>;
  createCardSubscription(input: CreateCardSubscriptionInput): Promise<CreateCardSubscriptionResult>;
  getSubscriptionStatus(
    mpId: string,
  ): Promise<{ status: string; externalReference: string | null }>;
  cancelSubscription(mpId: string): Promise<void>;
}

export class MercadoPagoProvider implements PaymentGateway {
  constructor(private readonly accessToken: string) {}

  async createPixPayment(input: CreatePixPaymentInput): Promise<PixPaymentResult> {
    const r = await criarPagamentoPix({
      accessToken: this.accessToken,
      valor: input.valor,
      descricao: input.descricao,
      externalReference: input.externalReference,
      notificationUrl: input.notificationUrl,
      payerEmail: input.payerEmail,
      expiraEm: input.expiraEm,
    });
    return {
      mpId: r.mpId,
      status: mapMercadoPagoPaymentStatus(r.status),
      qrCode: r.qrCode,
      qrCodeBase64: r.qrCodeBase64,
    };
  }

  async getPixPaymentStatus(mpId: string): Promise<string> {
    const r = await buscarPagamento(this.accessToken, mpId);
    return mapMercadoPagoPaymentStatus(r.status);
  }

  async createCardSubscription(
    input: CreateCardSubscriptionInput,
  ): Promise<CreateCardSubscriptionResult> {
    const r = await criarPreapproval({
      accessToken: this.accessToken,
      reason: input.reason,
      externalReference: input.externalReference,
      payerEmail: input.payerEmail,
      backUrl: input.backUrl,
      frequency: input.frequency,
      frequencyType: input.frequencyType,
      transactionAmount: input.transactionAmount,
    });
    return {
      mpId: r.mpId,
      status: mapMercadoPagoSubscriptionStatus(r.status),
      initPoint: r.initPoint,
    };
  }

  async getSubscriptionStatus(
    mpId: string,
  ): Promise<{ status: string; externalReference: string | null }> {
    const r = await buscarPreapproval(this.accessToken, mpId);
    return {
      status: mapMercadoPagoSubscriptionStatus(r.status),
      externalReference: r.externalReference,
    };
  }

  async cancelSubscription(mpId: string): Promise<void> {
    await cancelarPreapproval(this.accessToken, mpId);
  }
}
