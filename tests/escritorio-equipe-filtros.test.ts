// Testes da busca, dos filtros, do avatar e da validação de edição da Equipe.
// Sem React, banco ou rede.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { AgentProfile } from "../src/features/escritorio/equipe/tipos.ts";
import {
  FILTROS_PADRAO,
  FILTRO_TODOS,
  filtrarPerfis,
  listarSetores,
  normalizarTexto,
} from "../src/features/escritorio/equipe/filtros.ts";
import { corDoAvatar, iniciaisDoNome } from "../src/features/escritorio/equipe/avatar.ts";
import { validarEdicaoPerfil } from "../src/features/escritorio/equipe/validacaoEdicao.ts";

function perfil(sobrescrever: Partial<AgentProfile>): AgentProfile {
  return {
    agentId: "code-reviewer",
    kind: "agent",
    displayName: "Revisor",
    roleTitle: "Revisor de código",
    summaryPtBr: "Confere qualidade e padrões do código.",
    descriptionPtBr: "Descrição do perfil.",
    whenToUse: ["Depois de escrever código", "Antes de um commit", "Em revisões"],
    sector: "qualidade",
    appearance: { seed: "x" },
    originalDescription: "Original em inglês.",
    sourceHash: "hash",
    edited: false,
    ...sobrescrever,
  };
}

const EQUIPE: AgentProfile[] = [
  perfil({
    agentId: "planner",
    displayName: "Planejador",
    roleTitle: "Planejamento de missões",
    sector: "planejamento",
    summaryPtBr: "Organiza as etapas.",
  }),
  perfil({
    agentId: "code-reviewer",
    displayName: "Revisor",
    roleTitle: "Revisor de código",
    sector: "qualidade",
  }),
  perfil({
    agentId: "security-skill",
    kind: "skill",
    displayName: "Segurança",
    roleTitle: "Análise de segurança",
    sector: "seguranca",
    summaryPtBr: "Procura falhas e segredos expostos.",
  }),
  perfil({
    agentId: "doc-updater",
    displayName: "Documentador",
    roleTitle: "Escrita de docs",
    sector: "docs",
    summaryPtBr: "Atualiza a documentação.",
  }),
];

const SEM_FILTRO = { ...FILTROS_PADRAO, tipo: "todos" as const };

test("normalizarTexto ignora acentos, maiúsculas e espaços nas pontas", () => {
  assert.equal(normalizarTexto("  Planejamento  "), "planejamento");
  assert.equal(normalizarTexto("Análise"), "analise");
});

test("busca encontra por nome, cargo e resumo sem diferenciar acentos", () => {
  const porNome = filtrarPerfis(EQUIPE, { ...SEM_FILTRO, busca: "revisor" });
  const porCargo = filtrarPerfis(EQUIPE, { ...SEM_FILTRO, busca: "analise" });
  const porResumo = filtrarPerfis(EQUIPE, { ...SEM_FILTRO, busca: "SEGREDOS" });
  assert.deepEqual(
    porNome.map((p) => p.agentId),
    ["code-reviewer"],
  );
  assert.deepEqual(
    porCargo.map((p) => p.agentId),
    ["security-skill"],
  );
  assert.deepEqual(
    porResumo.map((p) => p.agentId),
    ["security-skill"],
  );
});

test("busca vazia devolve toda a equipe ordenada pelo nome", () => {
  const todos = filtrarPerfis(EQUIPE, SEM_FILTRO);
  assert.deepEqual(
    todos.map((p) => p.displayName),
    ["Documentador", "Planejador", "Revisor", "Segurança"],
  );
});

test("filtro por setor e por tipo combinam entre si", () => {
  const soSkills = filtrarPerfis(EQUIPE, { ...SEM_FILTRO, tipo: "skill" });
  assert.deepEqual(
    soSkills.map((p) => p.agentId),
    ["security-skill"],
  );

  const setorSemSkill = filtrarPerfis(EQUIPE, { ...SEM_FILTRO, setor: "qualidade", tipo: "skill" });
  assert.deepEqual(setorSemSkill, []);

  const setorAgente = filtrarPerfis(EQUIPE, { ...SEM_FILTRO, setor: "qualidade", tipo: "agent" });
  assert.deepEqual(
    setorAgente.map((p) => p.agentId),
    ["code-reviewer"],
  );
});

test("filtrarPerfis não altera a lista original", () => {
  const ordemOriginal = EQUIPE.map((p) => p.agentId);
  filtrarPerfis(EQUIPE, { ...SEM_FILTRO, busca: "" });
  assert.deepEqual(
    EQUIPE.map((p) => p.agentId),
    ordemOriginal,
  );
});

test("listarSetores devolve setores únicos em ordem alfabética", () => {
  const duplicada = [...EQUIPE, perfil({ agentId: "outro", sector: "docs" })];
  assert.deepEqual(listarSetores(duplicada), ["docs", "planejamento", "qualidade", "seguranca"]);
});

test("filtro de setor com valor 'todos' não restringe a lista", () => {
  const resultado = filtrarPerfis(EQUIPE, { busca: "", setor: FILTRO_TODOS, tipo: FILTRO_TODOS });
  assert.equal(resultado.length, EQUIPE.length);
});

test("iniciais usam as duas primeiras palavras e tratam nome vazio", () => {
  assert.equal(iniciaisDoNome("Ana Planner"), "AP");
  assert.equal(iniciaisDoNome("  revisor  "), "R");
  assert.equal(iniciaisDoNome("   "), "?");
});

test("cor do avatar é estável para o mesmo agente e vem da paleta", () => {
  assert.equal(corDoAvatar("planner"), corDoAvatar("planner"));
  assert.match(corDoAvatar("planner"), /^bg-[a-z]+-\d+ text-/);
});

test("validação aceita um perfil completo e único", () => {
  const valores = {
    displayName: "Ana Planner",
    roleTitle: "Planejadora",
    summaryPtBr: "Organiza as etapas.",
    descriptionPtBr: "Quebra pedidos grandes.",
    sector: "planejamento",
    whenToUse: ["Pedidos longos", "Mudanças grandes", "Falta de plano"],
  };
  assert.deepEqual(validarEdicaoPerfil(valores, ["Revisor"]), { ok: true });
});

test("validação recusa nome já usado por outro agente, sem diferenciar acento", () => {
  const valores = {
    displayName: "  REVISOR ",
    roleTitle: "Revisor",
    summaryPtBr: "Resumo.",
    descriptionPtBr: "Descrição.",
    sector: "qualidade",
    whenToUse: ["Um", "Dois", "Três"],
  };
  const resultado = validarEdicaoPerfil(valores, ["Revisor", "Planejador"]);
  assert.equal(resultado.ok, false);
  if (!resultado.ok)
    assert.equal(resultado.erros.displayName, "Já existe um agente com esse nome.");
});

test("validação aponta exemplo vazio e setor ausente em português", () => {
  const valores = {
    displayName: "Ana",
    roleTitle: "Planejadora",
    summaryPtBr: "Resumo.",
    descriptionPtBr: "Descrição.",
    sector: "   ",
    whenToUse: ["Um", "   ", "Três"],
  };
  const resultado = validarEdicaoPerfil(valores, []);
  assert.equal(resultado.ok, false);
  if (!resultado.ok) {
    assert.equal(resultado.erros.sector, "Informe o setor.");
    assert.ok(resultado.erros["whenToUse.1"]?.includes("obrigatório"));
  }
});
