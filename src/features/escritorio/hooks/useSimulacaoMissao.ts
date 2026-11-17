import { useCallback, useEffect, useRef, useState } from "react";
import { ESTADO_INICIAL, aplicarEvento, type EstadoMissao } from "../estado.ts";
import { criarSimulador, type DecisaoAprovacao, type Simulador } from "../simulador.ts";

// Fase 1: liga o simulador ao estado do escritório. Na Fase 2 este hook
// passa a receber eventos do WebSocket do runner, com a mesma interface.
export function useSimulacaoMissao() {
  const [estado, setEstado] = useState<EstadoMissao>(ESTADO_INICIAL);
  const simuladorRef = useRef<Simulador | null>(null);

  const receber = useCallback((evento: Parameters<typeof aplicarEvento>[1]) => {
    setEstado((atual) => aplicarEvento(atual, evento));
  }, []);

  const cancelar = useCallback(() => {
    simuladorRef.current?.cancelar();
  }, []);

  const iniciar = useCallback(() => {
    simuladorRef.current?.cancelar();
    setEstado(ESTADO_INICIAL);
    const simulador = criarSimulador({ onEvento: receber });
    simuladorRef.current = simulador;
    simulador.iniciar();
  }, [receber]);

  const decidir = useCallback((decisao: DecisaoAprovacao) => {
    simuladorRef.current?.decidir(decisao);
  }, []);

  useEffect(() => () => simuladorRef.current?.cancelar(), []);

  return { estado, iniciar, cancelar, decidir };
}
