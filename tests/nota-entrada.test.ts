// Testes da nota de entrada do fornecedor (XML NF-e → estoque).
// Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { DOMParser as XmldomParser } from "@xmldom/xmldom";
import { extrairNotaEntrada } from "../src/lib/nota-entrada/nfe-xml.ts";
import { eanValido } from "../src/lib/nota-entrada/ean.ts";
import { sugerirProduto, type ProdutoCadastrado } from "../src/lib/nota-entrada/casar-itens.ts";

const CHAVE = "35241112345678000195550010000001231000001234";

const XML_NOTA = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe${CHAVE}" versao="4.00">
      <ide>
        <nNF>123</nNF>
        <serie>1</serie>
        <dhEmi>2026-11-10T10:30:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>12345678000195</CNPJ>
        <xNome>DISTRIBUIDORA TESTE LTDA</xNome>
      </emit>
      <dest><CNPJ>99999999000199</CNPJ></dest>
      <det nItem="1">
        <prod>
          <cProd>TELA-IP11</cProd>
          <cEAN>7891234567890</cEAN>
          <xProd>Tela iPhone 11 Original</xProd>
          <NCM>85287200</NCM>
          <uCom>UN</uCom>
          <qCom>2.0000</qCom>
          <vUnCom>150.5000</vUnCom>
          <vProd>301.00</vProd>
        </prod>
      </det>
      <det nItem="2">
        <prod>
          <cProd>PEL-HID</cProd>
          <cEAN>SEM GTIN</cEAN>
          <xProd>Película Hidrogel</xProd>
          <NCM>39199090</NCM>
          <uCom>UN</uCom>
          <qCom>10.0000</qCom>
          <vUnCom>3.2000</vUnCom>
          <vProd>32.00</vProd>
        </prod>
      </det>
      <total><ICMSTot><vNF>333.00</vNF></ICMSTot></total>
    </infNFe>
  </NFe>
</nfeProc>`;

function docDe(xml: string) {
  return new XmldomParser().parseFromString(xml, "application/xml") as unknown as Document;
}

test("extrai chave, número, série, emitente e total da NF-e", () => {
  // Arrange
  const doc = docDe(XML_NOTA);

  // Act
  const nota = extrairNotaEntrada(doc);

  // Assert
  assert.equal(nota.chave, CHAVE);
  assert.equal(nota.numero, "123");
  assert.equal(nota.serie, "1");
  assert.equal(nota.emitente.cnpj, "12345678000195");
  assert.equal(nota.emitente.nome, "DISTRIBUIDORA TESTE LTDA");
  assert.equal(nota.valorTotal, 333);
});

test("lê quantidade e custo unitário decimais de cada item", () => {
  // Arrange
  const doc = docDe(XML_NOTA);

  // Act
  const [tela, pelicula] = extrairNotaEntrada(doc).itens;

  // Assert
  assert.equal(tela.quantidade, 2);
  assert.equal(tela.custoUnitario, 150.5);
  assert.equal(tela.ean, "7891234567890");
  assert.equal(pelicula.quantidade, 10);
  assert.equal(pelicula.custoUnitario, 3.2);
});

test("trata 'SEM GTIN' como item sem código de barras", () => {
  // Arrange
  const doc = docDe(XML_NOTA);

  // Act
  const [, pelicula] = extrairNotaEntrada(doc).itens;

  // Assert
  assert.equal(pelicula.ean, null);
});

test("recusa XML que não é NF-e", () => {
  // Arrange
  const doc = docDe("<outro><coisa/></outro>");

  // Act / Assert
  assert.throws(() => extrairNotaEntrada(doc), /não é uma NF-e/);
});

test("valida formato de EAN", () => {
  assert.equal(eanValido("7891234567890"), true);
  assert.equal(eanValido("789123"), false);
  assert.equal(eanValido("ABCDEFGH"), false);
});

const PRODUTOS: ProdutoCadastrado[] = [
  { id: "p1", nome: "Tela iPhone 11", codigo_barras: "7891234567890", sku: null },
  { id: "p2", nome: "Película Hidrogel", codigo_barras: null, sku: "PEL-HID" },
  { id: "p3", nome: "Bateria Samsung A10", codigo_barras: null, sku: null },
];

test("casa item pelo código de barras primeiro", () => {
  const doc = docDe(XML_NOTA);
  const [tela] = extrairNotaEntrada(doc).itens;
  assert.equal(sugerirProduto(tela, PRODUTOS)?.id, "p1");
});

test("casa pelo código do fornecedor quando não há EAN", () => {
  const doc = docDe(XML_NOTA);
  const [, pelicula] = extrairNotaEntrada(doc).itens;
  assert.equal(sugerirProduto(pelicula, PRODUTOS)?.id, "p2");
});

test("casa pelo nome ignorando acento e caixa", () => {
  const item = {
    ...extrairNotaEntrada(docDe(XML_NOTA)).itens[1],
    codigo: "X",
    descricao: "PELICULA HIDROGEL",
  };
  assert.equal(sugerirProduto(item, PRODUTOS)?.id, "p2");
});

test("retorna null quando o produto não está cadastrado", () => {
  const doc = docDe(XML_NOTA);
  const [tela] = extrairNotaEntrada(doc).itens;
  assert.equal(
    sugerirProduto({ ...tela, ean: null, codigo: "NOVO", descricao: "Item novo" }, PRODUTOS),
    null,
  );
});

test("monta payload com produto vinculado ou cadastrado como novo", async () => {
  // Arrange
  const { montarItensImportacao } = await import("../src/lib/nota-entrada/montar-itens.ts");
  const [tela, pelicula] = extrairNotaEntrada(docDe(XML_NOTA)).itens;

  // Act
  const itens = montarItensImportacao([
    { item: tela, produtoId: "p1", precoVenda: 300 },
    { item: pelicula, produtoId: null, precoVenda: null },
  ]);

  // Assert
  assert.deepEqual(itens[0], {
    produto_id: "p1",
    nome_novo: "Tela iPhone 11 Original",
    codigo_barras: "7891234567890",
    sku: "TELA-IP11",
    descricao: "Tela iPhone 11 Original",
    quantidade: 2,
    custo_unitario: 150.5,
    preco_venda: 300,
  });
  assert.equal((itens[1] as { produto_id: unknown }).produto_id, null);
  assert.equal((itens[1] as { preco_venda: unknown }).preco_venda, null);
  assert.equal((itens[1] as { codigo_barras: unknown }).codigo_barras, null);
});

test("calcula valor de revenda pela margem sobre o custo", async () => {
  const { precoComMargem } = await import("../src/lib/nota-entrada/montar-itens.ts");
  assert.equal(precoComMargem(150.5, 100), 301);
  assert.equal(precoComMargem(3.2, 50), 4.8);
  assert.equal(precoComMargem(10, 0), 10);
});
