// One-shot IA lookups (película, test point, model-from-photo). Prefers
// Gemini — free tier, no IA credit spent — when GEMINI_API_KEY is set
// (unless the caller asks for the paid provider first); otherwise uses
// AI_PROVIDER (provider.server.ts) and charges one IA credit, refunded if
// the call fails. Kept apart from provider.server.ts because grounding and
// inline images are Gemini-specific and the chat there needs tool calling.
import { consumirUsoIA, devolverUsoIA } from "./uso-diario.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { chamarProvedorIA, IAIndisponivelError } from "./provider.server";
import { requireFeature, FeatureIndisponivelError } from "@/lib/planos/features";

export type Imagem = { mime: "image/jpeg" | "image/png" | "image/webp"; base64: string };
export type Fonte = { titulo: string; url: string };
export type RespostaConsulta = { texto: string; fontes: Fonte[] };

const LIMITE_GEMINI_POR_MINUTO = 10;
const consultasGemini = new Map<string, number[]>();
function dentroDoLimiteGemini(userId: string): boolean {
  const agora = Date.now();
  const marcas = (consultasGemini.get(userId) ?? []).filter((t) => agora - t < 60_000);
  marcas.push(agora);
  consultasGemini.set(userId, marcas);
  return marcas.length <= LIMITE_GEMINI_POR_MINUTO;
}

const GEMINI_TIMEOUT_MS = 25_000;
const GEMINI_RESERVA = "gemini-flash-lite-latest";

async function chamarGemini(params: {
  apiKey: string;
  systemPrompt: string;
  texto: string;
  imagens: Imagem[];
  pesquisar: boolean;
}): Promise<RespostaConsulta> {
  // Flash-Lite by default: on the free tier the full Flash model regularly
  // takes 60s+ (measured), which left the page stuck on "Analisando...".
  const principal = process.env["GEMINI_MODEL"] || GEMINI_RESERVA;
  const modelos = [...new Set([principal, GEMINI_RESERVA])];
  const tentar = (modelo: string, pesquisar: boolean) =>
    fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`,
      {
        method: "POST",
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
        headers: { "x-goog-api-key": params.apiKey, "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: params.systemPrompt }] },
          contents: [
            {
              role: "user",
              parts: [
                ...params.imagens.map((i) => ({
                  inline_data: { mime_type: i.mime, data: i.base64 },
                })),
                { text: params.texto },
              ],
            },
          ],
          ...(pesquisar ? { tools: [{ google_search: {} }] } : {}),
        }),
      },
    );

  // Google Search grounding has no free quota on new keys (429 even on the
  // first call), so it's opt-in via GEMINI_PESQUISA=1 and dropped on 429.
  // A timeout or overload (5xx) moves on to the next model.
  let res: Response | null = null;
  let pesquisar = params.pesquisar && process.env["GEMINI_PESQUISA"] === "1";
  for (const modelo of modelos) {
    try {
      res = await tentar(modelo, pesquisar);
      if (res.status === 429 && pesquisar) {
        pesquisar = false;
        res = await tentar(modelo, pesquisar);
      }
    } catch (e) {
      console.error(`[ia] gemini ${modelo}: sem resposta`, e instanceof Error ? e.name : e);
      res = null;
      continue;
    }
    if (res.status < 500) break;
    console.error(`[ia] gemini ${modelo}: HTTP ${res.status}`);
  }
  if (!res) throw new Error("A IA demorou demais para responder. Tente de novo.");
  if (!res.ok) {
    const corpo = await res
      .clone()
      .text()
      .catch(() => "");
    console.error(`[ia] gemini HTTP ${res.status} (pesquisa=${pesquisar})`, corpo.slice(0, 300));
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error("IA de pesquisa indisponível: GEMINI_API_KEY inválida ou sem acesso.");
  }
  if (res.status === 429) {
    throw new Error("Limite gratuito da IA de pesquisa atingido. Tente de novo mais tarde.");
  }
  if (!res.ok) throw new Error("IA de pesquisa indisponível no momento.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await res.json();
  const candidato = json?.candidates?.[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const partes: any[] = candidato?.content?.parts ?? [];
  const texto = partes
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!texto) {
    console.error("[ia] gemini sem texto", JSON.stringify(json).slice(0, 300));
    throw new Error("A IA não retornou nenhuma resposta.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chunks: any[] = candidato?.groundingMetadata?.groundingChunks ?? [];
  const vistos = new Set<string>();
  const fontes = chunks
    .map((c) => ({ titulo: String(c.web?.title ?? ""), url: String(c.web?.uri ?? "") }))
    .filter((f) => f.url.startsWith("https://") && !vistos.has(f.url) && vistos.add(f.url))
    .slice(0, 6);
  return { texto, fontes };
}

/**
 * Texto curto para automações sem usuário logado (agente da pesquisa de
 * satisfação no WhatsApp). Tenta o Gemini e, se ele faltar, falhar ou
 * estourar o limite por minuto, o ChatGPT (OPENAI_API_KEY) como reserva.
 * Nunca usa o provedor pago do chat nem créditos de IA; sem nenhuma das duas
 * chaves devolve null e a automação simplesmente não age.
 */
export async function gerarTextoAutomacao(
  empresaId: string,
  params: { systemPrompt: string; texto: string },
): Promise<string | null> {
  const geminiKey = process.env["GEMINI_API_KEY"];
  if (geminiKey && dentroDoLimiteGemini(empresaId)) {
    try {
      const resposta = await chamarGemini({
        apiKey: geminiKey,
        ...params,
        imagens: [],
        pesquisar: false,
      });
      return resposta.texto;
    } catch (e) {
      console.error("[ia] automação: gemini falhou:", e instanceof Error ? e.message : e);
    }
  }
  return chamarChatGPT(params);
}

const OPENAI_MODELO_PADRAO = "gpt-4o-mini";

// Reserva das automações: OpenAI Chat Completions, só texto.
async function chamarChatGPT(params: {
  systemPrompt: string;
  texto: string;
}): Promise<string | null> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) return null;
  const modelo = process.env["OPENAI_MODEL"] || OPENAI_MODELO_PADRAO;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: modelo,
        max_tokens: 400,
        messages: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: params.texto },
        ],
      }),
    });
    if (!res.ok) {
      const corpo = await res.text().catch(() => "");
      console.error(`[ia] automação: chatgpt HTTP ${res.status}`, corpo.slice(0, 300));
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json();
    const texto = String(json?.choices?.[0]?.message?.content ?? "").trim();
    return texto || null;
  } catch (e) {
    console.error("[ia] automação: chatgpt sem resposta", e instanceof Error ? e.name : e);
    return null;
  }
}

async function chamarProvedorPago(
  userId: string,
  params: { systemPrompt: string; texto: string; imagens: Imagem[] },
): Promise<RespostaConsulta> {
  try {
    const resposta = await chamarProvedorIA({
      systemPrompt: params.systemPrompt,
      mensagens: [
        {
          role: "user",
          content: params.imagens.length
            ? [
                ...params.imagens.map((i) => ({
                  type: "image",
                  source: { type: "base64", media_type: i.mime, data: i.base64 },
                })),
                { type: "text", text: params.texto },
              ]
            : params.texto,
        },
      ],
      tools: [],
    });
    if (resposta.kind !== "text" || !resposta.text) {
      throw new Error("A IA não retornou nenhuma resposta.");
    }
    return { texto: resposta.text, fontes: [] };
  } catch (e) {
    if (e instanceof IAIndisponivelError) throw new Error(e.message);
    throw e;
  }
}

export async function consultarIA(
  context: { userId: string; supabase: SupabaseClient<Database> },
  params: {
    systemPrompt: string;
    texto: string;
    imagens?: Imagem[];
    pesquisar?: boolean;
    // Use the paid AI_PROVIDER first when accuracy matters more
    // than cost — e.g. identifying a phone from photos, where the free
    // Flash-Lite often guesses wrong. Falls back to Gemini if it fails.
    preferirPago?: boolean;
  },
): Promise<RespostaConsulta> {
  const imagens = params.imagens ?? [];
  const { data: membership } = await context.supabase
    .from("user_empresas")
    .select("empresa_id")
    .eq("user_id", context.userId);
  const empresaId =
    membership?.find((m) => m.empresa_id !== context.userId)?.empresa_id ??
    membership?.[0]?.empresa_id ??
    context.userId;
  try {
    await requireFeature(empresaId, "IA_BASICA", context.supabase);
  } catch (e) {
    if (e instanceof FeatureIndisponivelError) throw new Error(e.message);
    throw e;
  }

  try {
    await consumirUsoIA(context.userId);
  } catch (e) {
    if (e instanceof IAIndisponivelError) throw new Error(e.message);
    throw e;
  }
  try {
    return await responderConsulta(context.userId, params, imagens);
  } catch (e) {
    await devolverUsoIA(context.userId);
    throw e;
  }
}

async function responderConsulta(
  userId: string,
  params: Parameters<typeof consultarIA>[1],
  imagens: Imagem[],
): Promise<RespostaConsulta> {
  const geminiKey = process.env["GEMINI_API_KEY"];
  const inicio = Date.now();
  const log = (via: string, r: RespostaConsulta) => {
    console.info(
      `[ia] ${via} ok em ${Date.now() - inicio}ms (${imagens.length} foto(s), ${r.fontes.length} fonte(s))`,
    );
    return r;
  };

  // Com AI_PROVIDER=gemini o "pago" é o próprio Gemini pela rota OpenAI, que
  // não leva as fotos — aí a chamada direta ao Gemini (abaixo) é a melhor.
  if (params.preferirPago && process.env["AI_API_KEY"] && process.env["AI_PROVIDER"] !== "gemini") {
    try {
      return log("pago", await chamarProvedorPago(userId, { ...params, imagens }));
    } catch (e) {
      if (!geminiKey) throw e;
      console.error("[ia] pago falhou, usando gemini:", e instanceof Error ? e.message : e);
    }
  }

  if (geminiKey) {
    if (!dentroDoLimiteGemini(userId)) {
      throw new Error("Muitas consultas em pouco tempo — aguarde um instante.");
    }
    return log(
      "gemini",
      await chamarGemini({
        apiKey: geminiKey,
        systemPrompt: params.systemPrompt,
        texto: params.texto,
        imagens,
        pesquisar: params.pesquisar ?? true,
      }),
    );
  }

  return log("pago", await chamarProvedorPago(userId, { ...params, imagens }));
}
