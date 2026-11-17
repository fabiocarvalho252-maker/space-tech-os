import { test } from "node:test";
import assert from "node:assert/strict";
import { AcessoNegado, exigirAdmin } from "./admin.ts";
import { criarGerenciadorTickets, VALIDADE_TICKET_MS } from "./tickets.ts";

const ADMIN = "admin@spacetech.app";

test("sem cabeçalho Bearer responde 401", async () => {
  await assert.rejects(exigirAdmin(undefined, ADMIN, async () => null), (e: unknown) => e instanceof AcessoNegado && e.status === 401);
});

test("token inválido responde 401", async () => {
  await assert.rejects(exigirAdmin("Bearer xyz", ADMIN, async () => null), (e: unknown) => e instanceof AcessoNegado && e.status === 401);
});

test("usuário válido mas não-admin responde 403", async () => {
  const verificar = async () => ({ id: "u1", email: "cliente@x.com" });
  await assert.rejects(exigirAdmin("Bearer t", ADMIN, verificar), (e: unknown) => e instanceof AcessoNegado && e.status === 403);
});

test("admin passa", async () => {
  const verificar = async () => ({ id: "u1", email: ADMIN });
  const u = await exigirAdmin("Bearer t", ADMIN, verificar);
  assert.equal(u.id, "u1");
});

test("ticket vale uma vez", () => {
  const g = criarGerenciadorTickets(() => 1000);
  const t = g.emitir("u1");
  assert.equal(g.consumir(t.valor), "u1");
  assert.equal(g.consumir(t.valor), null);
});

test("ticket expira após 30 segundos", () => {
  let agora = 1000;
  const g = criarGerenciadorTickets(() => agora);
  const t = g.emitir("u1");
  agora += VALIDADE_TICKET_MS + 1;
  assert.equal(g.consumir(t.valor), null);
});
