import { test } from "node:test";
import assert from "node:assert/strict";
import { carregarConfig } from "./config.ts";

const BASE = { SUPABASE_URL: "https://db.example.com", SUPABASE_ANON_KEY: "a".repeat(30) };

test("usa valores padrão seguros quando só o obrigatório é dado", () => {
  const c = carregarConfig(BASE);
  assert.equal(c.PORT, 4317);
  assert.equal(c.OFFICE_MAX_CONCURRENCY, 1);
  assert.equal(c.ADMIN_EMAIL, "admin@spacetech.app");
});

test("recusa subir sem SUPABASE_URL, com mensagem que aponta o campo", () => {
  assert.throws(() => carregarConfig({ SUPABASE_ANON_KEY: BASE.SUPABASE_ANON_KEY }), /SUPABASE_URL/);
});

test("recusa limite de concorrência fora da faixa", () => {
  assert.throws(() => carregarConfig({ ...BASE, OFFICE_MAX_CONCURRENCY: "50" }), /OFFICE_MAX_CONCURRENCY/);
});
