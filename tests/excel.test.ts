// Planilha Excel (src/lib/excel.ts). Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import {
  gerarXlsx,
  lerCelula,
  letraColuna,
  montarArquivosXlsx,
  nomeAba,
  tituloColuna,
} from "../src/lib/excel.ts";

test("letras de coluna", () => {
  assert.equal(letraColuna(0), "A");
  assert.equal(letraColuna(25), "Z");
  assert.equal(letraColuna(26), "AA");
  assert.equal(letraColuna(701), "ZZ");
  assert.equal(letraColuna(702), "AAA");
});

test("títulos e nome de aba", () => {
  assert.equal(tituloColuna("custo_pecas"), "Custo pecas");
  assert.equal(tituloColuna("Lançado em"), "Lançado em");
  assert.equal(nomeAba("a/b:c*d?[e]"), "a b c d  e");
  assert.equal(nomeAba(""), "Planilha");
  assert.equal(nomeAba("x".repeat(40)).length, 31);
});

test("dinheiro em texto vira número; código com zero à esquerda continua texto", () => {
  assert.deepEqual(lerCelula("123.45"), { tipo: "numero", valor: 123.45, dinheiro: true });
  assert.deepEqual(lerCelula("0012"), { tipo: "texto", valor: "0012" });
  assert.deepEqual(lerCelula(3), { tipo: "numero", valor: 3, dinheiro: false });
  assert.deepEqual(lerCelula(null), { tipo: "vazia" });
  assert.deepEqual(lerCelula(true), { tipo: "texto", valor: "Sim" });
});

test("planilha escapa XML e remove caracteres de controle", () => {
  const f = montarArquivosXlsx([{ cliente: 'A & B <"x">\u0001', total: "10.00" }], "Teste");
  const sheet = f["xl/worksheets/sheet1.xml"]!;
  assert.match(sheet, /A &amp; B &lt;&quot;x&quot;&gt;</);
  assert.ok(!sheet.includes("\u0001"));
  assert.match(sheet, /<c r="B2" s="2"><v>10<\/v><\/c>/);
  assert.match(sheet, /<autoFilter ref="A1:B2"\/>/);
  assert.match(f["xl/workbook.xml"]!, /name="Teste"/);
});

test("gera zip válido com todas as partes", async () => {
  const blob = await gerarXlsx([{ a: 1 }, { a: 2, b: "x" }]);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  for (const p of [
    "[Content_Types].xml",
    "_rels/.rels",
    "xl/workbook.xml",
    "xl/styles.xml",
    "xl/worksheets/sheet1.xml",
  ]) {
    assert.ok(zip.file(p), p);
  }
});
