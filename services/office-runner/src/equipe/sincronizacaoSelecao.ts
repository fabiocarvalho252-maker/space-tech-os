// Seleção dos itens que precisam de perfil novo: sem perfil salvo ou com o texto
// original alterado. Perfis editados pelo administrador nunca são sobrescritos.
import { createHash } from "node:crypto";
import type { AgentProfile } from "../tipos.ts";

export const TAMANHO_TEXTO_ORIGINAL = 2000;

export type ItemSincronia = {
  agentId: string;
  kind: AgentProfile["kind"];
  setor: string;
  textoOriginal: string;
  sourceHash: string;
};

export function hashDoConteudo(conteudo: string): string {
  return createHash("sha256").update(conteudo, "utf8").digest("hex");
}

export function selecionarPendentes(itens: readonly ItemSincronia[], salvos: readonly AgentProfile[]): ItemSincronia[] {
  const porId = new Map(salvos.map((perfil) => [perfil.agentId, perfil] as const));
  return itens.filter((item) => {
    const salvo = porId.get(item.agentId);
    if (!salvo) return true;
    return !salvo.edited && salvo.sourceHash !== item.sourceHash;
  });
}

/** Itens rejeitados na rodada anterior vão para o fim da fila, para não travar o progresso. */
export function priorizarNaoRejeitados(itens: readonly ItemSincronia[], rejeitadosAntes: ReadonlySet<string>): ItemSincronia[] {
  const frescos = itens.filter((item) => !rejeitadosAntes.has(item.agentId));
  const reprovados = itens.filter((item) => rejeitadosAntes.has(item.agentId));
  return [...frescos, ...reprovados];
}
