import { test } from "node:test";
import assert from "node:assert/strict";
import { criarLimiteDiario } from "./cotaDiaria.ts";

test("bloqueia depois do máximo de lotes no dia", () => {
  const cota = criarLimiteDiario(2, () => new Date("2026-11-17T10:00:00Z"));
  assert.equal(cota.tentar(), true);
  assert.equal(cota.tentar(), true);
  assert.equal(cota.tentar(), false);
  assert.equal(cota.usadosHoje(), 2);
});

test("zera a contagem no dia seguinte (UTC)", () => {
  let agora = new Date("2026-11-17T23:59:00Z");
  const cota = criarLimiteDiario(1, () => agora);
  assert.equal(cota.tentar(), true);
  assert.equal(cota.tentar(), false);
  agora = new Date("2026-11-18T00:01:00Z");
  assert.equal(cota.tentar(), true);
});
