// Reprodução de uma missão antiga no tempo real: cada evento é aplicado com o
// intervalo que houve entre os eventos originais, limitado a LIMITE_INTERVALO_MS
// e dividido pela velocidade escolhida (1×, 2× ou 4×).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EventoEscritorio } from "../tipos.ts";

export const VELOCIDADES = [1, 2, 4] as const;
export type Velocidade = (typeof VELOCIDADES)[number];

export const LIMITE_INTERVALO_MS = 1500;

type Temporizador = ReturnType<typeof setTimeout>;

function instanteMs(evento: EventoEscritorio): number {
  const ms = Date.parse(evento.ts);
  return Number.isFinite(ms) ? ms : 0;
}

// Ordena por instante sem alterar a lista original. A ordenação do Array é estável,
// então eventos com o mesmo horário mantêm a ordem em que chegaram.
export function ordenarEventos(eventos: readonly EventoEscritorio[]): EventoEscritorio[] {
  return [...eventos].sort((a, b) => instanteMs(a) - instanteMs(b));
}

// Atraso até aplicar `atual`, contado a partir de `anterior`. Intervalos
// negativos ou zerados viram 0; intervalos longos são cortados em 1,5 s antes de
// aplicar a velocidade, então a pausa nunca passa de 1,5 s / velocidade.
export function calcularAtrasoMs(
  anterior: EventoEscritorio,
  atual: EventoEscritorio,
  velocidade: Velocidade,
): number {
  const intervaloReal = instanteMs(atual) - instanteMs(anterior);
  if (intervaloReal <= 0) return 0;
  return Math.min(intervaloReal, LIMITE_INTERVALO_MS) / velocidade;
}

export function useReplay(
  eventos: readonly EventoEscritorio[],
  onEvento: (evento: EventoEscritorio) => void,
) {
  const ordenados = useMemo(() => ordenarEventos(eventos), [eventos]);
  const [tocando, setTocando] = useState(false);
  const [velocidade, setVelocidadeEstado] = useState<Velocidade>(1);

  const listaRef = useRef<EventoEscritorio[]>(ordenados);
  const onEventoRef = useRef(onEvento);
  const velocidadeRef = useRef<Velocidade>(1);
  const indiceRef = useRef(0);
  const temporizadorRef = useRef<Temporizador | null>(null);

  const cancelarTemporizador = useCallback(() => {
    if (temporizadorRef.current !== null) {
      clearTimeout(temporizadorRef.current);
      temporizadorRef.current = null;
    }
  }, []);

  const finalizar = useCallback(() => {
    temporizadorRef.current = null;
    setTocando(false);
  }, []);

  // Aplica o evento atual e agenda o próximo com o atraso real entre os dois.
  const avancar = useCallback((): void => {
    temporizadorRef.current = null;
    const lista = listaRef.current;
    const indice = indiceRef.current;
    const evento = lista[indice];
    if (!evento) return finalizar();
    indiceRef.current = indice + 1;
    onEventoRef.current(evento);
    const proximo = lista[indice + 1];
    if (!proximo) return finalizar();
    const atraso = calcularAtrasoMs(evento, proximo, velocidadeRef.current);
    temporizadorRef.current = setTimeout(avancar, atraso);
  }, [finalizar]);

  const iniciar = useCallback(() => {
    cancelarTemporizador();
    indiceRef.current = 0;
    setTocando(true);
    temporizadorRef.current = setTimeout(avancar, 0);
  }, [avancar, cancelarTemporizador]);

  const pausar = useCallback(() => {
    cancelarTemporizador();
    setTocando(false);
  }, [cancelarTemporizador]);

  // Retoma do evento pendente. Se o replay já terminou, não faz nada.
  const continuar = useCallback(() => {
    if (temporizadorRef.current !== null) return;
    const lista = listaRef.current;
    const indice = indiceRef.current;
    const atual = lista[indice];
    if (!atual) return;
    const anterior = lista[indice - 1];
    const atraso = anterior ? calcularAtrasoMs(anterior, atual, velocidadeRef.current) : 0;
    setTocando(true);
    temporizadorRef.current = setTimeout(avancar, atraso);
  }, [avancar]);

  const setVelocidade = useCallback((nova: Velocidade) => {
    velocidadeRef.current = nova;
    setVelocidadeEstado(nova);
  }, []);

  useEffect(() => {
    listaRef.current = ordenados;
    onEventoRef.current = onEvento;
  }, [ordenados, onEvento]);

  // Outra missão selecionada: para o replay anterior e volta ao início.
  useEffect(() => {
    cancelarTemporizador();
    indiceRef.current = 0;
    setTocando(false);
  }, [ordenados, cancelarTemporizador]);

  useEffect(() => cancelarTemporizador, [cancelarTemporizador]);

  return { iniciar, pausar, continuar, velocidade, setVelocidade, tocando };
}
