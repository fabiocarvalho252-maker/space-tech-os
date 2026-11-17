// Executa o roteiro simulado no tempo, com cancelamento e pausa no pedido de
// aprovação. Só existe na Fase 1; na Fase 2 quem emite eventos é o runner.

import { MISSAO_SIMULADA, ROTEIRO, eventoDoPasso } from "./mock/roteiro.ts";
import type { EventoEscritorio } from "./tipos.ts";

export type DecisaoAprovacao = "permitir" | "negar";

export type Simulador = {
  iniciar: () => void;
  cancelar: () => void;
  decidir: (decisao: DecisaoAprovacao) => void;
};

type Opcoes = {
  onEvento: (evento: EventoEscritorio) => void;
  agora?: () => Date;
  // Atraso multiplicado (1 em tempo real; menor em testes).
  fator?: number;
};

export function criarSimulador({
  onEvento,
  agora = () => new Date(),
  fator = 1,
}: Opcoes): Simulador {
  let indice = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let aguardandoDecisao: ((d: DecisaoAprovacao) => void) | null = null;
  let ativo = false;

  const emitir = (evento: EventoEscritorio) => onEvento(evento);

  const parar = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    aguardandoDecisao = null;
    ativo = false;
  };

  function proximo(): void {
    if (!ativo) return;
    if (indice >= ROTEIRO.length) {
      parar();
      return;
    }
    const passo = ROTEIRO[indice];
    if (!passo) {
      parar();
      return;
    }
    timer = setTimeout(() => {
      if (!ativo) return;
      const evento = eventoDoPasso(passo, indice, agora());
      indice += 1;
      emitir(evento);
      if (passo.tipo === "aprovacao.pedida") {
        aguardandoDecisao = (decisao) => {
          aguardandoDecisao = null;
          const permitido = decisao === "permitir";
          emitir({
            id: `${evento.missaoId}-aprov-${evento.aprovacao?.id ?? "x"}`,
            missaoId: evento.missaoId,
            ts: agora().toISOString(),
            agenteId: evento.agenteId,
            tipo: "aprovacao.respondida",
            estado: permitido ? "trabalhando" : "concluido",
            texto: permitido ? "Aprovado, seguindo." : "Negado. Pulando a edição.",
          });
          proximo();
        };
        return; // espera decidir()
      }
      proximo();
    }, passo.atrasoMs * fator);
  }

  return {
    iniciar() {
      parar();
      indice = 0;
      ativo = true;
      proximo();
    },
    cancelar() {
      if (!ativo) return;
      parar();
      emitir({
        id: `${ROTEIRO.length}-cancelada-${Date.now()}`,
        missaoId: MISSAO_SIMULADA,
        ts: agora().toISOString(),
        agenteId: "orchestrator",
        tipo: "missao.cancelada",
        texto: "Missão parada.",
      });
    },
    decidir(decisao) {
      aguardandoDecisao?.(decisao);
    },
  };
}
