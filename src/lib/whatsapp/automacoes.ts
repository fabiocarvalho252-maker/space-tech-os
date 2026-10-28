// Automações do WhatsApp e pedido de PARAR. Sem imports com "@/": roda
// direto no `node --test` e pode ser usado no navegador e no servidor.

/** Mesmas chaves de whatsapp_automacao_chave (migration 20261026200000). */
export const AUTOMACOES = [
  { chave: "os_pronta", config: "notif_os_pronta", label: "Aviso de OS pronta" },
  { chave: "pesquisa_auto", config: "notif_pesquisa_auto", label: "Pesquisa pós-OS" },
  { chave: "pos_venda", config: "notif_pesquisa_venda_auto", label: "Pesquisa pós-venda" },
  { chave: "boas_vindas", config: "notif_boas_vindas_auto", label: "Boas-vindas" },
  { chave: "aniversario", config: "notif_aniversario_auto", label: "Aniversário" },
  {
    chave: "agradecimento",
    config: "ia_agradecer_pesquisa",
    label: "IA: agradecimento da pesquisa",
  },
  {
    chave: "cobranca_lembrete",
    config: "notif_cobranca_lembrete_auto",
    label: "Lembrete de cobrança Pix",
  },
  { chave: "cobranca_paga", config: "notif_cobranca_paga_auto", label: "Pagamento confirmado" },
  {
    chave: "cobranca_atraso",
    config: "notif_cobranca_atraso_auto",
    label: "Aviso de cobrança atrasada",
  },
] as const;

export type ChaveAutomacao = (typeof AUTOMACOES)[number]["chave"];

/** Chave da automação de um template_id (null = mensagem manual). */
export function chaveAutomacao(templateId: string | null | undefined): ChaveAutomacao | null {
  const t = templateId ?? "";
  if (t === "os_pronta") return "os_pronta";
  if (t === "pesquisa_auto") return "pesquisa_auto";
  if (t.startsWith("pos_venda_")) return "pos_venda";
  if (t.startsWith("boas_vindas_")) return "boas_vindas";
  if (t.startsWith("aniversario_")) return "aniversario";
  if (t.startsWith("agradecimento_")) return "agradecimento";
  if (t.startsWith("cobranca_lembrete_") || t.startsWith("cobranca_pix_"))
    return "cobranca_lembrete";
  if (t.startsWith("cobranca_paga_")) return "cobranca_paga";
  if (t.startsWith("cobranca_atraso_") || t.startsWith("cobranca_atrasopix_"))
    return "cobranca_atraso";
  return null;
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Só a mensagem inteira conta — "quero cancelar o conserto" ou "não para de
// travar" não podem tirar ninguém das mensagens.
const PEDIDOS_PARAR = new Set([
  "parar",
  "pare",
  "sair",
  "stop",
  "descadastrar",
  "nao quero receber",
  "nao quero mais receber",
  "parar mensagens",
  "parar de enviar",
]);
const PEDIDOS_VOLTAR = new Set(["voltar", "receber", "quero receber", "voltar a receber"]);

export function pedidoDeParar(texto: string | null | undefined): boolean {
  return PEDIDOS_PARAR.has(normalizar(texto ?? ""));
}

export function pedidoDeVoltar(texto: string | null | undefined): boolean {
  return PEDIDOS_VOLTAR.has(normalizar(texto ?? ""));
}

export const RESPOSTA_PARAR =
  "Pronto! Você não vai mais receber mensagens automáticas da loja. Se mudar de ideia, é só responder VOLTAR. Para falar com a gente, continue mandando mensagem normalmente.";

export const RESPOSTA_VOLTAR = "Combinado! Você voltou a receber nossos avisos automáticos. 😊";
