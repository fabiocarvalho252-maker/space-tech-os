// Presets de qualidade da cena 3D. Funções puras, exceto larguraDaTela,
// que só deve ser chamada no client (dentro de componente montado).

export type Qualidade = "alta" | "media" | "baixa";

export type AjustesQualidade = {
  nome: Qualidade;
  sombras: boolean;
  sombraMapSize: number;
  antialias: boolean;
  dprMaximo: number;
};

// Abaixo desta largura a cena usa o preset baixa, independente da escolha.
export const LIMITE_TELA_COMPACTA = 768;
// Valor usado quando não há window (renderização fora do navegador).
export const LARGURA_PADRAO_TELA = 1280;

export const PRESETS_QUALIDADE: Readonly<Record<Qualidade, AjustesQualidade>> = {
  alta: { nome: "alta", sombras: true, sombraMapSize: 2048, antialias: true, dprMaximo: 2 },
  media: { nome: "media", sombras: true, sombraMapSize: 1024, antialias: true, dprMaximo: 1.5 },
  baixa: { nome: "baixa", sombras: false, sombraMapSize: 512, antialias: false, dprMaximo: 1 },
};

export function quality(preset: Qualidade, larguraTela: number): AjustesQualidade {
  const escolhido: Qualidade = larguraTela < LIMITE_TELA_COMPACTA ? "baixa" : preset;
  return PRESETS_QUALIDADE[escolhido];
}

export function larguraDaTela(): number {
  if (typeof window === "undefined") return LARGURA_PADRAO_TELA;
  return window.innerWidth;
}
