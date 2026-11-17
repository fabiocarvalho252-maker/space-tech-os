// Pathfinding em grade 2D para o Escritório IA: A* com 8 direções, heurística
// octile e suavização por linha de Bresenham. Lógica pura: sem three, React ou DOM.

export type Celula = { x: number; z: number };

export type Grade = {
  largura: number;
  altura: number;
  bloqueada: (x: number, z: number) => boolean;
};

type ItemFila = { indice: number; prioridade: number };

type FilaDePrioridade = {
  vazia: () => boolean;
  inserir: (indice: number, prioridade: number) => void;
  remover: () => ItemFila | undefined;
};

type EstadoBusca = {
  custos: Float64Array;
  anteriores: Int32Array;
  fila: FilaDePrioridade;
};

const CUSTO_RETA = 1;
const CUSTO_DIAGONAL = Math.SQRT2;
const FATOR_LIMITE_ITERACOES = 4;
const SEM_ANTERIOR = -1;

const DIRECOES: ReadonlyArray<Celula> = [
  { x: 1, z: 0 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
  { x: 0, z: -1 },
  { x: 1, z: 1 },
  { x: 1, z: -1 },
  { x: -1, z: 1 },
  { x: -1, z: -1 },
];

/** Encontra o caminho entre duas células, incluindo origem e destino, ou null se não há rota. */
export function encontrarCaminho(grade: Grade, origem: Celula, destino: Celula): Celula[] | null {
  if (!gradeValida(grade)) return null;
  if (!celulaLivre(grade, origem.x, origem.z)) return null;
  if (!celulaLivre(grade, destino.x, destino.z)) return null;
  if (origem.x === destino.x && origem.z === destino.z) {
    return [copiarCelula(origem)];
  }
  return buscarAEstrela(grade, origem, destino);
}

/** Remove pontos intermediários sempre que há linha reta livre até um ponto posterior. */
export function suavizarCaminho(caminho: Celula[], grade: Grade): Celula[] {
  const ultimo = caminho.length - 1;
  const resultado: Celula[] = [];
  let indiceAtual = 0;
  for (;;) {
    const atual = caminho[indiceAtual];
    if (!atual) break;
    resultado.push(copiarCelula(atual));
    if (indiceAtual >= ultimo) break;
    indiceAtual = proximoPontoVisivel(caminho, indiceAtual, grade);
  }
  return resultado;
}

function buscarAEstrela(grade: Grade, origem: Celula, destino: Celula): Celula[] | null {
  const total = grade.largura * grade.altura;
  const limite = total * FATOR_LIMITE_ITERACOES;
  const inicio = indiceDaCelula(grade, origem.x, origem.z);
  const fim = indiceDaCelula(grade, destino.x, destino.z);
  const estado: EstadoBusca = {
    custos: new Float64Array(total).fill(Infinity),
    anteriores: new Int32Array(total).fill(SEM_ANTERIOR),
    fila: criarFilaDePrioridade(),
  };
  estado.custos[inicio] = 0;
  estado.fila.inserir(inicio, heuristicaOctile(origem, destino));

  for (let iteracao = 0; iteracao < limite; iteracao++) {
    const item = estado.fila.remover();
    if (!item) return null;
    if (item.indice === fim) return reconstruirCaminho(grade, estado.anteriores, fim);
    if (item.prioridade > custoEstimado(grade, estado, item.indice, destino)) continue;
    expandirVizinhos(grade, item.indice, destino, estado);
  }
  return null;
}

function custoEstimado(grade: Grade, estado: EstadoBusca, indice: number, destino: Celula): number {
  const custo = estado.custos[indice] ?? Infinity;
  return custo + heuristicaOctile(celulaDoIndice(grade, indice), destino);
}

function expandirVizinhos(grade: Grade, atual: number, destino: Celula, estado: EstadoBusca): void {
  const origem = celulaDoIndice(grade, atual);
  const custoAtual = estado.custos[atual] ?? Infinity;
  for (const direcao of DIRECOES) {
    const vizinha = { x: origem.x + direcao.x, z: origem.z + direcao.z };
    if (!passagemPermitida(grade, origem.x, origem.z, vizinha.x, vizinha.z)) continue;
    const custoPasso = direcao.x !== 0 && direcao.z !== 0 ? CUSTO_DIAGONAL : CUSTO_RETA;
    const candidato = custoAtual + custoPasso;
    const indiceVizinho = indiceDaCelula(grade, vizinha.x, vizinha.z);
    if (candidato >= (estado.custos[indiceVizinho] ?? Infinity)) continue;
    estado.custos[indiceVizinho] = candidato;
    estado.anteriores[indiceVizinho] = atual;
    estado.fila.inserir(indiceVizinho, candidato + heuristicaOctile(vizinha, destino));
  }
}

function reconstruirCaminho(grade: Grade, anteriores: Int32Array, fim: number): Celula[] {
  const caminho: Celula[] = [];
  let atual = fim;
  while (atual !== SEM_ANTERIOR) {
    caminho.push(celulaDoIndice(grade, atual));
    atual = anteriores[atual] ?? SEM_ANTERIOR;
  }
  return caminho.reverse();
}

function proximoPontoVisivel(caminho: Celula[], inicio: number, grade: Grade): number {
  const origem = caminho[inicio];
  if (!origem) return inicio + 1;
  for (let fim = caminho.length - 1; fim > inicio + 1; fim--) {
    const destino = caminho[fim];
    if (destino && linhaLivre(grade, origem, destino)) return fim;
  }
  return inicio + 1;
}

/** Bresenham célula a célula, aplicando a mesma regra de bloqueio do A*. */
function linhaLivre(grade: Grade, origem: Celula, destino: Celula): boolean {
  if (!celulaLivre(grade, origem.x, origem.z)) return false;
  const dx = Math.abs(destino.x - origem.x);
  const dz = -Math.abs(destino.z - origem.z);
  const sx = origem.x < destino.x ? 1 : -1;
  const sz = origem.z < destino.z ? 1 : -1;
  let erro = dx + dz;
  let x = origem.x;
  let z = origem.z;
  while (x !== destino.x || z !== destino.z) {
    const dobro = 2 * erro;
    const andaX = dobro >= dz;
    const andaZ = dobro <= dx;
    const proximoX = andaX ? x + sx : x;
    const proximoZ = andaZ ? z + sz : z;
    if (!passagemPermitida(grade, x, z, proximoX, proximoZ)) return false;
    if (andaX) {
      erro += dz;
      x += sx;
    }
    if (andaZ) {
      erro += dx;
      z += sz;
    }
  }
  return true;
}

/** Passo de (x, z) para (nx, nz): a célula de destino deve estar livre e, na diagonal, as duas vizinhas ortogonais também. */
function passagemPermitida(grade: Grade, x: number, z: number, nx: number, nz: number): boolean {
  if (!celulaLivre(grade, nx, nz)) return false;
  if (nx === x || nz === z) return true;
  return celulaLivre(grade, nx, z) && celulaLivre(grade, x, nz);
}

function celulaLivre(grade: Grade, x: number, z: number): boolean {
  return dentroDaGrade(grade, x, z) && !grade.bloqueada(x, z);
}

function dentroDaGrade(grade: Grade, x: number, z: number): boolean {
  return (
    Number.isInteger(x) &&
    Number.isInteger(z) &&
    x >= 0 &&
    z >= 0 &&
    x < grade.largura &&
    z < grade.altura
  );
}

function gradeValida(grade: Grade): boolean {
  return (
    Number.isInteger(grade.largura) &&
    Number.isInteger(grade.altura) &&
    grade.largura > 0 &&
    grade.altura > 0
  );
}

/** Heurística octile: admissível e consistente para movimento de 8 direções. */
function heuristicaOctile(a: Celula, b: Celula): number {
  const dx = Math.abs(a.x - b.x);
  const dz = Math.abs(a.z - b.z);
  return CUSTO_RETA * (dx + dz) + (CUSTO_DIAGONAL - 2 * CUSTO_RETA) * Math.min(dx, dz);
}

function indiceDaCelula(grade: Grade, x: number, z: number): number {
  return z * grade.largura + x;
}

function celulaDoIndice(grade: Grade, indice: number): Celula {
  return { x: indice % grade.largura, z: Math.floor(indice / grade.largura) };
}

function copiarCelula(celula: Celula): Celula {
  return { x: celula.x, z: celula.z };
}

/** Heap binário mínimo escrito à mão, usado apenas dentro da busca. */
function criarFilaDePrioridade(): FilaDePrioridade {
  const itens: ItemFila[] = [];

  function subir(posicao: number): void {
    let filho = posicao;
    while (filho > 0) {
      const pai = Math.floor((filho - 1) / 2);
      if (!menorQue(itens, filho, pai)) return;
      trocar(itens, filho, pai);
      filho = pai;
    }
  }

  function descer(posicao: number): void {
    let pai = posicao;
    for (;;) {
      const esquerda = 2 * pai + 1;
      const direita = esquerda + 1;
      let menor = pai;
      if (esquerda < itens.length && menorQue(itens, esquerda, menor)) menor = esquerda;
      if (direita < itens.length && menorQue(itens, direita, menor)) menor = direita;
      if (menor === pai) return;
      trocar(itens, pai, menor);
      pai = menor;
    }
  }

  return {
    vazia: () => itens.length === 0,
    inserir(indice, prioridade) {
      itens.push({ indice, prioridade });
      subir(itens.length - 1);
    },
    remover() {
      const topo = itens[0];
      const ultimo = itens.pop();
      if (!topo || !ultimo) return undefined;
      if (itens.length > 0) {
        itens[0] = ultimo;
        descer(0);
      }
      return topo;
    },
  };
}

function menorQue(itens: ReadonlyArray<ItemFila>, i: number, j: number): boolean {
  const a = itens[i];
  const b = itens[j];
  return a !== undefined && b !== undefined && a.prioridade < b.prioridade;
}

function trocar(itens: ItemFila[], i: number, j: number): void {
  const a = itens[i];
  const b = itens[j];
  if (!a || !b) return;
  itens[i] = b;
  itens[j] = a;
}
