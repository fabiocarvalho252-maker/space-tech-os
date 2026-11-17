// Texto do balão de fala de um agente na cena 3D. Lógica pura, sem React.
import { rotuloFerramenta } from "../equipe/rotulosFerramentas.ts";

export const LIMITE_BALAO = 90;

// Texto do balão: a fala do agente tem prioridade; sem fala, mostra a ferramenta em uso.
export function textoDoBalao(texto: string | null, ferramenta: string | null): string | null {
  const fala = texto?.trim() ?? "";
  if (fala) return fala.length > LIMITE_BALAO ? `${fala.slice(0, LIMITE_BALAO - 1)}…` : fala;
  if (ferramenta) return rotuloFerramenta(ferramenta);
  return null;
}
