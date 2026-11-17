// Monta o JSON de itens enviado à função importar_nota_compra.
// produtoId null significa "cadastrar como produto novo".
import type { ItemNota } from "./nfe-xml";
import type { Json } from "@/integrations/supabase/types";

export type LinhaImportacao = {
  item: ItemNota;
  produtoId: string | null;
};

export function montarItensImportacao(linhas: LinhaImportacao[]): Json[] {
  return linhas.map(({ item, produtoId }) => ({
    produto_id: produtoId,
    nome_novo: item.descricao,
    codigo_barras: item.ean,
    sku: item.codigo,
    descricao: item.descricao,
    quantidade: item.quantidade,
    custo_unitario: item.custoUnitario,
  }));
}
