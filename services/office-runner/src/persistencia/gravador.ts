// Grava missões, eventos e aprovações no Supabase. Falha de banco nunca para
// a missão: o erro vai para o log e a missão segue em memória.
import type { EventoEscritorio, TipoEvento } from "../tipos.ts";

export type Resultado = { error: { message: string } | null };

// Subconjunto do cliente do Supabase usado aqui; facilita testar sem rede.
export type ClienteBanco = {
  from(tabela: string): {
    upsert(linhas: unknown, opcoes?: unknown): PromiseLike<Resultado>;
    insert(linha: unknown): PromiseLike<Resultado>;
    update(valores: unknown): { eq(coluna: string, valor: string): PromiseLike<Resultado> };
  };
};

export const TAMANHO_LOTE = 50;
export const INTERVALO_LOTE_MS = 500;
export const TENTATIVAS_LOTE = 3;

export type MissaoNova = {
  id: string;
  criadoPor: string;
  prompt: string;
  projeto: string;
  modo: "seguro" | "automatico";
  criadaEm: string;
};

type StatusFinal = "concluida" | "falhou" | "cancelada";

const STATUS_FINAL: Partial<Record<TipoEvento, StatusFinal>> = {
  "missao.concluida": "concluida",
  "missao.falhou": "falhou",
  "missao.cancelada": "cancelada",
};

export function linhaDeEvento(e: EventoEscritorio) {
  return {
    id: e.id,
    mission_id: e.missaoId,
    ts: e.ts,
    agent_id: e.agenteId,
    parent_agent_id: e.agentePaiId ?? null,
    type: e.tipo,
    state: e.estado ?? null,
    text: e.texto ?? null,
    tool: e.ferramenta ?? null,
    usage: e.uso ?? null,
    detail: null,
  };
}

export function criarGravador(cliente: ClienteBanco, onErro: (mensagem: string) => void) {
  let fila: EventoEscritorio[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const falhou = (contexto: string, erro: { message: string } | null): void => {
    if (erro) onErro(`${contexto}: ${erro.message}`);
  };

  // Flushes em série: fechar a missão espera o lote em andamento terminar.
  let emCurso: Promise<void> = Promise.resolve();

  async function drenar(): Promise<void> {
    while (fila.length) {
      const lote = fila.slice(0, TAMANHO_LOTE);
      fila = fila.slice(TAMANHO_LOTE);
      await gravarLote(lote);
    }
  }

  async function gravarLote(lote: EventoEscritorio[]): Promise<void> {
    for (let tentativa = 1; tentativa <= TENTATIVAS_LOTE; tentativa++) {
      const r = await cliente
        .from("office_events")
        .upsert(lote.map(linhaDeEvento), { onConflict: "id", ignoreDuplicates: true });
      if (!r.error) return;
      if (tentativa === TENTATIVAS_LOTE) falhou("gravar eventos", r.error);
    }
  }

  function esvaziar(): Promise<void> {
    if (timer) clearTimeout(timer);
    timer = null;
    emCurso = emCurso.then(drenar);
    return emCurso;
  }

  function agendar(): void {
    if (timer) return;
    timer = setTimeout(() => void esvaziar(), INTERVALO_LOTE_MS);
  }

  async function atualizarStatus(missaoId: string, status: string): Promise<void> {
    const r = await cliente.from("office_missions").update({ status }).eq("id", missaoId);
    falhou("atualizar status", r.error);
  }

  async function fecharMissao(e: EventoEscritorio, status: StatusFinal): Promise<void> {
    // Eventos antes do fechamento: o histórico fica completo quando a missão aparece como fechada.
    await esvaziar();
    const r = await cliente
      .from("office_missions")
      .update({
        status,
        result_markdown: e.resultado ?? null,
        error: status === "falhou" ? (e.texto ?? null) : null,
        input_tokens: e.uso?.entradaTokens ?? 0,
        output_tokens: e.uso?.saidaTokens ?? 0,
        cost_usd: e.uso?.custoUsd ?? 0,
        finished_at: e.ts,
      })
      .eq("id", e.missaoId);
    falhou("fechar missão", r.error);
  }

  return {
    async missaoCriada(m: MissaoNova): Promise<void> {
      const r = await cliente.from("office_missions").insert({
        id: m.id,
        created_by: m.criadoPor,
        prompt: m.prompt,
        project_id: m.projeto,
        mode: m.modo,
        status: "fila",
        created_at: m.criadaEm,
      });
      falhou("gravar missão", r.error);
    },

    evento(e: EventoEscritorio): void {
      fila.push(e);
      if (fila.length >= TAMANHO_LOTE) void esvaziar();
      else agendar();
      const status = STATUS_FINAL[e.tipo];
      if (status) void fecharMissao(e, status);
      if (e.tipo === "missao.iniciada") void atualizarStatus(e.missaoId, "rodando");
    },

    async aprovacaoPedida(
      missaoId: string,
      a: { id: string; agenteId: string; ferramenta: string; resumo: string },
    ): Promise<void> {
      const r = await cliente.from("office_approvals").insert({
        id: a.id,
        mission_id: missaoId,
        agent_id: a.agenteId,
        tool_name: a.ferramenta,
        tool_input: { resumo: a.resumo },
        status: "pendente",
      });
      falhou("gravar aprovação", r.error);
    },

    async aprovacaoDecidida(
      aprovacaoId: string,
      status: "permitida" | "negada" | "expirada",
      decididoPor: string | null,
    ): Promise<void> {
      const r = await cliente
        .from("office_approvals")
        .update({ status, decided_by: decididoPor, decided_at: new Date().toISOString() })
        .eq("id", aprovacaoId);
      falhou("decidir aprovação", r.error);
    },

    esvaziar,
  };
}

export type Gravador = ReturnType<typeof criarGravador>;
