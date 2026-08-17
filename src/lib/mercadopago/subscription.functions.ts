// Server functions behind /planos (contratar) and /assinatura (histórico,
// cancelar) — the only entry points the frontend has into
// subscription-service.ts. Never accepts price, plan tier or status from
// the caller as authoritative: everything is re-read from the database.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { origemPublicaServer } from "@/lib/site-url.server";
import {
  cancelarAssinatura,
  iniciarAssinatura,
  type IniciarAssinaturaResultado,
} from "./subscription-service";

// Mesma resolução de empresaId usada em toda parte (solicitarPlano,
// requireFeature nos server functions de IA) — a conta logada pode ser um
// membro convidado, cuja empresa não é o próprio user_id.
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

const iniciarSchema = z.object({
  planId: z.string().uuid(),
  billingCycle: z.enum(["monthly", "yearly"]),
  paymentMethod: z.enum(["pix", "credit_card"]),
});

export const iniciarAssinaturaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => iniciarSchema.parse(data))
  .handler(async ({ data, context }): Promise<IniciarAssinaturaResultado> => {
    const empresaId = await resolverEmpresaId(context.userId, context.supabase);

    const { data: userData } = await context.supabase.auth.getUser();
    const payerEmail = userData.user?.email;
    if (!payerEmail) throw new Error("Sua conta não tem um e-mail válido para o checkout.");

    const origin = origemPublicaServer() || new URL(getRequest().url).origin;
    return iniciarAssinatura({
      empresaId,
      planId: data.planId,
      billingCycle: data.billingCycle,
      paymentMethod: data.paymentMethod,
      payerEmail,
      origin,
    });
  });

export const cancelarAssinaturaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ subscriptionId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const empresaId = await resolverEmpresaId(context.userId, context.supabase);
    await cancelarAssinatura(data.subscriptionId, empresaId);
    return { ok: true };
  });

export type AssinaturaAtual = {
  id: string;
  planId: string;
  planName: string;
  billingCycle: string;
  status: string;
  startDate: string | null;
  nextBillingDate: string | null;
};

export const minhaAssinaturaFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AssinaturaAtual | null> => {
    const empresaId = await resolverEmpresaId(context.userId, context.supabase);
    const { data, error } = await context.supabase
      .from("subscriptions")
      .select("id, plan_id, billing_cycle, status, start_date, next_billing_date, plans(name)")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      planId: data.plan_id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- nested select shape isn't in the generated relationship helper
      planName: (data as any).plans?.name ?? "",
      billingCycle: data.billing_cycle,
      status: data.status,
      startDate: data.start_date,
      nextBillingDate: data.next_billing_date,
    };
  });

export type PagamentoHistorico = {
  id: string;
  amount: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
};

export const historicoPagamentosFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PagamentoHistorico[]> => {
    const empresaId = await resolverEmpresaId(context.userId, context.supabase);
    const { data: subs } = await context.supabase
      .from("subscriptions")
      .select("id")
      .eq("empresa_id", empresaId);
    const ids = (subs ?? []).map((s) => s.id);
    if (!ids.length) return [];

    const { data, error } = await context.supabase
      .from("subscription_payments")
      .select("id, amount, payment_method, status, created_at, paid_at")
      .in("subscription_id", ids)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((p) => ({
      id: p.id,
      amount: p.amount,
      paymentMethod: p.payment_method,
      status: p.status,
      createdAt: p.created_at,
      paidAt: p.paid_at,
    }));
  });
