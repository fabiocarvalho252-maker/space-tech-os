import { useCallback, useEffect, useRef, useState } from "react";
import { ESTADO_INICIAL, aplicarEvento, aplicarEventos, type EstadoMissao } from "../estado.ts";
import {
  abrirFluxo,
  eventosDaMissaoReal,
  cancelarMissaoReal,
  criarMissaoReal,
  decidirAprovacaoReal,
  runnerOnline,
} from "../api/runner.ts";
import { criarSimulador, type DecisaoAprovacao, type Simulador } from "../simulador.ts";
import type { EventoEscritorio } from "../tipos.ts";

export type ModoEscritorio = "simulacao" | "real";

// Liga o escritório a dois modos: simulação (roteiro falso, sempre disponível)
// e real (runner na VPS). O estado é o mesmo; só muda quem emite os eventos.
export function useEscritorio() {
  const [estado, setEstado] = useState<EstadoMissao>(ESTADO_INICIAL);
  const [online, setOnline] = useState<boolean | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const simuladorRef = useRef<Simulador | null>(null);
  const fluxoRef = useRef<(() => void) | null>(null);
  const missaoRealRef = useRef<string | null>(null);

  useEffect(() => {
    void runnerOnline().then(setOnline);
    return () => {
      simuladorRef.current?.cancelar();
      fluxoRef.current?.();
    };
  }, []);

  const receber = useCallback((evento: EventoEscritorio) => {
    setEstado((atual) => aplicarEvento(atual, evento));
  }, []);

  const iniciarSimulacao = useCallback(() => {
    simuladorRef.current?.cancelar();
    setEstado(ESTADO_INICIAL);
    const simulador = criarSimulador({ onEvento: receber });
    simuladorRef.current = simulador;
    simulador.iniciar();
  }, [receber]);

  const iniciarReal = useCallback(
    async (prompt: string, projeto: string, modo: "seguro" | "automatico") => {
      setErro(null);
      simuladorRef.current?.cancelar();
      setEstado(ESTADO_INICIAL);
      try {
        const missao = await criarMissaoReal(prompt, projeto, modo);
        missaoRealRef.current = missao.id;
        // Eventos emitidos antes da resposta 202 foram descartados pelo filtro:
        // o replay da missão os traz de volta (o reducer não duplica por id).
        const { eventos } = await eventosDaMissaoReal(missao.id);
        setEstado((atual) =>
          aplicarEventos(atual.missaoId === missao.id ? atual : ESTADO_INICIAL, eventos),
        );
        fluxoRef.current ??= abrirFluxo((evento) => {
          // Só a missão atual: o fluxo entrega o histórico de todas.
          if (evento.missaoId === missaoRealRef.current) receber(evento);
        });
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não foi possível enviar a missão.");
      }
    },
    [receber],
  );

  const cancelar = useCallback(() => {
    simuladorRef.current?.cancelar();
    const missaoId = missaoRealRef.current;
    if (missaoId) {
      cancelarMissaoReal(missaoId).catch((e: unknown) =>
        setErro(e instanceof Error ? e.message : "Não foi possível parar a missão."),
      );
    }
  }, []);

  const decidir = useCallback(
    (decisao: DecisaoAprovacao) => {
      const pedido = estado.aprovacao;
      if (!pedido || pedido.id === undefined) return;
      if (missaoRealRef.current && estado.missaoId === missaoRealRef.current) {
        decidirAprovacaoReal(pedido.id, decisao === "permitir" ? "permitir" : "negar").catch(
          (e: unknown) =>
            setErro(e instanceof Error ? e.message : "Não foi possível responder à aprovação."),
        );
      } else {
        simuladorRef.current?.decidir(decisao);
      }
    },
    [estado.aprovacao, estado.missaoId],
  );

  // Abre no painel uma missão antiga, reproduzida a partir dos eventos guardados.
  // O resultado vem da missão no banco: o evento final guardado não o contém.
  const mostrarEventos = useCallback((eventos: EventoEscritorio[], resultado: string | null) => {
    simuladorRef.current?.cancelar();
    setEstado({ ...aplicarEventos(ESTADO_INICIAL, eventos), resultado: resultado ?? null });
  }, []);

  return { estado, online, erro, iniciarSimulacao, iniciarReal, cancelar, decidir, mostrarEventos };
}
