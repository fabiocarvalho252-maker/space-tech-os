// Lógica pura dos agentes na cena 3D: destino (mesa ou sala de espera) e animação
// por estado. Sem React, para ser testável.
import type { EstadoMissao } from "../estado.ts";
import type { EstadoAgente } from "../tipos.ts";
import type { Animacao } from "./characters/poses.ts";
import { SETOR_GERAL } from "../setores.ts";
import { mesaDoSetor, posicaoEspera, setorPorId } from "../game/layout.ts";
import { pontoParaTresD } from "./layout3d.ts";

export function animacaoDoEstado(estado: EstadoAgente): Animacao {
  if (estado === "andando") return "caminhando";
  if (estado === "pensando") return "pensando";
  if (estado === "trabalhando" || estado === "usando_ferramenta") return "digitando";
  if (estado === "concluido") return "pulando";
  if (estado === "erro") return "cabeca_baixa";
  if (estado === "aguardando_aprovacao") return "parado";
  return "respirando";
}

// Destino de cada agente: mesa do setor (ocupação compartilhada) ou sala de espera.
export function destinosDosAgentes(estado: EstadoMissao): Map<string, { x: number; z: number }> {
  const destinos = new Map<string, { x: number; z: number }>();
  const ocupacao = new Map<string, number>();
  estado.ordem.forEach((id, indice) => {
    const agente = estado.agentes[id];
    const espera = pontoParaTresD(posicaoEspera(indice));
    if (
      !agente ||
      agente.estado === "ocioso" ||
      agente.setor === SETOR_GERAL ||
      !setorPorId(agente.setor)
    ) {
      destinos.set(id, espera);
      return;
    }
    const ocupados = ocupacao.get(agente.setor) ?? 0;
    ocupacao.set(agente.setor, ocupados + 1);
    const mesa = mesaDoSetor(agente.setor, ocupados);
    destinos.set(id, mesa ? pontoParaTresD(mesa) : espera);
  });
  return destinos;
}
