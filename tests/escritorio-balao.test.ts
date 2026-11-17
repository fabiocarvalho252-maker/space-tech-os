// Texto do balão de fala na cena 3D.
import { test } from "node:test";
import assert from "node:assert/strict";
import { LIMITE_BALAO, textoDoBalao } from "../src/features/escritorio/scene3d/balao.ts";

test("fala do agente tem prioridade sobre a ferramenta", () => {
  assert.equal(textoDoBalao("Revisando o diff.", "Read"), "Revisando o diff.");
});

test("sem fala, mostra o rótulo da ferramenta em português", () => {
  assert.equal(textoDoBalao(null, "Read"), "Lendo arquivo");
});

test("sem fala e sem ferramenta, não há balão", () => {
  assert.equal(textoDoBalao("   ", null), null);
});

test("fala longa é cortada com reticências", () => {
  const longo = "a".repeat(200);
  const resultado = textoDoBalao(longo, null) ?? "";
  assert.equal(resultado.length, LIMITE_BALAO);
  assert.ok(resultado.endsWith("…"));
});
