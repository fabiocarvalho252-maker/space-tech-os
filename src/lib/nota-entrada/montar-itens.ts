// Monta o JSON de itens enviado à função importar_nota_compra.
// produtoId null significa "cadastrar como produto novo".
// precoVenda null significa "não alterar o preço de venda" (produto existente).
import type { ItemNota } from "./nfe-xml.ts";
import type { Json } from "@/integrations/supabase/types";

export type LinhaImportacao = {
  item: ItemNota;
  produtoId: string | null;
  precoVenda: number | null;
};

export function montarItensImportacao(linhas: LinhaImportacao[]): Json[] {
  return linhas.map(({ item, produtoId, precoVenda }) => ({
    produto_id: produtoId,
    nome_novo: item.descricao,
    codigo_barras: item.ean,
    sku: item.codigo,
    descricao: item.descricao,
    quantidade: item.quantidade,
    custo_unitario: item.custoUnitario,
    preco_venda: precoVenda,
  }));
}

/** Preço de venda sugerido pelo custo e uma margem percentual (2 casas decimais). */
export function precoComMargem(custoUnitario: number, margemPercentual: number): number {
  return Math.round(custoUnitario * (1 + margemPercentual / 100) * 100) / 100;
}
