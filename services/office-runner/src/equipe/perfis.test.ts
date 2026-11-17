import { test } from "node:test";
import assert from "node:assert/strict";
import { aplicarEdicao, mesclarEquipe, perfilPadrao } from "./perfis.ts";
import type { ItemCatalogo } from "../catalogo.ts";
import type { AgentProfile } from "../tipos.ts";

const PLANNER: ItemCatalogo = { id: "planner", nome: "planner", descricao: "Planeja", setor: "planejamento", tipo: "agente" };
const TDD: ItemCatalogo = { id: "tdd", nome: "tdd", descricao: "Testes", setor: "qualidade", tipo: "skill" };

function perfilSalvo(): AgentProfile {
  return { ...perfilPadrao(PLANNER), displayName: "Pauleta", roleTitle: "Planejadora", edited: true };
}

test("perfil padrão usa o id como nome e marca como não editado", () => {
  const perfil = perfilPadrao(PLANNER);
  assert.equal(perfil.displayName, "planner");
  assert.equal(perfil.kind, "agent");
  assert.equal(perfil.edited, false);
  assert.equal(perfil.originalDescription, "Planeja");
});

test("skill vira kind skill", () => {
  assert.equal(perfilPadrao(TDD).kind, "skill");
});

test("hash da descrição é estável e muda com o texto", () => {
  assert.equal(perfilPadrao(PLANNER).sourceHash, perfilPadrao({ ...PLANNER }).sourceHash);
  assert.notEqual(perfilPadrao(PLANNER).sourceHash, perfilPadrao({ ...PLANNER, descricao: "Outro" }).sourceHash);
});

test("mescla: perfil salvo tem prioridade e os demais ficam não salvos", () => {
  const equipe = mesclarEquipe([PLANNER, TDD], [perfilSalvo()]);
  assert.equal(equipe.length, 2);
  assert.equal(equipe[0]?.salvo, true);
  assert.equal(equipe[0]?.displayName, "Pauleta");
  assert.equal(equipe[1]?.salvo, false);
  assert.equal(equipe[1]?.displayName, "tdd");
});

test("mescla ignora perfis salvos de agentes que saíram do catálogo", () => {
  const equipe = mesclarEquipe([TDD], [perfilSalvo()]);
  assert.deepEqual(equipe.map((p) => p.agentId), ["tdd"]);
});

test("aplicar edição não muda o perfil original e marca edited", () => {
  const base = perfilPadrao(PLANNER);
  const editado = aplicarEdicao(base, {
    displayName: "Pauleta",
    roleTitle: "Planejadora",
    summaryPtBr: "Resumo",
    descriptionPtBr: "Descrição",
    whenToUse: ["a", "b", "c"],
    sector: "planejamento",
  });
  assert.equal(editado.edited, true);
  assert.equal(editado.displayName, "Pauleta");
  assert.equal(base.displayName, "planner");
  assert.equal(base.edited, false);
});
