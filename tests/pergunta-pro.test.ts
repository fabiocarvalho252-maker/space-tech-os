// "Pergunte ao Claude" só usa o plano Pro: sem chave de API no ambiente do
// processo filho e com teto diário de perguntas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ambienteSemChaveApi, dentroDoLimiteDiario } from "../src/lib/marketing/ig-pergunta.server.ts";

test("ambiente do Claude não recebe nenhuma chave de API", () => {
  const limpo = ambienteSemChaveApi({
    ANTHROPIC_API_KEY: "a",
    ANTHROPIC_AUTH_TOKEN: "b",
    AI_API_KEY: "c",
    HOME: "/root",
  });
  assert.equal("ANTHROPIC_API_KEY" in limpo, false);
  assert.equal("AI_API_KEY" in limpo, false);
  assert.equal(limpo["HOME"], "/root");
});

test("teto diário bloqueia a partir da quinta pergunta do dia", () => {
  const dia = new Date("2031-01-02T10:00:00Z");
  const respostas = [1, 2, 3, 4, 5, 6].map(() => dentroDoLimiteDiario(dia));
  assert.deepEqual(respostas, [true, true, true, true, true, false]);
  assert.equal(dentroDoLimiteDiario(new Date("2031-01-03T10:00:00Z")), true);
});
