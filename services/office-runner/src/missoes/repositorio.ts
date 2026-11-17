// Estado em memória das missões: eventos (com replay), assinantes do WebSocket
// e aprovações pendentes. Na Fase 3 os eventos também vão para o Supabase.
import type { EventoEscritorio, ModoPermissao } from "../tipos.ts";

export type StatusMissao = "fila" | "rodando" | "concluida" | "falhou" | "cancelada";

export type Missao = {
  id: string;
  prompt: string;
  projeto: string;
  modo: ModoPermissao;
  status: StatusMissao;
  criadaEm: string;
  controlador: AbortController;
  eventos: EventoEscritorio[];
};

type Aprovacao = {
  resolver: (decisao: "permitir" | "negar") => void;
  missaoId: string;
  timer: ReturnType<typeof setTimeout>;
};

export type Decisao = "permitir" | "negar";

export function criarRepositorio(agora: () => string = () => new Date().toISOString()) {
  const missoes = new Map<string, Missao>();
  const aprovacoes = new Map<string, Aprovacao>();
  const todos: EventoEscritorio[] = [];
  const assinantes = new Set<(evento: EventoEscritorio) => void>();
  let sequencia = 0;
  // Prefixo por subida: ids não se repetem depois de reinício do runner.
  const prefixoBoot = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  let sequenciaMissao = 0;

  function proximoId(): string {
    sequencia += 1;
    return `evt-${prefixoBoot}-${String(sequencia).padStart(10, "0")}`;
  }

  function publicar(evento: EventoEscritorio): void {
    todos.push(evento);
    missoes.get(evento.missaoId)?.eventos.push(evento);
    for (const assinante of assinantes) assinante(evento);
  }

  return {
    proximoId,
    agora,
    criar(prompt: string, projeto: string, modo: ModoPermissao): Missao {
      sequenciaMissao += 1;
      const id = `m-${Date.now().toString(36)}-${sequenciaMissao}`;
      const missao: Missao = {
        id,
        prompt,
        projeto,
        modo,
        status: "fila",
        criadaEm: agora(),
        controlador: new AbortController(),
        eventos: [],
      };
      missoes.set(id, missao);
      return missao;
    },
    obter: (id: string): Missao | undefined => missoes.get(id),
    listar: (): Missao[] => [...missoes.values()].sort((a, b) => b.criadaEm.localeCompare(a.criadaEm)),
    marcarStatus(id: string, status: StatusMissao): void {
      const missao = missoes.get(id);
      if (missao) missao.status = status;
    },
    publicar,
    // Eventos depois de um id (exclusivo). Sem id, todos.
    replay(depoisDe: string | undefined, missaoId?: string): EventoEscritorio[] {
      const base = missaoId ? (missoes.get(missaoId)?.eventos ?? []) : todos;
      if (!depoisDe) return [...base];
      const indice = base.findIndex((e) => e.id === depoisDe);
      return indice === -1 ? [...base] : base.slice(indice + 1);
    },
    assinar(fn: (evento: EventoEscritorio) => void): () => void {
      assinantes.add(fn);
      return () => assinantes.delete(fn);
    },
    aguardarAprovacao(
      aprovacaoId: string,
      missaoId: string,
      timeoutMs: number,
    ): Promise<Decisao> {
      return new Promise<Decisao>((resolver) => {
        const timer = setTimeout(() => {
          aprovacoes.delete(aprovacaoId);
          resolver("negar");
        }, timeoutMs);
        aprovacoes.set(aprovacaoId, {
          missaoId,
          timer,
          resolver: (decisao) => {
            clearTimeout(timer);
            aprovacoes.delete(aprovacaoId);
            resolver(decisao);
          },
        });
      });
    },
    decidirAprovacao(aprovacaoId: string, decisao: Decisao): boolean {
      const pendente = aprovacoes.get(aprovacaoId);
      if (!pendente) return false;
      pendente.resolver(decisao);
      return true;
    },
    cancelarAprovacoesDaMissao(missaoId: string): void {
      for (const [id, pendente] of aprovacoes) {
        if (pendente.missaoId === missaoId) pendente.resolver("negar");
        aprovacoes.delete(id);
      }
    },
  };
}

export type Repositorio = ReturnType<typeof criarRepositorio>;
