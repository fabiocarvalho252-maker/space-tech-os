import { test } from "node:test";
import assert from "node:assert/strict";
import { validarEdicao } from "./validacao.ts";

const CORPO_VALIDO = {
  displayName: "  Pauleta ",
  roleTitle: "Planejadora",
  summaryPtBr: "Organiza o trabalho.",
  descriptionPtBr: "Quebra a missão em etapas.",
  whenToUse: ["Antes de codar", "Em features grandes", "Ao replanejar"],
  sector: "planejamento",
};

test("aceita corpo válido e tira espaços das pontas", () => {
  const r = validarEdicao(CORPO_VALIDO);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.valor.displayName, "Pauleta");
});

test("recusa quando quando usar não tem exatamente 3 itens", () => {
  const r = validarEdicao({ ...CORPO_VALIDO, whenToUse: ["a", "b"] });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.erros.join(" "), /exatamente 3 itens/);
});

test("recusa item vazio em quando usar", () => {
  const r = validarEdicao({ ...CORPO_VALIDO, whenToUse: ["a", "   ", "c"] });
  assert.equal(r.ok, false);
});

test("recusa nome acima de 24 caracteres", () => {
  const r = validarEdicao({ ...CORPO_VALIDO, displayName: "x".repeat(25) });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.erros.join(" "), /máximo 24/);
});

test("recusa descrição acima de 1200 caracteres", () => {
  const r = validarEdicao({ ...CORPO_VALIDO, descriptionPtBr: "x".repeat(1201) });
  assert.equal(r.ok, false);
});

test("recusa campo fora da lista editável (ex.: edited ou agentId)", () => {
  assert.equal(validarEdicao({ ...CORPO_VALIDO, edited: false }).ok, false);
  assert.equal(validarEdicao({ ...CORPO_VALIDO, agentId: "outro" }).ok, false);
});

test("recusa corpo ausente ou que não é objeto", () => {
  assert.equal(validarEdicao(undefined).ok, false);
  assert.equal(validarEdicao("texto").ok, false);
});
