// Roteiro falso de uma missão inteira (Fase 1). Simula o Diretor delegando a
// planner → architect → build-error-resolver → code-reviewer → security-reviewer,
// com um pedido de aprovação no meio. Não executa nada de verdade.

import type { EventoEscritorio, EstadoAgente, TipoEvento } from "../tipos.ts";

export const MISSAO_SIMULADA = "missao-simulada";

type Passo = {
  atrasoMs: number;
  agenteId: string;
  tipo: TipoEvento;
  estado?: EstadoAgente | undefined;
  texto?: string | undefined;
  ferramenta?: { nome: string; ok?: boolean } | undefined;
  paiId?: string | undefined;
  aprovacao?: { id: string; ferramenta: string; resumo: string } | undefined;
  resultado?: string | undefined;
};

const RESUMO_FINAL =
  "Plano pronto: a tela de OS ganha filtro por técnico. Arquitetura validada, " +
  "build verde, revisão sem problemas críticos e sem riscos de segurança novos. " +
  "Alterações ficam numa branch separada para você revisar.";

export const ROTEIRO: Passo[] = [
  {
    atrasoMs: 0,
    agenteId: "orchestrator",
    tipo: "missao.iniciada",
    estado: "pensando",
    texto: "Vou dividir o pedido em etapas.",
  },
  { atrasoMs: 900, agenteId: "orchestrator", tipo: "agente.surgiu", texto: "Chamando o planner." },
  {
    atrasoMs: 300,
    agenteId: "planner",
    tipo: "agente.surgiu",
    paiId: "orchestrator",
    estado: "andando",
    texto: "Quebrando em fases.",
  },
  {
    atrasoMs: 1200,
    agenteId: "planner",
    tipo: "ferramenta.iniciada",
    estado: "usando_ferramenta",
    ferramenta: { nome: "Ler arquivos" },
  },
  {
    atrasoMs: 1000,
    agenteId: "planner",
    tipo: "ferramenta.finalizada",
    ferramenta: { nome: "Ler arquivos", ok: true },
  },
  {
    atrasoMs: 500,
    agenteId: "planner",
    tipo: "agente.finalizou",
    estado: "concluido",
    texto: "Plano com 3 etapas.",
  },
  {
    atrasoMs: 600,
    agenteId: "architect",
    tipo: "agente.surgiu",
    paiId: "orchestrator",
    estado: "pensando",
    texto: "Revisando o plano.",
  },
  {
    atrasoMs: 1400,
    agenteId: "architect",
    tipo: "agente.finalizou",
    estado: "concluido",
    texto: "Sem mudança de banco.",
  },
  {
    atrasoMs: 500,
    agenteId: "build-error-resolver",
    tipo: "agente.surgiu",
    paiId: "orchestrator",
    estado: "trabalhando",
    texto: "Rodando o build.",
  },
  {
    atrasoMs: 1300,
    agenteId: "build-error-resolver",
    tipo: "ferramenta.iniciada",
    estado: "usando_ferramenta",
    ferramenta: { nome: "Rodar testes" },
  },
  {
    atrasoMs: 1600,
    agenteId: "build-error-resolver",
    tipo: "ferramenta.finalizada",
    ferramenta: { nome: "Rodar testes", ok: true },
  },
  {
    atrasoMs: 300,
    agenteId: "build-error-resolver",
    tipo: "agente.finalizou",
    estado: "concluido",
    texto: "Build verde.",
  },
  {
    atrasoMs: 500,
    agenteId: "code-reviewer",
    tipo: "agente.surgiu",
    paiId: "orchestrator",
    estado: "trabalhando",
    texto: "Revisando o diff.",
  },
  {
    atrasoMs: 1200,
    agenteId: "code-reviewer",
    tipo: "agente.finalizou",
    estado: "concluido",
    texto: "Nada crítico.",
  },
  {
    atrasoMs: 500,
    agenteId: "security-reviewer",
    tipo: "agente.surgiu",
    paiId: "orchestrator",
    estado: "trabalhando",
    texto: "Conferindo segurança.",
  },
  {
    atrasoMs: 1000,
    agenteId: "security-reviewer",
    tipo: "aprovacao.pedida",
    estado: "aguardando_aprovacao",
    texto: "Preciso editar um arquivo.",
    aprovacao: {
      id: "ap-sim-1",
      ferramenta: "Editar arquivo",
      resumo: "src/features/os/filtros.ts (+12 linhas)",
    },
  },
  {
    atrasoMs: 800,
    agenteId: "security-reviewer",
    tipo: "agente.finalizou",
    estado: "concluido",
    texto: "Sem riscos novos.",
  },
  {
    atrasoMs: 500,
    agenteId: "orchestrator",
    tipo: "missao.concluida",
    estado: "concluido",
    texto: "Pronto.",
    resultado: RESUMO_FINAL,
  },
];

// Gera o evento completo a partir de um passo do roteiro, com id ordenável.
export function eventoDoPasso(passo: Passo, indice: number, agora: Date): EventoEscritorio {
  return {
    id: `${MISSAO_SIMULADA}-${String(indice).padStart(3, "0")}`,
    missaoId: MISSAO_SIMULADA,
    ts: agora.toISOString(),
    agenteId: passo.agenteId,
    agentePaiId: passo.paiId,
    tipo: passo.tipo,
    estado: passo.estado,
    texto: passo.texto,
    ferramenta: passo.ferramenta,
    aprovacao: passo.aprovacao,
    resultado: passo.resultado,
  };
}
