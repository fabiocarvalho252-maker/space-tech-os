// Sugere, para cada item da nota, o produto já cadastrado que ele representa.
// Ordem: código de barras (EAN) → código do fornecedor (SKU) → nome exato.
import type { ItemNota } from "./nfe-xml";

export type ProdutoCadastrado = {
  id: string;
  nome: string;
  codigo_barras: string | null;
  sku: string | null;
};

export function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function sugerirProduto(
  item: ItemNota,
  produtos: ProdutoCadastrado[],
): ProdutoCadastrado | null {
  if (item.ean) {
    const porEan = produtos.find((p) => p.codigo_barras === item.ean);
    if (porEan) return porEan;
  }
  if (item.codigo) {
    const porSku = produtos.find((p) => p.sku && p.sku === item.codigo);
    if (porSku) return porSku;
  }
  const nome = normalizarNome(item.descricao);
  return produtos.find((p) => normalizarNome(p.nome) === nome) ?? null;
}
