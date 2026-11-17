import { test } from "node:test";
import assert from "node:assert/strict";
import { criarApp } from "./app.ts";
import { carregarConfig } from "./config.ts";
import type { Consulta } from "./missoes/executar.ts";

const ADMIN = "admin@spacetech.app";
const config = carregarConfig({ SUPABASE_URL: "https://db.example.com", SUPABASE_ANON_KEY: "a".repeat(30), OFFICE_PROJECTS_ROOT: "/tmp/nao-existe" });

async function montar(consulta: Consulta) {
  return criarApp({
    config,
    verificar: async (token) => (token === "admin-token" ? { id: "u1", email: ADMIN } : token === "cliente" ? { id: "u2", email: "cliente@x.com" } : null),
    consulta,
    claudeHome: "/tmp/nao-existe",
    catalogo: async () => [{ id: "planner", nome: "planner", descricao: "", setor: "planejamento", tipo: "agente" }],
  });
}

const auth = { authorization: "Bearer admin-token" };

test("health é público e não expõe dados sensíveis", async () => {
  const app = await montar(() => (async function* () {})());
  const r = await app.inject({ method: "GET", url: "/office-api/health" });
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.includes("SUPABASE"), false);
  await app.close();
});

test("rotas exigem admin: sem token 401, cliente 403", async () => {
  const app = await montar(() => (async function* () {})());
  assert.equal((await app.inject({ method: "GET", url: "/office-api/agents" })).statusCode, 401);
  assert.equal((await app.inject({ method: "GET", url: "/office-api/agents", headers: { authorization: "Bearer cliente" } })).statusCode, 403);
  await app.close();
});

test("admin lista o catálogo", async () => {
  const app = await montar(() => (async function* () {})());
  const r = await app.inject({ method: "GET", url: "/office-api/agents", headers: auth });
  assert.equal(r.statusCode, 200);
  assert.equal(r.json().itens[0].id, "planner");
  await app.close();
});

test("criar missão responde 202 e o replay traz os eventos", async () => {
  const consulta: Consulta = () =>
    (async function* () {
      yield { type: "system", subtype: "init" };
      yield { type: "result", subtype: "success", is_error: false, result: "Pronto", total_cost_usd: 0.01, usage: {} };
    })();
  const app = await montar(consulta);
  const criada = await app.inject({
    method: "POST",
    url: "/office-api/missions",
    headers: auth,
    payload: { prompt: "liste os arquivos", projectId: "loja", mode: "seguro" },
  });
  assert.equal(criada.statusCode, 202);
  const id = criada.json().id as string;
  await new Promise((r) => setTimeout(r, 30));
  const eventos = await app.inject({ method: "GET", url: `/office-api/missions/${id}/events`, headers: auth });
  assert.equal(eventos.statusCode, 200);
  assert.equal(eventos.json().eventos.at(-1).tipo, "missao.concluida");
  await app.close();
});

test("pedido inválido é recusado com 400", async () => {
  const app = await montar(() => (async function* () {})());
  const r = await app.inject({ method: "POST", url: "/office-api/missions", headers: auth, payload: { prompt: "x", projectId: "../etc" } });
  assert.equal(r.statusCode, 400);
  await app.close();
});

test("ticket de WebSocket é emitido só para admin", async () => {
  const app = await montar(() => (async function* () {})());
  assert.equal((await app.inject({ method: "POST", url: "/office-api/ws-ticket", headers: { authorization: "Bearer cliente" } })).statusCode, 403);
  const ok = await app.inject({ method: "POST", url: "/office-api/ws-ticket", headers: auth });
  assert.equal(ok.statusCode, 200);
  assert.ok(ok.json().ticket.length >= 64);
  await app.close();
});

test("aprovação inexistente responde 404", async () => {
  const app = await montar(() => (async function* () {})());
  const r = await app.inject({ method: "POST", url: "/office-api/approvals/nao-existe", headers: auth, payload: { decision: "permitir" } });
  assert.equal(r.statusCode, 404);
  await app.close();
});

test("limite diário bloqueia missões além do permitido", async () => {
  const app = await montar(() => (async function* () {})());
  const corpo = { prompt: "liste os arquivos", projectId: "loja", mode: "seguro" };
  const codigos: number[] = [];
  for (let i = 0; i < config.OFFICE_MAX_MISSOES_DIA + 1; i++) {
    const r = await app.inject({ method: "POST", url: "/office-api/missions", headers: auth, payload: corpo });
    codigos.push(r.statusCode);
  }
  assert.equal(codigos.at(-1), 429);
  await app.close();
});

test("WebSocket: ticket abre o fluxo, entrega eventos da missão e recusa reuso", async () => {
  const consulta: Consulta = () =>
    (async function* () {
      yield { type: "system", subtype: "init" };
      yield { type: "result", subtype: "success", is_error: false, result: "Pronto", total_cost_usd: 0, usage: {} };
    })();
  const app = await montar(consulta);
  await app.listen({ port: 0, host: "127.0.0.1" });
  const endereco = app.server.address();
  const porta = typeof endereco === "object" && endereco ? endereco.port : 0;

  const ticketResp = await app.inject({ method: "POST", url: "/office-api/ws-ticket", headers: auth });
  const ticket = ticketResp.json().ticket as string;

  const tipos: string[] = [];
  const ws = new WebSocket(`ws://127.0.0.1:${porta}/office-ws?ticket=${ticket}`);
  ws.onmessage = (m: MessageEvent) => tipos.push(JSON.parse(String(m.data)).tipo as string);
  await new Promise<void>((ok, falha) => {
    ws.onopen = () => ok();
    ws.onerror = () => falha(new Error("falha ao conectar"));
  });

  await app.inject({ method: "POST", url: "/office-api/missions", headers: auth, payload: { prompt: "liste os arquivos", projectId: "loja", mode: "seguro" } });
  for (let i = 0; i < 50 && !tipos.includes("missao.concluida"); i++) await new Promise((r) => setTimeout(r, 20));
  assert.ok(tipos.includes("missao.iniciada"), "deve receber missão iniciada");
  assert.ok(tipos.includes("missao.concluida"), "deve receber missão concluída");
  ws.close();

  const reuso = new WebSocket(`ws://127.0.0.1:${porta}/office-ws?ticket=${ticket}`);
  const codigo = await new Promise<number>((ok) => {
    reuso.onclose = (e: CloseEvent) => ok(e.code);
  });
  assert.equal(codigo, 4401);
  await app.close();
});
