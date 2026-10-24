import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CaixaSessao = {
  id: string;
  status: "aberto" | "fechado";
  aberto_em: string;
  valor_abertura: number;
  fechado_em: string | null;
  valor_esperado: number | null;
  valor_contado: number | null;
  diferenca: number | null;
  resumo: ResumoCaixa | null;
  observacoes: string | null;
};

export type ResumoCaixa = {
  formas: { forma: string; entradas: number; saidas: number }[];
  total_entradas: number;
  total_saidas: number;
  qtd_vendas: number;
  abertura: number;
  suprimentos: number;
  sangrias: number;
  dinheiro_entradas: number;
  dinheiro_saidas: number;
  dinheiro_esperado: number;
};

// Caixa aberto da empresa + se a loja usa "Controle de caixa" (Configurações >
// Venda no balcão). Com controle ligado, o PDV só finaliza com caixa aberto.
export function useCaixa(empresaId: string | null | undefined) {
  const { data: caixa, isLoading } = useQuery({
    queryKey: ["caixa-aberto", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("caixa_sessoes")
        .select("*")
        .eq("user_id", empresaId!)
        .eq("status", "aberto")
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as CaixaSessao) ?? null;
    },
  });
  const { data: controleAtivo = false } = useQuery({
    queryKey: ["sale-config-tipo-caixa", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("sale_config")
        .select("tipo_caixa")
        .eq("user_id", empresaId!)
        .maybeSingle();
      return (data as { tipo_caixa?: string } | null)?.tipo_caixa === "controle_caixa";
    },
  });
  return { caixa: caixa ?? null, carregando: isLoading, controleAtivo };
}
