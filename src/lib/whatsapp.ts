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
  valor: string;
  empresa: string;
  data: string;
  telefone: string;
  status: string;
  tecnico: string;
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

export type MensagemRapida = {
  id: string;
  label: string;
  texto: string;
  /** true para as geradas por padrão neste modal — chips editados/adicionados pelo usuário ficam false */
  builtin?: boolean;
};

// Builds the "mensagens rápidas" chip bank from the message templates that
// genuinely exist (whatsapp_config's saved texts) plus a handful of sensible
// status-based defaults. Nothing here is persisted beyond this component's
// state — there's no backend for arbitrary custom templates yet (see
// WhatsAppSendModal's "Editar"/"+ Nova mensagem" — those edits are
// session-only, matching the config table's fixed set of columns).
export function buildMensagensRapidas(whatsappConfig: Record<string, unknown> | null | undefined): MensagemRapida[] {
  const texto = (chave: string) => {
    const v = whatsappConfig?.[chave];
    return typeof v === "string" && v.trim() ? v : null;
  };
  const lista: MensagemRapida[] = [
    {
      id: "padrao",
      label: "Padrão",
      builtin: true,
      texto: "Olá {cliente}! Sua OS nº {os} está com status: {status}. Total: {valor}.",
    },
  ];
  lista.push({
    id: "nova_os",
    label: "Nova OS",
    builtin: true,
    texto: texto("notif_os_criada_texto") ?? "Olá {cliente}, sua OS nº {os} foi aberta com sucesso!",
  });
  lista.push({
    id: "os_atualizada",
    label: "OS atualizada",
    builtin: true,
    texto:
      texto("notif_os_editada_texto") ??
      "Olá {cliente}, sua OS nº {os} foi atualizada para o status: {status}.",
  });
  lista.push({
    id: "pos_atendimento",
    label: "Pós-atendimento",
    builtin: true,
    texto: texto("pesquisa_pos_os_texto") ?? "Olá {cliente}, como foi sua experiência com a OS nº {os}?",
  });
  lista.push({
    id: "pronto_retirar",
    label: "Pronto p/ retirar",
    builtin: true,
    texto: "Olá {cliente}! Sua OS nº {os} está pronta para retirada. Valor: {valor}. Aguardamos você!",
  });
  lista.push({
    id: "aguardando_peca",
    label: "Aguardando peça",
    builtin: true,
    texto:
      "Olá {cliente}, sua OS nº {os} está aguardando a chegada de uma peça. Assim que chegar, avisamos você.",
  });
  lista.push({
    id: "em_analise",
    label: "Em análise",
    builtin: true,
    texto: "Olá {cliente}, seu aparelho da OS nº {os} está em análise técnica. Em breve traremos novidades.",
  });
  lista.push({
    id: "orcamento",
    label: "Orçamento / valor",
    builtin: true,
    texto: "Olá {cliente}! O orçamento da OS nº {os} ficou em {valor}. Podemos prosseguir?",
  });
  return lista;
}
