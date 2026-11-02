// Busca o modelo padrão de um tipo de documento (Configurações → Modelos).
// Usado pela impressão (ordens.tsx), pelo PDF da OS/orçamento e pelo
// comprovante de venda de aparelho — tanto com o cliente do navegador quanto
// com o supabaseAdmin no servidor. Sem modelo de Orçamento, usa o de
// Faturamento (era o comportamento antes de existir o tipo).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  FALLBACK_TEMPLATE_POR_USO,
  type OsTemplateRow,
  type OsTemplateUso,
} from "@/lib/os-template-render";

export async function buscarTemplatePadrao(
  client: SupabaseClient<Database>,
  empresaId: string,
  uso: OsTemplateUso,
): Promise<OsTemplateRow> {
  const buscar = (u: OsTemplateUso) =>
    client
      .from("os_templates")
      .select("*")
      .eq("user_id", empresaId)
      .eq("uso", u)
      .eq("ativo", true)
      .order("padrao", { ascending: false })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(1);
  let { data } = await buscar(uso);
  if (!data?.length && uso === "orcamento") ({ data } = await buscar("os"));
  return (data?.[0] as unknown as OsTemplateRow | undefined) ?? FALLBACK_TEMPLATE_POR_USO[uso];
}
