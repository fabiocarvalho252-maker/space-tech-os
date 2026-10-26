// Leitura defensiva dos eventos de mensagem do webhook da Evolution API.
// O formato muda entre versões self-hosted, então tudo entra como unknown e
// sai normalizado. Sem imports com "@/": roda direto no `node --test`.
import { tipoDaMensagemWhatsapp, type MidiaTipo } from "./midia.ts";

export function objeto(valor: unknown): Record<string, unknown> {
  return valor != null && typeof valor === "object" ? (valor as Record<string, unknown>) : {};
}

export function texto(valor: unknown): string | undefined {
  return typeof valor === "string" ? valor : undefined;
}

export type MensagemWebhook = {
  id: string | null;
  fromMe: boolean;
  /** Telefone (só dígitos) ou null para grupo/status/canal, que são ignorados. */
  numero: string | null;
  nomeContato: string | null;
  texto: string | null;
  midia: {
    tipo: MidiaTipo;
    mime: string | null;
    nome: string | null;
    base64: string | null;
  } | null;
  /** Id da mensagem citada, quando o cliente respondeu uma específica. */
  respostaA: string | null;
};

const SUBTIPOS_COM_CONTEXTO = [
  "extendedTextMessage",
  "imageMessage",
  "documentMessage",
  "audioMessage",
  "videoMessage",
  "stickerMessage",
];

export function lerMensagem(data: Record<string, unknown>): MensagemWebhook {
  const key = objeto(data["key"]);
  const remoteJid = texto(key["remoteJid"]);
  const grupoOuCanal = !!remoteJid && /@(g\.us|broadcast|newsletter)$/.test(remoteJid);

  // Contatos com "@lid" chegam com um código no lugar do telefone; o número
  // real vem em remoteJidAlt / senderPn (conforme a versão do Evolution).
  const jidTelefone = remoteJid?.endsWith("@lid")
    ? [key["remoteJidAlt"], key["senderPn"], data["senderPn"]]
        .map(texto)
        .find((j) => j?.endsWith("@s.whatsapp.net"))
    : undefined;
  const numero = grupoOuCanal ? null : ((jidTelefone ?? remoteJid)?.split("@")[0] ?? null);

  let mensagem = objeto(data["message"]);
  // Documento com legenda vem embrulhado um nível a mais.
  const embrulhado = objeto(objeto(mensagem["documentWithCaptionMessage"])["message"]);
  if (embrulhado["documentMessage"]) mensagem = { ...mensagem, ...embrulhado };

  const messageType =
    texto(data["messageType"]) ??
    Object.keys(mensagem).find((k) => tipoDaMensagemWhatsapp(k) !== null) ??
    "";
  const tipoMidia = tipoDaMensagemWhatsapp(messageType);
  const subtipo = objeto(
    mensagem[messageType === "documentWithCaptionMessage" ? "documentMessage" : messageType],
  );

  const corpo =
    texto(mensagem["conversation"]) ??
    texto(objeto(mensagem["extendedTextMessage"])["text"]) ??
    texto(subtipo["caption"]) ??
    texto(mensagem["body"]) ??
    null;

  let respostaA: string | null = null;
  for (const k of SUBTIPOS_COM_CONTEXTO) {
    const id = texto(objeto(objeto(mensagem[k])["contextInfo"])["stanzaId"]);
    if (id) {
      respostaA = id;
      break;
    }
  }
  respostaA ??= texto(objeto(data["contextInfo"])["stanzaId"]) ?? null;

  return {
    id: texto(key["id"]) ?? null,
    fromMe: key["fromMe"] === true,
    numero,
    nomeContato: key["fromMe"] === true ? null : (texto(data["pushName"]) ?? null),
    texto: corpo,
    midia: tipoMidia
      ? {
          tipo: tipoMidia,
          mime: texto(subtipo["mimetype"])?.split(";")[0]?.trim() ?? null,
          nome: texto(subtipo["fileName"]) ?? texto(subtipo["title"]) ?? null,
          base64: texto(mensagem["base64"]) ?? texto(data["base64"]) ?? null,
        }
      : null,
    respostaA,
  };
}

export type StatusWebhook = { id: string; entrega: "entregue" | "lido" };

/**
 * MESSAGES_UPDATE → confirmação de entrega/leitura. Devolve null para
 * estados que não interessam (SERVER_ACK, PENDING, ERROR...).
 */
export function lerStatus(data: Record<string, unknown>): StatusWebhook | null {
  const id = texto(data["keyId"]) ?? texto(objeto(data["key"])["id"]);
  const status = (
    texto(data["status"]) ??
    texto(objeto(data["update"])["status"]) ??
    ""
  ).toUpperCase();
  if (!id) return null;
  if (status === "READ" || status === "PLAYED") return { id, entrega: "lido" };
  if (status === "DELIVERY_ACK") return { id, entrega: "entregue" };
  return null;
}
