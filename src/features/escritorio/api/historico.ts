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
type ConsultaMissoes = {
  select(colunas: string): {
    order(coluna: string, opcoes: { ascending: boolean }): { limit(n: number): Resposta<unknown> };
  };
};
type ConsultaEventos = {
  select(colunas: string): {
    eq(
      coluna: string,
      valor: string,
    ): {
      order(
        coluna: string,
        opcoes: { ascending: boolean },
      ): {
        order(
          coluna: string,
          opcoes: { ascending: boolean },
        ): { range(de: number, ate: number): Resposta<unknown> };
      };
    };
  };
};

type ClienteTabelas = {
  from(tabela: "office_missions"): ConsultaMissoes;
  from(tabela: "office_events"): ConsultaEventos;
};
const cliente = supabase as unknown as ClienteTabelas;

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

// O PostgREST corta em 1000 linhas por padrão: a leitura pagina até acabar.
export const TAMANHO_PAGINA_EVENTOS = 1000;

export async function carregarEventos(missaoId: string): Promise<EventoEscritorio[]> {
  const todas: LinhaEvento[] = [];
  for (let de = 0; ; de += TAMANHO_PAGINA_EVENTOS) {
    const { data, error } = await cliente
      .from("office_events")
      .select("*")
      .eq("mission_id", missaoId)
      .order("ts", { ascending: true })
      .order("id", { ascending: true })
      .range(de, de + TAMANHO_PAGINA_EVENTOS - 1);
    if (error) throw new Error(error.message);
    const pagina = (data ?? []) as LinhaEvento[];
    todas.push(...pagina);
    if (pagina.length < TAMANHO_PAGINA_EVENTOS) break;
  }
  return todas.map(linhaParaEvento);
}
