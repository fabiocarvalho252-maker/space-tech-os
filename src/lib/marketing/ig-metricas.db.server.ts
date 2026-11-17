// Acesso às tabelas de métricas do Instagram com o service role. Estas tabelas
// ainda não estão em src/integrations/supabase/types.ts, então o acesso é tipado
// aqui à mão. Regenerar os tipos depois elimina este cast.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { diaBrasil } from "./ig-metricas.calc";

export const INTERVALO_MANUAL_MS = 10 * 60 * 1000;
export const DIAS_HISTORICO_MIDIAS = 120;
export const DIAS_RETENCAO_LOG = 180;

type Resultado = { data: unknown; error: { message: string } | null };
type Consulta = PromiseLike<Resultado> & {
  eq(coluna: string, valor: unknown): Consulta;
  neq(coluna: string, valor: unknown): Consulta;
  gte(coluna: string, valor: unknown): Consulta;
  order(coluna: string, opcoes: { ascending: boolean }): Consulta;
  limit(quantidade: number): Consulta;
};
type Tabela = {
  select(colunas: string): Consulta;
  insert(
    linha: unknown,
  ): PromiseLike<Resultado> & { select(colunas: string): PromiseLike<Resultado> };
  upsert(linhas: unknown[], opcoes: { onConflict: string }): PromiseLike<Resultado>;
  update(valores: unknown): { eq(coluna: string, valor: unknown): PromiseLike<Resultado> };
  delete(): {
    eq(coluna: string, valor: unknown): PromiseLike<Resultado>;
    lt(coluna: string, valor: unknown): PromiseLike<Resultado>;
  };
};

function tabela(nome: string): Tabela {
  return (supabaseAdmin as unknown as { from(n: string): Tabela }).from(nome);
}

export function verificarResultado(resultado: Resultado): Record<string, unknown>[] {
  if (resultado.error) throw new Error(`Supabase: ${resultado.error.message}`);
  return Array.isArray(resultado.data) ? (resultado.data as Record<string, unknown>[]) : [];
}

export async function upsertLinhas(
  nome: string,
  linhas: Record<string, unknown>[],
  onConflict: string,
) {
  if (!linhas.length) return;
  verificarResultado(await tabela(nome).upsert(linhas, { onConflict }));
}

export async function gravarColetaDiaria(
  igUserId: string,
  ok: boolean,
  mensagem: string,
  detalhes: Record<string, unknown>,
): Promise<void> {
  verificarResultado(
    await tabela("ig_coleta_log").insert({
      origem: "diaria",
      ok,
      mensagem,
      detalhes,
      ig_user_id: igUserId,
    }),
  );
}

export type ReservaManual =
  { reservada: true; id: number } | { reservada: false; esperarSegundos: number };

/**
 * Trava da coleta manual: cada clique grava uma linha "em andamento" e o primeiro
 * da janela de 10 minutos vence. Quem chega depois apaga a própria linha e
 * recebe o tempo de espera. Como o banco ordena por id, dois cliques simultâneos
 * não passam os dois.
 */
export async function reservarColetaManual(igUserId: string, agora: Date): Promise<ReservaManual> {
  const inseridas = verificarResultado(
    await tabela("ig_coleta_log")
      .insert({
        origem: "manual",
        ok: false,
        mensagem: "em andamento",
        detalhes: { em_andamento: true },
        ig_user_id: igUserId,
      })
      .select("id"),
  ) as { id: number }[];
  const id = inseridas[0]?.id;
  if (id === undefined) throw new Error("Não foi possível reservar a coleta.");

  const inicioJanela = new Date(agora.getTime() - INTERVALO_MANUAL_MS).toISOString();
  const primeira = verificarResultado(
    await tabela("ig_coleta_log")
      .select("id, executado_em")
      .eq("origem", "manual")
      .gte("executado_em", inicioJanela)
      .order("id", { ascending: true })
      .limit(1),
  )[0] as { id: number; executado_em: string } | undefined;

  if (primeira && primeira.id !== id) {
    verificarResultado(await tabela("ig_coleta_log").delete().eq("id", id));
    const falta = Date.parse(primeira.executado_em) + INTERVALO_MANUAL_MS - agora.getTime();
    return { reservada: false, esperarSegundos: Math.max(1, Math.ceil(falta / 1000)) };
  }
  return { reservada: true, id };
}

export async function concluirColetaManual(
  id: number,
  ok: boolean,
  mensagem: string,
  detalhes: Record<string, unknown>,
): Promise<void> {
  verificarResultado(await tabela("ig_coleta_log").update({ ok, mensagem, detalhes }).eq("id", id));
}

/** Remove histórico de mídias e de log além da retenção. Seguidores diários são mantidos. */
export async function podarHistorico(agora: Date): Promise<void> {
  const diaCorte = diaBrasil(new Date(agora.getTime() - DIAS_HISTORICO_MIDIAS * 86_400_000));
  const logCorte = new Date(agora.getTime() - DIAS_RETENCAO_LOG * 86_400_000).toISOString();
  verificarResultado(await tabela("ig_midia_metricas").delete().lt("dia_coleta", diaCorte));
  verificarResultado(await tabela("ig_coleta_log").delete().lt("executado_em", logCorte));
}

export async function lerLinhasConta(igUserId: string, desde: string) {
  return verificarResultado(
    await tabela("ig_conta_diaria")
      .select("*")
      .eq("ig_user_id", igUserId)
      .gte("dia", desde)
      .order("dia", { ascending: true }),
  );
}

export async function lerDiaMaisRecenteMidias(igUserId: string): Promise<string | null> {
  const linha = verificarResultado(
    await tabela("ig_midia_metricas")
      .select("dia_coleta")
      .eq("ig_user_id", igUserId)
      .order("dia_coleta", { ascending: false })
      .limit(1),
  )[0] as { dia_coleta: string } | undefined;
  return linha?.dia_coleta ?? null;
}

export async function lerMidiasDoDia(igUserId: string, dia: string, limite: number) {
  return verificarResultado(
    await tabela("ig_midia_metricas")
      .select("*")
      .eq("ig_user_id", igUserId)
      .eq("dia_coleta", dia)
      .order("publicado_em", { ascending: false })
      .limit(limite),
  );
}

/** Última coleta concluída (ignora as reservas em andamento). */
export async function lerUltimaColeta(igUserId: string) {
  return verificarResultado(
    await tabela("ig_coleta_log")
      .select("*")
      .eq("ig_user_id", igUserId)
      .neq("mensagem", "em andamento")
      .order("executado_em", { ascending: false })
      .limit(1),
  )[0] as
    | {
        executado_em: string;
        ok: boolean;
        mensagem: string | null;
        detalhes: { permissoes_ok?: boolean };
      }
    | undefined;
}
