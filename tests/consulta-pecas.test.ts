// Testes da "Consultar Peças" (tela Fornecedores). Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  horaLocal,
  linkConsultaWhatsapp,
  montarMensagemConsulta,
  nomeAparelho,
  numeroWhatsappFornecedor,
  saudacaoPorHorario,
} from "../src/lib/consulta-pecas.ts";

// Brasília é UTC-3 (sem horário de verão desde 2019).
const brt = (hhmm: string) => new Date(`2026-10-27T${hhmm}:00-03:00`);

test("saudação segue o horário de Brasília nas três faixas e nas bordas", () => {
  assert.equal(saudacaoPorHorario(brt("04:59")), "Boa noite! Tudo bem?");
  assert.equal(saudacaoPorHorario(brt("05:00")), "Bom dia! Tudo bem?");
  assert.equal(saudacaoPorHorario(brt("11:59")), "Bom dia! Tudo bem?");
  assert.equal(saudacaoPorHorario(brt("12:00")), "Boa tarde! Tudo bem?");
  assert.equal(saudacaoPorHorario(brt("17:59")), "Boa tarde! Tudo bem?");
  assert.equal(saudacaoPorHorario(brt("18:00")), "Boa noite! Tudo bem?");
  assert.equal(saudacaoPorHorario(brt("23:30")), "Boa noite! Tudo bem?");
  assert.equal(saudacaoPorHorario(brt("00:00")), "Boa noite! Tudo bem?");
});

test("hora local não depende de UTC: 13h UTC é 10h em Brasília", () => {
  const d = new Date("2026-10-27T13:00:00Z");
  assert.equal(horaLocal(d), 10);
  assert.equal(saudacaoPorHorario(d), "Bom dia! Tudo bem?");
  // 22h UTC = 19h BRT: em UTC seria "boa noite" também, mas 16h UTC = 13h BRT
  assert.equal(saudacaoPorHorario(new Date("2026-10-27T16:00:00Z")), "Boa tarde! Tudo bem?");
  // 02h UTC do dia seguinte ainda é 23h em Brasília
  assert.equal(horaLocal(new Date("2026-10-28T02:00:00Z")), 23);
});

test("mensagem usa peça, qualidade e modelo", () => {
  assert.equal(
    montarMensagemConsulta(
      { peca: "tela", qualidade: "OLED", marca: "Apple", modelo: "iPhone 13" },
      brt("14:00"),
    ),
    "Boa tarde! Tudo bem?\n\nTem tela OLED para iPhone 13 disponível? Qual o valor?",
  );
  assert.equal(
    montarMensagemConsulta({ peca: " bateria ", marca: "Samsung", modelo: "A54" }, brt("08:00")),
    "Bom dia! Tudo bem?\n\nTem bateria para Samsung A54 disponível? Qual o valor?",
  );
});

test("nomeAparelho não repete a marca", () => {
  assert.equal(nomeAparelho("Samsung", "Galaxy A54"), "Samsung Galaxy A54");
  assert.equal(nomeAparelho("Samsung", "Samsung A54"), "Samsung A54");
  assert.equal(nomeAparelho("Apple", "iPhone 13 Pro"), "iPhone 13 Pro");
  assert.equal(nomeAparelho("", "Moto G84"), "Moto G84");
});

test("número do fornecedor: válido, ausente, inválido, sem inventar dígitos", () => {
  assert.deepEqual(numeroWhatsappFornecedor({ whatsapp: "(74) 99812-5994" }), {
    ok: true,
    numero: "74998125994",
    origem: "whatsapp",
  });
  assert.deepEqual(numeroWhatsappFornecedor({ whatsapp: "+55 74 99812-5994" }), {
    ok: true,
    numero: "74998125994",
    origem: "whatsapp",
  });
  assert.deepEqual(numeroWhatsappFornecedor({ whatsapp: "", telefone: "" }), {
    ok: false,
    motivo: "ausente",
  });
  assert.deepEqual(numeroWhatsappFornecedor({ whatsapp: null, telefone: null }), {
    ok: false,
    motivo: "ausente",
  });
  assert.deepEqual(numeroWhatsappFornecedor({ whatsapp: "9812-5994" }), {
    ok: false,
    motivo: "invalido",
  });
  assert.deepEqual(numeroWhatsappFornecedor({ whatsapp: "(74) 89812-5994" }), {
    ok: false,
    motivo: "invalido",
  });
  // Sem WhatsApp, o telefone só vale se for celular
  assert.deepEqual(numeroWhatsappFornecedor({ telefone: "(74) 99812-5994" }), {
    ok: true,
    numero: "74998125994",
    origem: "telefone",
  });
  assert.deepEqual(numeroWhatsappFornecedor({ telefone: "(74) 3641-1234" }), {
    ok: false,
    motivo: "invalido",
  });
});

test("link wa.me com DDI e mensagem codificada", () => {
  const msg = "Boa tarde! Tudo bem?\n\nTem tela OLED para iPhone 13 & 14? Qual o valor? 100%";
  const link = linkConsultaWhatsapp("74998125994", msg);
  assert.ok(link.startsWith("https://wa.me/5574998125994?text="));
  const url = new URL(link);
  assert.equal(url.searchParams.get("text"), msg);
  assert.ok(!link.includes(" ") && !link.includes("\n") && link.includes("%26"));
});
