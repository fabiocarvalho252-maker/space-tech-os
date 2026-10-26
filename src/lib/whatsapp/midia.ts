// Validação de anexos da Central de WhatsApp. O tipo vem dos primeiros
// bytes do arquivo — nome e MIME informados pelo navegador só servem para
// desempatar formatos que têm a mesma assinatura (docx/xlsx são zip).
// Sem imports com "@/": roda direto no `node --test` (scripts/test.sh).

export type MidiaTipo = "imagem" | "documento" | "audio" | "video" | "figurinha";

export const MIDIA_MAX_BYTES_PADRAO = 16 * 1024 * 1024;

type Formato = { mime: string; extensao: string; tipo: MidiaTipo };

const ZIP_OFFICE: Record<string, Formato> = {
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extensao: "docx",
    tipo: "documento",
  },
  xlsx: {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extensao: "xlsx",
    tipo: "documento",
  },
};

function comeca(bytes: Uint8Array, assinatura: number[], offset = 0): boolean {
  if (bytes.length < offset + assinatura.length) return false;
  return assinatura.every((b, i) => bytes[offset + i] === b);
}

function ascii(bytes: Uint8Array, offset: number, tamanho: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + tamanho));
}

function extensaoDe(nome: string): string {
  const m = /\.([a-z0-9]{1,8})$/i.exec(nome);
  return m ? (m[1] ?? "").toLowerCase() : "";
}

/** Formato real pelos bytes, ou null se não for um dos aceitos. */
export function detectarFormato(bytes: Uint8Array, nome = ""): Formato | null {
  if (comeca(bytes, [0xff, 0xd8, 0xff]))
    return { mime: "image/jpeg", extensao: "jpg", tipo: "imagem" };
  if (comeca(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { mime: "image/png", extensao: "png", tipo: "imagem" };
  if (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a")
    return { mime: "image/gif", extensao: "gif", tipo: "imagem" };
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP")
    return { mime: "image/webp", extensao: "webp", tipo: "imagem" };
  if (ascii(bytes, 0, 5) === "%PDF-")
    return { mime: "application/pdf", extensao: "pdf", tipo: "documento" };
  if (ascii(bytes, 4, 4) === "ftyp") return { mime: "video/mp4", extensao: "mp4", tipo: "video" };
  if (ascii(bytes, 0, 4) === "OggS") return { mime: "audio/ogg", extensao: "ogg", tipo: "audio" };
  if (ascii(bytes, 0, 3) === "ID3" || comeca(bytes, [0xff, 0xfb]) || comeca(bytes, [0xff, 0xf3]))
    return { mime: "audio/mpeg", extensao: "mp3", tipo: "audio" };
  if (comeca(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    // Zip só vale como documento do Office — zip solto pode levar qualquer coisa.
    return ZIP_OFFICE[extensaoDe(nome)] ?? null;
  }
  return null;
}

/** Nome para mostrar e para o download: sem caminho nem caracteres de controle. */
export function nomeSeguro(nome: string, padrao = "arquivo"): string {
  const base = nome.split(/[\\/]/).pop() ?? "";
  const limpo = base
    .replace(/[^\p{L}\p{N} ._()-]/gu, "_")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 100);
  return limpo || padrao;
}

export type ResultadoValidacao =
  | { ok: true; mime: string; extensao: string; tipo: MidiaTipo; nome: string }
  | { ok: false; motivo: string };

/** Anexo enviado por um atendente: tamanho, tipo pelos bytes e nome seguro. */
export function validarAnexo(
  nome: string,
  bytes: Uint8Array,
  maxBytes = MIDIA_MAX_BYTES_PADRAO,
): ResultadoValidacao {
  if (bytes.length === 0) return { ok: false, motivo: "Arquivo vazio." };
  if (bytes.length > maxBytes) {
    const mb = Math.round(maxBytes / 1024 / 1024);
    return { ok: false, motivo: `Arquivo maior que ${mb} MB.` };
  }
  const formato = detectarFormato(bytes, nome);
  if (!formato) {
    return {
      ok: false,
      motivo: "Tipo de arquivo não permitido. Envie imagem, PDF, Word, Excel, áudio ou vídeo MP4.",
    };
  }
  const base = nomeSeguro(nome).replace(/\.[a-z0-9]{1,8}$/i, "");
  return { ok: true, ...formato, nome: `${base || "arquivo"}.${formato.extensao}` };
}

/** Tipo da mensagem do WhatsApp (messageType da Evolution) → tipo do anexo. */
export function tipoDaMensagemWhatsapp(messageType: string): MidiaTipo | null {
  if (messageType === "imageMessage") return "imagem";
  if (messageType === "documentMessage" || messageType === "documentWithCaptionMessage")
    return "documento";
  if (messageType === "audioMessage" || messageType === "pttMessage") return "audio";
  if (messageType === "videoMessage") return "video";
  if (messageType === "stickerMessage") return "figurinha";
  return null;
}
