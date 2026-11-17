// Leitura das métricas do Instagram pela Graph API oficial (somente GET).
// Usa o token da Página já conectada (meta.server.ts). Nunca grava token em lugar
// nenhum e nunca devolve o token para fora deste módulo.
import { GRAPH } from "./meta.server";
import type { MidiaBruta } from "./ig-metricas.normalizar";

/** Códigos da Graph API que indicam limite de uso: vale tentar de novo com espera. */
const CODIGOS_LIMITE = new Set([4, 17, 32, 613]);
/** Códigos de permissão ausente ou inválida: não adianta tentar de novo. */
const CODIGOS_PERMISSAO = new Set([10, 200]);
/** Métrica pedida que a API não suporta para o tipo de mídia. */
const CODIGO_METRICA_INVALIDA = 100;
const TIMEOUT_REDE_MS = 20_000;
const TENTATIVAS_MAX = 3;
const ESPERA_BASE_MS = 2000;
const LIMITE_POSTS = 50;
const METRICAS_CONTA = "reach,profile_views,website_clicks";
const METRICAS_MIDIA = "reach,saved,shares,views";

export class ErroGraph extends Error {
  constructor(
    message: string,
    readonly codigo: number | null,
  ) {
    super(message);
    this.name = "ErroGraph";
  }
}

/** Falta de permissão ou métrica não suportada: o caso em que vale tentar uma versão mais simples. */
export function ehErroDeCampoOuPermissao(erro: unknown): boolean {
  return (
    erro instanceof ErroGraph &&
    erro.codigo !== null &&
    (CODIGOS_PERMISSAO.has(erro.codigo) || erro.codigo === CODIGO_METRICA_INVALIDA)
  );
}

export function ehErroDePermissao(erro: unknown): boolean {
  return erro instanceof ErroGraph && erro.codigo !== null && CODIGOS_PERMISSAO.has(erro.codigo);
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function chamar<T>(
  caminho: string,
  params: Record<string, string>,
  token: string,
): Promise<T> {
  const url = new URL(`${GRAPH}${caminho}`);
  for (const [chave, valor] of Object.entries({ ...params, access_token: token })) {
    url.searchParams.set(chave, valor);
  }
  const resposta = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_REDE_MS) });
  const corpo = (await resposta.json().catch(() => ({}))) as {
    error?: { message?: string; code?: number };
  } & T;
  if (!resposta.ok || corpo.error) {
    throw new ErroGraph(
      `Meta: ${corpo.error?.message ?? `HTTP ${resposta.status}`}`,
      corpo.error?.code ?? null,
    );
  }
  return corpo;
}

/** Repete a chamada só em erro de limite de uso, com espera crescente. */
export async function chamarComRetentativa<T>(
  caminho: string,
  params: Record<string, string>,
  token: string,
): Promise<T> {
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await chamar<T>(caminho, params, token);
    } catch (erro) {
      const limite =
        erro instanceof ErroGraph && erro.codigo !== null && CODIGOS_LIMITE.has(erro.codigo);
      if (!limite || tentativa >= TENTATIVAS_MAX) throw erro;
      await espera(ESPERA_BASE_MS * 2 ** (tentativa - 1));
    }
  }
}

export type ContaBruta = { followers_count?: number; media_count?: number };

export async function buscarConta(igUserId: string, token: string): Promise<ContaBruta> {
  return chamarComRetentativa<ContaBruta>(
    `/${igUserId}`,
    { fields: "followers_count,media_count" },
    token,
  );
}

/** Seguidores dia a dia dos últimos 30 dias (a API só fornece com 100+ seguidores). */
export async function buscarSeguidoresDiarios(
  igUserId: string,
  token: string,
): Promise<{ data: { values?: { value?: number; end_time?: string }[] }[] }> {
  return chamarComRetentativa(
    `/${igUserId}/insights`,
    { metric: "follower_count", period: "day" },
    token,
  );
}

export type InsightsContaBruto = {
  data: { name: string; total_value?: { value?: number } }[];
};

export async function buscarInsightsConta(
  igUserId: string,
  token: string,
): Promise<InsightsContaBruto> {
  return chamarComRetentativa<InsightsContaBruto>(
    `/${igUserId}/insights`,
    { metric: METRICAS_CONTA, period: "day", metric_type: "total_value" },
    token,
  );
}

/**
 * Lista de posts/Reels já com as métricas aninhadas, numa única chamada
 * (economiza o limite de uso da Graph API).
 */
export async function buscarMidias(
  igUserId: string,
  token: string,
): Promise<{ data: MidiaBruta[] }> {
  return chamarComRetentativa<{ data: MidiaBruta[] }>(
    `/${igUserId}/media`,
    {
      fields: [
        "id",
        "media_type",
        "media_product_type",
        "timestamp",
        "caption",
        "thumbnail_url",
        "media_url",
        "permalink",
        "like_count",
        "comments_count",
        `insights.metric(${METRICAS_MIDIA})`,
      ].join(","),
      limit: String(LIMITE_POSTS),
    },
    token,
  );
}

/** Mesma lista, sem insights: usada quando a permissão de insights falta. */
export async function buscarMidiasBasicas(
  igUserId: string,
  token: string,
): Promise<{ data: MidiaBruta[] }> {
  return chamarComRetentativa<{ data: MidiaBruta[] }>(
    `/${igUserId}/media`,
    {
      fields:
        "id,media_type,media_product_type,timestamp,caption,thumbnail_url,media_url,permalink,like_count,comments_count",
      limit: String(LIMITE_POSTS),
    },
    token,
  );
}
