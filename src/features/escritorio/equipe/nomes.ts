// Validação do nome de um agente da equipe: obrigatório, até 24 caracteres
// e único sem diferenciar maiúsculas, minúsculas nem acentos.

const NOME_MAX = 24;

const MSG_OBRIGATORIO = "Dê um nome para o agente.";
const MSG_MUITO_LONGO = "Use no máximo 24 caracteres.";
const MSG_DUPLICADO = "Já existe um agente com esse nome.";

/** Chave de comparação: sem acentos, em minúsculas e sem espaços nas pontas. */
function chaveDeComparacao(nome: string): string {
  return nome.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();
}

/** Devolve a mensagem de erro em português, ou null quando o nome é aceito. */
export function validarNomeUnico(nome: string, nomesExistentes: readonly string[]): string | null {
  const nomeLimpo = nome.trim();
  if (nomeLimpo === "") return MSG_OBRIGATORIO;
  if (Array.from(nomeLimpo).length > NOME_MAX) return MSG_MUITO_LONGO;

  const chave = chaveDeComparacao(nomeLimpo);
  const duplicado = nomesExistentes.some((existente) => chaveDeComparacao(existente) === chave);
  return duplicado ? MSG_DUPLICADO : null;
}
