// Busca e filtros da aba Equipe. Camada pura: sem React, banco ou rede.
import type { AgentProfile, TipoEquipe } from "./tipos.ts";

export const FILTRO_TODOS = "todos";

export type FiltrosEquipe = {
  busca: string;
  setor: string;
  tipo: TipoEquipe | typeof FILTRO_TODOS;
};

// Abre só nos agentes: os skills (295) são muitos e não são personagens do escritório.
export const FILTROS_PADRAO: FiltrosEquipe = { busca: "", setor: FILTRO_TODOS, tipo: "agent" };

/** Minúsculas, sem acentos e sem espaços nas pontas, para comparar textos. */
export function normalizarTexto(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();
}

/** Setores existentes na lista, sem repetição e em ordem alfabética. */
export function listarSetores(perfis: readonly AgentProfile[]): string[] {
  const unicos = new Set(perfis.map((perfil) => perfil.sector));
  return [...unicos].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function combinaBusca(perfil: AgentProfile, buscaNormalizada: string): boolean {
  if (buscaNormalizada === "") return true;
  const campos = [perfil.displayName, perfil.roleTitle, perfil.summaryPtBr];
  return campos.some((campo) => normalizarTexto(campo).includes(buscaNormalizada));
}

function combinaFiltros(perfil: AgentProfile, filtros: FiltrosEquipe, busca: string): boolean {
  const combinaSetor = filtros.setor === FILTRO_TODOS || perfil.sector === filtros.setor;
  const combinaTipo = filtros.tipo === FILTRO_TODOS || perfil.kind === filtros.tipo;
  return combinaSetor && combinaTipo && combinaBusca(perfil, busca);
}

/** Aplica busca e filtros e devolve uma nova lista ordenada pelo nome. */
export function filtrarPerfis(
  perfis: readonly AgentProfile[],
  filtros: FiltrosEquipe,
): AgentProfile[] {
  const busca = normalizarTexto(filtros.busca);
  return perfis
    .filter((perfil) => combinaFiltros(perfil, filtros, busca))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR"));
}
