import { test } from "node:test";
import assert from "node:assert/strict";
import type { AgentProfile } from "../tipos.ts";
import { hashDoConteudo, priorizarNaoRejeitados, selecionarPendentes, type ItemSincronia } from "./sincronizacaoSelecao.ts";

function item(id: string, conteudo = `conteudo de ${id}`): ItemSincronia {
  return { agentId: id, kind: "agent", setor: "geral", textoOriginal: conteudo, sourceHash: hashDoConteudo(conteudo) };
}

function salvo(id: string, extra: Partial<AgentProfile> = {}): AgentProfile {
  return {
    agentId: id,
    kind: "agent",
    displayName: `Nome ${id}`,
    roleTitle: "Cargo",
    summaryPtBr: "Resumo.",
    descriptionPtBr: "Descrição.",
    whenToUse: [],
    sector: "geral",
    appearance: { seed: id },
    originalDescription: "",
    sourceHash: "",
    edited: false,
    ...extra,
  };
}

test("seleciona itens sem perfil salvo", () => {
  const selecionados = selecionarPendentes([item("planner")], []);
  assert.deepEqual(selecionados.map((i) => i.agentId), ["planner"]);
});

test("pula item cujo hash do texto original é igual ao salvo", () => {
  const novo = item("architect");
  const selecionados = selecionarPendentes([novo], [salvo("architect", { sourceHash: novo.sourceHash })]);
  assert.equal(selecionados.length, 0);
});

test("pula item editado pelo administrador mesmo com hash diferente", () => {
  const selecionados = selecionarPendentes([item("tdd-guide")], [salvo("tdd-guide", { sourceHash: "antigo", edited: true })]);
  assert.equal(selecionados.length, 0);
});

test("seleciona item não editado cujo texto original mudou", () => {
  const selecionados = selecionarPendentes([item("code-reviewer")], [salvo("code-reviewer", { sourceHash: "antigo" })]);
  assert.deepEqual(selecionados.map((i) => i.agentId), ["code-reviewer"]);
});

test("itens rejeitados na rodada anterior vão para o fim da fila", () => {
  const itens = [item("a"), item("b"), item("c")];
  const ordem = priorizarNaoRejeitados(itens, new Set(["a"])).map((i) => i.agentId);
  assert.deepEqual(ordem, ["b", "c", "a"]);
});
