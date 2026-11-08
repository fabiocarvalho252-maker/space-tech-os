// Transcrição dos áudios que os clientes mandam no WhatsApp, pelo Gemini
// gratuito (a mesma GEMINI_API_KEY da SPACE TECH IA). O texto fica em
// whatsapp_messages.transcricao — aparece embaixo do áudio na Central — e o
// robô de atendimento usa como se o cliente tivesse digitado.
//
// Cota própria por empresa e por dia (ia_uso_diario.audios), separada do
// chat da IA: WHATSAPP_TRANSCRICAO_LIMITE_DIARIO no .env (padrão 50).
// Qualquer falha (sem chave, cota, Gemini fora) só deixa o áudio sem texto.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { BUCKET_MIDIA } from "./central.server";
import { PROMPT_TRANSCRICAO, deveTranscrever, limparTranscricao } from "./transcricao";

const LIMITE_PADRAO = 50;
const TIMEOUT_MS = 30_000;
const MODELO_RESERVA = "gemini-flash-lite-latest";

function limiteDiario(): number {
  const n = Number(process.env["WHATSAPP_TRANSCRICAO_LIMITE_DIARIO"]);
  return Number.isInteger(n) && n > 0 ? n : LIMITE_PADRAO;
}

// Funções novas, fora dos tipos gerados do Supabase.
type RpcSemTipo = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: Error | null }>;
function rpc(fn: string, args: Record<string, unknown>) {
  return (supabaseAdmin.rpc as unknown as RpcSemTipo).call(supabaseAdmin, fn, args);
}

async function chamarGemini(apiKey: string, mime: string, base64: string): Promise<string | null> {
  const modelos = [...new Set([process.env["GEMINI_MODEL"] || MODELO_RESERVA, MODELO_RESERVA])];
  for (const modelo of modelos) {
    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`,
        {
          method: "POST",
          signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { inline_data: { mime_type: mime, data: base64 } },
                  { text: PROMPT_TRANSCRICAO },
                ],
              },
            ],
            generationConfig: { temperature: 0 },
          }),
        },
      );
    } catch (e) {
      console.error(
        `[transcricao] gemini ${modelo}: sem resposta`,
        e instanceof Error ? e.name : e,
      );
      continue;
    }
    if (res.status >= 500) {
      console.error(`[transcricao] gemini ${modelo}: HTTP ${res.status}`);
      continue;
    }
    if (!res.ok) {
      const corpo = await res.text().catch(() => "");
      console.error(`[transcricao] gemini HTTP ${res.status}`, corpo.slice(0, 300));
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const partes: any[] = json?.candidates?.[0]?.content?.parts ?? [];
    return partes.map((p) => p.text ?? "").join("");
  }
  return null;
}

/**
 * Transcreve o áudio de uma mensagem recebida (já gravada, com o arquivo no
 * bucket) e guarda o texto. Devolve a transcrição, ou null se não deu.
 */
export async function transcreverAudioRecebido(params: {
  empresaId: string;
  evolutionMessageId: string;
  segundos?: number | null | undefined;
}): Promise<string | null> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) return null;

  const { data: msg } = await supabaseAdmin
    .from("whatsapp_messages")
    .select("id, midia_tipo, midia_mime, midia_path, midia_tamanho, transcricao")
    .eq("user_id", params.empresaId)
    .eq("evolution_message_id", params.evolutionMessageId)
    .maybeSingle();
  if (!msg?.midia_path) return null;
  if (msg.transcricao) return msg.transcricao;
  if (
    !deveTranscrever({
      tipo: msg.midia_tipo,
      mime: msg.midia_mime,
      segundos: params.segundos,
      tamanho: msg.midia_tamanho,
    })
  )
    return null;

  const { data: permitido, error: erroCota } = await rpc("consumir_transcricao_audio", {
    p_empresa: params.empresaId,
    p_limite: limiteDiario(),
  });
  if (erroCota) {
    console.error("[transcricao] cota:", erroCota.message);
    return null;
  }
  if (permitido !== true) return null;

  let bruto: string | null = null;
  try {
    const { data: arquivo, error } = await supabaseAdmin.storage
      .from(BUCKET_MIDIA)
      .download(msg.midia_path);
    if (error || !arquivo) throw new Error(error?.message ?? "arquivo não encontrado");
    const base64 = Buffer.from(await arquivo.arrayBuffer()).toString("base64");
    bruto = await chamarGemini(apiKey, msg.midia_mime!, base64);
  } catch (e) {
    console.error("[transcricao] falha:", e instanceof Error ? e.message : e);
  }
  if (bruto === null) {
    await rpc("devolver_transcricao_audio", { p_empresa: params.empresaId }).catch(() => {});
    return null;
  }

  const transcricao = limparTranscricao(bruto);
  const { error } = await supabaseAdmin
    .from("whatsapp_messages")
    .update({ transcricao })
    .eq("id", msg.id);
  if (error) console.error("[transcricao] não gravada:", error.message);
  return transcricao;
}
