// Testes da lógica do Escritório IA (Fase 1): estado puro, roteiro simulado,
// aprovação e cancelamento. Não dependem de navegador nem de Phaser.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ESTADO_INICIAL,
  aplicarEvento,
  aplicarEventos,
} from "../src/features/escritorio/estado.ts";
import { criarSimulador } from "../src/features/escritorio/simulador.ts";
import {
  eventoDoPasso,
  ROTEIRO,
  MISSAO_SIMULADA,
} from "../src/features/escritorio/mock/roteiro.ts";
import { setorDe, SETOR_GERAL } from "../src/features/escritorio/setores.ts";
import type { EventoEscritorio } from "../src/features/escritorio/tipos.ts";

const AGORA = new Date("2026-11-17T12:00:00Z");

function evento(
  parcial: Partial<EventoEscritorio> & Pick<EventoEscritorio, "id" | "agenteId" | "tipo">,
): EventoEscritorio {
  return { missaoId: "m1", ts: AGORA.toISOString(), ...parcial };
}

test("evento repetido com o mesmo id não muda o estado", () => {
  const e = evento({ id: "a", agenteId: "planner", tipo: "agente.surgiu", estado: "andando" });
  const uma = aplicarEvento(ESTADO_INICIAL, e);
  const duas = aplicarEvento(uma, e);
  assert.equal(duas, uma);
  assert.equal(duas.eventos.length, 1);
});

test("estado é imutável: o original não muda ao aplicar um evento", () => {
  const e = evento({ id: "a", agenteId: "planner", tipo: "agente.surgiu" });
  aplicarEvento(ESTADO_INICIAL, e);
  assert.equal(ESTADO_INICIAL.eventos.length, 0);
  assert.deepEqual(ESTADO_INICIAL.agentes, {});
});

test("agente novo entra no setor certo e na ordem de chegada", () => {
  const s = aplicarEventos(ESTADO_INICIAL, [
    evento({ id: "1", agenteId: "planner", tipo: "agente.surgiu", estado: "andando" }),
    evento({ id: "2", agenteId: "agente-desconhecido", tipo: "agente.surgiu" }),
  ]);
  assert.deepEqual(s.ordem, ["planner", "agente-desconhecido"]);
  assert.equal(s.agentes["planner"].setor, "planejamento");
  assert.equal(s.agentes["agente-desconhecido"].setor, SETOR_GERAL);
});

test("ferramenta iniciada e finalizada atualizam o agente", () => {
  const s = aplicarEventos(ESTADO_INICIAL, [
    evento({ id: "1", agenteId: "planner", tipo: "agente.surgiu", estado: "trabalhando" }),
    evento({
      id: "2",
      agenteId: "planner",
      tipo: "ferramenta.iniciada",
      ferramenta: { nome: "Ler arquivos" },
    }),
  ]);
  assert.equal(s.agentes["planner"].estado, "usando_ferramenta");
  assert.equal(s.agentes["planner"].ferramenta, "Ler arquivos");
  const f = aplicarEvento(
    s,
    evento({ id: "3", agenteId: "planner", tipo: "ferramenta.finalizada" }),
  );
  assert.equal(f.agentes["planner"].estado, "trabalhando");
  assert.equal(f.agentes["planner"].ferramenta, null);
});

test("pedido de aprovação fica pendente até ser respondido", () => {
  const pedido = evento({
    id: "p1",
    agenteId: "security-reviewer",
    tipo: "aprovacao.pedida",
    estado: "aguardando_aprovacao",
    aprovacao: { id: "ap1", ferramenta: "Editar arquivo", resumo: "x.ts" },
  });
  const s = aplicarEvento(ESTADO_INICIAL, pedido);
  assert.equal(s.aprovacao?.id, "ap1");
  assert.equal(s.agentes["security-reviewer"].estado, "aguardando_aprovacao");
  const r = aplicarEvento(
    s,
    evento({
      id: "r1",
      agenteId: "security-reviewer",
      tipo: "aprovacao.respondida",
      estado: "trabalhando",
    }),
  );
  assert.equal(r.aprovacao, null);
});

test("missão de outro id começa uma tela limpa", () => {
  const s1 = aplicarEvento(
    ESTADO_INICIAL,
    evento({ id: "a", missaoId: "m1", agenteId: "planner", tipo: "agente.surgiu" }),
  );
  const s2 = aplicarEvento(
    s1,
    evento({ id: "b", missaoId: "m2", agenteId: "architect", tipo: "agente.surgiu" }),
  );
  assert.deepEqual(s2.ordem, ["architect"]);
  assert.equal(s2.missaoId, "m2");
});

test("missão concluída guarda o resultado e marca status", () => {
  const s = aplicarEvento(
    ESTADO_INICIAL,
    evento({ id: "c", agenteId: "orchestrator", tipo: "missao.concluida", resultado: "pronto" }),
  );
  assert.equal(s.status, "concluida");
  assert.equal(s.resultado, "pronto");
});

test("setorDe manda agentes não mapeados para 'geral'", () => {
  assert.equal(setorDe("code-reviewer"), "qualidade");
  assert.equal(setorDe("nao-existe"), SETOR_GERAL);
});

test("roteiro simulado termina concluído, sem aprovação pendente e com todos em 'concluido'", async () => {
  const recebidos: EventoEscritorio[] = [];
  let estado = ESTADO_INICIAL;
  const fim = new Promise<void>((resolve) => {
    const sim = criarSimulador({
      fator: 0,
      agora: () => AGORA,
      onEvento: (e) => {
        recebidos.push(e);
        estado = aplicarEvento(estado, e);
        if (e.tipo === "aprovacao.pedida") setImmediate(() => sim.decidir("permitir"));
        if (e.tipo === "missao.concluida") resolve();
      },
    });
    sim.iniciar();
  });
  await fim;
  assert.equal(estado.status, "concluida");
  assert.equal(estado.aprovacao, null);
  assert.ok(estado.resultado && estado.resultado.length > 20);
  assert.equal(estado.agentes["planner"].estado, "concluido");
  assert.ok(recebidos.some((e) => e.tipo === "aprovacao.respondida"));
  assert.equal(recebidos.length, ROTEIRO.length + 1); // +1: resposta da aprovação
});

test("negar aprovação segue o roteiro sem editar", async () => {
  let respondido: string | undefined;
  await new Promise<void>((resolve) => {
    const sim = criarSimulador({
      fator: 0,
      agora: () => AGORA,
      onEvento: (e) => {
        if (e.tipo === "aprovacao.pedida") setImmediate(() => sim.decidir("negar"));
        if (e.tipo === "aprovacao.respondida") respondido = e.texto;
        if (e.tipo === "missao.concluida") resolve();
      },
    });
    sim.iniciar();
  });
  assert.equal(respondido, "Negado. Pulando a edição.");
});

test("cancelar para a simulação e emite missao.cancelada", async () => {
  const tipos: string[] = [];
  const sim = criarSimulador({
    fator: 1,
    agora: () => AGORA,
    onEvento: (e) => tipos.push(e.tipo),
  });
  sim.iniciar();
  sim.cancelar();
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(tipos, ["missao.cancelada"]);
});

test("passos do roteiro geram ids ordenáveis da mesma missão", () => {
  const e0 = eventoDoPasso(ROTEIRO[0], 0, AGORA);
  const e1 = eventoDoPasso(ROTEIRO[1], 1, AGORA);
  assert.equal(e0.missaoId, MISSAO_SIMULADA);
  assert.ok(e0.id < e1.id);
});

test("cancelar com aprovação aberta fecha o pedido e tira agentes de 'trabalhando'", () => {
  const s = aplicarEventos(ESTADO_INICIAL, [
    evento({ id: "1", agenteId: "planner", tipo: "agente.surgiu", estado: "trabalhando" }),
    evento({
      id: "2",
      agenteId: "security-reviewer",
      tipo: "aprovacao.pedida",
      estado: "aguardando_aprovacao",
      aprovacao: { id: "ap9", ferramenta: "Editar arquivo", resumo: "a.ts" },
    }),
    evento({ id: "3", agenteId: "orchestrator", tipo: "missao.cancelada" }),
  ]);
  assert.equal(s.status, "cancelada");
  assert.equal(s.aprovacao, null);
  assert.equal(s.agentes["planner"].estado, "ocioso");
  assert.equal(s.agentes["security-reviewer"].estado, "ocioso");
});

test("missão concluída deixa agentes ativos como 'concluido'", () => {
  const s = aplicarEventos(ESTADO_INICIAL, [
    evento({ id: "1", agenteId: "planner", tipo: "agente.surgiu", estado: "trabalhando" }),
    evento({ id: "2", agenteId: "orchestrator", tipo: "missao.concluida", resultado: "ok" }),
  ]);
  assert.equal(s.agentes["planner"].estado, "concluido");
});
