import { test } from "node:test";
import assert from "node:assert/strict";
import { argumentosClaude, caminhoClaude, CAMINHO_CLAUDE_PADRAO, TIMEOUT_LOTE_MS } from "./claudeCli.ts";
import { ambienteSemChaveApi } from "../missoes/executar.ts";

test("o processo filho não recebe nenhuma chave de API", () => {
  const ambiente = ambienteSemChaveApi({
    ANTHROPIC_API_KEY: "chave",
    ANTHROPIC_AUTH_TOKEN: "token",
    AI_API_KEY: "outra",
    SUPABASE_SERVICE_ROLE_KEY: "segredo",
    PATH: "/usr/bin",
    HOME: "/root",
  });
  assert.equal("ANTHROPIC_API_KEY" in ambiente, false);
  assert.equal("ANTHROPIC_AUTH_TOKEN" in ambiente, false);
  assert.equal("AI_API_KEY" in ambiente, false);
  assert.equal("SUPABASE_SERVICE_ROLE_KEY" in ambiente, false);
  assert.equal(ambiente["HOME"], "/root");
});

test("a CLI roda em modo texto sem ferramentas", () => {
  const args = argumentosClaude();
  assert.ok(args.includes("--print"));
  const posicao = args.indexOf("--tools");
  assert.notEqual(posicao, -1);
  assert.equal(args[posicao + 1], "");
});

test("caminho do binário vem de CLAUDE_BIN, com padrão na VPS", () => {
  assert.equal(caminhoClaude({ CLAUDE_BIN: "/opt/claude" }), "/opt/claude");
  assert.equal(caminhoClaude({}), CAMINHO_CLAUDE_PADRAO);
  assert.equal(TIMEOUT_LOTE_MS, 180_000);
});
