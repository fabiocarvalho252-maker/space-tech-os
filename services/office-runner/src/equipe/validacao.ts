// Validação do corpo do PATCH /office-api/equipe/:agentId. Campos fora da lista
// são recusados (schema estrito) para que o cliente não grave colunas protegidas.
import { z } from "zod";
import type { CamposEdicao } from "./perfis.ts";

export const LIMITES_EQUIPE = {
  nome: 24,
  cargo: 60,
  resumo: 140,
  descricao: 1200,
  quandoUsar: 120,
  quantidadeQuandoUsar: 3,
  setor: 40,
} as const;

function textoObrigatorio(campo: string, maximo: number) {
  return z
    .string({ error: `${campo} é obrigatório.` })
    .trim()
    .min(1, { error: `${campo} é obrigatório.` })
    .max(maximo, { error: `${campo} deve ter no máximo ${maximo} caracteres.` });
}

export const ESQUEMA_EDICAO = z.strictObject({
  displayName: textoObrigatorio("Nome", LIMITES_EQUIPE.nome),
  roleTitle: textoObrigatorio("Cargo", LIMITES_EQUIPE.cargo),
  summaryPtBr: textoObrigatorio("Resumo", LIMITES_EQUIPE.resumo),
  descriptionPtBr: textoObrigatorio("Descrição", LIMITES_EQUIPE.descricao),
  whenToUse: z
    .array(textoObrigatorio("Quando usar", LIMITES_EQUIPE.quandoUsar), { error: "Quando usar deve ser uma lista." })
    .length(LIMITES_EQUIPE.quantidadeQuandoUsar, {
      error: `Quando usar deve ter exatamente ${LIMITES_EQUIPE.quantidadeQuandoUsar} itens.`,
    }),
  sector: textoObrigatorio("Setor", LIMITES_EQUIPE.setor),
});

export type ResultadoEdicao = { ok: true; valor: CamposEdicao } | { ok: false; erros: string[] };

export function validarEdicao(entrada: unknown): ResultadoEdicao {
  const resultado = ESQUEMA_EDICAO.safeParse(entrada);
  if (resultado.success) return { ok: true, valor: resultado.data };
  return { ok: false, erros: resultado.error.issues.map((issue) => issue.message) };
}
