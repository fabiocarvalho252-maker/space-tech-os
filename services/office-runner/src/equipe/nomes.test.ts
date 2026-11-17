import { test } from "node:test";
import assert from "node:assert/strict";
import { validarNomeUnico } from "./nomes.ts";

test("aceita nome novo e livre", () => {
  assert.equal(validarNomeUnico("Ana Revisora", ["Bruno"]), null);
});

test("rejeita nome vazio ou só com espaços", () => {
  assert.match(validarNomeUnico("   ", []) ?? "", /Dê um nome/);
});

test("rejeita nome com mais de 24 caracteres", () => {
  assert.match(validarNomeUnico("a".repeat(25), []) ?? "", /máximo 24/);
});

test("aceita exatamente 24 caracteres", () => {
  assert.equal(validarNomeUnico("a".repeat(24), []), null);
});

test("conta caracteres e não bytes (acentos)", () => {
  assert.equal(validarNomeUnico("ção".repeat(8), []), null);
});

test("duplicado ignora maiúsculas, minúsculas e acentos", () => {
  assert.match(validarNomeUnico("  ANA revisora ", ["Ana Revisórã"]) ?? "", /Já existe/);
  assert.match(validarNomeUnico("Revisão", ["revisao"]) ?? "", /Já existe/);
});
