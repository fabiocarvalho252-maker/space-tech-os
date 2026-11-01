import { supabase } from "@/integrations/supabase/client";
import { origemPublica } from "@/lib/site-url";
import { statusAposEnviarOrcamento } from "@/lib/whatsapp";

/** Link que o cliente abre para ver o orçamento e aprovar ou recusar. */
export function linkAprovacaoOrcamento(osId: string): string {
  return `${origemPublica()}/consulta/${osId}`;
}

/**
 * Depois que o orçamento saiu com o link, passa a OS para "Aguardando
 * aprovação" (se ainda estava antes disso), para os botões aparecerem na
 * página do cliente. Devolve true quando mudou o status.
 */
export async function marcarOrcamentoEnviado(os: { id: string; status?: string | null }) {
  const novo = os.status ? statusAposEnviarOrcamento(os.status) : null;
  if (!novo) return false;
  const { error } = await supabase
    .from("ordens_servico")
    .update({ status: novo })
    .eq("id", os.id)
    .eq("status", os.status as string);
  return !error;
}
