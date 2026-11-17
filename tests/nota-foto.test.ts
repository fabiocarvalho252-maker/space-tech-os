// Testes da leitura de nota por foto (resposta da IA → nota validada).
// Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { chaveAcessoValida } from "../src/lib/nota-entrada/chave-acesso.ts";
import { extrairJson, normalizarNotaFoto } from "../src/lib/nota-entrada/nota-foto.ts";

// Chave com dígito verificador calculado em Python (DV 1).
const CHAVE_VALIDA = "35241112345678000195550010000001231000001231";

test("aceita chave com dígito verificador correto e recusa com errado", () => {
  assert.equal(chaveAcessoValida(CHAVE_VALIDA), true);
  assert.equal(chaveAcessoValida(CHAVE_VALIDA.slice(0, 43) + "9"), false);
  assert.equal(chaveAcessoValida("123"), false);
});

test("extrai o JSON mesmo com texto ao redor", () => {
  const json = extrairJson('Claro! {"itens": [{"descricao": "x"}]} Espero ter ajudado.');
  assert.deepEqual(json, { itens: [{ descricao: "x" }] });
});

test("recusa resposta sem JSON", () => {
  assert.throws(() => extrairJson("não consegui ler a imagem"), /não devolveu/);
});

test("normaliza itens, calcula totais e descarta chave com DV inválido", () => {
  const nota = normalizarNotaFoto({
    chave: "1".repeat(44),
    numero: "456",
    serie: "1",
    dataEmissao: "2026-11-10",
    emitente: { cnpj: "12.345.678/0001-95", nome: "Distribuidora" },
    itens: [
      {
        codigo: "A1",
        ean: "7891234567890",
        descricao: "Tela",
        unidade: "UN",
        quantidade: "2",
        custoUnitario: 150.5,
      },
      { codigo: null, ean: "SEM", descricao: "Película", quantidade: 10, custoUnitario: 3.2 },
    ],
  });

  assert.equal(nota.chave, null);
  assert.equal(nota.emitente.cnpj, "12345678000195");
  assert.equal(nota.itens[0].quantidade, 2);
  assert.equal(nota.itens[0].valorTotal, 301);
  assert.equal(nota.itens[0].ean, "7891234567890");
  assert.equal(nota.itens[1].ean, null);
  assert.equal(nota.itens[1].unidade, "UN");
  assert.equal(nota.valorTotal, 333);
});

test("mantém chave válida lida da foto", () => {
  const nota = normalizarNotaFoto({
    chave: CHAVE_VALIDA,
    itens: [{ descricao: "Item", quantidade: 1, custoUnitario: 5 }],
  });
  assert.equal(nota.chave, CHAVE_VALIDA);
});

test("recusa nota sem itens", () => {
  assert.throws(() => normalizarNotaFoto({ itens: [] }));
});

test("recusa quantidade zero ou negativa", () => {
  assert.throws(() =>
    normalizarNotaFoto({ itens: [{ descricao: "x", quantidade: 0, custoUnitario: 1 }] }),
  );
});
