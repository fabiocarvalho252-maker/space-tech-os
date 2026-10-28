// Testes do link de assinatura do /admin. Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MODELOS_CONVITE,
  lerListaContatos,
  normalizarTelefoneConvite,
  personalizarConvite,
} from "../src/lib/convites-assinatura.ts";

test("telefone: com e sem 55, com máscara; incompleto é null", () => {
  assert.equal(normalizarTelefoneConvite("(74) 99999-1111"), "5574999991111");
  assert.equal(normalizarTelefoneConvite("+55 74 9999-1111"), "557499991111");
  assert.equal(normalizarTelefoneConvite("99999-1111"), null);
});

test("lista: vários formatos, repetido entra uma vez, linha sem telefone é apontada", () => {
  const { contatos, invalidas } = lerListaContatos(
    "João Silva, 74 99999-1111\nMaria; (74) 98888-2222\n74977773333\nPedro - 74 9 9999-1111\nsó um nome\n\n",
  );
  assert.deepEqual(contatos, [
    { nome: "João Silva", telefone: "5574999991111" },
    { nome: "Maria", telefone: "5574988882222" },
    { nome: null, telefone: "5574977773333" },
  ]);
  assert.deepEqual(invalidas, [{ linha: 5, texto: "só um nome" }]);
});

test("mensagem: nome, link e preço preenchidos", () => {
  const t = personalizarConvite(MODELOS_CONVITE.mensal, {
    nome: "joão silva",
    link: "https://srmpretech.online/cadastro",
    precos: { mensal: 40.4, anual: 460.56 },
  }).replace(/\s/g, " ");
  assert.match(t, /^Oi, João!/);
  assert.match(t, /R\$ 40,40\/mês/);
  assert.match(t, /https:\/\/srmpretech\.online\/cadastro/);
  const semNome = personalizarConvite(MODELOS_CONVITE.teste, {
    nome: null,
    link: "x",
    precos: { mensal: null, anual: null },
  });
  assert.match(semNome, /^Oi, tudo bem!/);
});
