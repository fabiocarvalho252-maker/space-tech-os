// Gestão da Fila WhatsApp (tela /whatsapp-fila): o que está agendado, o que
// falhou e o que já saiu, e as ações sobre cada mensagem. O envio em si é de
// processarFila / enviarItemReservado (whatsapp-service.ts). Server-only;
// toda função recebe a empresa já resolvida pela sessão e filtra por ela.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { type MotivoEsperaFila, enviarItemReservado, obterConexao } from "./whatsapp-service";
import { evolutionConfigurado } from "./evolution-api";

export type AbaFila = "aprovacao" | "agendadas" | "falhas" | "enviadas" | "canceladas";

export type ItemFila = {
  id: string;
  status: "aguardando_aprovacao" | "agendado" | "pendente" | "falhou" | "enviado" | "cancelado";
  phone_number: string;
  contact_name: string | null;
  content: string | null;
  template_id: string | null;
  scheduled_at: string | null;
  enviado_em: string | null;
  created_at: string;
  error: string | null;
  os_id: string | null;
  os_numero: number | null;
  anexos: number;
};

export type RegrasFila = {
  intervaloSeg: number;
  horaInicio: number;
  horaFim: number;
  limiteHora: number;
};

export type ResumoFila = {
  conectado: boolean;
  regras: RegrasFila;
  contagem: {
    aprovacao: number;
    agendadas: number;
    enviando: number;
    falhas: number;
    enviadasHoje: number;
  };
  enviosUltimaHora: number;
  proximoEnvio: string | null;
  /** Por que nada está saindo agora (null = saindo normalmente / fila vazia). */
  espera: MotivoEsperaFila | null;
};

const STATUS_POR_ABA: Record<AbaFila, ItemFila["status"][]> = {
  aprovacao: ["aguardando_aprovacao"],
  agendadas: ["agendado", "pendente"],
  falhas: ["falhou"],
  enviadas: ["enviado"],
  canceladas: ["cancelado"],
};

async function regras(empresaId: string) {
  const { data, error } = await supabaseAdmin.rpc("whatsapp_fila_regras", {
    p_empresa: empresaId,
  });
  if (error) throw error;
  const r = data?.[0];
  return {
    regras: {
      intervaloSeg: r?.intervalo_seg ?? 20,
      horaInicio: r?.hora_inicio ?? 8,
      horaFim: r?.hora_fim ?? 20,
      limiteHora: r?.limite_hora ?? 30,
    },
    horaAtual: r?.hora_atual ?? 0,
    enviosUltimaHora: r?.envios_ultima_hora ?? 0,
  };
}

async function contar(empresaId: string, status: string[], desde?: string): Promise<number> {
  let q = supabaseAdmin
    .from("whatsapp_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", empresaId)
    .eq("direction", "outbound")
    .in("status", status);
  if (desde) q = q.gte("created_at", desde);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

function inicioDoDiaBrasilia(): string {
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(),
  );
  return new Date(`${dia}T00:00:00-03:00`).toISOString();
}

export async function resumoFila(empresaId: string): Promise<ResumoFila> {
  const conexao = evolutionConfigurado() ? await obterConexao(empresaId) : null;
  const conectado = conexao?.status === "conectado";
  const [r, aprovacao, agendadas, enviando, falhas, enviadasHoje, proxima, vencidas] =
    await Promise.all([
      regras(empresaId),
      contar(empresaId, ["aguardando_aprovacao"]),
      contar(empresaId, ["agendado"]),
      contar(empresaId, ["pendente"]),
      contar(empresaId, ["falhou"]),
      contar(empresaId, ["enviado"], inicioDoDiaBrasilia()),
      supabaseAdmin
        .from("whatsapp_messages")
        .select("scheduled_at")
        .eq("user_id", empresaId)
        .eq("status", "agendado")
        .order("scheduled_at")
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("whatsapp_messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", empresaId)
        .eq("status", "agendado")
        .lte("scheduled_at", new Date().toISOString()),
    ]);

  let espera: MotivoEsperaFila | null = null;
  if ((vencidas.count ?? 0) > 0) {
    if (!conectado) espera = "desconectado";
    else if (r.horaAtual < r.regras.horaInicio || r.horaAtual >= r.regras.horaFim)
      espera = "fora_do_horario";
    else if (r.enviosUltimaHora >= r.regras.limiteHora) espera = "limite_hora";
  }

  return {
    conectado,
    regras: r.regras,
    contagem: { aprovacao, agendadas, enviando, falhas, enviadasHoje },
    enviosUltimaHora: r.enviosUltimaHora,
    proximoEnvio: proxima.data?.scheduled_at ?? null,
    espera,
  };
}

export async function listarFila(empresaId: string, aba: AbaFila): Promise<ItemFila[]> {
  let q = supabaseAdmin
    .from("whatsapp_messages")
    .select(
      "id, status, phone_number, contact_name, content, template_id, scheduled_at, enviado_em, created_at, error, os_id, attachments, ordens_servico(numero)",
    )
    .eq("user_id", empresaId)
    .eq("direction", "outbound")
    .in("status", STATUS_POR_ABA[aba]);
  q =
    aba === "agendadas" || aba === "aprovacao"
      ? q.order("scheduled_at", { ascending: true })
      : q.order("created_at", { ascending: false });
  const { data, error } = await q.limit(200);
  if (error) throw error;
  return (data ?? []).map((m) => ({
    id: m.id,
    status: m.status as ItemFila["status"],
    phone_number: m.phone_number,
    contact_name: m.contact_name,
    content: m.content,
    template_id: m.template_id,
    scheduled_at: m.scheduled_at,
    enviado_em: m.enviado_em,
    created_at: m.created_at,
    error: m.error,
    os_id: m.os_id,
    os_numero: (m.ordens_servico as { numero: number } | null)?.numero ?? null,
    anexos: Array.isArray(m.attachments) ? m.attachments.length : 0,
  }));
}

/** Atualiza só se a mensagem é da empresa e está num dos status permitidos. */
async function atualizar(
  empresaId: string,
  id: string,
  permitidos: ItemFila["status"][],
  campos: Pick<
    TablesUpdate<"whatsapp_messages">,
    "status" | "scheduled_at" | "enviado_em" | "error" | "content"
  >,
): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("whatsapp_messages")
    .update(campos)
    .eq("id", id)
    .eq("user_id", empresaId)
    .eq("direction", "outbound")
    .in("status", permitidos)
    .select("id");
  if (error) throw error;
  if (!data?.length) {
    throw new Error(
      "Essa mensagem mudou de situação (já foi enviada ou cancelada). Atualize a tela.",
    );
  }
}

/**
 * Envia já, sem esperar intervalo nem horário — é um pedido explícito da loja
 * para uma mensagem só. A reserva (→ pendente) evita envio duplo com o worker.
 */
export async function enviarAgora(empresaId: string, id: string): Promise<"enviado" | "falhou"> {
  const conexao = evolutionConfigurado() ? await obterConexao(empresaId) : null;
  if (!conexao || conexao.status !== "conectado") {
    throw new Error(
      "O WhatsApp da empresa está desconectado. Conecte em WhatsApp antes de enviar.",
    );
  }
  await atualizar(empresaId, id, ["aguardando_aprovacao", "agendado", "falhou", "cancelado"], {
    status: "pendente",
    enviado_em: new Date().toISOString(),
    error: null,
  });
  return enviarItemReservado(id, conexao);
}

export async function reagendar(empresaId: string, id: string, quando: string): Promise<void> {
  await atualizar(empresaId, id, ["agendado", "falhou", "cancelado"], {
    status: "agendado",
    scheduled_at: quando,
    error: null,
  });
}

export async function editarTexto(empresaId: string, id: string, texto: string): Promise<void> {
  await atualizar(empresaId, id, ["aguardando_aprovacao", "agendado", "falhou", "cancelado"], {
    content: texto,
  });
}

export async function cancelar(empresaId: string, id: string): Promise<void> {
  await atualizar(empresaId, id, ["aguardando_aprovacao", "agendado", "falhou"], {
    status: "cancelado",
  });
}

/** Põe de volta na fila (respeitando intervalo e horário). */
export async function reenviar(empresaId: string, id: string): Promise<void> {
  await atualizar(empresaId, id, ["aguardando_aprovacao", "falhou", "cancelado"], {
    status: "agendado",
    scheduled_at: new Date().toISOString(),
    error: null,
  });
}

export const DIAS_REENVIO_EM_MASSA = 7;

/**
 * Só as falhas recentes (um aviso de OS de meses atrás confundiria o
 * cliente) e uma vez cada: a mesma mensagem para o mesmo número que falhou
 * várias vezes volta para a fila uma vez só, e a que já saiu depois não volta.
 * As cópias ficam canceladas.
 */
export async function reenviarTodasFalhas(empresaId: string): Promise<number> {
  const desde = new Date(Date.now() - DIAS_REENVIO_EM_MASSA * 86400_000).toISOString();
  const { data: falhas, error } = await supabaseAdmin
    .from("whatsapp_messages")
    .select("id, phone_number, content")
    .eq("user_id", empresaId)
    .eq("direction", "outbound")
    .eq("status", "falhou")
    .gte("created_at", desde)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!falhas?.length) return 0;

  const { data: enviadas } = await supabaseAdmin
    .from("whatsapp_messages")
    .select("phone_number, content")
    .eq("user_id", empresaId)
    .eq("direction", "outbound")
    .in("status", ["enviado", "agendado", "pendente"])
    .in("phone_number", [...new Set(falhas.map((f) => f.phone_number))])
    .gte("created_at", desde);
  const chave = (m: { phone_number: string; content: string | null }) =>
    `${m.phone_number}|${(m.content ?? "").trim()}`;
  const jaSaiu = new Set((enviadas ?? []).map(chave));

  const voltar: string[] = [];
  const copias: string[] = [];
  const vistas = new Set<string>();
  for (const f of falhas) {
    const k = chave(f);
    if (jaSaiu.has(k) || vistas.has(k)) copias.push(f.id);
    else voltar.push(f.id);
    vistas.add(k);
  }

  if (copias.length) {
    const { error: e } = await supabaseAdmin
      .from("whatsapp_messages")
      .update({ status: "cancelado", error: "Cópia de outra mensagem igual — não reenviada." })
      .in("id", copias)
      .eq("status", "falhou");
    if (e) throw e;
  }
  if (!voltar.length) return 0;
  const { data, error: e } = await supabaseAdmin
    .from("whatsapp_messages")
    .update({ status: "agendado", scheduled_at: new Date().toISOString(), error: null })
    .in("id", voltar)
    .eq("status", "falhou")
    .select("id");
  if (e) throw e;
  return data?.length ?? 0;
}

export async function salvarRegras(empresaId: string, r: RegrasFila): Promise<void> {
  const { error } = await supabaseAdmin.from("whatsapp_config").upsert(
    {
      user_id: empresaId,
      fila_intervalo_seg: r.intervaloSeg,
      fila_hora_inicio: r.horaInicio,
      fila_hora_fim: r.horaFim,
      fila_limite_hora: r.limiteHora,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}
