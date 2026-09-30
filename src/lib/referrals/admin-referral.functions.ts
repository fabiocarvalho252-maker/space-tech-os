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

    const [{ data: perfis, error: perfisErro }, { data: usersPage, error: usersErro }, { data: comissoes, error: comissoesErro }] =
      await Promise.all([
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
