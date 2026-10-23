// One-shot IA lookups (película, test point, model-from-photo). Prefers
// Gemini with Google Search grounding — free tier, real web results, no IA
// credit spent — when GEMINI_API_KEY is set; otherwise falls back to
// AI_PROVIDER (provider.server.ts) and charges one IA credit, refunded if
// the call fails. Kept apart from provider.server.ts because grounding and
// inline images are Gemini-specific and the chat there needs tool calling.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { chamarProvedorIA, IAIndisponivelError } from "./provider.server";
import { verificarEDescontarCreditoIA, estornarCreditoIA } from "./creditos.server";
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

async function chamarGemini(params: {
  apiKey: string;
  systemPrompt: string;
  texto: string;
  imagens: Imagem[];
  pesquisar: boolean;
}): Promise<RespostaConsulta> {
  const model = process.env["GEMINI_MODEL"] || "gemini-flash-latest";
  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
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
          ...(params.pesquisar ? { tools: [{ google_search: {} }] } : {}),
        }),
      },
    );
  } catch {
    throw new Error("Não foi possível conectar à IA de pesquisa (Gemini).");
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
  if (!texto) throw new Error("A IA não retornou nenhuma resposta.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chunks: any[] = candidato?.groundingMetadata?.groundingChunks ?? [];
  const vistos = new Set<string>();
  const fontes = chunks
    .map((c) => ({ titulo: String(c.web?.title ?? ""), url: String(c.web?.uri ?? "") }))
    .filter((f) => f.url.startsWith("https://") && !vistos.has(f.url) && vistos.add(f.url))
    .slice(0, 6);
  return { texto, fontes };
}

export async function consultarIA(
  context: { userId: string; supabase: SupabaseClient<Database> },
  params: { systemPrompt: string; texto: string; imagens?: Imagem[]; pesquisar?: boolean },
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

  const geminiKey = process.env["GEMINI_API_KEY"];
  if (geminiKey) {
    if (!dentroDoLimiteGemini(context.userId)) {
      throw new Error("Muitas consultas em pouco tempo — aguarde um instante.");
    }
    return chamarGemini({
      apiKey: geminiKey,
      systemPrompt: params.systemPrompt,
      texto: params.texto,
      imagens,
      pesquisar: params.pesquisar ?? true,
    });
  }

  try {
    await verificarEDescontarCreditoIA(context.userId);
  } catch (e) {
    if (e instanceof IAIndisponivelError) throw new Error(e.message);
    throw e;
  }
  try {
    const resposta = await chamarProvedorIA({
      systemPrompt: params.systemPrompt,
      mensagens: [
        {
          role: "user",
          content: imagens.length
            ? [
                ...imagens.map((i) => ({
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
    // No answer, no credit spent — same rule as ia.functions.ts.
    await estornarCreditoIA(context.userId);
    if (e instanceof IAIndisponivelError) throw new Error(e.message);
    throw e;
  }
}
