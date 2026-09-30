// Site-admin-only server functions behind /admin → "Programa de
// Indicações" (Fase A). Same authorization model as the rest of
// site-admin.functions.ts: a single hardcoded operator e-mail, checked
// server-side on every call — never a grantable role, and never enforced
// only by hiding a link in the UI.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SITE_ADMIN_EMAIL = "admin@spacetech.app";

function checarSiteAdmin(claims: Record<string, unknown>) {
  if (claims["email"] !== SITE_ADMIN_EMAIL) {
    throw new Error("Acesso restrito ao administrador do site.");
  }
}

export type ConfiguracaoIndicacoes = {
  id: string;
  name: string;
  active: boolean;
  description: string | null;
  commissionType: "FIXED" | "PERCENTAGE" | "PER_PLAN" | null;
  commissionValue: number | null;
  minimumWithdrawal: number | null;
  pendingDays: number | null;
  recurringCommission: boolean;
  firstPaymentOnly: boolean;
  whatsappShareMessage: string | null;
};

export const obterConfiguracaoIndicacoesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConfiguracaoIndicacoes> => {
    checarSiteAdmin(context.claims);

    const { data, error } = await supabaseAdmin
      .from("referral_program_config")
      .select("*")
      .limit(1)
      .single();
    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      active: data.active,
      description: data.description,
      commissionType: data.commission_type as ConfiguracaoIndicacoes["commissionType"],
      commissionValue: data.commission_value,
      minimumWithdrawal: data.minimum_withdrawal,
      pendingDays: data.pending_days,
      recurringCommission: data.recurring_commission,
      firstPaymentOnly: data.first_payment_only,
      whatsappShareMessage: data.whatsapp_share_message,
    };
  });

// Todo campo numérico chega aqui null quando o formulário está em branco —
// nunca 0. NULL continua significando "não configurado" (mesma convenção
// de plans.monthly_price).
const atualizarConfigSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  active: z.boolean(),
  description: z.string().trim().max(500).nullable(),
  commissionType: z.enum(["FIXED", "PERCENTAGE", "PER_PLAN"]).nullable(),
  commissionValue: z.number().nonnegative().nullable(),
  minimumWithdrawal: z.number().nonnegative().nullable(),
  pendingDays: z.number().int().nonnegative().nullable(),
  recurringCommission: z.boolean(),
  firstPaymentOnly: z.boolean(),
  whatsappShareMessage: z.string().trim().max(1000).nullable(),
});

export const atualizarConfiguracaoIndicacoesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => atualizarConfigSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    checarSiteAdmin(context.claims);

    const { error } = await supabaseAdmin
      .from("referral_program_config")
      .update({
        name: data.name,
        active: data.active,
        description: data.description,
        commission_type: data.commissionType,
        commission_value: data.commissionValue,
        minimum_withdrawal: data.minimumWithdrawal,
        pending_days: data.pendingDays,
        recurring_commission: data.recurringCommission,
        first_payment_only: data.firstPaymentOnly,
        whatsapp_share_message: data.whatsappShareMessage,
      })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export type RegraIndicacaoPorPlano = {
  planId: string;
  planName: string;
  ruleId: string | null;
  commissionType: "FIXED" | "PERCENTAGE";
  commissionValue: number | null;
  active: boolean;
};

export const listarRegrasIndicacaoPorPlanoFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RegraIndicacaoPorPlano[]> => {
    checarSiteAdmin(context.claims);

    const [{ data: plans, error: plansErro }, { data: regras, error: regrasErro }] =
      await Promise.all([
        supabaseAdmin.from("plans").select("id, name").eq("active", true).order("sort_order"),
        supabaseAdmin
          .from("referral_plan_rules")
          .select("id, plan_id, commission_type, commission_value, active"),
      ]);
    if (plansErro) throw plansErro;
    if (regrasErro) throw regrasErro;

    return (plans ?? []).map((p) => {
      const regra = (regras ?? []).find((r) => r.plan_id === p.id) ?? null;
      return {
        planId: p.id,
        planName: p.name,
        ruleId: regra?.id ?? null,
        commissionType: (regra?.commission_type as "FIXED" | "PERCENTAGE") ?? "FIXED",
        commissionValue: regra?.commission_value ?? null,
        active: regra?.active ?? true,
      };
    });
  });

const atualizarRegraSchema = z.object({
  planId: z.string().uuid(),
  commissionType: z.enum(["FIXED", "PERCENTAGE"]),
  commissionValue: z.number().nonnegative().nullable(),
  active: z.boolean(),
});

export const atualizarRegraIndicacaoPorPlanoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => atualizarRegraSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    checarSiteAdmin(context.claims);

    const { error } = await supabaseAdmin.from("referral_plan_rules").upsert(
      {
        plan_id: data.planId,
        commission_type: data.commissionType,
        commission_value: data.commissionValue,
        active: data.active,
      },
      { onConflict: "plan_id" },
    );
    if (error) throw error;
    return { ok: true };
  });

export type EmpresaIndicacao = {
  nome: string | null;
  loja: string | null;
  email: string | null;
};

export type Indicacao = {
  id: string;
  referralCode: string;
  status: string;
  registradoEm: string | null;
  convertidoEm: string | null;
  indicador: EmpresaIndicacao;
  indicado: EmpresaIndicacao | null;
  comissaoTotal: number;
};

// Painel operacional do programa de indicações (continuação da fundação
// acima): quem indicou quem, com qual código, e o total de comissão já
// gerada por essa indicação. Somente leitura — nenhuma escrita acontece
// aqui, os status/comissões são derivados de registrarReferralFn e
// processarComissaoIndicacao (commission-service.ts).
export const listarIndicacoesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ indicacoes: Indicacao[] }> => {
    checarSiteAdmin(context.claims);

    const { data: referrals, error: referralsErro } = await supabaseAdmin
      .from("referrals")
      .select(
        "id, referrer_empresa_id, referred_empresa_id, referral_code, status, registered_at, converted_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (referralsErro) throw referralsErro;
    if (!referrals?.length) return { indicacoes: [] };

    const empresaIds = Array.from(
      new Set(
        referrals.flatMap((r) => [r.referrer_empresa_id, r.referred_empresa_id]).filter(Boolean),
      ),
    ) as string[];
    const referralIds = referrals.map((r) => r.id);

    const [
      { data: perfis, error: perfisErro },
      { data: usersPage, error: usersErro },
      { data: comissoes, error: comissoesErro },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, nome, loja").in("id", empresaIds),
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
      supabaseAdmin
        .from("referral_commissions")
        .select("referral_id, amount")
        .in("referral_id", referralIds)
        .not("status", "in", "(rejected,canceled)"),
    ]);
    if (perfisErro) throw perfisErro;
    if (usersErro) throw usersErro;
    if (comissoesErro) throw comissoesErro;

    const perfilPorId = new Map((perfis ?? []).map((p) => [p.id, p]));
    const emailPorId = new Map(usersPage.users.map((u) => [u.id, u.email ?? null]));
    const comissaoPorReferral = new Map<string, number>();
    for (const c of comissoes ?? []) {
      comissaoPorReferral.set(
        c.referral_id,
        (comissaoPorReferral.get(c.referral_id) ?? 0) + Number(c.amount),
      );
    }

    function empresaInfo(id: string | null): EmpresaIndicacao | null {
      if (!id) return null;
      const p = perfilPorId.get(id);
      return { nome: p?.nome ?? null, loja: p?.loja ?? null, email: emailPorId.get(id) ?? null };
    }

    return {
      indicacoes: referrals.map((r) => ({
        id: r.id,
        referralCode: r.referral_code,
        status: r.status,
        registradoEm: r.registered_at,
        convertidoEm: r.converted_at,
        indicador: empresaInfo(r.referrer_empresa_id) ?? { nome: null, loja: null, email: null },
        indicado: empresaInfo(r.referred_empresa_id),
        comissaoTotal: comissaoPorReferral.get(r.id) ?? 0,
      })),
    };
  });

export type Indicador = {
  empresaId: string;
  nome: string | null;
  loja: string | null;
  email: string | null;
  referralCode: string;
  totalIndicacoes: number;
  convertidas: number;
  descontoDisponivel: number;
  descontoUsado: number;
  bonificacoesPix: { id: string; valor: number; pagoEm: string | null; nota: string | null }[];
};

// Quem indica: quantas empresas trouxe, quantas viraram pagantes, quanto
// desconto de mensalidade tem para usar/já usou e as bonificações em Pix
// já registradas — base para o admin decidir quem merece uma bonificação.
export const listarIndicadoresFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Indicador[]> => {
    checarSiteAdmin(context.claims);

    const { data: referrals, error } = await supabaseAdmin
      .from("referrals")
      .select("referrer_empresa_id, referral_code, status");
    if (error) throw error;
    if (!referrals?.length) return [];

    const ids = Array.from(new Set(referrals.map((r) => r.referrer_empresa_id)));
    const [perfis, usuarios, comissoes, bonus] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, nome, loja").in("id", ids),
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
      supabaseAdmin
        .from("referral_commissions")
        .select("referrer_empresa_id, amount, status")
        .in("referrer_empresa_id", ids)
        .in("status", ["available", "used"]),
      supabaseAdmin
        .from("referral_withdrawals")
        .select("id, referrer_empresa_id, amount, paid_at, notes")
        .in("referrer_empresa_id", ids)
        .eq("status", "paid")
        .order("paid_at", { ascending: false }),
    ]);
    for (const r of [perfis, usuarios, comissoes, bonus]) if (r.error) throw r.error;

    const perfilPorId = new Map((perfis.data ?? []).map((p) => [p.id, p]));
    const emailPorId = new Map((usuarios.data?.users ?? []).map((u) => [u.id, u.email ?? null]));

    const lista = ids.map((id): Indicador => {
      const minhas = referrals.filter((r) => r.referrer_empresa_id === id);
      const minhasComissoes = (comissoes.data ?? []).filter((c) => c.referrer_empresa_id === id);
      const soma = (status: string) =>
        Math.round(
          minhasComissoes
            .filter((c) => c.status === status)
            .reduce((s, c) => s + Number(c.amount), 0) * 100,
        ) / 100;
      return {
        empresaId: id,
        nome: perfilPorId.get(id)?.nome ?? null,
        loja: perfilPorId.get(id)?.loja ?? null,
        email: emailPorId.get(id) ?? null,
        referralCode: minhas[0]?.referral_code ?? "",
        totalIndicacoes: minhas.length,
        convertidas: minhas.filter((r) => r.status === "converted").length,
        descontoDisponivel: soma("available"),
        descontoUsado: soma("used"),
        bonificacoesPix: (bonus.data ?? [])
          .filter((b) => b.referrer_empresa_id === id)
          .map((b) => ({ id: b.id, valor: Number(b.amount), pagoEm: b.paid_at, nota: b.notes })),
      };
    });
    return lista.sort(
      (a, b) => b.convertidas - a.convertidas || b.totalIndicacoes - a.totalIndicacoes,
    );
  });

const bonificacaoSchema = z.object({
  empresaId: z.string().uuid(),
  valor: z.number().positive().max(100000),
  chavePix: z.string().trim().max(140).optional(),
  nota: z.string().trim().max(500).optional(),
});

// Registra uma bonificação em Pix que o admin já pagou (pelo banco, fora do
// sistema) a quem indica muitas empresas. Fica em referral_withdrawals
// (payment_method = 'pix', status 'paid') e aparece para a empresa em
// /indicacoes.
export const registrarBonificacaoPixFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => bonificacaoSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    checarSiteAdmin(context.claims);
    const agora = new Date().toISOString();
    const { data: bonus, error } = await supabaseAdmin
      .from("referral_withdrawals")
      .insert({
        referrer_empresa_id: data.empresaId,
        amount: Math.round(data.valor * 100) / 100,
        status: "paid",
        payment_method: "pix",
        pix_key: data.chavePix || null,
        notes: data.nota
          ? `Bonificação por indicações — ${data.nota}`
          : "Bonificação por indicações",
        requested_at: agora,
        approved_at: agora,
        paid_at: agora,
      })
      .select("id")
      .single();
    if (error) throw error;
    await supabaseAdmin.from("referral_events").insert({
      type: "BONUS_PIX_PAID",
      withdrawal_id: bonus.id,
      actor_empresa_id: data.empresaId,
      payload: { valor: data.valor },
    });
    return { ok: true };
  });
