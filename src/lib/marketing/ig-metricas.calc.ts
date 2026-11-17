// Cálculos do painel de métricas do Instagram. Funções puras: sem rede, sem
// banco, sem React. Testadas em tests/ig-metricas.test.ts.

export type PontoSeguidores = { data: string; seguidores: number };

export type PostMetricas = {
  id: string;
  tipo: string;
  data: string;
  legenda: string;
  miniatura: string | null;
  permalink: string | null;
  /** null quando a API não devolveu a métrica (nunca 0 inventado). */
  alcance: number | null;
  curtidas: number;
  comentarios: number;
  salvamentos: number | null;
  compartilhamentos: number | null;
  visualizacoes: number | null;
};

export type VariacaoSeguidores = {
  suficiente: boolean;
  atual: number | null;
  anterior: number | null;
  delta: number | null;
  percentual: number | null;
};

export type CriterioRanking = "alcance" | "salvamentos" | "compartilhamentos" | "visualizacoes";

const MS_POR_DIA = 86_400_000;

function paraMs(data: string): number {
  return Date.parse(`${data}T00:00:00Z`);
}

function arredondar1(valor: number): number {
  return Math.round(valor * 10) / 10;
}

/**
 * Compara o último ponto da série com o ponto mais recente que esteja pelo
 * menos `dias` antes dele. Sem ponto anterior suficiente, o histórico é
 * considerado insuficiente em vez de inventar uma variação.
 */
export function variacaoSeguidores(serie: PontoSeguidores[], dias: number): VariacaoSeguidores {
  const ordenada = [...serie].sort((a, b) => paraMs(a.data) - paraMs(b.data));
  const vazio: VariacaoSeguidores = {
    suficiente: false,
    atual: null,
    anterior: null,
    delta: null,
    percentual: null,
  };
  const ultimo = ordenada.at(-1);
  if (!ultimo) return vazio;

  const limite = paraMs(ultimo.data) - dias * MS_POR_DIA;
  const anterior = ordenada.filter((p) => paraMs(p.data) <= limite).at(-1);
  if (!anterior) return { ...vazio, atual: ultimo.seguidores };

  const delta = ultimo.seguidores - anterior.seguidores;
  const percentual =
    anterior.seguidores > 0 ? arredondar1((delta / anterior.seguidores) * 100) : null;
  return {
    suficiente: true,
    atual: ultimo.seguidores,
    anterior: anterior.seguidores,
    delta,
    percentual,
  };
}

/**
 * Média, por post, de (curtidas + comentários + salvos + compartilhamentos) ÷
 * alcance, em porcentagem. Posts sem alcance ficam de fora da média.
 */
export function engajamentoMedio(posts: PostMetricas[]): number | null {
  const taxas = posts
    .filter(
      (
        p,
      ): p is PostMetricas & { alcance: number; salvamentos: number; compartilhamentos: number } =>
        p.alcance !== null &&
        p.alcance > 0 &&
        p.salvamentos !== null &&
        p.compartilhamentos !== null,
    )
    .map(
      (p) => ((p.curtidas + p.comentarios + p.salvamentos + p.compartilhamentos) / p.alcance) * 100,
    );
  if (!taxas.length) return null;
  const media = taxas.reduce((soma, t) => soma + t, 0) / taxas.length;
  return arredondar1(media);
}

/**
 * Ranking por um critério, do maior para o menor. Empate desempata pelo
 * alcance. Devolve uma cópia: o array original não é alterado.
 */
export function rankingPosts(
  posts: PostMetricas[],
  criterio: CriterioRanking,
  limite: number,
): PostMetricas[] {
  return [...posts]
    .sort(
      (a, b) => (b[criterio] ?? -1) - (a[criterio] ?? -1) || (b.alcance ?? -1) - (a.alcance ?? -1),
    )
    .slice(0, Math.max(0, limite));
}

const DIAS_DA_JANELA_MAX = 366;

function dataDeDia(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Série diária dos últimos `dias` até `hoje` (inclusive). Dias sem coleta
 * repetem o último valor conhecido. Dias antes da primeira coleta ficam de
 * fora: não se inventa histórico.
 */
export function serieSeguidores(
  pontos: PontoSeguidores[],
  dias: number,
  hoje: string,
): PontoSeguidores[] {
  const total = Math.min(Math.max(1, Math.floor(dias)), DIAS_DA_JANELA_MAX);
  const ordenados = [...pontos].sort((a, b) => paraMs(a.data) - paraMs(b.data));
  const fimMs = paraMs(hoje);
  const serie: PontoSeguidores[] = [];
  let ultimo: PontoSeguidores | undefined;
  let indice = 0;

  for (let i = 0; i < total; i++) {
    const diaMs = fimMs - (total - 1 - i) * MS_POR_DIA;
    const dia = dataDeDia(diaMs);
    while (indice < ordenados.length && paraMs(ordenados[indice]!.data) <= diaMs) {
      ultimo = ordenados[indice];
      indice++;
    }
    if (ultimo) serie.push({ data: dia, seguidores: ultimo.seguidores });
  }
  return serie;
}

/** Limite de caracteres da pergunta enviada ao assistente (compartilhado com o cliente). */
export const TAMANHO_PERGUNTA_MAX = 500;

const FUSO_BRASIL = "America/Sao_Paulo";

/** Dia no fuso de Brasília, AAAA-MM-DD. Usado tanto no servidor quanto no painel. */
export function diaBrasil(momento: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_BRASIL }).format(momento);
}

/** Soma de uma métrica ignorando null. Sem nenhum valor conhecido, devolve null (nunca 0). */
export function somarMetrica(posts: PostMetricas[], campo: CampoNumericoPost): number | null {
  const valores = posts.map((p) => p[campo]).filter((v): v is number => typeof v === "number");
  if (!valores.length) return null;
  return valores.reduce((soma, v) => soma + v, 0);
}

/** Posts publicados nos últimos `dias` até `hoje` (inclusive). */
export function filtrarPorPeriodo(
  posts: PostMetricas[],
  dias: number,
  hoje: string,
): PostMetricas[] {
  const inicio = paraMs(hoje) - (Math.max(1, Math.floor(dias)) - 1) * MS_POR_DIA;
  return posts.filter((p) => {
    const ms = paraMs(p.data);
    return !Number.isNaN(ms) && ms >= inicio && ms <= paraMs(hoje);
  });
}

export type CampoNumericoPost =
  "alcance" | "curtidas" | "comentarios" | "salvamentos" | "compartilhamentos" | "visualizacoes";

const formatoNumeroPt = new Intl.NumberFormat("pt-BR");

/** Número para exibir; null vira "n/d" (dado que a API não entregou). */
export function formatarValor(valor: number | null): string {
  return valor === null ? "n/d" : formatoNumeroPt.format(valor);
}

/** Só links https válidos viram href; o resto não é clicável. */
export function linkSeguro(url: string | null): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function dataCurtaPt(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

/** Alternativa textual ao gráfico para leitores de tela. */
export function resumoParaLeitor(serie: PontoSeguidores[]): string {
  const primeiro = serie[0];
  const ultimo = serie.at(-1);
  if (!primeiro || !ultimo) return "Sem dados de seguidores.";
  const diferenca = ultimo.seguidores - primeiro.seguidores;
  const verbo = diferenca >= 0 ? "ganhou" : "perdeu";
  return `De ${dataCurtaPt(primeiro.data)} a ${dataCurtaPt(ultimo.data)} a conta ${verbo} ${Math.abs(diferenca)} seguidores, chegando a ${ultimo.seguidores}.`;
}

/**
 * Pontos válidos da série de seguidores da Meta. Zero ou negativo significa
 * "sem dado" (a Meta devolve 0 quando ainda não consolidou o dia), e não queda real.
 */
export function seguidoresValidos<T extends { value?: number }>(
  valores: T[],
): (T & { value: number })[] {
  return valores.filter(
    (v): v is T & { value: number } => typeof v.value === "number" && v.value > 0,
  );
}
