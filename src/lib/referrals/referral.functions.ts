// Self-service server functions — anything a logged-in empresa can trigger
// about its own referral standing. Writes go through supabaseAdmin (RLS on
// referral_profiles/referrals only grants read access, by design: a brand
// new account has no way to read another empresa's referral_profiles row
// through its own session), but every write here is scoped to the caller's
// own empresa_id — never another tenant's data.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function resolverEmpresaId(userId: string, supabase: typeof supabaseAdmin) {
  const { data: membership } = await supabase
    .from("user_empresas")
    .select("empresa_id")
    .eq("user_id", userId);
  return (
    membership?.find((m) => m.empresa_id !== userId)?.empresa_id ??
    membership?.[0]?.empresa_id ??
    userId
  );
}

const registrarSchema = z.object({ referralCode: z.string().trim().min(1).max(20) });

export type RegistrarReferralResultado =
  { ok: true } | { ok: false; reason: "invalid" | "self" | "already-referred" };

/** Called once, right after supabase.auth.signUp() succeeds on /cadastro,
 * with whatever code the client captured from ?ref= (see cadastro.tsx). A
 * new signup is always its own empresa (profiles.id === auth uid) — invited
 * team members never go through this flow, they redeem an invite code
 * instead, so resolverEmpresaId's "own id" fallback is always correct here. */
export const registrarReferralFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => registrarSchema.parse(data))
  .handler(async ({ data, context }): Promise<RegistrarReferralResultado> => {
    const referredEmpresaId = context.userId;
    const codigo = data.referralCode.trim().toUpperCase();

    const { data: perfil } = await supabaseAdmin
      .from("referral_profiles")
      .select("empresa_id, active")
      .eq("referral_code", codigo)
      .maybeSingle();
    if (!perfil || !perfil.active) return { ok: false, reason: "invalid" };

    // Fase 61: bloquear autoindicação — mesma conta, ou a mesma empresa
    // (um convidado tentando "indicar" a própria empresa que já integra).
    if (perfil.empresa_id === referredEmpresaId) return { ok: false, reason: "self" };

    const { data: existente } = await supabaseAdmin
      .from("referrals")
      .select("id")
      .eq("referred_empresa_id", referredEmpresaId)
      .maybeSingle();
    if (existente) return { ok: false, reason: "already-referred" };

    const agora = new Date().toISOString();
    const { error } = await supabaseAdmin.from("referrals").insert({
      referrer_empresa_id: perfil.empresa_id,
      referred_empresa_id: referredEmpresaId,
      referral_code: codigo,
      status: "registered",
      registered_at: agora,
    });
    // 23505 = a corrida rara de duas chamadas simultâneas batendo no mesmo
    // índice único de referred_empresa_id — trata como sucesso silencioso,
    // não como erro para o usuário que acabou de criar a conta.
    if (error && error.code !== "23505") throw error;

    await supabaseAdmin.from("referral_events").insert({
      type: "REFERRAL_REGISTERED",
      payload: { referredEmpresaId },
    });

    return { ok: true };
  });

export type MeuPerfilIndicacao = {
  referralCode: string;
  programAtivo: boolean;
  programDescription: string | null;
  whatsappShareMessage: string | null;
};

/** Backs /indicacoes and the "Programa de Indicações" dashboard shortcut —
 * the only fields a regular (non-site-admin) empresa is allowed to read
 * about the program: its own code and the public-facing copy, never the
 * commission model/value (that stays behind checarSiteAdmin in
 * admin-referral.functions.ts, same boundary as plans' price vs display
 * copy). */
export const meuPerfilIndicacaoFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MeuPerfilIndicacao | null> => {
    const empresaId = await resolverEmpresaId(context.userId, context.supabase);
    const [{ data: perfil }, { data: program }] = await Promise.all([
      context.supabase
        .from("referral_profiles")
        .select("referral_code")
        .eq("empresa_id", empresaId)
        .maybeSingle(),
      context.supabase
        .from("referral_program_config")
        .select("active, description, whatsapp_share_message")
        .limit(1)
        .maybeSingle(),
    ]);
    if (!perfil) return null;
    return {
      referralCode: perfil.referral_code,
      programAtivo: program?.active ?? false,
      programDescription: program?.description ?? null,
      whatsappShareMessage: program?.whatsapp_share_message ?? null,
    };
  });

export type MeuDescontoIndicacao = {
  valorPorIndicacao: number | null;
  disponivel: number;
  creditos: number;
  historico: { valor: number; status: "available" | "used"; data: string; nota: string | null }[];
  bonificacoes: { valor: number; pagoEm: string | null }[];
};

/** Recompensa da própria empresa no programa: desconto na próxima
 * mensalidade (R$ por indicação convertida) e bonificações em Pix que o
 * admin registrou. Só dados da empresa de quem chama. */
export const meuDescontoIndicacaoFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MeuDescontoIndicacao> => {
    const empresaId = await resolverEmpresaId(context.userId, context.supabase);
    const [program, comissoes, bonus] = await Promise.all([
      supabaseAdmin
        .from("referral_program_config")
        .select("commission_type, commission_value")
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("referral_commissions")
        .select("amount, status, created_at, used_at, used_note")
        .eq("referrer_empresa_id", empresaId)
        .in("status", ["available", "used"])
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("referral_withdrawals")
        .select("amount, paid_at")
        .eq("referrer_empresa_id", empresaId)
        .eq("status", "paid")
        .order("paid_at", { ascending: false }),
    ]);
    if (comissoes.error) throw comissoes.error;
    if (bonus.error) throw bonus.error;

    const disponiveis = (comissoes.data ?? []).filter((c) => c.status === "available");
    return {
      valorPorIndicacao:
        program.data?.commission_type === "FIXED" && program.data.commission_value != null
          ? Number(program.data.commission_value)
          : null,
      disponivel: Math.round(disponiveis.reduce((s, c) => s + Number(c.amount), 0) * 100) / 100,
      creditos: disponiveis.length,
      historico: (comissoes.data ?? []).map((c) => ({
        valor: Number(c.amount),
        status: c.status as "available" | "used",
        data: (c.status === "used" ? c.used_at : c.created_at) ?? c.created_at,
        nota: c.status === "used" ? c.used_note : null,
      })),
      bonificacoes: (bonus.data ?? []).map((b) => ({ valor: Number(b.amount), pagoEm: b.paid_at })),
    };
  });
