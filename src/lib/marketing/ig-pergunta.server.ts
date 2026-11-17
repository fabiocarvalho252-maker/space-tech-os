// "Pergunte ao Claude" sobre as métricas do Instagram (API de mensagens da Anthropic).
// Sem ANTHROPIC_API_KEY no .env, não chama nada e avisa. Envia só números agregados
// e os títulos curtos dos posts: nunca token, IDs internos ou dados de contato.
import type { PainelInstagram } from "./ig-metricas.server";
import { TAMANHO_PERGUNTA_MAX } from "./ig-metricas.calc";

const URL_API = "https://api.anthropic.com/v1/messages";
const VERSAO_API = "2023-06-01";
const MODELO_PADRAO = "claude-sonnet-5-5";
const MAX_TOKENS_RESPOSTA = 600;
const TIMEOUT_MODELO_MS = 30_000;
const MAX_TITULOS = 15;
const TAMANHO_TITULO = 60;

export type RespostaPergunta =
  { disponivel: false; motivo: string } | { disponivel: true; resposta: string };

export function chaveAnthropicConfigurada(): boolean {
  return Boolean(process.env["ANTHROPIC_API_KEY"]);
}

/** Resumo sem identificadores: o modelo só recebe números e títulos truncados. */
export function resumirParaModelo(painel: PainelInstagram): string {
  const ultimo = painel.conta.at(-1);
  const posts = [...painel.midias]
    .sort((a, b) => (b.alcance ?? -1) - (a.alcance ?? -1))
    .slice(0, MAX_TITULOS)
    .map((p) => ({
      data: p.data,
      tipo: p.tipo,
      titulo: p.legenda.slice(0, TAMANHO_TITULO),
      alcance: p.alcance,
      curtidas: p.curtidas,
      comentarios: p.comentarios,
      salvamentos: p.salvamentos,
      compartilhamentos: p.compartilhamentos,
    }));
  return JSON.stringify(
    {
      seguidoresAtuais: painel.seguidoresAtuais,
      diasDeHistorico: painel.conta.length,
      ultimoDiaConta: ultimo ?? null,
      permissoesCompletas: painel.ultimaColeta?.permissoesOk ?? null,
      posts,
    },
    null,
    0,
  );
}

const INSTRUCAO_SISTEMA =
  "Você analisa métricas de Instagram de uma assistência técnica (SPACE TECH). " +
  "Responda em português, de forma curta e objetiva, apenas com base nos dados fornecidos. " +
  "Se faltar dado para responder, diga que falta, sem estimar.";

type RespostaApi = { content?: { type: string; text?: string }[]; error?: { message?: string } };

export async function perguntarSobreMetricas(
  pergunta: string,
  painel: PainelInstagram,
): Promise<RespostaPergunta> {
  const chave = process.env["ANTHROPIC_API_KEY"];
  if (!chave) {
    return {
      disponivel: false,
      motivo: "Configure ANTHROPIC_API_KEY no .env para usar o Pergunte ao Claude.",
    };
  }
  const modelo = process.env["ANTHROPIC_MODEL"] || MODELO_PADRAO;
  const perguntaLimpa = pergunta.trim().slice(0, TAMANHO_PERGUNTA_MAX);

  const r = await fetch(URL_API, {
    method: "POST",
    headers: {
      "x-api-key": chave,
      "anthropic-version": VERSAO_API,
      "content-type": "application/json",
    },
    signal: AbortSignal.timeout(TIMEOUT_MODELO_MS),
    body: JSON.stringify({
      model: modelo,
      max_tokens: MAX_TOKENS_RESPOSTA,
      system: INSTRUCAO_SISTEMA,
      messages: [
        {
          role: "user",
          content: `Dados (JSON):\n${resumirParaModelo(painel)}\n\nPergunta: ${perguntaLimpa}`,
        },
      ],
    }),
  });
  const corpo = (await r.json().catch(() => ({}))) as RespostaApi;
  if (!r.ok) {
    throw new Error(`Anthropic: ${corpo.error?.message ?? `HTTP ${r.status}`}`);
  }
  const texto = (corpo.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n")
    .trim();
  return { disponivel: true, resposta: texto || "Sem resposta do modelo." };
}
