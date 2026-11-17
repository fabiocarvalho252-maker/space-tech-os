// Estado do escritório como função pura: cada evento gera um novo estado
// (sem mutação) e eventos repetidos com o mesmo id são ignorados.

import { setorDe } from "./setores.ts";
import type { AgenteVisual, EstadoAgente, EventoEscritorio, StatusMissao } from "./tipos.ts";

const ESTADOS_ATIVOS: EstadoAgente[] = [
  "andando",
  "pensando",
  "trabalhando",
  "usando_ferramenta",
  "aguardando_aprovacao",
];

// Ao terminar a missão, ninguém continua "trabalhando" nem com aprovação aberta.
function encerrarAgentes(
  agentes: Record<string, AgenteVisual>,
  concluida: boolean,
): Record<string, AgenteVisual> {
  const destino: EstadoAgente = concluida ? "concluido" : "ocioso";
  const resultado: Record<string, AgenteVisual> = {};
  for (const [id, agente] of Object.entries(agentes)) {
    resultado[id] = ESTADOS_ATIVOS.includes(agente.estado)
      ? { ...agente, estado: destino, ferramenta: null }
      : agente;
  }
  return resultado;
}

export type PedidoAprovacao = {
  id: string;
  agenteId: string;
  ferramenta: string;
  resumo: string;
};

export type EstadoMissao = {
  status: StatusMissao;
  missaoId: string | null;
  agentes: Record<string, AgenteVisual>;
  ordem: string[];
  eventos: EventoEscritorio[];
  vistos: Record<string, true>;
  aprovacao: PedidoAprovacao | null;
  resultado: string | null;
};

export const ESTADO_INICIAL: EstadoMissao = {
  status: "ocioso",
  missaoId: null,
  agentes: {},
  ordem: [],
  eventos: [],
  vistos: {},
  aprovacao: null,
  resultado: null,
};

function agenteAtual(estado: EstadoMissao, id: string): AgenteVisual {
  return (
    estado.agentes[id] ?? {
      id,
      nome: id,
      setor: setorDe(id),
      estado: "ocioso",
      texto: null,
      ferramenta: null,
      paiId: null,
    }
  );
}

function comAgente(
  estado: EstadoMissao,
  id: string,
  mudanca: Partial<Omit<AgenteVisual, "id" | "nome" | "setor">>,
): Pick<EstadoMissao, "agentes" | "ordem"> {
  const atual = agenteAtual(estado, id);
  const novo: AgenteVisual = { ...atual, ...mudanca };
  const jaExiste = id in estado.agentes;
  return {
    agentes: { ...estado.agentes, [id]: novo },
    ordem: jaExiste ? estado.ordem : [...estado.ordem, id],
  };
}

// Mudanças de estado do agente que cada tipo de evento provoca.
function mudancaDoAgente(
  estado: EstadoMissao,
  evento: EventoEscritorio,
): Partial<Omit<AgenteVisual, "id" | "nome" | "setor">> | null {
  const atual = agenteAtual(estado, evento.agenteId);
  switch (evento.tipo) {
    case "agente.surgiu":
      return {
        estado: evento.estado ?? "pensando",
        texto: evento.texto ?? atual.texto,
        paiId: evento.agentePaiId ?? atual.paiId,
      };
    case "agente.estado":
    case "agente.mensagem":
    case "agente.finalizou":
      return {
        estado: evento.estado ?? atual.estado,
        texto: evento.texto ?? atual.texto,
        ferramenta: evento.tipo === "agente.finalizou" ? null : atual.ferramenta,
      };
    case "ferramenta.iniciada":
      return { estado: "usando_ferramenta", ferramenta: evento.ferramenta?.nome ?? null };
    case "ferramenta.finalizada":
      return {
        estado: atual.estado === "usando_ferramenta" ? "trabalhando" : atual.estado,
        ferramenta: null,
      };
    case "aprovacao.pedida":
      return { estado: "aguardando_aprovacao", texto: evento.texto ?? atual.texto };
    case "aprovacao.respondida":
      return { estado: evento.estado ?? "trabalhando", texto: evento.texto ?? atual.texto };
    default:
      return null;
  }
}

function estadoDaMissao(
  evento: EventoEscritorio,
): Pick<EstadoMissao, "status" | "resultado"> | null {
  switch (evento.tipo) {
    case "missao.iniciada":
    case "missao.criada":
      return { status: "rodando", resultado: null };
    case "missao.concluida":
      return { status: "concluida", resultado: evento.resultado ?? null };
    case "missao.falhou":
      return { status: "falhou", resultado: null };
    case "missao.cancelada":
      return { status: "cancelada", resultado: null };
    default:
      return null;
  }
}

export function aplicarEvento(estado: EstadoMissao, evento: EventoEscritorio): EstadoMissao {
  if (estado.vistos[evento.id]) return estado;

  // Um evento de outra missão começa uma tela limpa.
  const base: EstadoMissao =
    estado.missaoId && estado.missaoId !== evento.missaoId
      ? { ...ESTADO_INICIAL, missaoId: evento.missaoId }
      : { ...estado, missaoId: evento.missaoId };

  const proximo: EstadoMissao = {
    ...base,
    eventos: [...base.eventos, evento],
    vistos: { ...base.vistos, [evento.id]: true },
  };

  const missao = estadoDaMissao(evento);
  const comMissao = missao ? { ...proximo, ...missao } : proximo;

  const mudanca = mudancaDoAgente(comMissao, evento);
  const comAgentes0 = mudanca
    ? { ...comMissao, ...comAgente(comMissao, evento.agenteId, mudanca) }
    : comMissao;

  const terminou = comMissao.status !== "rodando" && comMissao.status !== "ocioso";
  const comAgentes = terminou
    ? {
        ...comAgentes0,
        agentes: encerrarAgentes(comAgentes0.agentes, comMissao.status === "concluida"),
        aprovacao: null,
      }
    : comAgentes0;

  if (evento.tipo === "aprovacao.pedida" && evento.aprovacao) {
    return {
      ...comAgentes,
      aprovacao: {
        id: evento.aprovacao.id,
        agenteId: evento.agenteId,
        ferramenta: evento.aprovacao.ferramenta,
        resumo: evento.aprovacao.resumo,
      },
    };
  }
  if (evento.tipo === "aprovacao.respondida") {
    return { ...comAgentes, aprovacao: null };
  }
  return comAgentes;
}

export function aplicarEventos(
  estado: EstadoMissao,
  eventos: readonly EventoEscritorio[],
): EstadoMissao {
  return eventos.reduce(aplicarEvento, estado);
}
