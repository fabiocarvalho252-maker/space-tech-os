import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { carregarCatalogo, lerFrontMatter, setorDoAgente } from "./catalogo.ts";

test("lê nome e descrição do front matter", () => {
  const r = lerFrontMatter('---\nname: planner\ndescription: "Planeja features"\n---\ncorpo');
  assert.equal(r.descricao, "Planeja features");
});

test("agente sem mapa cai em 'geral'", () => {
  assert.equal(setorDoAgente("code-reviewer"), "qualidade");
  assert.equal(setorDoAgente("outro"), "geral");
});

test("catálogo lista agentes .md e skills de pasta, ordenado", async () => {
  const home = await mkdtemp(join(tmpdir(), "ecc-"));
  await mkdir(join(home, "agents"));
  await mkdir(join(home, "skills", "tdd-workflow"), { recursive: true });
  await writeFile(join(home, "agents", "planner.md"), "---\nname: planner\ndescription: Planeja\n---\n");
  await writeFile(join(home, "agents", "leia-me.txt"), "não é agente");
  const itens = await carregarCatalogo(home);
  assert.deepEqual(itens.map((i) => `${i.tipo}:${i.id}`), ["agente:planner", "skill:tdd-workflow"]);
  assert.equal(itens[0]?.setor, "planejamento");
});

test("catálogo vazio não quebra quando as pastas não existem", async () => {
  const home = await mkdtemp(join(tmpdir(), "ecc-vazio-"));
  assert.deepEqual(await carregarCatalogo(home), []);
});
