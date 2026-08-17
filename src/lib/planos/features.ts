// Centralized feature-gate helper for the plan/tier system (Básico vs
// Profissional). This is the single place that knows which features a
// plan unlocks — no screen or server function should ever hardcode
// `plano === "profissional"` on its own. Both the frontend hook
// (usePlanoFeatures, in useCurrentUser.ts) and every requireFeature() call
// in a server function go through this, so a feature toggled by the site
// admin in /admin (see atualizarPlanoFeature) takes effect everywhere
// without a code change or redeploy.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type FeatureSupabase = SupabaseClient<Database>;

const PLANO_PADRAO_SLUG = "basico";

// Empresas that predate the plans table (or whose plan_id was never set)
// fall back to the Básico plan's features rather than getting nothing —
// matches how profiles.plano already defaults to "trial" when unset.
export async function getPlanoFeatures(
  empresaId: string,
  supabase: FeatureSupabase,
): Promise<Set<string>> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_id")
    .eq("id", empresaId)
    .maybeSingle();

  let planId = profile?.plan_id ?? null;
  if (!planId) {
    const { data: padrao } = await supabase
      .from("plans")
      .select("id")
      .eq("slug", PLANO_PADRAO_SLUG)
      .maybeSingle();
    planId = padrao?.id ?? null;
  }
  if (!planId) return new Set();

  const { data: features } = await supabase
    .from("plan_features")
    .select("feature")
    .eq("plan_id", planId)
    .eq("enabled", true);

  return new Set((features ?? []).map((f) => f.feature));
}

export async function hasFeature(
  empresaId: string,
  feature: string,
  supabase: FeatureSupabase,
): Promise<boolean> {
  const features = await getPlanoFeatures(empresaId, supabase);
  return features.has(feature);
}

// Ordem/rótulo de exibição das features — usado pela tabela comparativa em
// /planos e pelo painel de toggle em /admin. O conteúdo de cada plano (o
// que ele tem ligado/desligado) vem sempre de plan_features no banco, nunca
// hardcoded aqui — só o rótulo e a ordem de exibição são fixos.
export const FEATURES_EXIBICAO: { feature: string; label: string }[] = [
  { feature: "CLIENTES", label: "Clientes" },
  { feature: "FORNECEDORES", label: "Fornecedores" },
  { feature: "PRODUTOS", label: "Produtos" },
  { feature: "SERVICOS", label: "Serviços" },
  { feature: "ESTOQUE", label: "Estoque" },
  { feature: "VENDAS", label: "Vendas" },
  { feature: "PDV", label: "PDV" },
  { feature: "ORDENS_SERVICO", label: "Ordens de Serviço" },
  { feature: "FINANCEIRO", label: "Financeiro" },
  { feature: "CONTAS_RECEBER", label: "Contas a Receber" },
  { feature: "CONTAS_PAGAR", label: "Contas a Pagar" },
  { feature: "CAIXA", label: "Caixa" },
  { feature: "DRE", label: "DRE" },
  { feature: "RELATORIOS_BASICOS", label: "Relatórios básicos" },
  { feature: "WHATSAPP", label: "WhatsApp" },
  { feature: "NOTA_FISCAL", label: "Nota Fiscal" },
  { feature: "IA_BASICA", label: "IA Básica" },
  { feature: "IA_PROFISSIONAL", label: "IA Profissional" },
  { feature: "IA_FINANCEIRA", label: "IA Financeira" },
  { feature: "IA_VENDAS", label: "IA de Vendas" },
  { feature: "IA_ESTOQUE", label: "IA de Estoque" },
  { feature: "IA_OS", label: "IA para OS" },
  { feature: "RELATORIOS_AVANCADOS", label: "Relatórios avançados" },
];

export class FeatureIndisponivelError extends Error {
  constructor(public readonly feature: string) {
    super(`Recurso "${feature}" não está disponível no seu plano atual.`);
    this.name = "FeatureIndisponivelError";
  }
}

export async function requireFeature(
  empresaId: string,
  feature: string,
  supabase: FeatureSupabase,
): Promise<void> {
  if (!(await hasFeature(empresaId, feature, supabase))) {
    throw new FeatureIndisponivelError(feature);
  }
}
