// Regras puras dos perfis da Equipe: perfil padrão derivado do catálogo,
// mescla com os perfis salvos e aplicação de edições. Sem banco nem rede.
import { createHash } from "node:crypto";
import type { ItemCatalogo } from "../catalogo.ts";
import type { AgentProfile, TipoEquipe } from "../tipos.ts";

export type PerfilEquipe = AgentProfile & { salvo: boolean };

export type CamposEdicao = {
  displayName: string;
  roleTitle: string;
  summaryPtBr: string;
  descriptionPtBr: string;
  whenToUse: string[];
  sector: string;
};

export function tipoDoItem(tipo: ItemCatalogo["tipo"]): TipoEquipe {
  return tipo === "skill" ? "skill" : "agent";
}

export function hashDaDescricao(descricao: string): string {
  return createHash("sha256").update(descricao, "utf8").digest("hex");
}

/** Perfil ainda não salvo: nome igual ao id, textos em português ainda vazios. */
export function perfilPadrao(item: ItemCatalogo): AgentProfile {
  return {
    agentId: item.id,
    kind: tipoDoItem(item.tipo),
    displayName: item.id,
    roleTitle: "",
    summaryPtBr: "",
    descriptionPtBr: "",
    whenToUse: [],
    sector: item.setor,
    appearance: { seed: item.id },
    originalDescription: item.descricao,
    sourceHash: hashDaDescricao(item.descricao),
    edited: false,
  };
}

/** Uma entrada por agente do catálogo: o perfil salvo quando existe, senão o padrão. */
export function mesclarEquipe(itens: readonly ItemCatalogo[], salvos: readonly AgentProfile[]): PerfilEquipe[] {
  const porId = new Map(salvos.map((perfil) => [perfil.agentId, perfil] as const));
  return itens.map((item) => {
    const salvo = porId.get(item.id);
    return salvo ? { ...salvo, salvo: true } : { ...perfilPadrao(item), salvo: false };
  });
}

/** Devolve um novo perfil com as edições aplicadas e edited = true. */
export function aplicarEdicao(perfil: AgentProfile, edicao: CamposEdicao): AgentProfile {
  return { ...perfil, ...edicao, edited: true };
}
