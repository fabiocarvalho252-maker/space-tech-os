import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { AcessoNegado, exigirAdmin, type VerificarToken } from "../autenticacao/admin.ts";
import type { ItemCatalogo } from "../catalogo.ts";
import type { AgentProfile } from "../tipos.ts";
import { MSG_SEM_BANCO, registrarRotasEquipe } from "./rotas.ts";
import type { RepositorioEquipe } from "./repositorio.ts";
import { perfilPadrao } from "./perfis.ts";

const ADMIN = "admin@spacetech.app";
const CATALOGO: ItemCatalogo[] = [
  { id: "planner", nome: "planner", descricao: "Planeja", setor: "planejamento", tipo: "agente" },
  { id: "tdd-guide", nome: "tdd-guide", descricao: "Testes", setor: "qualidade", tipo: "agente" },
];

const verificar: VerificarToken = async (token) =>
  token === "admin-token" ? { id: "u1", email: ADMIN } : token === "cliente" ? { id: "u2", email: "cliente@x.com" } : null;

const CORPO = {
  displayName: "Pauleta",
  roleTitle: "Planejadora",
  summaryPtBr: "Organiza o trabalho.",
  descriptionPtBr: "Quebra a missão em etapas.",
  whenToUse: ["Antes de codar", "Em features grandes", "Ao replanejar"],
  sector: "planejamento",
};

const AUTH = { authorization: "Bearer admin-token" };

function repositorioEmMemoria(iniciais: AgentProfile[] = []) {
  const guardados = new Map(iniciais.map((p) => [p.agentId, p] as const));
  const repositorio: RepositorioEquipe = {
    listar: async () => [...guardados.values()],
    salvar: async (perfil) => {
      guardados.set(perfil.agentId, perfil);
    },
  };
  return { repositorio, guardados };
}

async function montar(repositorio: RepositorioEquipe | undefined): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setErrorHandler((erro, _request, reply) => {
    if (erro instanceof AcessoNegado) return reply.code(erro.status).send({ erro: erro.message });
    return reply.code(500).send({ erro: "Erro interno." });
  });
  registrarRotasEquipe(app, {
    exigir: (request: FastifyRequest) => exigirAdmin(request.headers.authorization, ADMIN, verificar),
    catalogo: async () => CATALOGO,
    repositorio,
  });
  await app.ready();
  return app;
}

test("GET e PATCH sem token respondem 401", async () => {
  const app = await montar(undefined);
  assert.equal((await app.inject({ method: "GET", url: "/office-api/equipe" })).statusCode, 401);
  assert.equal((await app.inject({ method: "PATCH", url: "/office-api/equipe/planner", payload: CORPO })).statusCode, 401);
  await app.close();
});

test("GET e PATCH com cliente comum respondem 403", async () => {
  const app = await montar(undefined);
  const cliente = { authorization: "Bearer cliente" };
  assert.equal((await app.inject({ method: "GET", url: "/office-api/equipe", headers: cliente })).statusCode, 403);
  assert.equal((await app.inject({ method: "PATCH", url: "/office-api/equipe/planner", headers: cliente, payload: CORPO })).statusCode, 403);
  await app.close();
});

test("GET sem banco devolve o catálogo como perfis não salvos", async () => {
  const app = await montar(undefined);
  const r = await app.inject({ method: "GET", url: "/office-api/equipe", headers: AUTH });
  assert.equal(r.statusCode, 200);
  const corpo = r.json() as { perfis: (AgentProfile & { salvo: boolean })[]; bancoDisponivel: boolean };
  assert.equal(corpo.bancoDisponivel, false);
  assert.deepEqual(corpo.perfis.map((p) => [p.agentId, p.displayName, p.salvo]), [
    ["planner", "planner", false],
    ["tdd-guide", "tdd-guide", false],
  ]);
  await app.close();
});

test("GET com banco mescla o perfil salvo", async () => {
  const salvo: AgentProfile = { ...perfilPadrao(CATALOGO[0] as ItemCatalogo), displayName: "Pauleta", edited: true };
  const { repositorio } = repositorioEmMemoria([salvo]);
  const app = await montar(repositorio);
  const corpo = (await app.inject({ method: "GET", url: "/office-api/equipe", headers: AUTH })).json() as {
    perfis: { agentId: string; displayName: string; salvo: boolean }[];
  };
  assert.equal(corpo.perfis[0]?.displayName, "Pauleta");
  assert.equal(corpo.perfis[0]?.salvo, true);
  assert.equal(corpo.perfis[1]?.salvo, false);
  await app.close();
});

test("PATCH sem banco responde 503 com mensagem clara", async () => {
  const app = await montar(undefined);
  const r = await app.inject({ method: "PATCH", url: "/office-api/equipe/planner", headers: AUTH, payload: CORPO });
  assert.equal(r.statusCode, 503);
  assert.equal(r.json().erro, MSG_SEM_BANCO);
  await app.close();
});

test("PATCH com corpo inválido responde 400 antes de tocar no banco", async () => {
  const { repositorio, guardados } = repositorioEmMemoria();
  const app = await montar(repositorio);
  const r = await app.inject({
    method: "PATCH",
    url: "/office-api/equipe/planner",
    headers: AUTH,
    payload: { ...CORPO, whenToUse: ["só um"] },
  });
  assert.equal(r.statusCode, 400);
  assert.equal(guardados.size, 0);
  await app.close();
});

test("PATCH de agente fora do catálogo responde 404", async () => {
  const { repositorio } = repositorioEmMemoria();
  const app = await montar(repositorio);
  const r = await app.inject({ method: "PATCH", url: "/office-api/equipe/inventado", headers: AUTH, payload: CORPO });
  assert.equal(r.statusCode, 404);
  await app.close();
});

test("PATCH com nome já usado por outro agente responde 409", async () => {
  const { repositorio } = repositorioEmMemoria();
  const app = await montar(repositorio);
  const r = await app.inject({
    method: "PATCH",
    url: "/office-api/equipe/tdd-guide",
    headers: AUTH,
    payload: { ...CORPO, displayName: "PLANNER" },
  });
  assert.equal(r.statusCode, 409);
  await app.close();
});

test("PATCH válido grava com edited true e devolve o perfil", async () => {
  const { repositorio, guardados } = repositorioEmMemoria();
  const app = await montar(repositorio);
  const r = await app.inject({ method: "PATCH", url: "/office-api/equipe/planner", headers: AUTH, payload: CORPO });
  assert.equal(r.statusCode, 200);
  const gravado = guardados.get("planner");
  assert.equal(gravado?.edited, true);
  assert.equal(gravado?.displayName, "Pauleta");
  assert.equal(gravado?.originalDescription, "Planeja");
  assert.equal(r.json().perfil.salvo, true);
  await app.close();
});
