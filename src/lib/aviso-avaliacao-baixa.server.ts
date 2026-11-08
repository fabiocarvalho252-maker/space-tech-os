// Alerta imediato à loja no WhatsApp quando chega uma avaliação de 1 ou 2
// estrelas (OS pela Área do Cliente ou venda pela página de avaliação). Sai
// pela conexão de WhatsApp da própria loja para o "número do dono" de
// Configurações > WhatsApp (o mesmo do resumo semanal; sem ele, o WhatsApp do
// cadastro da loja) — mesmo caminho do aviso de orçamento respondido.
//
// A página pede o aviso logo depois do envio e a conferência do cron da fila
// (a cada minuto) manda o que não saiu. O índice
// whatsapp_messages_aviso_avaliacao_key garante um aviso por avaliação.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { paraE164BR } from "@/lib/whatsapp/telefone";
import { enviarAutomatico, obterConexao } from "@/lib/whatsapp/whatsapp-service";

/** Avaliações mais antigas que isso não são mais avisadas. */
const JANELA_CONFERENCIA_MS = 24 * 60 * 60 * 1000;
/** Envio que falhou só é tentado de novo depois disso. */
const ESPERA_NOVA_TENTATIVA_MS = 10 * 60 * 1000;
const NOTA_BAIXA = 2;

type Baixa = {
  id: string;
  user_id: string;
  nota: number;
  comentario: string | null;
  tipo: "os" | "venda";
  osId: string | null;
  numero: number | null;
  cliente: string | null;
};

function templateAviso(avaliacaoId: string) {
  return `aviso_avaliacao_${avaliacaoId}`;
}

async function enviarAviso(av: Baixa): Promise<void> {
  const [{ data: config }, { data: perfil }] = await Promise.all([
    supabaseAdmin
      .from("whatsapp_config")
      .select("relatorio_numero")
      .eq("user_id", av.user_id)
      .maybeSingle(),
    supabaseAdmin.from("profiles").select("whatsapp").eq("id", av.user_id).maybeSingle(),
  ]);
  const telefone = (config?.relatorio_numero || perfil?.whatsapp || "").replace(/\D/g, "");
  if (telefone.length < 10) return;

  const conexao = await obterConexao(av.user_id);
  if (!conexao || conexao.status !== "conectado") return;

  const site = import.meta.env["VITE_SITE_URL"] ?? "";
  const estrelas = "★".repeat(av.nota) + "☆".repeat(5 - av.nota);
  const onde = av.tipo === "os" ? `OS nº ${av.numero ?? "?"}` : `Venda nº ${av.numero ?? "?"}`;

  await enviarAutomatico({
    empresaId: av.user_id,
    conexao,
    numeroCompleto: paraE164BR(telefone),
    nome: null,
    osId: av.osId,
    templateId: templateAviso(av.id),
    mensagem: [
      `⚠️ *Avaliação baixa* — ${onde}`,
      `Cliente: ${av.cliente || "Cliente"}`,
      `Nota: ${estrelas} (${av.nota}/5)`,
      av.comentario ? `Comentário: "${av.comentario}"` : "Sem comentário.",
      "",
      "Vale falar com o cliente o quanto antes.",
      ...(site ? ["", `Ver avaliações: ${site}/relatorios#avaliacoes`] : []),
    ].join("\n"),
  });
}

/**
 * Manda o alerta das avaliações baixas das últimas 24 h que ainda não foram
 * avisadas (ou cujo aviso falhou há mais de 10 min). Com `filtro`, só a de
 * uma OS ou venda — é o que a página do cliente chama. Não lança.
 */
export async function conferirAvisosDeAvaliacaoBaixa(filtro?: {
  tipo: "os" | "venda";
  id: string;
}): Promise<number> {
  try {
    const agora = Date.now();
    const desde = new Date(agora - JANELA_CONFERENCIA_MS).toISOString();
    const baixas: Baixa[] = [];

    if (!filtro || filtro.tipo === "os") {
      let q = supabaseAdmin
        .from("os_avaliacoes")
        .select("id, user_id, nota, comentario, os_id, ordens_servico(numero, clientes(nome))")
        .lte("nota", NOTA_BAIXA)
        .gte("created_at", desde);
      if (filtro) q = q.eq("os_id", filtro.id);
      const { data, error } = await q;
      if (error) throw error;
      for (const a of data ?? []) {
        const os = a.ordens_servico as unknown as {
          numero: number;
          clientes: { nome: string | null } | null;
        } | null;
        baixas.push({
          id: a.id,
          user_id: a.user_id,
          nota: a.nota,
          comentario: a.comentario,
          tipo: "os",
          osId: a.os_id,
          numero: os?.numero ?? null,
          cliente: os?.clientes?.nome ?? null,
        });
      }
    }
    if (!filtro || filtro.tipo === "venda") {
      let q = supabaseAdmin
        .from("venda_avaliacoes")
        .select("id, user_id, nota, comentario, venda_id, vendas(numero, clientes(nome))")
        .lte("nota", NOTA_BAIXA)
        .gte("created_at", desde);
      if (filtro) q = q.eq("venda_id", filtro.id);
      const { data, error } = await q;
      if (error) throw error;
      for (const a of data ?? []) {
        const v = a.vendas as unknown as {
          numero: number | null;
          clientes: { nome: string | null } | null;
        } | null;
        baixas.push({
          id: a.id,
          user_id: a.user_id,
          nota: a.nota,
          comentario: a.comentario,
          tipo: "venda",
          osId: null,
          numero: v?.numero ?? null,
          cliente: v?.clientes?.nome ?? null,
        });
      }
    }
    if (!baixas.length) return 0;

    const { data: avisos } = await supabaseAdmin
      .from("whatsapp_messages")
      .select("id, template_id, status, created_at")
      .in(
        "template_id",
        baixas.map((b) => templateAviso(b.id)),
      );

    let enviados = 0;
    for (const av of baixas) {
      const aviso = avisos?.find((a) => a.template_id === templateAviso(av.id));
      if (aviso) {
        const falhouHaTempo =
          aviso.status === "falhou" &&
          agora - new Date(aviso.created_at).getTime() > ESPERA_NOVA_TENTATIVA_MS;
        if (!falhouHaTempo) continue;
        await supabaseAdmin.from("whatsapp_messages").delete().eq("id", aviso.id);
      }
      await enviarAviso(av);
      enviados++;
    }
    return enviados;
  } catch (erro) {
    console.error("[Aviso avaliação] Conferência de avaliações baixas:", erro);
    return 0;
  }
}
