// Consulta de peças a fornecedores pelo WhatsApp (tela Fornecedores).
// Sem imports com "@/": roda direto no `node --test`.
//
// A conversa é aberta pelo link wa.me — o sistema não envia nada sozinho.
// Quem confirma o envio é o usuário, no próprio WhatsApp.
import { buildWaMeLink, isValidPhoneBR } from "./whatsapp.ts";

/** Fuso da operação. Mesmo fuso usado no resto do sistema (PDFs, fila). */
export const FUSO_OPERACAO = "America/Sao_Paulo";

/** Hora (0–23) no fuso da operação, independente do fuso do navegador/servidor. */
export function horaLocal(data: Date = new Date(), timeZone: string = FUSO_OPERACAO): number {
  const parte = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  })
    .formatToParts(data)
    .find((p) => p.type === "hour");
  return Number(parte?.value ?? 0) % 24;
}

/** 05:00–11:59 bom dia · 12:00–17:59 boa tarde · 18:00–04:59 boa noite. */
export function saudacaoPorHorario(data: Date = new Date(), timeZone: string = FUSO_OPERACAO) {
  const h = horaLocal(data, timeZone);
  if (h >= 5 && h < 12) return "Bom dia! Tudo bem?";
  if (h >= 12 && h < 18) return "Boa tarde! Tudo bem?";
  return "Boa noite! Tudo bem?";
}

export type PecaConsulta = {
  peca: string;
  marca?: string;
  modelo: string;
  qualidade?: string;
};

/** "Samsung A54", mas "iPhone 13" (não "Apple iPhone 13") e sem repetir a marca. */
export function nomeAparelho(marca: string | undefined, modelo: string): string {
  const m = (marca ?? "").trim();
  const mod = modelo.trim();
  if (!m) return mod;
  if (!mod) return m;
  if (mod.toLowerCase().includes(m.toLowerCase())) return mod;
  if (/^apple$/i.test(m) && /^i(phone|pad|watch)|^macbook|^airpods/i.test(mod)) return mod;
  return `${m} ${mod}`;
}

export function montarMensagemConsulta(p: PecaConsulta, data: Date = new Date()): string {
  const peca = [p.peca.trim(), (p.qualidade ?? "").trim()].filter(Boolean).join(" ");
  const aparelho = nomeAparelho(p.marca, p.modelo);
  return `${saudacaoPorHorario(data)}\n\nTem ${peca} para ${aparelho} disponível? Qual o valor?`;
}

export type FornecedorContato = {
  whatsapp?: string | null;
  telefone?: string | null;
};

export type NumeroFornecedor =
  | { ok: true; numero: string; origem: "whatsapp" | "telefone" }
  | { ok: false; motivo: "ausente" | "invalido" };

/** Tira o 55 de quem foi cadastrado já com DDI. */
function nacional(valor: string): string {
  const d = valor.replace(/\D/g, "");
  return d.startsWith("55") && (d.length === 12 || d.length === 13) ? d.slice(2) : d;
}

/**
 * Número para abrir a conversa. Usa o campo WhatsApp do cadastro; se ele
 * estiver vazio, aceita o campo Telefone só quando for um celular válido
 * (fixo não tem WhatsApp na maioria dos casos). Nunca completa ou inventa
 * dígitos: número fora do padrão brasileiro é "inválido".
 */
export function numeroWhatsappFornecedor(f: FornecedorContato): NumeroFornecedor {
  const wpp = (f.whatsapp ?? "").trim();
  if (wpp) {
    const n = nacional(wpp);
    return isValidPhoneBR(n)
      ? { ok: true, numero: n, origem: "whatsapp" }
      : { ok: false, motivo: "invalido" };
  }
  const tel = nacional((f.telefone ?? "").trim());
  if (tel.length === 11 && isValidPhoneBR(tel)) {
    return { ok: true, numero: tel, origem: "telefone" };
  }
  return { ok: false, motivo: tel ? "invalido" : "ausente" };
}

export function linkConsultaWhatsapp(numeroNacional: string, mensagem: string): string {
  return buildWaMeLink(numeroNacional, mensagem);
}

// "enviada" só quando o WhatsApp da empresa aceitou a mensagem; pelo wa.me
// a consulta fica em "conversa_aberta" (o envio é confirmado lá, à mão).
export type StatusConsulta = "preparada" | "conversa_aberta" | "enviada" | "falhou" | "respondida";

export const STATUS_CONSULTA_LABEL: Record<StatusConsulta, string> = {
  preparada: "Preparada",
  conversa_aberta: "Conversa aberta",
  enviada: "Enviada",
  falhou: "Falhou",
  respondida: "Resposta recebida",
};
