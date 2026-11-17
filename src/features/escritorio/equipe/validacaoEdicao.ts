// Validação ao vivo do formulário de edição do perfil. Reaproveita as regras do
// JSON gerado (limites e lista de 3 exemplos) e acrescenta nome único e setor.
import type { AgentProfile } from "./tipos.ts";
import { validarNomeUnico } from "./nomes.ts";
import { schemaPerfilGerado } from "./validacaoPerfil.ts";

const SETOR_MAX = 40;
const QUANTIDADE_EXEMPLOS = 3;
const MSG_SETOR_OBRIGATORIO = "Informe o setor.";
const MSG_SETOR_LONGO = `Use no máximo ${SETOR_MAX} caracteres.`;

export type ValoresEdicaoPerfil = {
  displayName: string;
  roleTitle: string;
  summaryPtBr: string;
  descriptionPtBr: string;
  sector: string;
  whenToUse: string[];
};

/** Campo do formulário. Itens da lista usam a chave "whenToUse.<índice>". */
export type CampoEdicaoPerfil = keyof ValoresEdicaoPerfil | `whenToUse.${number}`;

/** Mensagem de erro por campo. */
export type ErrosEdicaoPerfil = Partial<Record<CampoEdicaoPerfil, string>>;

export type ResultadoEdicaoPerfil = { ok: true } | { ok: false; erros: ErrosEdicaoPerfil };

function validarSetor(setor: string, erros: ErrosEdicaoPerfil): void {
  const setorLimpo = setor.trim();
  if (setorLimpo === "") erros.sector = MSG_SETOR_OBRIGATORIO;
  else if (Array.from(setorLimpo).length > SETOR_MAX) erros.sector = MSG_SETOR_LONGO;
}

function errosDoSchema(valores: ValoresEdicaoPerfil): ErrosEdicaoPerfil {
  const erros: ErrosEdicaoPerfil = {};
  const resultado = schemaPerfilGerado.safeParse(valores);
  if (resultado.success) return erros;
  for (const issue of resultado.error.issues) {
    const chave = issue.path.join(".") as CampoEdicaoPerfil;
    if (!(chave in erros)) erros[chave] = issue.message;
  }
  return erros;
}

/** Valida o formulário; `nomesOutros` são os nomes dos outros agentes da equipe. */
export function validarEdicaoPerfil(
  valores: ValoresEdicaoPerfil,
  nomesOutros: readonly string[],
): ResultadoEdicaoPerfil {
  const erros = errosDoSchema(valores);
  const erroNome = validarNomeUnico(valores.displayName, nomesOutros);
  if (erroNome !== null) erros.displayName = erroNome;
  validarSetor(valores.sector, erros);
  return Object.keys(erros).length === 0 ? { ok: true } : { ok: false, erros };
}

/** Valores do formulário a partir do perfil atual (sempre com 3 exemplos). */
export function valoresIniciaisEdicao(perfil: AgentProfile): ValoresEdicaoPerfil {
  return {
    displayName: perfil.displayName,
    roleTitle: perfil.roleTitle,
    summaryPtBr: perfil.summaryPtBr,
    descriptionPtBr: perfil.descriptionPtBr,
    sector: perfil.sector,
    whenToUse: Array.from({ length: QUANTIDADE_EXEMPLOS }, (_, i) => perfil.whenToUse[i] ?? ""),
  };
}
