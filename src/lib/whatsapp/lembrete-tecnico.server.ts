// Lembrete diário ao técnico (Configurações → WhatsApp, desligado por
// padrão): a partir das 8h (Brasília), cada pessoa da equipe com WhatsApp no
// perfil recebe, uma vez por dia, as OS dela com entrega prevista para hoje
// e as visitas/compromissos da agenda marcados no nome dela. Quem não tem
// nada no dia não recebe nada. Roda em rodarAutomacoes (worker a cada 10 min).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { paraE164BR } from "./telefone";
import { enviarAutomatico, obterConexao } from "./whatsapp-service";
import { montarLembreteTecnico, type OsDoDia, type VisitaDoDia } from "./lembrete-tecnico";

const HORA_INICIO = 8;
const HORA_FIM = 20;
const FUSO = "America/Sao_Paulo";
// Encerradas: não tem mais entrega a fazer.
const STATUS_ENCERRADOS = ["entregue", "faturado", "cancelado", "reprovado"];

function agoraBrasilia(): { hoje: string; hora: number } {
  const agora = new Date();
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(agora);
  const hora = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: FUSO }).format(
      agora,
    ),
  );
  return { hoje, hora };
}

const normalizar = (t: string | null | undefined) =>
  (t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export async function enviarLembretesTecnicos(empresaId: string): Promise<number> {
  const { hoje, hora } = agoraBrasilia();
  if (hora < HORA_INICIO || hora >= HORA_FIM) return 0;

  const { data: config } = await supabaseAdmin
    .from("whatsapp_config")
    .select("lembrete_tecnico, lembrete_tecnico_texto")
    .eq("user_id", empresaId)
    .maybeSingle();
  if (!config?.lembrete_tecnico) return 0;

  const conexao = await obterConexao(empresaId);
  if (!conexao || conexao.status !== "conectado") return 0;

  // Equipe: dono + membros, com o WhatsApp do perfil de cada um.
  const { data: membros } = await supabaseAdmin
    .from("user_empresas")
    .select("user_id")
    .eq("empresa_id", empresaId);
  const ids = Array.from(new Set([empresaId, ...(membros ?? []).map((m) => m.user_id)]));
  const { data: perfis } = await supabaseAdmin
    .from("profiles")
    .select("id, nome, loja, whatsapp")
    .in("id", ids);
  const equipe = (perfis ?? []).filter((p) => (p.whatsapp ?? "").replace(/\D/g, "").length >= 10);
  if (!equipe.length) return 0;

  // Já avisados hoje (uma mensagem por pessoa por dia).
  const templates = equipe.map((p) => `lembrete_tecnico_${p.id}_${hoje}`);
  const { data: jaEnviados } = await supabaseAdmin
    .from("whatsapp_messages")
    .select("template_id")
    .eq("user_id", empresaId)
    .in("template_id", templates);
  const avisados = new Set((jaEnviados ?? []).map((m) => m.template_id));
  const pendentes = equipe.filter((p) => !avisados.has(`lembrete_tecnico_${p.id}_${hoje}`));
  if (!pendentes.length) return 0;

  const inicioDia = new Date(`${hoje}T00:00:00-03:00`).toISOString();
  const fimDia = new Date(`${hoje}T23:59:59-03:00`).toISOString();
  const [{ data: ordens }, { data: agenda }] = await Promise.all([
    supabaseAdmin
      .from("ordens_servico")
      .select("numero, aparelho, modelo, status, responsavel_user_id, clientes(nome)")
      .eq("user_id", empresaId)
      .eq("previsao", hoje)
      .not("responsavel_user_id", "is", null)
      .not("status", "in", `(${STATUS_ENCERRADOS.join(",")})`),
    supabaseAdmin
      .from("agendamentos")
      .select("titulo, inicio, tecnico, status, clientes(nome)")
      .eq("user_id", empresaId)
      .gte("inicio", inicioDia)
      .lte("inicio", fimDia)
      .not("status", "in", "(cancelado,concluido)"),
  ]);

  const loja = (perfis?.find((p) => p.id === empresaId)?.loja || "a loja").trim();
  let enviados = 0;
  for (const p of pendentes) {
    const os: OsDoDia[] = (ordens ?? [])
      .filter((o) => o.responsavel_user_id === p.id)
      .map((o) => ({
        numero: o.numero,
        aparelho: [o.aparelho, o.modelo].filter(Boolean).join(" ") || null,
        cliente: (o.clientes as unknown as { nome: string } | null)?.nome ?? null,
        status: o.status,
      }));
    // A agenda guarda o técnico pelo nome.
    const visitas: VisitaDoDia[] = (agenda ?? [])
      .filter((a) => !!p.nome && normalizar(a.tecnico) === normalizar(p.nome))
      .map((a) => ({
        inicio: a.inicio,
        titulo: a.titulo,
        cliente: (a.clientes as unknown as { nome: string } | null)?.nome ?? null,
      }));
    const mensagem = montarLembreteTecnico({
      texto: config.lembrete_tecnico_texto || "Bom dia, {{tecnico}}! Seu dia na {{loja}}:",
      tecnico: p.nome ?? "",
      loja,
      os,
      visitas,
    });
    if (!mensagem) continue;
    const r = await enviarAutomatico({
      empresaId,
      conexao,
      numeroCompleto: paraE164BR(p.whatsapp!),
      nome: p.nome,
      mensagem,
      templateId: `lembrete_tecnico_${p.id}_${hoje}`,
    });
    if (r === "enviado") enviados++;
  }
  return enviados;
}
