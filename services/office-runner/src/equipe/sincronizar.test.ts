import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AgentProfile } from "../tipos.ts";
import type { ItemCatalogo } from "../catalogo.ts";
import { criarLimiteDiario } from "./cotaDiaria.ts";
import { criarSincronizador, type RepositorioSincronia } from "./sincronizar.ts";
import { hashDoConteudo } from "./sincronizacaoSelecao.ts";

const CONTEUDO_PLANNER = "---\nname: planner\ndescription: Plans\n---\nplanner";
const CONTEUDO_ARCHITECT = "---\nname: architect\ndescription: Designs\n---\narchitect";
const CONTEUDO_TDD = "---\nname: tdd-guide\ndescription: Tests\n---\ntdd";

async function claudeHomeComAgentes(): Promise<string> {
  const home = await mkdtemp(join(tmpdir(), "equipe-sync-"));
  await mkdir(join(home, "agents"));
  await writeFile(join(home, "agents", "planner.md"), CONTEUDO_PLANNER);
  await writeFile(join(home, "agents", "architect.md"), CONTEUDO_ARCHITECT);
  await writeFile(join(home, "agents", "tdd-guide.md"), CONTEUDO_TDD);
  return home;
}

const CATALOGO: ItemCatalogo[] = [
  { id: "architect", nome: "architect", descricao: "Designs", setor: "planejamento", tipo: "agente" },
  { id: "planner", nome: "planner", descricao: "Plans", setor: "planejamento", tipo: "agente" },
  { id: "tdd-guide", nome: "tdd-guide", descricao: "Tests", setor: "qualidade", tipo: "agente" },
];

function salvoBase(agentId: string, extra: Partial<AgentProfile>): AgentProfile {
  return {
    agentId,
    kind: "agent",
    displayName: `Nome ${agentId}`,
    roleTitle: "Cargo",
    summaryPtBr: "Resumo.",
    descriptionPtBr: "Descrição.",
    whenToUse: [],
    sector: "geral",
    appearance: { seed: agentId },
    originalDescription: "",
    sourceHash: "",
    edited: false,
    ...extra,
  };
}

function repositorioFalso(salvos: AgentProfile[], falharEm?: string) {
  const gravados: AgentProfile[] = [];
  const repo: RepositorioSincronia = {
    listar: async () => salvos,
    salvar: async (perfil) => {
      if (perfil.agentId === falharEm) throw new Error("banco fora");
      gravados.push(perfil);
    },
  };
  return { repo, gravados };
}

function perfilJson(agentId: string, displayName: string): Record<string, unknown> {
  return {
    agentId,
    displayName,
    roleTitle: "Estrategista",
    summaryPtBr: "Planeja a produção.",
    descriptionPtBr: "Organiza o conteúdo do Instagram e dos vídeos.",
    whenToUse: ["Roteiro de Reels", "Carrossel de serviços", "Semana de posts"],
  };
}

function criar(opcoes: { home: string; repo: RepositorioSincronia | undefined; gerar: (p: string) => Promise<string>; limite?: number }) {
  return criarSincronizador({
    claudeHome: opcoes.home,
    catalogo: async () => CATALOGO,
    repositorio: opcoes.repo,
    gerar: opcoes.gerar,
    cota: criarLimiteDiario(opcoes.limite ?? 5),
  });
}

test("grava só itens novos ou alterados, pulando editados e hash igual", async () => {
  const home = await claudeHomeComAgentes();
  const salvos = [
    salvoBase("architect", { sourceHash: hashDoConteudo(CONTEUDO_ARCHITECT) }),
    salvoBase("tdd-guide", { sourceHash: "antigo", edited: true }),
  ];
  const { repo, gravados } = repositorioFalso(salvos);
  const prompts: string[] = [];
  const sinc = criar({
    home,
    repo,
    gerar: async (prompt) => {
      prompts.push(prompt);
      return JSON.stringify([perfilJson("planner", "Lucas")]);
    },
  });

  const resposta = await sinc.executar(10);
  assert.equal(resposta.ok, true);
  if (!resposta.ok) return;
  assert.deepEqual(resposta.resultado, { processados: 1, gravados: 1, rejeitados: [], restantes: 0 });
  assert.equal(prompts.length, 1);
  assert.match(prompts[0] ?? "", /"agentId":"planner"/);
  assert.doesNotMatch(prompts[0] ?? "", /"agentId":"tdd-guide"/);
  assert.equal(gravados[0]?.agentId, "planner");
  assert.equal(gravados[0]?.edited, false);
  assert.equal(gravados[0]?.displayName, "Lucas");
  assert.equal(gravados[0]?.sourceHash, hashDoConteudo(CONTEUDO_PLANNER));
});

test("nome repetido no lote é retentado uma vez e depois gravado", async () => {
  const home = await claudeHomeComAgentes();
  const { repo, gravados } = repositorioFalso([]);
  const respostas = [
    JSON.stringify([perfilJson("planner", "Ana"), perfilJson("architect", "Ana")]),
    JSON.stringify([perfilJson("architect", "Bruno")]),
  ];
  let chamadas = 0;
  const sinc = criar({
    home,
    repo,
    gerar: async () => {
      chamadas += 1;
      return respostas.shift() ?? "[]";
    },
  });

  const resposta = await sinc.executar(10);
  assert.equal(chamadas, 2);
  assert.equal(resposta.ok && resposta.resultado.gravados, 2);
  assert.deepEqual(gravados.map((p) => p.displayName).sort(), ["Ana", "Bruno"]);
});

test("item inválido vai para rejeitados com motivo e continua pendente", async () => {
  const home = await claudeHomeComAgentes();
  const { repo, gravados } = repositorioFalso([]);
  const invalido = { ...perfilJson("planner", "Lucas"), whenToUse: ["só um"] };
  const sinc = criar({ home, repo, gerar: async () => JSON.stringify([invalido]) });

  const resposta = await sinc.executar(10);
  assert.equal(gravados.length, 0);
  assert.equal(resposta.ok && resposta.resultado.rejeitados[0]?.agentId, "planner");
  assert.equal(resposta.ok && resposta.resultado.restantes, 3);
});

test("cota diária estourada responde 429 enquanto houver pendências", async () => {
  const home = await claudeHomeComAgentes();
  const { repo } = repositorioFalso([]);
  const sinc = criar({ home, repo, gerar: async () => "[]", limite: 1 });

  assert.equal((await sinc.executar(10)).ok, true);
  const segunda = await sinc.executar(10);
  assert.equal(segunda.ok, false);
  if (!segunda.ok) assert.equal(segunda.status, 429);
});

test("sem pendências não consome a cota", async () => {
  const home = await claudeHomeComAgentes();
  const salvos = CATALOGO.map((item) => {
    const conteudo = item.id === "planner" ? CONTEUDO_PLANNER : item.id === "architect" ? CONTEUDO_ARCHITECT : CONTEUDO_TDD;
    return salvoBase(item.id, { sourceHash: hashDoConteudo(conteudo) });
  });
  const { repo } = repositorioFalso(salvos);
  const cota = criarLimiteDiario(1);
  const sinc = criarSincronizador({ claudeHome: home, catalogo: async () => CATALOGO, repositorio: repo, gerar: async () => "[]", cota });

  const resposta = await sinc.executar(10);
  assert.equal(resposta.ok && resposta.resultado.processados, 0);
  assert.equal(cota.usadosHoje(), 0);
});

test("sem banco responde 503", async () => {
  const home = await claudeHomeComAgentes();
  const sinc = criar({ home, repo: undefined, gerar: async () => "[]" });
  const resposta = await sinc.executar(10);
  assert.equal(resposta.ok, false);
  if (!resposta.ok) assert.equal(resposta.status, 503);
});

test("segunda execução enquanto a primeira roda responde 409", async () => {
  const home = await claudeHomeComAgentes();
  const { repo } = repositorioFalso([]);
  let liberar: () => void = () => undefined;
  let chegouAoModelo: () => void = () => undefined;
  const modeloChamado = new Promise<void>((resolver) => { chegouAoModelo = resolver; });
  const sinc = criar({
    home,
    repo,
    gerar: () => new Promise<string>((resolver) => {
      liberar = () => resolver("[]");
      chegouAoModelo();
    }),
  });

  const primeira = sinc.executar(10);
  await modeloChamado;
  const segunda = await sinc.executar(10);
  assert.equal(segunda.ok, false);
  if (!segunda.ok) assert.equal(segunda.status, 409);
  liberar();
  assert.equal((await primeira).ok, true);
});

test("falha de gravação de um perfil vai para rejeitados sem parar o lote", async () => {
  const home = await claudeHomeComAgentes();
  const { repo, gravados } = repositorioFalso([], "architect");
  const sinc = criar({
    home,
    repo,
    gerar: async () => JSON.stringify([perfilJson("planner", "Lucas"), perfilJson("architect", "Bruna")]),
  });
  const resposta = await sinc.executar(10);
  assert.equal(gravados.map((p) => p.agentId).join(), "planner");
  assert.equal(resposta.ok && resposta.resultado.rejeitados.find((r) => r.agentId === "architect")?.motivo, "falha ao gravar: banco fora");
});
