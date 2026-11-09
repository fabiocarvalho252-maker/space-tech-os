// Datas exibidas ao cliente (Área do Cliente, PDF). Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { dataBR, dataHoraBR } from "../src/lib/format.ts";

test("valor só de data não volta um dia (previsão de entrega)", () => {
  assert.equal(dataHoraBR("2026-11-11"), "11/11/2026");
  assert.equal(dataBR("2026-11-11"), "11/11/2026");
});

test("data e hora continua no horário de Brasília", () => {
  assert.equal(dataHoraBR("2026-11-09T16:52:00Z"), "09/11/2026 às 13:52");
  assert.equal(dataHoraBR("2026-11-10T01:30:00Z"), "09/11/2026 às 22:30");
});

test("vazio vira travessão", () => {
  assert.equal(dataHoraBR(null), "—");
  assert.equal(dataHoraBR(""), "—");
});
