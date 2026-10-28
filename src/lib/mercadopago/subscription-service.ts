// Orchestrates subscriptions/subscription_payments/subscription_events with
// the MercadoPagoProvider (payment-gateway.ts). Server-only. Mirrors
// src/lib/pix/pix-service.ts's core rule: never trust a webhook's claimed
// status — every status change here is written only after re-fetching the
// real resource from Mercado Pago's own API.
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { MercadoPagoProvider, type PaymentGateway } from "./payment-gateway";
import { comTaxaRepassada } from "./fees";
import { novoAcessoAte } from "@/lib/acesso";
import { avisarDonoDaPlataforma, enviarDaPlataforma } from "@/lib/whatsapp/whatsapp-service";
import { dataCurtaBR, textoComprovanteWhatsapp } from "@/lib/planos/comprovante";
import {
  aplicarDescontoIndicacao,
  marcarReferralComoPendente,
  previaDescontoIndicacao,
  processarComissaoIndicacao,
} from "@/lib/referrals/commission-service";
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
  await marcarReferralComoPendente(input.empresaId);

  // Referência externa única por tentativa de cobrança — nunca reaproveita
  // o id interno "cru" como se fosse suficiente sozinho (ver Fase 40).
  const externalReference = `ST-${input.empresaId}-${subscription.id}-${randomUUID()}`;
  // Desconto de indicação (R$ 10 por indicação convertida) só vale para a
  // próxima mensalidade paga em Pix — o cartão é uma assinatura recorrente
  // de valor fixo no Mercado Pago, não dá para descontar um mês só. Sempre
  // sobra ao menos R$ 1 para cobrar; os créditos são consumidos só quando o
  // pagamento é confirmado (ativarAssinatura).
  const descontoIndicacao =
    input.billingCycle === "monthly" && input.paymentMethod === "pix"
      ? await previaDescontoIndicacao(input.empresaId, preco - 1)
      : 0;
  if (descontoIndicacao > 0) {
    await registrarEvento(subscription.id, "REFERRAL_DISCOUNT_RESERVED", {
      valor: descontoIndicacao,
    });
  }
  const valorCobrado = comTaxaRepassada(preco - descontoIndicacao, input.paymentMethod);

  if (input.paymentMethod === "credit_card") {
    const resultado = await gateway.createCardSubscription({
      reason: `SpaceTech OS — Plano ${plan.name} (${input.billingCycle === "monthly" ? "mensal" : "anual"})`,
      externalReference,
      payerEmail: input.payerEmail,
      backUrl: `${input.origin}/assinatura`,
      frequency: input.billingCycle === "monthly" ? 1 : 12,
      frequencyType: "months",
      transactionAmount: valorCobrado,
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
      amount: valorCobrado,
      payment_method: "pix",
      status: "pending",
      external_reference: externalReference,
      expires_at: expiraEm.toISOString(),
    })
    .select("id")
    .single();
  if (pagErro) throw pagErro;

  const pix = await gateway.createPixPayment({
    valor: valorCobrado,
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

type PagamentoAviso = {
  metodo: "Pix" | "cartão";
  valor: number | null;
  /** Novo último dia de acesso, quando o pagamento renovou o prazo. */
  acessoAte?: string | null;
};

/** Avisa o dono da plataforma no WhatsApp que um plano foi pago/renovado. */
async function avisarPagamentoPlano(
  tipo: "pago" | "renovado",
  subscriptionId: string,
  chave: string,
  pagamento: PagamentoAviso,
) {
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("billing_cycle, next_billing_date, plans(name), profiles:empresa_id(loja, nome)")
    .eq("id", subscriptionId)
    .maybeSingle();
  const plano = (data?.plans as { name: string } | null)?.name ?? "—";
  const empresa = data?.profiles as { loja: string | null; nome: string | null } | null;
  const ciclo = data?.billing_cycle === "yearly" ? "anual" : "mensal";
  const valor = pagamento.valor
    ? ` — ${pagamento.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
    : "";
  const proxima = data?.next_billing_date
    ? `Próxima cobrança: ${new Date(data.next_billing_date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
    : null;
  await avisarDonoDaPlataforma(
    `aviso_plano_${tipo}_${chave}`,
    [
      `${tipo === "pago" ? "💰 *Plano pago*" : "🔁 *Renovação paga*"} — ${empresa?.loja || empresa?.nome || "Loja sem nome"}`,
      `Plano ${plano} (${ciclo}) no ${pagamento.metodo}${valor}`,
      tipo === "pago" ? "Plano liberado automaticamente." : "Assinatura segue ativa.",
      ...(pagamento.acessoAte ? [`Acesso até: ${dataCurtaBR(pagamento.acessoAte)}`] : []),
      ...(proxima && !pagamento.acessoAte ? [proxima] : []),
    ].join("\n"),
  );
}

/** Ativa a assinatura e libera o plano — único lugar que faz isso, chamado
 * só depois de uma reconciliação bem-sucedida (nunca direto de um webhook). */
async function ativarAssinatura(
  subscriptionId: string,
  planId: string,
  empresaId: string,
  pagamento: PagamentoAviso,
) {
  const agora = new Date();
  await supabaseAdmin
    .from("subscriptions")
    .update({ status: "active", start_date: agora.toISOString() })
    .eq("id", subscriptionId);
  await supabaseAdmin.from("profiles").update({ plan_id: planId }).eq("id", empresaId);
  await registrarEvento(subscriptionId, "SUBSCRIPTION_ACTIVATED");
  await processarComissaoIndicacao(subscriptionId, planId, empresaId);

  // Consome os créditos de desconto de indicação reservados na cobrança.
  const { data: reserva } = await supabaseAdmin
    .from("subscription_events")
    .select("payload")
    .eq("subscription_id", subscriptionId)
    .eq("type", "REFERRAL_DISCOUNT_RESERVED")
    .maybeSingle();
  const valorReservado = Number((reserva?.payload as { valor?: number } | null)?.valor ?? 0);
  const nota = `Mensalidade Pix — assinatura ${subscriptionId}`;
  const { count: jaAplicado } = await supabaseAdmin
    .from("referral_commissions")
    .select("id", { count: "exact", head: true })
    .eq("used_note", nota);
  if (valorReservado > 0 && !jaAplicado) {
    try {
      await aplicarDescontoIndicacao(empresaId, valorReservado, nota);
    } catch (erro) {
      console.error("[Referrals] Falha ao consumir desconto de indicação:", erro);
    }
  }

  await avisarPagamentoPlano("pago", subscriptionId, subscriptionId, pagamento);
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
    await ativarAssinatura(subscription.id, subscription.plan_id, subscription.empresa_id, {
      metodo: "cartão",
      valor: null,
    });
    return;
  }

  await supabaseAdmin.from("subscriptions").update({ status }).eq("id", subscription.id);
  await registrarEvento(subscription.id, "SUBSCRIPTION_UPDATED", { status });
}

/** Mesma ideia para o caminho Pix por ciclo: re-consulta o pagamento antes
 * de marcar como pago, e só então ativa a assinatura correspondente. Usado
 * pela contratação (/planos) e pela renovação por Pix (/assinatura). */
export async function reconciliarPagamentoAssinatura(mpPaymentId: string): Promise<void> {
  const { data: payment } = await supabaseAdmin
    .from("subscription_payments")
    .select(
      "id, subscription_id, status, amount, metadata, subscriptions(id, empresa_id, plan_id, status, billing_cycle)",
    )
    .eq("mercado_pago_payment_id", mpPaymentId)
    .maybeSingle();
  if (!payment) return;

  const gateway = obterGateway();
  const status = await gateway.getPixPaymentStatus(mpPaymentId);
  if (status === payment.status) return;

  // Só um chamador vence a troca de status (webhook e a tela consultando ao
  // mesmo tempo): quem não atualizou nenhuma linha não renova de novo.
  const pagoEm = new Date().toISOString();
  const { data: trocou } = await supabaseAdmin
    .from("subscription_payments")
    .update({ status, paid_at: status === "paid" ? pagoEm : null })
    .eq("id", payment.id)
    .eq("status", payment.status)
    .select("id");
  if (!trocou?.length) return;
  await registrarEvento(payment.subscription_id, "MP_PAYMENT_UPDATED", { status });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- nested select shape isn't in the generated relationship helper
  const subscription = (payment as any).subscriptions as {
    id: string;
    empresa_id: string;
    plan_id: string;
    status: string;
    billing_cycle: BillingCycle;
  } | null;
  if (status === "paid" && subscription) {
    const ciclo = subscription.billing_cycle;
    // Antes do aviso, para ele já mostrar a próxima cobrança.
    await supabaseAdmin
      .from("subscriptions")
      .update({ next_billing_date: proximaCobranca(ciclo) })
      .eq("id", subscription.id);
    const acessoAte = await estenderAcesso(subscription.empresa_id, ciclo);
    await supabaseAdmin
      .from("subscription_payments")
      .update({ metadata: { ...objetoJson(payment.metadata), acesso_ate: acessoAte } })
      .eq("id", payment.id);

    const pagamento = { metodo: "Pix", valor: Number(payment.amount), acessoAte } as const;
    if (subscription.status !== "active") {
      await ativarAssinatura(
        subscription.id,
        subscription.plan_id,
        subscription.empresa_id,
        pagamento,
      );
    } else {
      await avisarPagamentoPlano("renovado", subscription.id, payment.id, pagamento);
    }
    await enviarComprovante(payment.id);
  }
}

function objetoJson(valor: unknown): Record<string, Json> {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, Json>)
    : {};
}

function proximaCobranca(ciclo: BillingCycle): string {
  const dias = ciclo === "yearly" ? 365 : 30;
  return new Date(Date.now() + dias * 86_400_000).toISOString();
}

/** "AAAA-MM-DD" de hoje em Brasília. */
function hojeBrasilia(): string {
  return new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * Renova o prazo de acesso — profiles.plano/acesso_ate é o que o bloqueio
 * realmente confere (lib/acesso.ts); plan_id sozinho só muda os recursos.
 * Soma 1 ou 12 meses ao vencimento atual (se ainda não venceu) ou a hoje.
 * Vitalício não muda. Devolve o novo último dia de acesso.
 */
export async function estenderAcesso(
  empresaId: string,
  ciclo: BillingCycle,
): Promise<string | null> {
  const { data: perfil } = await supabaseAdmin
    .from("profiles")
    .select("plano, acesso_ate")
    .eq("id", empresaId)
    .maybeSingle();
  if (!perfil) return null;
  const novo = novoAcessoAte(perfil.plano, perfil.acesso_ate, hojeBrasilia(), ciclo);
  if (!novo) return null;

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      plano: ciclo === "yearly" ? "anual" : "mensal",
      acesso_ate: novo,
      plano_solicitado: null,
      plano_solicitado_em: null,
    })
    .eq("id", empresaId);
  if (error) throw error;
  return novo;
}

export type ComprovantePagamento = {
  id: string;
  loja: string;
  plano: string;
  ciclo: BillingCycle;
  metodo: PaymentMethod;
  valor: number;
  pagoEm: string;
  acessoAte: string | null;
  codigo: string | null;
};

/** Dados do comprovante de um pagamento pago (null se não existe/não pago). */
export async function obterComprovante(
  paymentId: string,
  empresaId?: string,
): Promise<ComprovantePagamento | null> {
  const { data } = await supabaseAdmin
    .from("subscription_payments")
    .select(
      "id, amount, payment_method, status, paid_at, metadata, mercado_pago_payment_id, subscriptions(empresa_id, billing_cycle, plans(name), profiles:empresa_id(loja, nome))",
    )
    .eq("id", paymentId)
    .maybeSingle();
  if (!data || data.status !== "paid" || !data.paid_at) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- nested select shape isn't in the generated relationship helper
  const sub = (data as any).subscriptions as {
    empresa_id: string;
    billing_cycle: BillingCycle;
    plans: { name: string } | null;
    profiles: { loja: string | null; nome: string | null } | null;
  } | null;
  if (!sub || (empresaId && sub.empresa_id !== empresaId)) return null;
  const acessoAte = objetoJson(data.metadata)["acesso_ate"];
  return {
    id: data.id,
    loja: sub.profiles?.loja || sub.profiles?.nome || "Sua empresa",
    plano: sub.plans?.name ?? "SPACE TECH",
    ciclo: sub.billing_cycle,
    metodo: data.payment_method as PaymentMethod,
    valor: Number(data.amount),
    pagoEm: data.paid_at,
    acessoAte: typeof acessoAte === "string" ? acessoAte : null,
    codigo: data.mercado_pago_payment_id,
  };
}

/** Comprovante pelo WhatsApp para o número da empresa (uma vez por pagamento). */
async function enviarComprovante(paymentId: string): Promise<void> {
  try {
    const comprovante = await obterComprovante(paymentId);
    if (!comprovante) return;
    const { data: sub } = await supabaseAdmin
      .from("subscription_payments")
      .select("subscriptions(empresa_id)")
      .eq("id", paymentId)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- nested select shape isn't in the generated relationship helper
    const empresaId = (sub as any)?.subscriptions?.empresa_id as string | undefined;
    if (!empresaId) return;
    const { data: perfil } = await supabaseAdmin
      .from("profiles")
      .select("whatsapp, nome")
      .eq("id", empresaId)
      .maybeSingle();
    const telefone = (perfil?.whatsapp ?? "").replace(/\D/g, "");
    if (telefone.length < 10) {
      console.warn("[Comprovante plano] Empresa sem WhatsApp no cadastro:", empresaId);
      return;
    }
    const envio = await enviarDaPlataforma({
      telefone,
      nome: perfil?.nome ?? null,
      mensagem: textoComprovanteWhatsapp(comprovante),
      // aviso_plano_*: índice único — webhook repetido não manda duas vezes.
      templateId: `aviso_plano_comprovante_${paymentId}`,
    });
    if (envio !== "enviado") console.warn("[Comprovante plano] Não enviado:", envio, paymentId);
  } catch (erro) {
    console.error("[Comprovante plano] Erro:", erro);
  }
}

export type PixRenovacao = {
  paymentId: string;
  valor: number;
  plano: string;
  ciclo: BillingCycle;
  qrCode: string | null;
  qrCodeBase64: string | null;
  expiraEm: string;
};

/**
 * Pix de renovação (Meu Plano): uma cobrança avulsa no plano atual da
 * empresa (ou no plano ativo mais barato), mensal ou anual. Reaproveita a
 * assinatura mais recente da empresa (troca plano/ciclo se mudou) para o
 * histórico ficar num lugar só. A confirmação vem do webhook ou da tela
 * consultando (reconciliarPagamentoAssinatura), sempre re-checando o
 * Mercado Pago.
 */
export async function gerarPixRenovacao(input: {
  empresaId: string;
  ciclo: BillingCycle;
  payerEmail: string;
  origin: string;
}): Promise<PixRenovacao> {
  const { data: perfil } = await supabaseAdmin
    .from("profiles")
    .select("plan_id, plano")
    .eq("id", input.empresaId)
    .maybeSingle();
  if (perfil?.plano === "vitalicio")
    throw new Error("Seu plano é vitalício: não há o que renovar.");

  const { data: planos } = await supabaseAdmin
    .from("plans")
    .select("id, name, active, monthly_price, annual_price")
    .eq("active", true)
    .order("monthly_price", { ascending: true });
  const plan = planos?.find((p) => p.id === perfil?.plan_id) ?? planos?.[0];
  if (!plan) throw new PlanNotFoundError();
  const preco = input.ciclo === "monthly" ? plan.monthly_price : plan.annual_price;
  if (preco === null || preco <= 0) throw new PlanPriceNotConfiguredError();

  const gateway = obterGateway();

  const { data: ultima } = await supabaseAdmin
    .from("subscriptions")
    .select("id, plan_id, billing_cycle, status, mercado_pago_preapproval_id")
    .eq("empresa_id", input.empresaId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ultima?.status === "active" && ultima.mercado_pago_preapproval_id) {
    throw new Error(
      "Sua assinatura é no cartão e renova sozinha todo mês. Para pagar por Pix, cancele a do cartão primeiro.",
    );
  }
  let subscriptionId: string;
  if (ultima) {
    subscriptionId = ultima.id;
    if (ultima.plan_id !== plan.id || ultima.billing_cycle !== input.ciclo) {
      await supabaseAdmin
        .from("subscriptions")
        .update({ plan_id: plan.id, billing_cycle: input.ciclo })
        .eq("id", ultima.id);
    }
  } else {
    const { data: nova, error } = await supabaseAdmin
      .from("subscriptions")
      .insert({
        empresa_id: input.empresaId,
        plan_id: plan.id,
        billing_cycle: input.ciclo,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw error;
    subscriptionId = nova.id;
    await registrarEvento(subscriptionId, "SUBSCRIPTION_CREATED", {
      planId: plan.id,
      billingCycle: input.ciclo,
      origem: "renovacao_pix",
    });
  }

  const valor = comTaxaRepassada(preco, "pix");
  const externalReference = `ST-REN-${input.empresaId}-${subscriptionId}-${randomUUID()}`;
  const expiraEm = new Date(Date.now() + 30 * 60_000);
  const { data: payment, error: pagErro } = await supabaseAdmin
    .from("subscription_payments")
    .insert({
      subscription_id: subscriptionId,
      amount: valor,
      payment_method: "pix",
      status: "pending",
      external_reference: externalReference,
      expires_at: expiraEm.toISOString(),
      metadata: { renovacao: true, ciclo: input.ciclo },
    })
    .select("id")
    .single();
  if (pagErro) throw pagErro;

  const pix = await gateway.createPixPayment({
    valor,
    descricao: `SPACE TECH — Renovação plano ${plan.name} (${input.ciclo === "yearly" ? "anual" : "mensal"})`,
    externalReference,
    notificationUrl: `${input.origin}/api/subscriptions/mercadopago/webhook`,
    payerEmail: input.payerEmail,
    expiraEm,
  });
  await supabaseAdmin
    .from("subscription_payments")
    .update({ mercado_pago_payment_id: pix.mpId, status: pix.status })
    .eq("id", payment.id);
  await registrarEvento(subscriptionId, "MP_PAYMENT_CREATED", { mpId: pix.mpId, renovacao: true });

  return {
    paymentId: payment.id,
    valor,
    plano: plan.name,
    ciclo: input.ciclo,
    qrCode: pix.qrCode,
    qrCodeBase64: pix.qrCodeBase64,
    expiraEm: expiraEm.toISOString(),
  };
}

/** A tela de Meu Plano consulta isso enquanto o QR está aberto: confere no
 * Mercado Pago (caso o webhook demore ou não chegue) e devolve o status. */
export async function statusPixRenovacao(
  paymentId: string,
  empresaId: string,
): Promise<{ status: string; comprovante: ComprovantePagamento | null }> {
  const { data } = await supabaseAdmin
    .from("subscription_payments")
    .select("id, status, mercado_pago_payment_id, expires_at, subscriptions(empresa_id)")
    .eq("id", paymentId)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- nested select shape isn't in the generated relationship helper
  if (!data || (data as any).subscriptions?.empresa_id !== empresaId) {
    throw new SubscriptionNotFoundError();
  }
  if (data.status === "pending" && data.mercado_pago_payment_id) {
    await reconciliarPagamentoAssinatura(data.mercado_pago_payment_id);
  }
  const { data: atual } = await supabaseAdmin
    .from("subscription_payments")
    .select("status")
    .eq("id", paymentId)
    .single();
  const status = atual?.status ?? data.status;
  return {
    status,
    comprovante: status === "paid" ? await obterComprovante(paymentId, empresaId) : null,
  };
}

/** Cobrança mensal/anual de uma assinatura no cartão (webhook
 * subscription_authorized_payment). Re-consulta o Mercado Pago, registra o
 * pagamento aprovado em subscription_payments (uma vez só) e avança a
 * próxima cobrança. A 1ª cobrança é a da ativação (aviso "plano pago" vem de
 * reconciliarAssinatura); as seguintes avisam o dono como renovação. */
export async function reconciliarPagamentoCartao(mpAuthorizedPaymentId: string): Promise<void> {
  const gateway = obterGateway();
  const cobranca = await gateway.getCardRecurringPayment(mpAuthorizedPaymentId);
  if (cobranca.status !== "paid" || !cobranca.preapprovalId) return;

  const { data: subscription } = await supabaseAdmin
    .from("subscriptions")
    .select("id, status, billing_cycle")
    .eq("mercado_pago_preapproval_id", cobranca.preapprovalId)
    .maybeSingle();
  if (!subscription) return; // não é nossa

  const { count: anteriores } = await supabaseAdmin
    .from("subscription_payments")
    .select("id", { count: "exact", head: true })
    .eq("subscription_id", subscription.id)
    .eq("payment_method", "credit_card")
    .eq("status", "paid");

  const { data: registrado, error } = await supabaseAdmin
    .from("subscription_payments")
    .insert({
      subscription_id: subscription.id,
      amount: cobranca.amount,
      payment_method: "credit_card",
      status: "paid",
      paid_at: new Date().toISOString(),
      // Prefixo: ids de cobrança do cartão e de pagamento Pix são de espaços
      // diferentes no Mercado Pago e dividem esta coluna única.
      mercado_pago_payment_id: `ap-${mpAuthorizedPaymentId}`,
      external_reference: `ST-AP-${mpAuthorizedPaymentId}`,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return; // webhook repetido — já registrado
    throw error;
  }
  await registrarEvento(subscription.id, "MP_CARD_PAYMENT_PAID", {
    mpId: mpAuthorizedPaymentId,
    amount: cobranca.amount,
  });

  const ciclo = subscription.billing_cycle as BillingCycle;
  await supabaseAdmin
    .from("subscriptions")
    .update({ next_billing_date: proximaCobranca(ciclo) })
    .eq("id", subscription.id);

  // Cada cobrança aprovada do cartão renova o prazo de acesso (inclusive a 1ª).
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("empresa_id")
    .eq("id", subscription.id)
    .single();
  const acessoAte = sub ? await estenderAcesso(sub.empresa_id, ciclo) : null;
  await supabaseAdmin
    .from("subscription_payments")
    .update({ metadata: { acesso_ate: acessoAte } })
    .eq("id", registrado.id);

  if (anteriores && subscription.status === "active") {
    await avisarPagamentoPlano("renovado", subscription.id, registrado.id, {
      metodo: "cartão",
      valor: cobranca.amount,
      acessoAte,
    });
  }
  await enviarComprovante(registrado.id);
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
