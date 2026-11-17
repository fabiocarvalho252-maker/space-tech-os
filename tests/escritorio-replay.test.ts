// Testes do replay com velocidade: cálculo do intervalo entre eventos, ordenação
// e a regra de aviso sonoro. A parte de tempo real (setTimeout) fica no hook.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularAtrasoMs,
  LIMITE_INTERVALO_MS,
  ordenarEventos,
} from "../src/features/escritorio/hooks/useReplay.ts";
import { avisoDaTransicao } from "../src/features/escritorio/som.ts";
import type { EventoEscritorio } from "../src/features/escritorio/tipos.ts";

const BASE = Date.parse("2026-11-17T12:00:00.000Z");

function evento(id: string, deslocamentoMs: number): EventoEscritorio {
  return {
    id,
    missaoId: "m1",
    ts: new Date(BASE + deslocamentoMs).toISOString(),
    agenteId: "planner",
    tipo: "agente.mensagem",
  };
}

test("intervalo real menor que o limite é aplicado como está em 1×", () => {
  const atraso = calcularAtrasoMs(evento("a", 0), evento("b", 800), 1);
  assert.equal(atraso, 800);
});

test("intervalo longo é cortado em 1,5 s antes de aplicar a velocidade", () => {
  const atraso = calcularAtrasoMs(evento("a", 0), evento("b", 60_000), 1);
  assert.equal(atraso, LIMITE_INTERVALO_MS);
});

test("velocidade 2× divide o atraso pela metade", () => {
  assert.equal(calcularAtrasoMs(evento("a", 0), evento("b", 1000), 2), 500);
});

test("velocidade 4× com intervalo longo resulta em 375 ms", () => {
  assert.equal(calcularAtrasoMs(evento("a", 0), evento("b", 120_000), 4), 375);
});

test("intervalo zero ou negativo vira 0 ms", () => {
  assert.equal(calcularAtrasoMs(evento("a", 500), evento("b", 500), 1), 0);
  assert.equal(calcularAtrasoMs(evento("a", 500), evento("b", 100), 2), 0);
});

test("data inválida não gera atraso negativo nem NaN", () => {
  const invalido: EventoEscritorio = { ...evento("x", 0), ts: "não é data" };
  const atraso = calcularAtrasoMs(invalido, evento("b", 1000), 1);
  assert.ok(Number.isFinite(atraso));
  assert.ok(atraso >= 0);
});

test("ordenarEventos coloca os eventos em ordem cronológica", () => {
  const embaralhados = [evento("c", 300), evento("a", 0), evento("b", 100)];
  const ordenados = ordenarEventos(embaralhados);
  assert.deepEqual(
    ordenados.map((e) => e.id),
    ["a", "b", "c"],
  );
});

test("ordenarEventos não altera a lista original", () => {
  const original = [evento("b", 100), evento("a", 0)];
  ordenarEventos(original);
  assert.deepEqual(
    original.map((e) => e.id),
    ["b", "a"],
  );
});

test("eventos com o mesmo horário mantêm a ordem de chegada", () => {
  const lista = [evento("primeiro", 50), evento("segundo", 50), evento("antes", 0)];
  const ordenados = ordenarEventos(lista);
  assert.deepEqual(
    ordenados.map((e) => e.id),
    ["antes", "primeiro", "segundo"],
  );
});

const SEM_APROVACAO = { status: "rodando" as const, aprovacao: null };

test("aviso de aprovação toca quando chega um pedido novo", () => {
  const atual = {
    status: "rodando" as const,
    aprovacao: { id: "ap1", agenteId: "dev", ferramenta: "shell", resumo: "x" },
  };
  assert.equal(avisoDaTransicao(SEM_APROVACAO, atual), "aprovacao");
});

test("aviso de aprovação não repete para o mesmo pedido", () => {
  const pedido = { id: "ap1", agenteId: "dev", ferramenta: "shell", resumo: "x" };
  assert.equal(
    avisoDaTransicao(
      { status: "rodando", aprovacao: pedido },
      { status: "rodando", aprovacao: pedido },
    ),
    null,
  );
});

test("aviso de conclusão toca ao terminar a missão com sucesso ou falha", () => {
  const rodando = SEM_APROVACAO;
  assert.equal(avisoDaTransicao(rodando, { status: "concluida", aprovacao: null }), "conclusao");
  assert.equal(avisoDaTransicao(rodando, { status: "falhou", aprovacao: null }), "conclusao");
});

test("sem mudança relevante não há aviso", () => {
  assert.equal(avisoDaTransicao(SEM_APROVACAO, SEM_APROVACAO), null);
  assert.equal(
    avisoDaTransicao(
      { status: "concluida", aprovacao: null },
      { status: "concluida", aprovacao: null },
    ),
    null,
  );
});
