// Tipos da "Equipe em português": perfil de cada agente ou skill como o
// escritório mostra ao usuário. Camada pura, sem React, banco ou rede.

export type TipoEquipe = "agent" | "skill";

export type AparenciaAgente = {
  seed: string;
  palette?: string;
  accessory?: string;
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
