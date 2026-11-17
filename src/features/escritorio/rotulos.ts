// Única fonte dos nomes exibidos para um agente. Por enquanto devolve o próprio id
// técnico do ECC; depois a equipe em português troca esta função sem tocar nas telas.
export function getAgentLabel(agenteId: string): string {
  return agenteId;
}
