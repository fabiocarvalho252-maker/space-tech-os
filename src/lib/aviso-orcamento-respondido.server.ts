// Aviso à loja no WhatsApp quando o cliente aprova ou recusa o orçamento
// (pelo link da OS ou pela Área do Cliente). Sai pela conexão de WhatsApp da
// própria loja para o "número do dono" de Configurações > WhatsApp (o mesmo
// do resumo semanal; sem ele, o WhatsApp do cadastro da loja).
//
// A página /consulta/:id pede o aviso logo depois da resposta e a
// conferência do cron da fila (a cada minuto) manda o que não saiu — página
// fechada, WhatsApp desconectado, envio que falhou. O índice
// whatsapp_messages_aviso_orcamento_key garante um aviso por resposta.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { brl } from "@/lib/format";
import { paraE164BR } from "@/lib/whatsapp/telefone";
import { enviarAutomatico, obterConexao } from "@/lib/whatsapp/whatsapp-service";

/** Respostas mais antigas que isso não são mais avisadas. */
const JANELA_CONFERENCIA_MS = 24 * 60 * 60 * 1000;
/** Envio que falhou só é tentado de novo depois disso. */
const ESPERA_NOVA_TENTATIVA_MS = 10 * 60 * 1000;

type Resposta = { id: string; user_id: string; os_id: string; descricao: string };

function templateAvisoOrcamento(historicoId: string) {
  return `aviso_orcamento_${historicoId}`;
}

async function enviarAviso(resposta: Resposta): Promise<void> {
  const [{ data: os }, { data: config }, { data: perfil }] = await Promise.all([
    supabaseAdmin
      .from("ordens_servico")
      .select("numero, status, aparelho, marca, modelo, valor, clientes(nome)")
      .eq("id", resposta.os_id)
      .maybeSingle(),
    supabaseAdmin
      .from("whatsapp_config")
      .select("relatorio_numero")
      .eq("user_id", resposta.user_id)
      .maybeSingle(),
    supabaseAdmin.from("profiles").select("whatsapp").eq("id", resposta.user_id).maybeSingle(),
  ]);
  if (!os) return;
  const telefone = (config?.relatorio_numero || perfil?.whatsapp || "").replace(/\D/g, "");
  if (telefone.length < 10) return;

  const conexao = await obterConexao(resposta.user_id);
  if (!conexao || conexao.status !== "conectado") return;

  const aprovou = /aprovou/i.test(resposta.descricao);
  const aparelho = [os.marca, os.modelo].filter(Boolean).join(" ").trim() || os.aparelho || "-";
  const cliente = (os.clientes as { nome?: string | null } | null)?.nome || "Cliente";
  const site = import.meta.env["VITE_SITE_URL"] ?? "";

  await enviarAutomatico({
    empresaId: resposta.user_id,
    conexao,
    numeroCompleto: paraE164BR(telefone),
    nome: null,
    osId: resposta.os_id,
    templateId: templateAvisoOrcamento(resposta.id),
    mensagem: [
      aprovou
        ? `✅ *Orçamento APROVADO* — OS nº ${os.numero}`
        : `❌ *Orçamento RECUSADO* — OS nº ${os.numero}`,
      `Cliente: ${cliente}`,
      `Aparelho: ${aparelho}`,
      `Valor: ${brl(Number(os.valor))}`,
      "",
      aprovou ? "Pode dar andamento ao serviço." : "O cliente não aprovou o orçamento.",
      ...(site ? ["", `Abrir as OS: ${site}/ordens`] : []),
    ].join("\n"),
  });
}

/**
 * Manda o aviso das respostas de orçamento das últimas 24 h que ainda não
 * foram avisadas (ou cujo aviso falhou há mais de 10 min). Com `osId`, só
 * as daquela OS — é o que a página do cliente chama. Não lança.
 */
export async function conferirAvisosDeOrcamento(osId?: string): Promise<number> {
  try {
    const agora = Date.now();
    let consulta = supabaseAdmin
      .from("os_historico")
      .select("id, user_id, os_id, descricao")
      .eq("evento", "aprovacao_cliente")
      .gte("created_at", new Date(agora - JANELA_CONFERENCIA_MS).toISOString());
    if (osId) consulta = consulta.eq("os_id", osId);
    const { data: respostas, error } = await consulta;
    if (error) throw error;
    if (!respostas?.length) return 0;

    const { data: avisos } = await supabaseAdmin
      .from("whatsapp_messages")
      .select("id, template_id, status, created_at")
      .in(
        "template_id",
        respostas.map((r) => templateAvisoOrcamento(r.id)),
      );

    let enviados = 0;
    for (const resposta of respostas) {
      const aviso = avisos?.find((a) => a.template_id === templateAvisoOrcamento(resposta.id));
      if (aviso) {
        const falhouHaTempo =
          aviso.status === "falhou" &&
          agora - new Date(aviso.created_at).getTime() > ESPERA_NOVA_TENTATIVA_MS;
        if (!falhouHaTempo) continue;
        await supabaseAdmin.from("whatsapp_messages").delete().eq("id", aviso.id);
      }
      await enviarAviso(resposta);
      enviados++;
    }
    return enviados;
  } catch (erro) {
    console.error("[Aviso orçamento] Conferência de respostas de orçamento:", erro);
    return 0;
  }
}
