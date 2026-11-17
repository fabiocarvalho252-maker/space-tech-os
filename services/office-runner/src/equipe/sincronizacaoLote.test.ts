import { test } from "node:test";
import assert from "node:assert/strict";
import { extrairLista, montarPrompt, validarLote, chaveNome } from "./sincronizacaoLote.ts";
import type { ItemSincronia } from "./sincronizacaoSelecao.ts";

function perfil(agentId: string, displayName: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    agentId,
    displayName,
    roleTitle: "Estrategista de conteúdo",
    summaryPtBr: "Planeja a sequência de posts da semana.",
    descriptionPtBr: "Organiza a produção de conteúdo para o Instagram e os vídeos.",
    whenToUse: ["Criar roteiro de Reels", "Planejar carrossel de serviços", "Organizar a semana de posts"],
    ...extra,
  };
}

const IDS = new Set(["planner", "architect"]);

test("aceita um lote válido e mantém o agentId", () => {
  const r = validarLote([perfil("planner", "Lucas"), perfil("architect", "Bruna")], IDS, new Set());
  assert.equal(r.aceitos.length, 2);
  assert.equal(r.rejeitados.length, 0);
  assert.equal(r.aceitos[0]?.agentId, "planner");
});

test("rejeita nome duplicado dentro do lote e marca para nova tentativa", () => {
  const r = validarLote([perfil("planner", "Ana"), perfil("architect", "ana")], IDS, new Set());
  assert.equal(r.aceitos.length, 1);
  assert.equal(r.rejeitados[0]?.agentId, "architect");
  assert.equal(r.rejeitados[0]?.porNome, true);
});

test("rejeita nome já existente no banco, sem diferenciar acento nem maiúscula", () => {
  const ocupados = new Set([chaveNome("Érica")]);
  const r = validarLote([perfil("planner", "erica")], IDS, ocupados);
  assert.equal(r.aceitos.length, 0);
  assert.equal(r.rejeitados[0]?.porNome, true);
});

test("rejeita campo obrigatório faltando com a mensagem em português", () => {
  const sem = perfil("planner", "Lucas");
  delete sem["roleTitle"];
  const r = validarLote([sem], IDS, new Set());
  assert.equal(r.aceitos.length, 0);
  assert.match(r.rejeitados[0]?.motivo ?? "", /roleTitle|Cargo/);
});

test("rejeita whenToUse com 2 itens (exige exatamente 3)", () => {
  const r = validarLote([perfil("planner", "Lucas", { whenToUse: ["Um", "Dois"] })], IDS, new Set());
  assert.equal(r.aceitos.length, 0);
  assert.match(r.rejeitados[0]?.motivo ?? "", /exatamente 3/);
});

test("rejeita agentId fora do lote e marca os ausentes na resposta", () => {
  const r = validarLote([perfil("outro", "Lucas")], IDS, new Set());
  assert.equal(r.rejeitados.find((x) => x.agentId === "outro")?.motivo, "agentId ausente ou fora do lote");
  assert.equal(r.rejeitados.filter((x) => x.motivo === "ausente na resposta do modelo").length, 2);
});

test("extrai o JSON mesmo com texto e cercas de código ao redor", () => {
  const lista = extrairLista('Aqui está:\n```json\n[{"agentId":"planner"}]\n```');
  assert.deepEqual(lista, [{ agentId: "planner" }]);
  assert.equal(extrairLista("sem json nenhum"), null);
  assert.equal(extrairLista("[quebrado"), null);
});

test("o prompt traz os nomes proibidos e o texto original do item", () => {
  const itens: ItemSincronia[] = [{ agentId: "planner", kind: "agent", setor: "planejamento", textoOriginal: "Plan features", sourceHash: "h" }];
  const texto = montarPrompt(itens, ["Lucas", "Bruna"]);
  assert.match(texto, /Lucas, Bruna/);
  assert.match(texto, /Plan features/);
  assert.match(texto, /somente com JSON puro/i);
});
