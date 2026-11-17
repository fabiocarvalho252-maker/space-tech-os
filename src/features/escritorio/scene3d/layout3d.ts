// Conversão pura das coordenadas 2D de game/layout.ts para o plano 3D.
// Não importa three nem React: pode ser testada com node:test.

import { ALTURA, LARGURA, SETORES, type Ponto, type Setor } from "../game/layout.ts";

// Um pixel do layout 2D equivale a 1/100 de unidade 3D.
export const ESCALA_3D = 100;

export type Ponto3d = { x: number; z: number };
export type Trio = [number, number, number];
export type Caixa3d = { posicao: Trio; escala: Trio };
export type Retangulo3d = {
  centroX: number;
  centroZ: number;
  largura: number;
  profundidade: number;
};
export type SalaCena3d = Retangulo3d & {
  id: string;
  nome: string;
  zFrontal: number;
  mesas: Ponto3d[];
};

export function paraX(x: number): number {
  return (x - LARGURA / 2) / ESCALA_3D;
}

export function paraZ(y: number): number {
  return (y - ALTURA / 2) / ESCALA_3D;
}

export function pontoParaTresD(ponto: Ponto): Ponto3d {
  return { x: paraX(ponto.x), z: paraZ(ponto.y) };
}

export function retanguloParaTresD(
  x: number,
  y: number,
  largura: number,
  altura: number,
): Retangulo3d {
  return {
    centroX: paraX(x + largura / 2),
    centroZ: paraZ(y + altura / 2),
    largura: largura / ESCALA_3D,
    profundidade: altura / ESCALA_3D,
  };
}

// Chão ocupa a tela lógica inteira, com centro na origem do plano 3D.
export function chaoEmTresD(): Retangulo3d {
  return retanguloParaTresD(0, 0, LARGURA, ALTURA);
}

export function salaParaTresD(setor: Setor): SalaCena3d {
  const retangulo = retanguloParaTresD(setor.x, setor.y, setor.largura, setor.altura);
  return {
    ...retangulo,
    id: setor.id,
    nome: setor.nome,
    zFrontal: retangulo.centroZ + retangulo.profundidade / 2,
    mesas: setor.mesas.map(pontoParaTresD),
  };
}

export function salasEmTresD(setores: readonly Setor[] = SETORES): SalaCena3d[] {
  return setores.map(salaParaTresD);
}

// Quatro paredes de vidro em volta da sala, cada uma como caixa de lados
// posicionados sobre o perímetro do retângulo.
export function caixasDasParedes(sala: SalaCena3d, altura: number, espessura: number): Caixa3d[] {
  const meiaLargura = sala.largura / 2;
  const meiaProfundidade = sala.profundidade / 2;
  const centroY = altura / 2;
  const larguraTotal = sala.largura + espessura;
  return [
    {
      posicao: [sala.centroX, centroY, sala.centroZ - meiaProfundidade],
      escala: [larguraTotal, altura, espessura],
    },
    {
      posicao: [sala.centroX, centroY, sala.centroZ + meiaProfundidade],
      escala: [larguraTotal, altura, espessura],
    },
    {
      posicao: [sala.centroX - meiaLargura, centroY, sala.centroZ],
      escala: [espessura, altura, sala.profundidade],
    },
    {
      posicao: [sala.centroX + meiaLargura, centroY, sala.centroZ],
      escala: [espessura, altura, sala.profundidade],
    },
  ];
}
