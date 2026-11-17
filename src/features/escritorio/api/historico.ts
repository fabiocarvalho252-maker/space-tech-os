// Leitura do histórico no Supabase, com a sessão do admin. O RLS garante que só o
// admin lê estas tabelas; aqui só tipamos o que vem de volta.
import { supabase } from "@/integrations/supabase/client";
import type { EventoEscritorio, TipoEvento, EstadoAgente } from "../tipos.ts";

export type MissaoHistorico = {
  id: string;
  prompt: string;
  status: string;
  created_at: string;
  cost_usd: number;
  result_markdown: string | null;
};

type Resposta<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
type ConsultaBanco = {
  select(colunas: string): {
    order(
      coluna: string,
      opcoes: { ascending: boolean },
    ): { limit(n: number): Resposta<unknown>; eq?: never } & Resposta<unknown>;
    eq(
      coluna: string,
      valor: string,
    ): {
      order(
        coluna: string,
        opcoes: { ascending: boolean },
      ): { limit(n: number): Resposta<unknown> };
    };
  };
};

const cliente = supabase as unknown as { from(tabela: string): ConsultaBanco };

export async function listarMissoes(limite = 20): Promise<MissaoHistorico[]> {
  const { data, error } = await cliente
    .from("office_missions")
    .select("id,prompt,status,created_at,cost_usd,result_markdown")
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw new Error(error.message);
  return (data ?? []) as MissaoHistorico[];
}

type LinhaEvento = {
  id: string;
  mission_id: string;
  ts: string;
  agent_id: string;
  parent_agent_id: string | null;
  type: string;
  state: string | null;
  text: string | null;
  tool: { nome: string; ok?: boolean } | null;
  usage: EventoEscritorio["uso"] | null;
};

export function linhaParaEvento(l: LinhaEvento): EventoEscritorio {
  return {
    id: l.id,
    missaoId: l.mission_id,
    ts: l.ts,
    agenteId: l.agent_id,
    agentePaiId: l.parent_agent_id ?? undefined,
    tipo: l.type as TipoEvento,
    estado: (l.state ?? undefined) as EstadoAgente | undefined,
    texto: l.text ?? undefined,
    ferramenta: l.tool ?? undefined,
    uso: l.usage ?? undefined,
  };
}

export const LIMITE_EVENTOS_REPLAY = 5000;

export async function carregarEventos(missaoId: string): Promise<EventoEscritorio[]> {
  const consulta = cliente.from("office_events").select("*").eq("mission_id", missaoId);
  // Limite explícito: o PostgREST corta em 1000 linhas por padrão e a reprodução ficaria truncada.
  const { data, error } = await consulta
    .order("ts", { ascending: true })
    .limit(LIMITE_EVENTOS_REPLAY);
  if (error) throw new Error(error.message);
  return ((data ?? []) as LinhaEvento[]).map(linhaParaEvento);
}
