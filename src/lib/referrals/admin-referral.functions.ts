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
        supabaseAdmin.from("plans").select("id, name").order("sort_order"),
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
