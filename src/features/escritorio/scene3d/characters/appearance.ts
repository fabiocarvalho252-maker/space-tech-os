// Aparência determinística dos personagens do Escritório IA.
// Lógica pura: sem three e sem React, para poder ser testada no node:test.

export const PALETA_ROUPAS = [
  "#7c3aed",
  "#a78bfa",
  "#c4b5fd",
  "#4c1d95",
  "#5b21b6",
  "#6d28d9",
  "#8b5cf6",
  "#2e1065",
  "#1f1b2e",
  "#374151",
] as const;

export const PALETA_CABELOS = [
  "#1f1720",
  "#3b2a1e",
  "#6b4423",
  "#b08d57",
  "#e5e7eb",
  "#7c2d12",
  "#4b5563",
] as const;

export const PALETA_PELES = [
  "#f5d0b5",
  "#e0ac83",
  "#c68a5f",
  "#8d5a3b",
  "#5c3a24",
  "#fde1c8",
] as const;

export const ACESSORIOS = ["nenhum", "oculos", "fone", "bone", "cracha"] as const;

export const PALETA_ACESSORIOS = [
  "#e9d5ff",
  "#c4b5fd",
  "#f5f3ff",
  "#facc15",
  "#22d3ee",
  "#f472b6",
] as const;

export type Acessorio = (typeof ACESSORIOS)[number];

export type Aparencia = {
  corRoupa: string;
  corCabelo: string;
  corPele: string;
  acessorio: Acessorio;
  corAcessorio: string;
};

// FNV-1a de 32 bits: simples, rápido e estável entre execuções.
const FNV_OFFSET_BASE = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function hashNome(nome: string): number {
  let hash = FNV_OFFSET_BASE;
  for (let indice = 0; indice < nome.length; indice += 1) {
    hash ^= nome.charCodeAt(indice);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

function escolher<T extends string>(paleta: readonly T[], semente: string): T {
  const indice = hashNome(semente) % paleta.length;
  const escolhido = paleta[indice];
  if (escolhido === undefined) {
    throw new Error("Paleta vazia na escolha de aparência do personagem.");
  }
  return escolhido;
}

export function aparenciaDoAgente(agenteId: string): Aparencia {
  return {
    corRoupa: escolher(PALETA_ROUPAS, `${agenteId}|roupa`),
    corCabelo: escolher(PALETA_CABELOS, `${agenteId}|cabelo`),
    corPele: escolher(PALETA_PELES, `${agenteId}|pele`),
    acessorio: escolher(ACESSORIOS, `${agenteId}|acessorio`),
    corAcessorio: escolher(PALETA_ACESSORIOS, `${agenteId}|cor-acessorio`),
  };
}
