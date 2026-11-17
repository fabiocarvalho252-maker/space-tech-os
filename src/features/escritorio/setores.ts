// Quais salas do escritório recebem cada agente do ECC. Agentes não mapeados
// caem em "geral" automaticamente, como manda a especificação.

export const SETOR_GERAL = "geral";

export const MAPA_SETOR: Record<string, string> = {
  orchestrator: "diretoria",
  planner: "planejamento",
  architect: "planejamento",
  "build-error-resolver": "engenharia",
  "refactor-cleaner": "engenharia",
  "code-reviewer": "qualidade",
  "tdd-guide": "qualidade",
  "e2e-runner": "qualidade",
  "security-reviewer": "seguranca",
  "doc-updater": "docs",
};

export function setorDe(agenteId: string): string {
  return MAPA_SETOR[agenteId] ?? SETOR_GERAL;
}
