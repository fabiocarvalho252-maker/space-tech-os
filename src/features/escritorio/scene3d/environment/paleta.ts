// Cores da cena 3D: roxo, preto, branco e cinza, com pisos escuros por setor.

export const PALETA = {
  fundo: "#0b0714",
  chao: "#120d1f",
  pisoPadrao: "#1c1830",
  vidro: "#c4b5fd",
  mesa: "#2a2640",
  neon: "#a855f7",
} as const;

const PISOS_POR_SETOR: Readonly<Record<string, string>> = {
  diretoria: "#3b0764",
  planejamento: "#4c1d95",
  engenharia: "#312e81",
  qualidade: "#581c87",
  seguranca: "#1e1b4b",
  docs: "#6b21a8",
};

export function corDoPiso(setorId: string): string {
  return PISOS_POR_SETOR[setorId] ?? PALETA.pisoPadrao;
}
