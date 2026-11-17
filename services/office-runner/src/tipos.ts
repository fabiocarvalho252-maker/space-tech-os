// Contrato de eventos enviado ao painel. Espelha src/features/escritorio/tipos.ts
// do app: se um mudar, o outro muda junto.

export type EstadoAgente =
  | "ocioso"
  | "andando"
  | "pensando"
  | "trabalhando"
  | "usando_ferramenta"
  | "aguardando_aprovacao"
  | "concluido"
  | "erro";

export type TipoEvento =
  | "missao.criada"
  | "missao.iniciada"
  | "missao.concluida"
  | "missao.falhou"
  | "missao.cancelada"
  | "agente.surgiu"
  | "agente.estado"
  | "agente.mensagem"
  | "agente.finalizou"
  | "ferramenta.iniciada"
  | "ferramenta.finalizada"
  | "aprovacao.pedida"
  | "aprovacao.respondida"
  | "uso.atualizado";

export type EventoEscritorio = {
  id: string;
  missaoId: string;
  ts: string;
  agenteId: string;
  agentePaiId?: string | undefined;
  tipo: TipoEvento;
  estado?: EstadoAgente | undefined;
  texto?: string | undefined;
  ferramenta?: { nome: string; ok?: boolean | undefined } | undefined;
  aprovacao?: { id: string; ferramenta: string; resumo: string; decisao?: string | undefined } | undefined;
  resultado?: string | undefined;
  uso?: { entradaTokens: number; saidaTokens: number; custoUsd: number } | undefined;
};

export type ModoPermissao = "seguro" | "automatico";

// Perfil da Equipe em português (espelha src/features/escritorio/equipe/tipos.ts).
export type TipoEquipe = "agent" | "skill";

export type AparenciaAgente = {
  seed: string;
  palette?: string | undefined;
  accessory?: string | undefined;
};

export type AgentProfile = {
  agentId: string;
  kind: TipoEquipe;
  displayName: string;
  roleTitle: string;
  summaryPtBr: string;
  descriptionPtBr: string;
  whenToUse: string[];
  sector: string;
  appearance: AparenciaAgente;
  originalDescription: string;
  sourceHash: string;
  edited: boolean;
};
