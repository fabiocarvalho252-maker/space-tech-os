// Limpeza de contas inativas — roda uma vez por dia (POST
// /api/contas-inativas/cron, chamado pelo cron do servidor em
// /etc/cron.d/space-tech-contas-inativas).
//
// 1. 2 meses depois do fim do acesso (teste grátis ou plano mensal/anual
//    vencido), o dono da empresa recebe no WhatsApp a pergunta se vai voltar
//    a usar, com o aviso de que a conta será apagada em 30 dias.
// 2. 30 dias depois desse aviso, se a empresa continua sem plano, a conta é
//    apagada — mesmo efeito do "Excluir" do /admin (excluirEmpresa): apagar o
//    usuário dono leva junto todos os dados da empresa. Não tem volta.
//
// Nunca apaga sem aviso enviado com sucesso depois do vencimento atual: sem
// WhatsApp cadastrado ou com o envio falhando, a conta fica como está.
// Ficam de fora: vitalício, suspenso (decisão manual do /admin), quem pediu
// plano e aguarda aprovação, funcionários de outra empresa e a conta do
// operador do site.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { prazoAcesso } from "@/lib/acesso";
import { SITE_ADMIN_EMAIL } from "@/lib/site-admin";
import { avisarDonoDaPlataforma, enviarDaPlataforma } from "@/lib/whatsapp/whatsapp-service";

const DIA_MS = 86_400_000;
export const DIAS_ATE_AVISO = 60;
export const DIAS_AVISO_ATE_EXCLUSAO = 30;
/** Por quanto tempo a auditoria (audit_log) fica guardada. */
export const AUDITORIA_DIAS = 365;

type Empresa = { id: string; nome: string };

export type ResultadoContasInativas = {
  simulacao: boolean;
  avisadas: Empresa[];
  avisoFalhou: (Empresa & { motivo: string })[];
  excluidas: Empresa[];
  exclusaoFalhou: (Empresa & { motivo: string })[];
};

function dataBR(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Bahia" });
}

function mensagemAviso(nome: string | null, loja: string, apagarEm: Date): string {
  const site = process.env["VITE_SITE_URL"] ?? "https://srmpretech.online";
  return [
    `Olá${nome ? `, ${nome.split(" ")[0]}` : ""}! 👋 Aqui é da *SPACE TECH*.`,
    "",
    `Faz 2 meses que o acesso da *${loja}* ao sistema SPACE TECH OS terminou e sentimos sua falta. Você pretende voltar a usar o sistema? 🙂`,
    "",
    `Para reativar é só entrar e escolher um plano: ${site}/assinatura`,
    "",
    `⚠️ Se não houver assinatura até *${dataBR(apagarEm)}*, a conta da ${loja} e todos os dados (ordens de serviço, clientes, vendas, estoque e financeiro) serão apagados do sistema.`,
  ].join("\n");
}

export async function processarContasInativas(
  opcoes: { simular?: boolean } = {},
): Promise<ResultadoContasInativas> {
  const simular = opcoes.simular ?? false;
  const agora = new Date();
  const resultado: ResultadoContasInativas = {
    simulacao: simular,
    avisadas: [],
    avisoFalhou: [],
    excluidas: [],
    exclusaoFalhou: [],
  };

  // Auditoria guarda 1 ano (roda junto com esta rotina diária).
  if (!simular) {
    await supabaseAdmin
      .from("audit_log")
      .delete()
      .lt("created_at", new Date(agora.getTime() - AUDITORIA_DIAS * DIA_MS).toISOString());
  }

  const [{ data: perfis, error }, { data: membros }, { data: usuarios }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select(
        "id, nome, loja, whatsapp, plano, acesso_ate, created_at, plano_solicitado, aviso_inatividade_enviado_em",
      )
      .not("plano", "in", "(vitalicio,suspenso)"),
    supabaseAdmin.from("user_empresas").select("user_id, empresa_id"),
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  if (error) throw error;

  const funcionarios = new Set(
    (membros ?? []).filter((m) => m.user_id !== m.empresa_id).map((m) => m.user_id),
  );
  const operador = usuarios?.users.find((u) => u.email === SITE_ADMIN_EMAIL)?.id;

  for (const p of perfis ?? []) {
    if (p.id === operador || funcionarios.has(p.id) || p.plano_solicitado) continue;

    const prazo = prazoAcesso({ plano: p.plano, acessoAte: p.acesso_ate, criadoEm: p.created_at });
    if (prazo.tipo === "suspenso" || prazo.tipo === "sem_vencimento" || !prazo.expirado) continue;

    const empresa: Empresa = { id: p.id, nome: p.loja || p.nome || "Loja sem nome" };
    const diasVencido = (agora.getTime() - prazo.fim.getTime()) / DIA_MS;
    const aviso = p.aviso_inatividade_enviado_em ? new Date(p.aviso_inatividade_enviado_em) : null;
    const avisoValido = aviso !== null && aviso >= prazo.fim;

    if (avisoValido) {
      if ((agora.getTime() - aviso.getTime()) / DIA_MS < DIAS_AVISO_ATE_EXCLUSAO) continue;
      if (simular) {
        resultado.excluidas.push(empresa);
        continue;
      }
      const { error: erroExclusao } = await supabaseAdmin.auth.admin.deleteUser(p.id);
      if (erroExclusao) {
        resultado.exclusaoFalhou.push({ ...empresa, motivo: erroExclusao.message });
      } else {
        // A auditoria não tem chave para a conta (para não travar a exclusão
        // em cascata); apaga junto aqui.
        await supabaseAdmin.from("audit_log").delete().eq("user_id", p.id);
        resultado.excluidas.push(empresa);
      }
      continue;
    }

    if (diasVencido < DIAS_ATE_AVISO) continue;

    const telefone = (p.whatsapp ?? "").replace(/\D/g, "");
    if (telefone.length < 10) {
      resultado.avisoFalhou.push({ ...empresa, motivo: "sem WhatsApp cadastrado" });
      continue;
    }
    if (simular) {
      resultado.avisadas.push(empresa);
      continue;
    }
    const apagarEm = new Date(agora.getTime() + DIAS_AVISO_ATE_EXCLUSAO * DIA_MS);
    const envio = await enviarDaPlataforma({
      telefone,
      nome: p.nome,
      mensagem: mensagemAviso(p.nome, empresa.nome, apagarEm),
      templateId: `inatividade_${p.id}_${prazo.fim.toISOString().slice(0, 10)}`,
    });
    if (envio !== "enviado") {
      resultado.avisoFalhou.push({
        ...empresa,
        motivo: envio === "sem_conexao" ? "WhatsApp da SPACE TECH desconectado" : "falha no envio",
      });
      continue;
    }
    await supabaseAdmin
      .from("profiles")
      .update({ aviso_inatividade_enviado_em: agora.toISOString() })
      .eq("id", p.id);
    resultado.avisadas.push(empresa);
  }

  if (!simular && (resultado.avisadas.length || resultado.excluidas.length)) {
    const linhas = ["🧹 *Contas inativas — rotina de hoje*"];
    if (resultado.avisadas.length) {
      linhas.push("", `Avisadas (apagam em ${DIAS_AVISO_ATE_EXCLUSAO} dias sem assinatura):`);
      linhas.push(...resultado.avisadas.map((e) => `• ${e.nome}`));
    }
    if (resultado.excluidas.length) {
      linhas.push("", "Apagadas do sistema:");
      linhas.push(...resultado.excluidas.map((e) => `• ${e.nome}`));
    }
    await avisarDonoDaPlataforma(`contas_inativas_${agora.toISOString()}`, linhas.join("\n"));
  }

  return resultado;
}
