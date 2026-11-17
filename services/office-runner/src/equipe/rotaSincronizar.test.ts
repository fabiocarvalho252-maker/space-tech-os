import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registrarRotaSincronizar } from "./rotaSincronizar.ts";
import type { RespostaSincronia, Sincronizador } from "./sincronizar.ts";

async function montar(resposta: RespostaSincronia | Error, chamadas: number[]) {
  const app = Fastify();
  const sincronizador: Sincronizador = {
    executar: async (tamanho) => {
      chamadas.push(tamanho);
      if (resposta instanceof Error) throw resposta;
      return resposta;
    },
  };
  registrarRotaSincronizar(app, async () => ({ id: "u1" }), sincronizador);
  return app;
}

const VAZIO = { ok: true as const, resultado: { processados: 0, gravados: 0, rejeitados: [], restantes: 0 } };

test("lote padrão é 10 e a resposta traz o resultado", async () => {
  const chamadas: number[] = [];
  const app = await montar(VAZIO, chamadas);
  const r = await app.inject({ method: "POST", url: "/office-api/equipe/sincronizar" });
  assert.equal(r.statusCode, 200);
  assert.deepEqual(chamadas, [10]);
  assert.deepEqual(r.json(), VAZIO.resultado);
  await app.close();
});

test("lote fora da faixa 1–10 responde 400", async () => {
  const chamadas: number[] = [];
  const app = await montar(VAZIO, chamadas);
  const r = await app.inject({ method: "POST", url: "/office-api/equipe/sincronizar?lote=11" });
  assert.equal(r.statusCode, 400);
  assert.equal(chamadas.length, 0);
  await app.close();
});

test("cota estourada responde 429 com a mensagem", async () => {
  const app = await montar({ ok: false, status: 429, erro: "Limite diário de lotes da Equipe atingido. Tente amanhã." }, []);
  const r = await app.inject({ method: "POST", url: "/office-api/equipe/sincronizar?lote=3" });
  assert.equal(r.statusCode, 429);
  assert.match(r.json().erro, /Limite diário/);
  await app.close();
});

test("falha do Claude responde 502 sem vazar detalhes", async () => {
  const app = await montar(new Error("cota do plano Pro atingida por hoje"), []);
  const r = await app.inject({ method: "POST", url: "/office-api/equipe/sincronizar" });
  assert.equal(r.statusCode, 502);
  assert.equal(r.body.includes("plano Pro"), false);
  await app.close();
});
