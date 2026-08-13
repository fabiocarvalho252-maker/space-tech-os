import { IAIndisponivelError } from "./provider.server";

// Same "outside membership wins over self-ownership" resolution as
// useMinhaEmpresa/planos.functions.ts — an invited team member spends/gets
// refunded credits from the empresa they work for, not a placeholder
// self-row.
async function resolverEmpresaId(userId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: membership } = await supabaseAdmin
    .from("user_empresas")
    .select("empresa_id")
    .eq("user_id", userId);
  return (
    membership?.find((m) => m.empresa_id !== userId)?.empresa_id ??
    membership?.[0]?.empresa_id ??
    userId
  );
}

/**
 * Spends one IA credit for the caller's empresa, atomically (see
 * descontar_credito_ia in the ia_creditos migration). New empresas start at
 * 0 credits — the site admin tops up whoever asks for IA access, since the
 * Anthropic key behind it is a real, billed API key.
 *
 * Callers must refund via estornarCreditoIA if the IA call itself fails
 * afterwards — a credit should only be spent on an answer that actually
 * came back, not on a provider-side outage.
 */
export async function verificarEDescontarCreditoIA(userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const empresaId = await resolverEmpresaId(userId);

  const { data: sucesso, error } = await supabaseAdmin.rpc("descontar_credito_ia", {
    p_empresa_id: empresaId,
  });
  if (error) throw error;
  if (!sucesso) {
    throw new IAIndisponivelError(
      "Sua empresa não tem créditos de IA disponíveis no momento. Peça a ativação para o suporte.",
    );
  }
}

/** Gives back one credit — call this when a spent credit's IA call failed. */
export async function estornarCreditoIA(userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const empresaId = await resolverEmpresaId(userId);
  const { data: atual, error: erroLeitura } = await supabaseAdmin
    .from("profiles")
    .select("ia_creditos")
    .eq("id", empresaId)
    .single();
  if (erroLeitura) throw erroLeitura;
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ ia_creditos: atual.ia_creditos + 1 })
    .eq("id", empresaId);
  if (error) throw error;
}
