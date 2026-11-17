// Navegação dos agentes na cena 3D: grade do chão (células de 16 px do plano 2D),
// com as mesas bloqueadas. Lógica pura: sem three e sem React.
import { ALTURA, LARGURA, SETORES, type Ponto } from "../game/layout.ts";
import { encontrarCaminho, suavizarCaminho, type Celula, type Grade } from "./pathfinding.ts";
import { ESCALA_3D } from "./layout3d.ts";

export const TAMANHO_CELULA = 16;
const COLUNAS = Math.ceil(LARGURA / TAMANHO_CELULA);
const LINHAS = Math.ceil(ALTURA / TAMANHO_CELULA);

// Área ocupada por uma mesa no plano 2D (tampo e monitor).
function mesaOcupa(mesa: Ponto, x: number, y: number): boolean {
  return x >= mesa.x - 40 && x <= mesa.x + 40 && y >= mesa.y - 16 && y <= mesa.y + 30;
}

function celulaOcupada(x: number, z: number): boolean {
  const px = x * TAMANHO_CELULA + TAMANHO_CELULA / 2;
  const py = z * TAMANHO_CELULA + TAMANHO_CELULA / 2;
  return SETORES.some((setor) => setor.mesas.some((mesa) => mesaOcupa(mesa, px, py)));
}

export function celulaDe(ponto: Ponto): Celula {
  return {
    x: Math.min(COLUNAS - 1, Math.max(0, Math.floor(ponto.x / TAMANHO_CELULA))),
    z: Math.min(LINHAS - 1, Math.max(0, Math.floor(ponto.y / TAMANHO_CELULA))),
  };
}

export function pontoDaCelula(celula: Celula): Ponto {
  return {
    x: celula.x * TAMANHO_CELULA + TAMANHO_CELULA / 2,
    y: celula.z * TAMANHO_CELULA + TAMANHO_CELULA / 2,
  };
}

// Grade com origem e destino liberados: o agente pode começar ou parar em cima de uma mesa.
export function gradeParaPercurso(origem: Celula, destino: Celula): Grade {
  return {
    largura: COLUNAS,
    altura: LINHAS,
    bloqueada: (x, z) => {
      if ((x === origem.x && z === origem.z) || (x === destino.x && z === destino.z)) return false;
      return celulaOcupada(x, z);
    },
  };
}

// Caminho em pontos 2D do plano (origem exclusive) até o destino, já suavizado.
export function caminhoEntre(origem: Ponto, destino: Ponto): Ponto[] {
  const inicio = celulaDe(origem);
  const fim = celulaDe(destino);
  const grade = gradeParaPercurso(inicio, fim);
  const caminho = encontrarCaminho(grade, inicio, fim);
  if (!caminho) return [destino];
  const suave = suavizarCaminho(caminho, grade);
  return [...suave.slice(1).map(pontoDaCelula.bind(null)), destino];
}

// Converte um ponto 3D de volta para o plano 2D (inverso de paraX/paraZ).
export function pontoDe3d(x3d: number, z3d: number): Ponto {
  return { x: x3d * ESCALA_3D + LARGURA / 2, y: z3d * ESCALA_3D + ALTURA / 2 };
}
