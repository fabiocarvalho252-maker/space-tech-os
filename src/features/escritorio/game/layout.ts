// Planta do escritório pixel: salas, mesas e sala de espera. Coordenadas em
// pixels no canvas lógico (LARGURA × ALTURA), escalado pelo Phaser.

export const LARGURA = 960;
export const ALTURA = 640;

export type Ponto = { x: number; y: number };

export type Setor = {
  id: string;
  nome: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
  mesas: Ponto[];
};

export const SETORES: Setor[] = [
  {
    id: "diretoria",
    nome: "Diretoria",
    x: 30,
    y: 30,
    largura: 290,
    altura: 200,
    mesas: [{ x: 175, y: 130 }],
  },
  {
    id: "planejamento",
    nome: "Planejamento",
    x: 340,
    y: 30,
    largura: 290,
    altura: 200,
    mesas: [
      { x: 420, y: 120 },
      { x: 540, y: 120 },
    ],
  },
  {
    id: "engenharia",
    nome: "Engenharia",
    x: 650,
    y: 30,
    largura: 280,
    altura: 200,
    mesas: [
      { x: 730, y: 120 },
      { x: 860, y: 120 },
    ],
  },
  {
    id: "qualidade",
    nome: "Qualidade",
    x: 30,
    y: 250,
    largura: 290,
    altura: 200,
    mesas: [
      { x: 110, y: 340 },
      { x: 240, y: 340 },
    ],
  },
  {
    id: "seguranca",
    nome: "Segurança",
    x: 340,
    y: 250,
    largura: 290,
    altura: 200,
    mesas: [{ x: 480, y: 340 }],
  },
  {
    id: "docs",
    nome: "Docs & Conteúdo",
    x: 650,
    y: 250,
    largura: 280,
    altura: 200,
    mesas: [{ x: 790, y: 340 }],
  },
];

// Sala de espera: faixa de baixo, onde os agentes ficam quando ociosos.
export const ESPERA = { x: 30, y: 470, largura: 900, altura: 150 };

// Posição de espera: fileira com espaçamento fixo, até cabe na faixa.
export function posicaoEspera(indice: number): Ponto {
  const colunas = 10;
  const coluna = indice % colunas;
  const linha = Math.floor(indice / colunas);
  return { x: ESPERA.x + 60 + coluna * 84, y: ESPERA.y + 60 + linha * 60 };
}

export function setorPorId(id: string): Setor | undefined {
  return SETORES.find((s) => s.id === id);
}

// Mesa para o próximo agente de um setor. Se as mesas acabarem, o agente
// divide a última (mesa compartilhada), como manda a especificação.
export function mesaDoSetor(setorId: string, ocupacao: number): Ponto | null {
  const setor = setorPorId(setorId);
  if (!setor || setor.mesas.length === 0) return null;
  const indice = Math.min(ocupacao, setor.mesas.length - 1);
  return setor.mesas[indice] ?? null;
}
