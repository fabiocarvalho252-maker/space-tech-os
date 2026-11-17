// Persistência da Equipe no Supabase (tabela office_agent_profiles). Só o runner
// grava, com a service role. O cliente é tipado por um subconjunto mínimo para
// que os testes rodem sem rede; linhas lidas do banco são validadas antes de uso.
import { z } from "zod";
import type { AgentProfile } from "../tipos.ts";

export const TABELA_PERFIS = "office_agent_profiles";

type RespostaBanco<T> = { data?: T | null; error: { message: string } | null };

export type ClienteEquipe = {
  from(tabela: string): {
    select(colunas: string): PromiseLike<RespostaBanco<unknown[]>>;
    upsert(linha: unknown, opcoes: { onConflict: string }): PromiseLike<RespostaBanco<unknown>>;
  };
};

export type RepositorioEquipe = {
  listar(): Promise<AgentProfile[]>;
  salvar(perfil: AgentProfile): Promise<void>;
};

const ESQUEMA_LINHA = z.object({
  agent_id: z.string(),
  kind: z.enum(["agent", "skill"]),
  display_name: z.string(),
  role_title: z.string(),
  summary_pt_br: z.string(),
  description_pt_br: z.string(),
  when_to_use: z.array(z.string()),
  sector: z.string(),
  appearance: z.object({
    seed: z.string(),
    palette: z.string().optional(),
    accessory: z.string().optional(),
  }),
  original_description: z.string(),
  source_hash: z.string(),
  edited: z.boolean(),
});

export type LinhaPerfil = {
  agent_id: string;
  kind: AgentProfile["kind"];
  display_name: string;
  role_title: string;
  summary_pt_br: string;
  description_pt_br: string;
  when_to_use: string[];
  sector: string;
  appearance: AgentProfile["appearance"];
  original_description: string;
  source_hash: string;
  edited: boolean;
  updated_at: string;
};

export function linhaDoPerfil(perfil: AgentProfile, atualizadoEm: string): LinhaPerfil {
  return {
    agent_id: perfil.agentId,
    kind: perfil.kind,
    display_name: perfil.displayName,
    role_title: perfil.roleTitle,
    summary_pt_br: perfil.summaryPtBr,
    description_pt_br: perfil.descriptionPtBr,
    when_to_use: perfil.whenToUse,
    sector: perfil.sector,
    appearance: perfil.appearance,
    original_description: perfil.originalDescription,
    source_hash: perfil.sourceHash,
    edited: perfil.edited,
    updated_at: atualizadoEm,
  };
}

/** Converte uma linha do banco em perfil; lança erro claro se a linha estiver fora do contrato. */
export function perfilDaLinha(entrada: unknown): AgentProfile {
  const resultado = ESQUEMA_LINHA.safeParse(entrada);
  if (!resultado.success) {
    const id = typeof entrada === "object" && entrada !== null && "agent_id" in entrada ? String(entrada.agent_id) : "?";
    throw new Error(`Perfil salvo inválido no banco: ${id}`);
  }
  const linha = resultado.data;
  return {
    agentId: linha.agent_id,
    kind: linha.kind,
    displayName: linha.display_name,
    roleTitle: linha.role_title,
    summaryPtBr: linha.summary_pt_br,
    descriptionPtBr: linha.description_pt_br,
    whenToUse: linha.when_to_use,
    sector: linha.sector,
    appearance: linha.appearance,
    originalDescription: linha.original_description,
    sourceHash: linha.source_hash,
    edited: linha.edited,
  };
}

export function criarRepositorioEquipe(
  cliente: ClienteEquipe,
  agora: () => string = () => new Date().toISOString(),
): RepositorioEquipe {
  return {
    async listar() {
      const resposta = await cliente.from(TABELA_PERFIS).select("*");
      if (resposta.error) throw new Error(`Falha ao ler a Equipe: ${resposta.error.message}`);
      return (resposta.data ?? []).map(perfilDaLinha);
    },
    async salvar(perfil) {
      const linha = linhaDoPerfil(perfil, agora());
      const resposta = await cliente.from(TABELA_PERFIS).upsert(linha, { onConflict: "agent_id" });
      if (resposta.error) throw new Error(`Falha ao salvar o agente ${perfil.agentId}: ${resposta.error.message}`);
    },
  };
}
