// Receita bruta do MEI (src/lib/relatorio-mei.ts). Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularReceitaMei, mesAnoBrasilia } from "../src/lib/relatorio-mei.ts";

test("mês pelo horário de Brasília (venda às 22h de 31/01 é janeiro)", () => {
  assert.deepEqual(mesAnoBrasilia("2026-02-01T01:00:00Z"), { ano: 2026, mes: 1 });
});

test("venda com desconto rateia entre comércio e serviço; OS sem itens é serviço", () => {
  const meses = calcularReceitaMei(
    2026,
    [
      {
        created_at: "2026-03-10T15:00:00Z",
        total: 90, // 100 bruto com 10 de desconto
        itens: [
          { quantidade: 1, preco_unitario: 50, servico: false },
          { quantidade: 1, preco_unitario: 50, servico: true },
        ],
      },
      { created_at: "2025-03-10T15:00:00Z", total: 999, itens: [] }, // outro ano
    ],
    [
      {
        created_at: "2026-03-20T15:00:00Z",
        valor_total: 200,
        itens: [
          { tipo: "produto", quantidade: 1, preco_unitario: 120 },
          { tipo: "servico", quantidade: 1, preco_unitario: 80 },
        ],
      },
      { created_at: "2026-04-02T15:00:00Z", valor_total: 70, itens: [] },
    ],
  );
  assert.deepEqual(meses[2], { mes: 3, comercio: 165, servicos: 125, total: 290 });
  assert.deepEqual(meses[3], { mes: 4, comercio: 0, servicos: 70, total: 70 });
  assert.equal(
    meses.reduce((s, m) => s + m.total, 0),
    360,
  );
});
