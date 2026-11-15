// Testes da captura de origem da campanha (UTM) no cadastro. Sem banco. Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extrairOrigemCampanha,
  mesclarOrigemCampanha,
  type OrigemCampanha,
} from "../src/lib/marketing/utm-campanha.ts";

test("extrai só os parâmetros utm_* aceitos, em minúsculas", () => {
  const origem = extrairOrigemCampanha({
    utm_source: "Instagram",
    utm_medium: "bio",
    utm_campaign: "lancamento-nov26",
    utm_content: "EDU-03",
    utm_term: "ignorado",
    ref: "abc",
  });
  assert.deepEqual(origem, {
    utm_source: "instagram",
    utm_medium: "bio",
    utm_campaign: "lancamento-nov26",
    utm_content: "edu-03",
  });
});

test("ignora valores vazios, não-texto e textos longos", () => {
  const origem = extrairOrigemCampanha({
    utm_source: "   ",
    utm_medium: 42,
    utm_campaign: "x".repeat(200),
    utm_content: "ok",
  });
  assert.deepEqual(origem, { utm_content: "ok" });
});

test("sem nenhum utm_* válido devolve objeto vazio", () => {
  assert.deepEqual(extrairOrigemCampanha({ ref: "abc" }), {});
  assert.deepEqual(extrairOrigemCampanha({}), {});
});

test("mesclar mantém a origem já salva quando a nova visita não traz UTM", () => {
  const salva: OrigemCampanha = { utm_source: "instagram", utm_medium: "bio" };
  assert.deepEqual(mesclarOrigemCampanha(salva, {}), salva);
});

test("mesclar substitui pela origem mais recente quando ela traz UTM", () => {
  const salva: OrigemCampanha = { utm_source: "instagram", utm_medium: "bio" };
  const nova: OrigemCampanha = { utm_source: "tiktok", utm_medium: "bio", utm_content: "ser-01" };
  assert.deepEqual(mesclarOrigemCampanha(salva, nova), nova);
});
