// Rótulos em português para os balões do escritório, por nome de ferramenta.
// O mapa é fixo: nomes desconhecidos recebem um rótulo genérico.

const ROTULO_DESCONHECIDO = "Usando {nome}";
const ROTULO_SEM_NOME = "Usando uma ferramenta";

const ROTULOS_POR_FERRAMENTA: ReadonlyMap<string, string> = new Map([
  ["Read", "Lendo arquivo"],
  ["Write", "Criando arquivo"],
  ["Edit", "Editando arquivo"],
  ["MultiEdit", "Editando arquivo"],
  ["Bash", "Rodando comando"],
  ["Grep", "Procurando no código"],
  ["Glob", "Procurando no código"],
  ["WebSearch", "Pesquisando na internet"],
  ["WebFetch", "Lendo página"],
  ["Task", "Passando tarefa"],
  ["Agent", "Passando tarefa"],
]);

/** Devolve o balão em português para o nome de uma ferramenta do Claude. */
export function rotuloFerramenta(nome: string): string {
  const nomeLimpo = nome.trim();
  if (nomeLimpo === "") return ROTULO_SEM_NOME;

  const rotulo = ROTULOS_POR_FERRAMENTA.get(nomeLimpo);
  if (rotulo !== undefined) return rotulo;

  return ROTULO_DESCONHECIDO.replace("{nome}", nomeLimpo);
}
