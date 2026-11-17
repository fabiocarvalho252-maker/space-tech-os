// Validação do JSON de perfil que o Claude devolve na geração da equipe.
// Limites e mensagens ficam aqui para que a UI exiba erros em português.
import { z } from "zod";

const NOME_MAX = 24;
const CARGO_MAX = 60;
const RESUMO_MAX = 140;
const DESCRICAO_MAX = 1200;
const QUANTIDADE_QUANDO_USAR = 3;
const QUANDO_USAR_MAX = 120;

const MSG_OBRIGATORIO = "é obrigatório.";

/** Nome sem espaços nas pontas e sem espaços repetidos. */
function nomeSemEspacosRepetidos(valor: string): boolean {
  return !/\s{2,}/.test(valor);
}

function textoObrigatorio(campo: string, maximo: number) {
  return z
    .string({ error: `${campo} ${MSG_OBRIGATORIO}` })
    .trim()
    .min(1, { error: `${campo} ${MSG_OBRIGATORIO}` })
    .max(maximo, { error: `${campo} deve ter no máximo ${maximo} caracteres.` });
}

export const schemaPerfilGerado = z.object({
  displayName: textoObrigatorio("Nome", NOME_MAX).refine(nomeSemEspacosRepetidos, {
    error: "Nome não pode ter espaços repetidos.",
  }),
  roleTitle: textoObrigatorio("Cargo", CARGO_MAX),
  summaryPtBr: textoObrigatorio("Resumo", RESUMO_MAX),
  descriptionPtBr: textoObrigatorio("Descrição", DESCRICAO_MAX),
  whenToUse: z
    .array(textoObrigatorio("Quando usar", QUANDO_USAR_MAX), {
      error: "Quando usar deve ser uma lista.",
    })
    .length(QUANTIDADE_QUANDO_USAR, {
      error: `Quando usar deve ter exatamente ${QUANTIDADE_QUANDO_USAR} itens.`,
    }),
});

export type PerfilGerado = z.infer<typeof schemaPerfilGerado>;

export type ResultadoValidacaoPerfil =
  { ok: true; valor: PerfilGerado } | { ok: false; erros: string[] };

/** Valida a entrada do Claude; devolve o perfil tratado ou a lista de erros em português. */
export function validarPerfilGerado(entrada: unknown): ResultadoValidacaoPerfil {
  const resultado = schemaPerfilGerado.safeParse(entrada);
  if (resultado.success) {
    return { ok: true, valor: resultado.data };
  }

  const erros = resultado.error.issues.map((issue) => {
    const campo = issue.path.length > 0 ? issue.path.join(".") : "perfil";
    return `${campo}: ${issue.message}`;
  });
  return { ok: false, erros };
}
