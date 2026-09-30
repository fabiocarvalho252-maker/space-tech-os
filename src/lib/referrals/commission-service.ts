// Orchestrates referral_commissions creation from a confirmed subscription
// activation. Server-only, mirrors mercadopago/subscription-service.ts's
// core rule: this only ever runs after ativarAssinatura() — which itself
// only fires once a Mercado Pago status has been re-fetched and confirmed
// (never trusts a webhook's claimed status) — so every commission created
// here is backed by a real, confirmed payment.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

type CommissionType = "FIXED" | "PERCENTAGE";
type BillingCycle = "monthly" | "yearly";

async function registrarEvento(
  type: string,
  fields: {
    referralId?: string | null;
    commissionId?: string | null;
    withdrawalId?: string | null;
    actorEmpresaId?: string | null;
    payload?: Record<string, Json>;
  } = {},
) {
  await supabaseAdmin.from("referral_events").insert({
    type,
    referral_id: fields.referralId ?? null,
    commission_id: fields.commissionId ?? null,
    withdrawal_id: fields.withdrawalId ?? null,
    actor_empresa_id: fields.actorEmpresaId ?? null,
    payload: fields.payload ?? null,
  });
}

/** Called right after iniciarAssinatura() creates a subscription row — the
 * referral (if any) moves from REGISTERED to PENDING while the payment is
 * still being processed. Best-effort: a referral system hiccup must never
 * block a real subscription checkout. */
export async function marcarReferralComoPendente(referredEmpresaId: string): Promise<void> {
  try {
    const { data: referral } = await supabaseAdmin
      .from("referrals")
      .select("id, status")
      .eq("referred_empresa_id", referredEmpresaId)
      .maybeSingle();
    if (!referral || referral.status !== "registered") return;

    await supabaseAdmin.from("referrals").update({ status: "pending" }).eq("id", referral.id);
    await registrarEvento("REFERRAL_PENDING", { referralId: referral.id });
  } catch (erro) {
    console.error("[Referrals] Falha ao marcar referral como pendente:", erro);
  }
}

type ProgramConfig = {
  active: boolean;
  commission_type: string | null;
  commission_value: number | null;
};

type PlanRule = {
  commission_type: string;
  commission_value: number | null;
  active: boolean;
};

type Plano = {
  monthly_price: number | null;
  annual_price: number | null;
};

/** Pure calculation, kept separate from I/O so the rule is defined in
 * exactly one place (Fase 49: "Nunca permitir cálculo financeiro espalhado
 * em várias páginas"). Percentual commissions are based on the plan's own
 * catalog price (plans.monthly_price/annual_price) for the subscription's
 * billing cycle — not the Mercado Pago fee-inclusive charged amount — so
 * the same rule applies identically to both payment methods (the card
 * flow never persists a charged amount anywhere to read back). Returns
 * null whenever nothing is configured — never fabricates a value. */
export function calcularComissaoIndicacao(input: {
  program: ProgramConfig;
  planRule: PlanRule | null;
  plano: Plano;
  billingCycle: BillingCycle;
}): { type: CommissionType; amount: number } | null {
  const { program, planRule, plano, billingCycle } = input;
  if (!program.active) return null;

  let type: CommissionType;
  let value: number | null;

  if (program.commission_type === "PER_PLAN") {
    if (!planRule || !planRule.active || planRule.commission_value === null) return null;
    type = planRule.commission_type as CommissionType;
    value = planRule.commission_value;
  } else if (program.commission_type === "FIXED" || program.commission_type === "PERCENTAGE") {
    type = program.commission_type;
    value = program.commission_value;
  } else {
    return null; // commission_type ainda não configurado
  }

  if (value === null || value <= 0) return null;

  if (type === "FIXED") {
    return { type, amount: Math.round(value * 100) / 100 };
  }

  const base = billingCycle === "monthly" ? plano.monthly_price : plano.annual_price;
  if (base === null || base <= 0) return null;
  return { type, amount: Math.round(base * (value / 100) * 100) / 100 };
}

/** The single hook point called from ativarAssinatura(). Never throws —
 * a referral/commission failure must never break the subscription
 * activation that just happened. Idempotent: referral_commissions has a
 * unique index on subscription_id, so a duplicate webhook delivery (two
 * concurrent calls for the same subscription) can insert at most once;
 * the loser just hits a 23505 and treats it as already-done. */
export async function processarComissaoIndicacao(
  subscriptionId: string,
  planId: string,
  empresaId: string,
): Promise<void> {
  try {
    const { data: referral } = await supabaseAdmin
      .from("referrals")
      .select("id, status, referrer_empresa_id")
      .eq("referred_empresa_id", empresaId)
      .maybeSingle();
    if (!referral || referral.status === "converted" || referral.status === "canceled") return;

    const [{ data: subscription }, { data: plano }, { data: program }, { data: planRule }] =
      await Promise.all([
        supabaseAdmin
          .from("subscriptions")
          .select("id, billing_cycle")
          .eq("id", subscriptionId)
          .maybeSingle(),
        supabaseAdmin
          .from("plans")
          .select("monthly_price, annual_price")
          .eq("id", planId)
          .maybeSingle(),
        supabaseAdmin
          .from("referral_program_config")
          .select("active, commission_type, commission_value")
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from("referral_plan_rules")
          .select("commission_type, commission_value, active")
          .eq("plan_id", planId)
          .maybeSingle(),
      ]);
    if (!subscription || !plano || !program) return;

    const calculo = calcularComissaoIndicacao({
      program,
      planRule: planRule ?? null,
      plano,
      billingCycle: subscription.billing_cycle as BillingCycle,
    });

    if (calculo) {
      const { data: comissao, error } = await supabaseAdmin
        .from("referral_commissions")
        .insert({
          referral_id: referral.id,
          referrer_empresa_id: referral.referrer_empresa_id,
          subscription_id: subscriptionId,
          plan_id: planId,
          commission_type: calculo.type,
          amount: calculo.amount,
          // Recompensa = desconto na próxima mensalidade de quem indicou
          // (ver aplicarDescontoIndicacao) — já nasce disponível, pois só
          // é criada depois de um pagamento confirmado.
          status: "available",
          available_at: new Date().toISOString(),
          description: "Desconto na próxima mensalidade — indicação convertida",
        })
        .select("id")
        .single();

      if (error && error.code !== "23505") throw error;
      if (comissao)
        await registrarEvento("COMMISSION_CREATED", {
          referralId: referral.id,
          commissionId: comissao.id,
        });
    }

    if (referral.status !== "converted") {
      await supabaseAdmin
        .from("referrals")
        .update({ status: "converted", converted_at: new Date().toISOString() })
        .eq("id", referral.id);
      await registrarEvento("REFERRAL_CONVERTED", {
        referralId: referral.id,
        payload: { comissaoGerada: !!calculo },
      });
    }
  } catch (erro) {
    console.error("[Referrals] Falha ao processar comissão de indicação:", erro);
  }
}

/** If the payment that generated a pending/available commission gets
 * refunded/canceled, the commission follows it (Fase 15) — never deletes
 * history, only moves status. Called from a future cancellation/refund
 * hook (not wired to anything yet in Fase A, kept here so the rule lives
 * in one place when that hook is added). */
export async function cancelarComissaoPorAssinatura(subscriptionId: string): Promise<void> {
  const { data: comissao } = await supabaseAdmin
    .from("referral_commissions")
    .select("id, status")
    .eq("subscription_id", subscriptionId)
    .maybeSingle();
  if (!comissao) return;
  if (comissao.status !== "pending" && comissao.status !== "available") return;

  await supabaseAdmin
    .from("referral_commissions")
    .update({ status: "canceled", canceled_at: new Date().toISOString() })
    .eq("id", comissao.id);
  await registrarEvento("COMMISSION_CANCELED", { commissionId: comissao.id });
}

/** Ativação manual pelo administrador do site (/admin → plano pago), que é
 * como as empresas viram clientes pagantes hoje — sem passar pelo Mercado
 * Pago, processarComissaoIndicacao nunca rodaria e quem indicou nunca
 * ganharia o desconto. Mesma regra (calcularComissaoIndicacao), sem
 * assinatura vinculada. Só a primeira ativação paga conta (a indicação
 * vira "converted"). Nunca lança. */
export async function processarIndicacaoAtivacaoManual(
  referredEmpresaId: string,
  plano: "mensal" | "anual" | "vitalicio",
): Promise<void> {
  try {
    const { data: referral } = await supabaseAdmin
      .from("referrals")
      .select("id, status, referrer_empresa_id")
      .eq("referred_empresa_id", referredEmpresaId)
      .maybeSingle();
    if (!referral || referral.status === "converted" || referral.status === "canceled") return;

    const planoInfo = await planoDaEmpresa(referredEmpresaId);
    const [{ data: program }, { data: planRule }] = await Promise.all([
      supabaseAdmin
        .from("referral_program_config")
        .select("active, commission_type, commission_value")
        .limit(1)
        .maybeSingle(),
      planoInfo
        ? supabaseAdmin
            .from("referral_plan_rules")
            .select("commission_type, commission_value, active")
            .eq("plan_id", planoInfo.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    if (!program) return;

    const calculo = calcularComissaoIndicacao({
      program,
      planRule: planRule ?? null,
      plano: planoInfo ?? { monthly_price: null, annual_price: null },
      billingCycle: plano === "anual" ? "yearly" : "monthly",
    });

    // Marca como convertida antes de creditar: se duas ativações chegarem
    // juntas, só a que virar o status gera o crédito.
    const { data: virou } = await supabaseAdmin
      .from("referrals")
      .update({ status: "converted", converted_at: new Date().toISOString() })
      .eq("id", referral.id)
      .neq("status", "converted")
      .select("id");
    if (!virou?.length) return;
    await registrarEvento("REFERRAL_CONVERTED", {
      referralId: referral.id,
      payload: { comissaoGerada: !!calculo, origem: "ativacao_manual" },
    });

    if (!calculo) return;
    const { data: comissao, error } = await supabaseAdmin
      .from("referral_commissions")
      .insert({
        referral_id: referral.id,
        referrer_empresa_id: referral.referrer_empresa_id,
        plan_id: planoInfo?.id ?? null,
        commission_type: calculo.type,
        amount: calculo.amount,
        status: "available",
        available_at: new Date().toISOString(),
        description: "Desconto na próxima mensalidade — indicação convertida",
      })
      .select("id")
      .single();
    if (error) throw error;
    await registrarEvento("COMMISSION_CREATED", {
      referralId: referral.id,
      commissionId: comissao.id,
    });
  } catch (erro) {
    console.error("[Referrals] Falha ao processar indicação (ativação manual):", erro);
  }
}

async function planoDaEmpresa(
  empresaId: string,
): Promise<{ id: string; monthly_price: number | null; annual_price: number | null } | null> {
  const { data: perfil } = await supabaseAdmin
    .from("profiles")
    .select("plan_id")
    .eq("id", empresaId)
    .maybeSingle();
  const query = supabaseAdmin.from("plans").select("id, monthly_price, annual_price");
  const { data } = perfil?.plan_id
    ? await query.eq("id", perfil.plan_id).maybeSingle()
    : await query.eq("slug", "basico").maybeSingle();
  return data ?? null;
}

/** Mensalidade (preço mensal do plano da empresa), base do desconto. */
export async function mensalidadeDaEmpresa(empresaId: string): Promise<number | null> {
  const plano = await planoDaEmpresa(empresaId);
  return plano?.monthly_price != null ? Number(plano.monthly_price) : null;
}

type CreditoDesconto = { id: string; amount: number };

async function creditosDisponiveis(empresaId: string): Promise<CreditoDesconto[]> {
  const { data, error } = await supabaseAdmin
    .from("referral_commissions")
    .select("id, amount")
    .eq("referrer_empresa_id", empresaId)
    .eq("status", "available")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((c) => ({ id: c.id, amount: Number(c.amount) }));
}

/** Escolhe os créditos (mais antigos primeiro) que cabem em `limite` —
 * o desconto vale só para a próxima mensalidade e nunca passa do valor
 * dela; o que sobrar fica para os meses seguintes. */
function escolherCreditos(creditos: CreditoDesconto[], limite: number) {
  const escolhidos: CreditoDesconto[] = [];
  let total = 0;
  for (const c of creditos) {
    if (total + c.amount > limite + 0.001) continue;
    escolhidos.push(c);
    total = Math.round((total + c.amount) * 100) / 100;
  }
  return { escolhidos, total };
}

export async function saldoDescontoIndicacao(
  empresaId: string,
): Promise<{ disponivel: number; creditos: number }> {
  const creditos = await creditosDisponiveis(empresaId);
  return {
    disponivel: Math.round(creditos.reduce((s, c) => s + c.amount, 0) * 100) / 100,
    creditos: creditos.length,
  };
}

/** Quanto de desconto caberia agora numa mensalidade de `limite` reais,
 * sem consumir nada (prévia para o admin / valor da cobrança Pix). */
export async function previaDescontoIndicacao(empresaId: string, limite: number): Promise<number> {
  if (limite <= 0) return 0;
  return escolherCreditos(await creditosDisponiveis(empresaId), limite).total;
}

/** Consome créditos de desconto (até `limite`) marcando-os como usados.
 * Cada crédito só vira "used" se ainda estiver "available" — duas
 * renovações simultâneas nunca usam o mesmo crédito duas vezes. */
export async function aplicarDescontoIndicacao(
  empresaId: string,
  limite: number,
  nota: string,
): Promise<number> {
  if (limite <= 0) return 0;
  const { escolhidos } = escolherCreditos(await creditosDisponiveis(empresaId), limite);
  let aplicado = 0;
  for (const c of escolhidos) {
    const { data } = await supabaseAdmin
      .from("referral_commissions")
      .update({ status: "used", used_at: new Date().toISOString(), used_note: nota })
      .eq("id", c.id)
      .eq("status", "available")
      .select("id");
    if (data?.length) {
      aplicado = Math.round((aplicado + c.amount) * 100) / 100;
      await registrarEvento("COMMISSION_USED_AS_DISCOUNT", {
        commissionId: c.id,
        actorEmpresaId: empresaId,
        payload: { nota },
      });
    }
  }
  return aplicado;
}
