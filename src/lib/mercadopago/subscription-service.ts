// Orchestrates subscriptions/subscription_payments/subscription_events with
// the MercadoPagoProvider (payment-gateway.ts). Server-only. Mirrors
// src/lib/pix/pix-service.ts's core rule: never trust a webhook's claimed
// status — every status change here is written only after re-fetching the
// real resource from Mercado Pago's own API.
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { MercadoPagoProvider, type PaymentGateway } from "./payment-gateway";
import {
  MercadoPagoNaoConfiguradoError,
  PlanInactiveError,
  PlanNotFoundError,
  PlanPriceNotConfiguredError,
  SubscriptionAlreadyActiveError,
  SubscriptionNotFoundError,
} from "./errors";

type BillingCycle = "monthly" | "yearly";
type PaymentMethod = "pix" | "credit_card";

function obterGateway(): PaymentGateway {
  const token = process.env["MERCADOPAGO_ACCESS_TOKEN"];
  if (!token) throw new MercadoPagoNaoConfiguradoError();
  return new MercadoPagoProvider(token);
}

async function registrarEvento(
  subscriptionId: string | null,
  type: string,
  payload?: Record<string, Json>,
) {
  await supabaseAdmin.from("subscription_events").insert({
    subscription_id: subscriptionId,
    type,
    payload: payload ?? null,
  });
}

export type IniciarAssinaturaInput = {
  empresaId: string;
  planId: string;
  billingCycle: BillingCycle;
  paymentMethod: PaymentMethod;
  payerEmail: string;
  origin: string;
};

export type IniciarAssinaturaResultado =
  | { paymentMethod: "credit_card"; initPoint: string }
  | { paymentMethod: "pix"; qrCode: string | null; qrCodeBase64: string | null };

export async function iniciarAssinatura(
  input: IniciarAssinaturaInput,
): Promise<IniciarAssinaturaResultado> {
  const { data: plan, error: planErro } = await supabaseAdmin
    .from("plans")
    .select("id, name, active, monthly_price, annual_price")
    .eq("id", input.planId)
    .maybeSingle();
  if (planErro) throw planErro;
  if (!plan) throw new PlanNotFoundError();
  if (!plan.active) throw new PlanInactiveError();

  // A regra mais importante desta integração: preço NULL nunca chama o
  // Mercado Pago, mesmo que o resto do fluxo esteja correto.
  const preco = input.billingCycle === "monthly" ? plan.monthly_price : plan.annual_price;
  if (preco === null || preco <= 0) throw new PlanPriceNotConfiguredError();

  const gateway = obterGateway(); // lança MercadoPagoNaoConfiguradoError se faltar credencial

  const { data: existente } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("empresa_id", input.empresaId)
    .eq("status", "active")
    .maybeSingle();
  if (existente) throw new SubscriptionAlreadyActiveError();

  const { data: subscription, error: subErro } = await supabaseAdmin
    .from("subscriptions")
    .insert({
      empresa_id: input.empresaId,
      plan_id: input.planId,
      billing_cycle: input.billingCycle,
      status: "pending",
    })
    .select("id")
    .single();
  if (subErro) throw subErro;

  await registrarEvento(subscription.id, "SUBSCRIPTION_CREATED", {
    planId: input.planId,
    billingCycle: input.billingCycle,
  });

  // Referência externa única por tentativa de cobrança — nunca reaproveita
  // o id interno "cru" como se fosse suficiente sozinho (ver Fase 40).
  const externalReference = `ST-${input.empresaId}-${subscription.id}-${randomUUID()}`;

  if (input.paymentMethod === "credit_card") {
    const resultado = await gateway.createCardSubscription({
      reason: `SpaceTech OS — Plano ${plan.name} (${input.billingCycle === "monthly" ? "mensal" : "anual"})`,
      externalReference,
      payerEmail: input.payerEmail,
      backUrl: `${input.origin}/assinatura`,
      frequency: input.billingCycle === "monthly" ? 1 : 12,
      frequencyType: "months",
      transactionAmount: preco,
    });

    await supabaseAdmin
      .from("subscriptions")
      .update({ mercado_pago_preapproval_id: resultado.mpId })
      .eq("id", subscription.id);
    await registrarEvento(subscription.id, "MP_SUBSCRIPTION_CREATED", { mpId: resultado.mpId });

    if (!resultado.initPoint) throw new MercadoPagoNaoConfiguradoError();
    return { paymentMethod: "credit_card", initPoint: resultado.initPoint };
  }

  // Pix: o Mercado Pago não tem débito automático recorrente via Pix —
  // cada ciclo gera uma cobrança avulsa vinculada a esta subscription (ver
  // "Decisão sobre PIX recorrente" no plano desta tarefa).
  const expiraEm = new Date(Date.now() + 30 * 60_000);
  const { data: payment, error: pagErro } = await supabaseAdmin
    .from("subscription_payments")
    .insert({
      subscription_id: subscription.id,
      amount: preco,
      payment_method: "pix",
      status: "pending",
      external_reference: externalReference,
      expires_at: expiraEm.toISOString(),
    })
    .select("id")
    .single();
  if (pagErro) throw pagErro;

  const pix = await gateway.createPixPayment({
    valor: preco,
    descricao: `SpaceTech OS — Plano ${plan.name}`,
    externalReference,
    notificationUrl: `${input.origin}/api/subscriptions/mercadopago/webhook`,
    payerEmail: input.payerEmail,
    expiraEm,
  });

  await supabaseAdmin
    .from("subscription_payments")
    .update({ mercado_pago_payment_id: pix.mpId, status: pix.status })
    .eq("id", payment.id);
  await registrarEvento(subscription.id, "MP_PAYMENT_CREATED", { mpId: pix.mpId });

  return { paymentMethod: "pix", qrCode: pix.qrCode, qrCodeBase64: pix.qrCodeBase64 };
}

/** Ativa a assinatura e libera o plano — único lugar que faz isso, chamado
 * só depois de uma reconciliação bem-sucedida (nunca direto de um webhook). */
async function ativarAssinatura(subscriptionId: string, planId: string, empresaId: string) {
  const agora = new Date();
  await supabaseAdmin
    .from("subscriptions")
    .update({ status: "active", start_date: agora.toISOString() })
    .eq("id", subscriptionId);
  await supabaseAdmin.from("profiles").update({ plan_id: planId }).eq("id", empresaId);
  await registrarEvento(subscriptionId, "SUBSCRIPTION_ACTIVATED");
}

/** Re-consulta o Mercado Pago pelo preapproval id — nunca confia no status
 * que o webhook alega. Chamada tanto pelo webhook quanto por um refresh
 * manual futuro em "Minha assinatura". */
export async function reconciliarAssinatura(mpPreapprovalId: string): Promise<void> {
  const { data: subscription } = await supabaseAdmin
    .from("subscriptions")
    .select("id, empresa_id, plan_id, status")
    .eq("mercado_pago_preapproval_id", mpPreapprovalId)
    .maybeSingle();
  if (!subscription) return; // não é nossa

  const gateway = obterGateway();
  const { status } = await gateway.getSubscriptionStatus(mpPreapprovalId);
  if (status === subscription.status) return; // já reconciliado

  if (status === "active" && subscription.status !== "active") {
    await ativarAssinatura(subscription.id, subscription.plan_id, subscription.empresa_id);
    return;
  }

  await supabaseAdmin.from("subscriptions").update({ status }).eq("id", subscription.id);
  await registrarEvento(subscription.id, "SUBSCRIPTION_UPDATED", { status });
}

/** Mesma ideia para o caminho Pix por ciclo: re-consulta o pagamento antes
 * de marcar como pago, e só então ativa a assinatura correspondente. */
export async function reconciliarPagamentoAssinatura(mpPaymentId: string): Promise<void> {
  const { data: payment } = await supabaseAdmin
    .from("subscription_payments")
    .select("id, subscription_id, status, subscriptions(id, empresa_id, plan_id, status)")
    .eq("mercado_pago_payment_id", mpPaymentId)
    .maybeSingle();
  if (!payment) return;

  const gateway = obterGateway();
  const status = await gateway.getPixPaymentStatus(mpPaymentId);
  if (status === payment.status) return;

  await supabaseAdmin
    .from("subscription_payments")
    .update({ status, paid_at: status === "paid" ? new Date().toISOString() : null })
    .eq("id", payment.id);
  await registrarEvento(payment.subscription_id, "MP_PAYMENT_UPDATED", { status });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- nested select shape isn't in the generated relationship helper
  const subscription = (payment as any).subscriptions as {
    id: string;
    empresa_id: string;
    plan_id: string;
    status: string;
  } | null;
  if (status === "paid" && subscription && subscription.status !== "active") {
    await ativarAssinatura(subscription.id, subscription.plan_id, subscription.empresa_id);
    await supabaseAdmin
      .from("subscriptions")
      .update({
        next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString(),
      })
      .eq("id", subscription.id);
  }
}

export async function cancelarAssinatura(subscriptionId: string, empresaId: string): Promise<void> {
  const { data: subscription, error } = await supabaseAdmin
    .from("subscriptions")
    .select("id, empresa_id, mercado_pago_preapproval_id, status")
    .eq("id", subscriptionId)
    .maybeSingle();
  if (error) throw error;
  if (!subscription || subscription.empresa_id !== empresaId) throw new SubscriptionNotFoundError();

  if (subscription.mercado_pago_preapproval_id) {
    const gateway = obterGateway();
    await gateway.cancelSubscription(subscription.mercado_pago_preapproval_id);
  }

  await supabaseAdmin
    .from("subscriptions")
    .update({ status: "canceled", canceled_at: new Date().toISOString() })
    .eq("id", subscriptionId);
  await registrarEvento(subscriptionId, "SUBSCRIPTION_CANCELED");

  // Remove só o acesso aos recursos exclusivos — nunca apaga OS, vendas,
  // notas ou qualquer outro histórico da empresa (ver Fase 31 do pedido).
  const { data: basico } = await supabaseAdmin
    .from("plans")
    .select("id")
    .eq("slug", "basico")
    .maybeSingle();
  if (basico) {
    await supabaseAdmin.from("profiles").update({ plan_id: basico.id }).eq("id", empresaId);
  }
}
