// Automações de cobrança Pix pelo WhatsApp (Configurações → WhatsApp,
// desligadas por padrão). Server-only, rodam em rodarAutomacoes (worker a
// cada 10 min):
//   - lembrete: cobrança pendente que vence nas próximas 24 h → texto + Pix
//     copia e cola em outra mensagem (fica mais fácil de copiar);
//   - pagamento confirmado: cobrança que o Mercado Pago confirmou como paga.
// Tudo entra na fila (horário, intervalo, limite por hora) com um template
// por cobrança — o índice único impede repetir. Na hora de sair, a fila
// confere de novo a situação real da cobrança (impedimentoCobranca), então
// nunca vai lembrete de algo já pago nem "recebemos" sem pagamento de fato.
// Cobranças de parcelas do Crediário ficam de fora: ele tem avisos próprios.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { brl } from "@/lib/format";
import { paraE164BR } from "./telefone";
import { enviarAutomatico, obterConexao } from "./whatsapp-service";
import type { WhatsappMensagem } from "./types";

const HORA_INICIO = 9;
const HORA_FIM = 20;
const LEMBRETE_ANTES_H = 24;
const CONFIRMACAO_ATE_H = 72;

function horaDeBrasilia(): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "America/Sao_Paulo",
    }).format(new Date()),
  );
}

/** "hoje às 18:00", "amanhã às 09:30" ou "05/11 às 14:00", no horário de Brasília. */
export function quandoVence(iso: string, agora = new Date()): string {
  const fuso = { timeZone: "America/Sao_Paulo" } as const;
  const dia = (d: Date) => new Intl.DateTimeFormat("en-CA", fuso).format(d);
  const d = new Date(iso);
  const hora = new Intl.DateTimeFormat("pt-BR", {
    ...fuso,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  if (dia(d) === dia(agora)) return `hoje às ${hora}`;
  if (dia(d) === dia(new Date(agora.getTime() + 86400_000))) return `amanhã às ${hora}`;
  const data = new Intl.DateTimeFormat("pt-BR", {
    ...fuso,
    day: "2-digit",
    month: "2-digit",
  }).format(d);
  return `${data} às ${hora}`;
}

function preencher(texto: string, v: Record<string, string>): string {
  return texto
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => v[k] ?? "")
    .replace(/Olá\s+!/g, "Olá!");
}

type CobrancaComCliente = {
  id: string;
  valor: number;
  expires_at: string | null;
  qr_code_copy_paste: string | null;
  clientes: { nome: string | null; telefone: string | null } | null;
};

export async function enviarAutomacoesCobranca(empresaId: string): Promise<number> {
  const { data: config } = await supabaseAdmin
    .from("whatsapp_config")
    .select(
      "notif_cobranca_lembrete_auto, cobranca_lembrete_texto, notif_cobranca_paga_auto, cobranca_paga_texto, notif_cobranca_desde",
    )
    .eq("user_id", empresaId)
    .maybeSingle();
  if (!config || !(config.notif_cobranca_lembrete_auto || config.notif_cobranca_paga_auto))
    return 0;
  if (!config.notif_cobranca_desde) return 0;
  const hora = horaDeBrasilia();
  if (hora < HORA_INICIO || hora >= HORA_FIM) return 0;

  const conexao = await obterConexao(empresaId);
  if (!conexao || conexao.status !== "conectado") return 0;

  const { data: perfil } = await supabaseAdmin
    .from("profiles")
    .select("loja, nome")
    .eq("id", empresaId)
    .maybeSingle();
  const loja = (perfil?.loja || perfil?.nome || "nossa loja").trim();
  const agora = new Date();
  let enfileiradas = 0;

  const enviar = async (c: CobrancaComCliente, templateId: string, mensagem: string) => {
    const telefone = (c.clientes?.telefone ?? "").replace(/\D/g, "");
    if (telefone.length < 10) return "sem_telefone" as const;
    const r = await enviarAutomatico({
      empresaId,
      conexao,
      numeroCompleto: paraE164BR(telefone),
      nome: c.clientes?.nome ?? null,
      mensagem,
      templateId,
      fila: true,
    });
    if (r === "enfileirada") enfileiradas++;
    return r;
  };
  const primeiroNome = (c: CobrancaComCliente) =>
    (c.clientes?.nome ?? "").trim().split(/\s+/)[0] ?? "";

  if (config.notif_cobranca_lembrete_auto) {
    const { data } = await supabaseAdmin
      .from("cobrancas")
      .select("id, valor, expires_at, qr_code_copy_paste, clientes(nome, telefone)")
      .eq("user_id", empresaId)
      .eq("status", "pendente")
      .is("crediario_parcela_id", null)
      .not("cliente_id", "is", null)
      .gte("created_at", config.notif_cobranca_desde)
      // Não lembra de algo que acabou de ser emitido (o cliente já recebeu).
      .lte("created_at", new Date(agora.getTime() - 3600_000).toISOString())
      .gt("expires_at", agora.toISOString())
      .lte("expires_at", new Date(agora.getTime() + LEMBRETE_ANTES_H * 3600_000).toISOString())
      .limit(50);
    for (const c of (data ?? []) as unknown as CobrancaComCliente[]) {
      const texto = preencher(config.cobranca_lembrete_texto, {
        cliente: primeiroNome(c),
        valor: brl(c.valor),
        vencimento: c.expires_at ? quandoVence(c.expires_at, agora) : "em breve",
        loja,
      });
      const r = await enviar(c, `cobranca_lembrete_${c.id}`, texto);
      if (r === "enfileirada" && c.qr_code_copy_paste) {
        await enviar(c, `cobranca_pix_${c.id}`, c.qr_code_copy_paste);
      }
    }
  }

  if (config.notif_cobranca_paga_auto) {
    const desde = new Date(
      Math.max(
        new Date(config.notif_cobranca_desde).getTime(),
        agora.getTime() - CONFIRMACAO_ATE_H * 3600_000,
      ),
    ).toISOString();
    const { data } = await supabaseAdmin
      .from("cobrancas")
      .select("id, valor, expires_at, qr_code_copy_paste, clientes(nome, telefone)")
      .eq("user_id", empresaId)
      .eq("status", "paga")
      .is("crediario_parcela_id", null)
      .not("cliente_id", "is", null)
      .gte("updated_at", desde)
      .limit(50);
    for (const c of (data ?? []) as unknown as CobrancaComCliente[]) {
      const texto = preencher(config.cobranca_paga_texto, {
        cliente: primeiroNome(c),
        valor: brl(c.valor),
        loja,
      });
      await enviar(c, `cobranca_paga_${c.id}`, texto);
    }
  }
  return enfileiradas;
}

/**
 * Situação real da cobrança na hora de a mensagem sair da fila. Devolve o
 * motivo para não enviar, ou null (pode enviar / não é mensagem de cobrança).
 */
export async function impedimentoCobranca(msg: WhatsappMensagem): Promise<string | null> {
  const m = /^cobranca_(lembrete|pix|paga)_(.+)$/.exec(msg.template_id ?? "");
  if (!m) return null;
  const { data: c } = await supabaseAdmin
    .from("cobrancas")
    .select("status, expires_at")
    .eq("user_id", msg.user_id)
    .eq("id", m[2]!)
    .maybeSingle();
  if (!c) return "A cobrança não existe mais.";
  if (m[1] === "paga") {
    return c.status === "paga" ? null : "O pagamento não está confirmado no sistema.";
  }
  if (c.status !== "pendente") return `A cobrança está ${c.status} — lembrete não enviado.`;
  if (c.expires_at && new Date(c.expires_at) <= new Date())
    return "O Pix já venceu — lembrete não enviado.";
  return null;
}
