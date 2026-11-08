// Regras puras da transcrição de áudios do WhatsApp (testadas em
// tests/transcricao-audio.test.ts). A chamada ao Gemini fica em
// transcricao.server.ts.

/** Áudio mais longo que isso não é transcrito (gasta a cota gratuita à toa). */
export const TRANSCRICAO_MAX_SEGUNDOS = 180;
/** ~3 min de nota de voz (opus) fica bem abaixo disso. */
export const TRANSCRICAO_MAX_BYTES = 4 * 1024 * 1024;
export const TRANSCRICAO_MAX_CARACTERES = 3000;
/** O que o Gemini responde quando não há fala; também é o que aparece na Central. */
export const SEM_FALA = "[sem fala compreensível]";

export const PROMPT_TRANSCRICAO =
  "Transcreva fielmente a fala deste áudio de WhatsApp, em português do Brasil. " +
  "Responda somente com o texto falado, sem aspas, sem comentários e sem descrever sons. " +
  'Números ditos por extenso que sejam a escolha de uma opção (ex.: "um", "opção dois") ' +
  `escreva como algarismo. Se não houver fala compreensível, responda exatamente: ${SEM_FALA}`;

/** Vale a pena transcrever? (só áudio, com duração e tamanho razoáveis) */
export function deveTranscrever(midia: {
  tipo: string | null;
  mime: string | null;
  segundos?: number | null | undefined;
  tamanho?: number | null | undefined;
}): boolean {
  if (midia.tipo !== "audio") return false;
  if (!midia.mime?.startsWith("audio/")) return false;
  if (midia.segundos && midia.segundos > TRANSCRICAO_MAX_SEGUNDOS) return false;
  if (midia.tamanho && midia.tamanho > TRANSCRICAO_MAX_BYTES) return false;
  return true;
}

/** Limpa a resposta do modelo; devolve SEM_FALA quando não veio fala. */
export function limparTranscricao(bruto: string | null | undefined): string {
  let t = (bruto ?? "").replace(/\s+/g, " ").trim();
  // Às vezes o modelo embrulha em aspas ou prefixa "Transcrição:".
  t = t.replace(/^(transcri[çc][ãa]o|texto)\s*:\s*/i, "").trim();
  if (/^["“].*["”]$/.test(t)) t = t.slice(1, -1).trim();
  if (!t || /sem fala compreens[ií]vel|^\[?(inaud[ií]vel|sil[êe]ncio|m[úu]sica)\]?\.?$/i.test(t)) {
    return SEM_FALA;
  }
  return t.length > TRANSCRICAO_MAX_CARACTERES ? `${t.slice(0, TRANSCRICAO_MAX_CARACTERES)}…` : t;
}

/** Texto que o robô deve usar (null quando o áudio não tinha fala). */
export function textoParaRobo(transcricao: string | null): string | null {
  if (!transcricao || transcricao === SEM_FALA) return null;
  return transcricao;
}
