// Shared helpers for the WhatsApp modals (reconexão + envio de notificação).
// There is no real WhatsApp session/QR backend in this project yet — see
// WhatsAppConnectModal — so these helpers only cover what's genuinely usable
// today: formatting/validating a BR phone number, building a wa.me link (the
// same mechanism ordens.tsx already used before the modals existed), and
// substituting {variavel}/{{variavel}} placeholders in message templates.

export function digitsOnlyBR(value: string): string {
  return (value ?? "").replace(/\D/g, "");
}

// Progressive (00) 00000-0000 mask. Numbers up to 10 digits are treated as
// landline (4-digit local part); the 11th digit — always "9" on real BR
// mobile numbers — switches the split to the 5-digit mobile local part.
export function maskPhoneBR(value: string): string {
  const digits = digitsOnlyBR(value).slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  const localLen = digits.length > 10 ? 5 : 4;
  const parte1 = rest.slice(0, localLen);
  const parte2 = rest.slice(localLen);
  return parte2 ? `(${ddd}) ${parte1}-${parte2}` : `(${ddd}) ${parte1}`;
}

export function isValidPhoneBR(value: string): boolean {
  const digits = digitsOnlyBR(value);
  if (digits.length !== 10 && digits.length !== 11) return false;
  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  if (digits.length === 11 && digits[2] !== "9") return false;
  return true;
}

// Same convention ordens.tsx already used: assumes Brazil, prefixes "55".
export function buildWaMeLink(phone: string, message: string): string {
  const digits = digitsOnlyBR(phone);
  const comPais = digits.startsWith("55") && digits.length > 11 ? digits : `55${digits}`;
  return `https://wa.me/${comPais}?text=${encodeURIComponent(message)}`;
}

export type VariaveisWhatsApp = Partial<{
  cliente: string;
  os: string;
  numero: string;
  numero_os: string;
  valor: string;
  empresa: string;
  nome_loja: string;
  data: string;
  telefone: string;
  status: string;
  tecnico: string;
  aparelho: string;
  modelo: string;
  servico: string;
  garantia: string;
}>;

// Supports both the {variavel} syntax from the spec and the {{variavel}}
// syntax already used by whatsapp_config's saved templates, so either can be
// used as a "mensagem rápida" source. Placeholders with no matching value
// are left untouched so possuiVariaveisNaoPreenchidas() can catch them.
export function preencherVariaveisWhatsApp(template: string, vars: VariaveisWhatsApp): string {
  return (template ?? "").replace(/\{\{(\w+)\}\}|\{(\w+)\}/g, (match, dupla, simples) => {
    const chave = (dupla ?? simples) as keyof VariaveisWhatsApp;
    const valor = vars[chave];
    return valor !== undefined && valor !== "" ? valor : match;
  });
}

export function possuiVariaveisNaoPreenchidas(texto: string): boolean {
  return /\{\{?\w+\}?\}/.test(texto);
}

export class WhatsAppNaoConfiguradoError extends Error {
  constructor() {
    super(
      "Integração com um provedor de WhatsApp (Evolution API, Baileys, WPPConnect, Z-API, Twilio etc.) ainda não foi configurada para este projeto.",
    );
    this.name = "WhatsAppNaoConfiguradoError";
  }
}

// Placeholder for the real WhatsApp session/QR provider. No provider is
// wired up yet — see the research that went into WhatsAppConnectModal — so
// this always rejects, letting the modal show an honest "não configurado"
// state instead of a fake QR code. Swap the body for a real call (e.g. a
// Supabase Edge Function that talks to a self-hosted Evolution API/Baileys
// instance) once a provider is chosen; the modal itself won't need to change.
export async function solicitarQrCodeWhatsApp(): Promise<{ qr: string }> {
  throw new WhatsAppNaoConfiguradoError();
}

export type WhatsAppMessageTemplate = {
  id: string;
  name: string;
  message: string;
  /** true para os templates padrão do sistema — chips editados/adicionados pelo usuário ficam false */
  builtin?: boolean;
};

export type WhatsAppAttachmentKind = "os" | "orcamento";
export type WhatsAppAttachment = {
  tipo: WhatsAppAttachmentKind;
  nome: string;
  status: "pendente" | "enviado" | "falhou";
};

export type WhatsAppSchedule = { tipo: "agora" } | { tipo: "fila"; data: string; hora: string };

export type WhatsAppNotification = {
  osId: string;
  telefone: string;
  mensagem: string;
  templateId: string | null;
  anexos: { os: boolean; orcamento: boolean };
  agendamento: WhatsAppSchedule;
};

/** @deprecated use WhatsAppMessageTemplate — kept only so old imports don't break mid-refactor. */
export type MensagemRapida = WhatsAppMessageTemplate;

// The 8 base templates from the spec, defined as data (not hardcoded JSX in
// the modal) so "+ Nova mensagem" can append to this same shape and "Editar"
// can point at real persisted overrides — see buildMensagensRapidas, which
// merges whatsapp_config's saved texts (Configurações → WhatsApp) on top of
// these defaults for the 3 templates that already have a dedicated column
// there.
export const messageTemplates: WhatsAppMessageTemplate[] = [
  {
    id: "padrao",
    name: "Padrão",
    builtin: true,
    message: "Olá {cliente}! Sua OS nº {numero_os} está com status: {status}. Total: {valor}.",
  },
  {
    id: "nova_os",
    name: "Nova OS",
    builtin: true,
    message: "Olá {cliente}, sua OS nº {numero_os} foi aberta com sucesso!",
  },
  {
    id: "os_atualizada",
    name: "OS atualizada",
    builtin: true,
    message: "Olá {cliente}, sua OS nº {numero_os} foi atualizada para o status: {status}.",
  },
  {
    id: "pos_atendimento",
    name: "Pós-atendimento",
    builtin: true,
    message: "Olá {cliente}, como foi sua experiência com a OS nº {numero_os}?",
  },
  {
    id: "pronto_retirar",
    name: "Pronto p/ retirar",
    builtin: true,
    message:
      "Olá {cliente}! Sua OS nº {numero_os} está pronta para retirada. Valor: {valor}. Aguardamos você!",
  },
  {
    id: "aguardando_peca",
    name: "Aguardando peça",
    builtin: true,
    message:
      "Olá {cliente}, sua OS nº {numero_os} está aguardando a chegada de uma peça. Assim que chegar, avisamos você.",
  },
  {
    id: "em_analise",
    name: "Em análise",
    builtin: true,
    message:
      "Olá {cliente}, seu aparelho da OS nº {numero_os} está em análise técnica. Em breve traremos novidades.",
  },
  {
    id: "orcamento",
    name: "Orçamento / valor",
    builtin: true,
    message:
      "Olá {cliente}! O orçamento da OS nº {numero_os} ficou em {valor}. Podemos prosseguir?",
  },
];

// Builds the "sugestões de mensagem" chip bank from messageTemplates,
// overriding with whatsapp_config's saved texts where a dedicated column
// exists (edited from Configurações → WhatsApp, linked from this modal's
// "Editar" button). Templates without a saved column keep their built-in
// default — there's no free-form template CRUD backend yet, so "+ Nova
// mensagem" additions only persist for the current modal session.
export function buildMensagensRapidas(
  whatsappConfig: Record<string, unknown> | null | undefined,
): WhatsAppMessageTemplate[] {
  const texto = (chave: string) => {
    const v = whatsappConfig?.[chave];
    return typeof v === "string" && v.trim() ? v : null;
  };
  const overrides: Record<string, string | null> = {
    nova_os: texto("notif_os_criada_texto"),
    os_atualizada: texto("notif_os_editada_texto"),
    pos_atendimento: texto("pesquisa_pos_os_texto"),
  };
  return messageTemplates.map((t) =>
    overrides[t.id] ? { ...t, message: overrides[t.id] as string } : t,
  );
}
