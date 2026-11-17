import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarMensagem, type ContextoMissao } from "./normalizar.ts";
import { mascararSegredos, truncar } from "./sanitizar.ts";

function ctx(): ContextoMissao {
  let n = 0;
  return {
    missaoId: "m1",
    proximoId: () => `e${++n}`,
    agora: () => "2026-11-17T12:00:00.000Z",
    subagentes: new Map(),
  };
}

test("init vira missão iniciada do Diretor", () => {
  const [e] = normalizarMensagem(ctx(), { type: "system", subtype: "init" });
  assert.equal(e?.tipo, "missao.iniciada");
  assert.equal(e?.agenteId, "orchestrator");
});

test("Task com subagent_type cria agente do ECC ligado ao Diretor", () => {
  const c = ctx();
  const eventos = normalizarMensagem(c, {
    type: "assistant",
    parent_tool_use_id: null,
    message: { content: [{ type: "tool_use", id: "t1", name: "Task", input: { subagent_type: "planner", description: "Planejar" } }] },
  });
  assert.equal(eventos[0]?.tipo, "agente.surgiu");
  assert.equal(eventos[0]?.agenteId, "planner");
  assert.equal(eventos[0]?.agentePaiId, "orchestrator");
  assert.equal(c.subagentes.get("t1"), "planner");
});

test("mensagem dentro de subagente é atribuída ao agente certo", () => {
  const c = ctx();
  c.subagentes.set("t1", "planner");
  const [e] = normalizarMensagem(c, {
    type: "assistant",
    parent_tool_use_id: "t1",
    message: { content: [{ type: "text", text: "Pensando no plano." }] },
  });
  assert.equal(e?.agenteId, "planner");
  assert.equal(e?.tipo, "agente.mensagem");
});

test("tool_result de subagente finaliza o agente; de ferramenta comum, a ferramenta", () => {
  const c = ctx();
  c.subagentes.set("t1", "code-reviewer");
  const fim = normalizarMensagem(c, { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t1", is_error: false }] } });
  assert.equal(fim[0]?.tipo, "agente.finalizou");
  assert.equal(fim[0]?.agenteId, "code-reviewer");
  const ferr = normalizarMensagem(c, { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t9", is_error: true }] } });
  assert.equal(ferr[0]?.tipo, "ferramenta.finalizada");
  assert.equal(ferr[0]?.ferramenta?.ok, false);
});

test("resultado com sucesso vira missão concluída com uso e custo", () => {
  const [e] = normalizarMensagem(ctx(), {
    type: "result",
    subtype: "success",
    is_error: false,
    result: "Tudo certo.",
    total_cost_usd: 0.12,
    usage: { input_tokens: 100, output_tokens: 40 },
  });
  assert.equal(e?.tipo, "missao.concluida");
  assert.equal(e?.resultado, "Tudo certo.");
  assert.deepEqual(e?.uso, { entradaTokens: 100, saidaTokens: 40, custoUsd: 0.12 });
});

test("resultado com erro vira missão falhou", () => {
  const [e] = normalizarMensagem(ctx(), { type: "result", subtype: "error_max_turns", is_error: true, errors: ["limite de turnos"] });
  assert.equal(e?.tipo, "missao.falhou");
  assert.equal(e?.texto, "limite de turnos");
});

test("segredos são mascarados e textos longos são cortados", () => {
  assert.equal(mascararSegredos("use sk-abcdefghijklmnopqrstuv agora"), "use [segredo mascarado] agora");
  assert.equal(mascararSegredos("SUPABASE_SERVICE_ROLE_KEY=abc123"), "[segredo mascarado]");
  assert.equal(truncar("a".repeat(50), 10).length, 10);
  const [e] = normalizarMensagem(ctx(), { type: "assistant", parent_tool_use_id: null, message: { content: [{ type: "text", text: "x".repeat(500) }] } });
  assert.ok((e?.texto ?? "").length <= 120);
});
