// Typed errors for the SaaS subscription flow (src/lib/mercadopago/). Never
// leak internal detail in the message — these strings reach the frontend
// as-is (see subscription.functions.ts).
export class PlanNotFoundError extends Error {
  constructor() {
    super("Plano não encontrado.");
    this.name = "PlanNotFoundError";
  }
}

export class PlanInactiveError extends Error {
  constructor() {
    super("Este plano não está mais disponível para contratação.");
    this.name = "PlanInactiveError";
  }
}

// The one rule this whole integration exists to enforce: never call
// Mercado Pago while the admin hasn't set a real price yet.
export class PlanPriceNotConfiguredError extends Error {
  constructor() {
    super("O preço deste plano ainda não foi configurado.");
    this.name = "PlanPriceNotConfiguredError";
  }
}

export class SubscriptionNotFoundError extends Error {
  constructor() {
    super("Assinatura não encontrada.");
    this.name = "SubscriptionNotFoundError";
  }
}

export class SubscriptionAlreadyActiveError extends Error {
  constructor() {
    super("Esta empresa já tem uma assinatura ativa para este plano.");
    this.name = "SubscriptionAlreadyActiveError";
  }
}

export class PaymentNotFoundError extends Error {
  constructor() {
    super("Pagamento não encontrado.");
    this.name = "PaymentNotFoundError";
  }
}

// Platform-level credential missing (process.env.MERCADOPAGO_ACCESS_TOKEN)
// — distinct from MercadoPagoNaoConfiguradoError in src/lib/pix/, which is
// about a *empresa's own* per-tenant token (pagamento_config), not the
// SPACE TECH platform account this module uses.
export class MercadoPagoNaoConfiguradoError extends Error {
  constructor() {
    super("Mercado Pago ainda não está configurado nesta instalação.");
    this.name = "MercadoPagoNaoConfiguradoError";
  }
}

export class MercadoPagoError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = "MercadoPagoError";
  }
}

export class InvalidWebhookError extends Error {
  constructor() {
    super("Webhook inválido.");
    this.name = "InvalidWebhookError";
  }
}

export class InvalidSignatureError extends Error {
  constructor() {
    super("Assinatura do webhook inválida.");
    this.name = "InvalidSignatureError";
  }
}
