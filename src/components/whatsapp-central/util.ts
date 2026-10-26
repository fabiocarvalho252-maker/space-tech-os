import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Membro } from "@/lib/whatsapp/central.server";

export const QK = {
  acesso: ["whatsapp-central", "acesso"] as const,
  conversas: (filtro: string, busca: string) =>
    ["whatsapp-central", "conversas", filtro, busca] as const,
  conversa: (id: string) => ["whatsapp-central", "conversa", id] as const,
  mensagens: (id: string) => ["whatsapp-central", "mensagens", id] as const,
  contexto: (id: string) => ["whatsapp-central", "contexto", id] as const,
  respostas: ["whatsapp-central", "respostas"] as const,
  filtros: ["whatsapp-central", "filtros"] as const,
  arquivos: (id: string) => ["whatsapp-central", "arquivos", id] as const,
  automacoes: (id: string) => ["whatsapp-central", "automacoes", id] as const,
};

/** OS que ainda não terminaram (aparecem em destaque no painel). */
export const OS_FINALIZADAS = new Set(["entregue", "faturado", "reprovado", "cancelado"]);

/** Hora para a lista: "14:32", "Ontem" ou "12/10". */
export function horaCurta(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd/MM");
}

/** Separador de dia dentro da conversa. */
export function rotuloDia(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return "Hoje";
  if (isYesterday(d)) return "Ontem";
  return format(d, "EEEE, dd 'de' MMMM", { locale: ptBR });
}

export function nomeMembro(equipe: Membro[] | undefined, id: string | null): string | null {
  if (!id) return null;
  return equipe?.find((m) => m.id === id)?.nome ?? "Atendente";
}

export function iniciais(nome: string): string {
  // Por código (não por unidade UTF-16): nome com emoji não vira "�".
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = (p: string | undefined) =>
    Array.from(p ?? "").find((c) => /[\p{L}\p{N}]/u.test(c)) ?? "";
  const letras = primeira(partes[0]) + (partes.length > 1 ? primeira(partes.at(-1)) : "");
  return letras.toUpperCase() || Array.from(nome.trim())[0] || "?";
}

export function tamanhoArquivo(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/** Arquivo do navegador → base64 puro (sem o prefixo data:). */
export function lerComoBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      const resultado = String(leitor.result ?? "");
      resolve(resultado.slice(resultado.indexOf(",") + 1));
    };
    leitor.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    leitor.readAsDataURL(arquivo);
  });
}

export function mensagemDeErro(e: unknown): string {
  return e instanceof Error
    ? e.message.replace(/^COLISAO:\s*/, "")
    : "Algo deu errado. Tente de novo.";
}
