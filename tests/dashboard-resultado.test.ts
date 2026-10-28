// Testes do cálculo do "Resultado do mês" do Painel e da comparação com o
// período anterior. Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { format } from "date-fns";
import {
  calcularResultado,
  intervaloAnterior,
  variacaoPercentual,
} from "../src/lib/dashboard/resultado.ts";

const d = (s: string) => new Date(`${s}T12:00:00`);
const f = (x: Date) => format(x, "yyyy-MM-dd");

test("resultado: só lançamentos pagos; custo separado entre peças e serviços", () => {
  const produtos = new Map([
    ["tela", { categoria: "Peças", preco_custo: 100 }],
    ["troca", { categoria: "Serviço", preco_custo: 20 }],
  ]);
  const r = calcularResultado(
    [
      { tipo: "entrada", valor: 500, data: "2026-10-01", status: "pago" },
      { tipo: "entrada", valor: 999, data: "2026-10-01", status: "pendente" },
      { tipo: "saida", valor: "50", data: "2026-10-02", status: "pago" },
    ],
    [
      {
        produto_id: "tela",
        quantidade: 2,
        created_at: "2026-10-01T15:00:00Z",
        ordens_servico: { status: "entregue" },
      },
      {
        produto_id: "tela",
        quantidade: 5,
        created_at: "2026-10-01T15:00:00Z",
        ordens_servico: { status: "cancelado" },
      },
    ],
    [
      {
        produto_id: "troca",
        quantidade: 1,
        created_at: "2026-10-02T15:00:00Z",
        vendas: { status: "pago" },
      },
    ],
    produtos,
  );
  assert.equal(r.receita, 500);
  assert.equal(r.despesas, 50);
  assert.equal(r.cmv, 200);
  assert.equal(r.custoServicos, 20);
  assert.equal(r.lucroLiquido, 230);
  assert.equal(r.margem, 46);
});

test("período anterior: este mês compara com os mesmos dias do mês passado", () => {
  const a = intervaloAnterior("mes", d("2026-10-01"), d("2026-10-28"));
  assert.equal(f(a.inicio), "2026-09-01");
  assert.equal(f(a.fim), "2026-09-28");
});

test("período anterior: 31 de março vira fim de fevereiro", () => {
  const a = intervaloAnterior("mes", d("2026-03-01"), d("2026-03-31"));
  assert.equal(f(a.fim), "2026-02-28");
});

test("período anterior: mês anterior, hoje, semana e personalizado", () => {
  const m = intervaloAnterior("mes_anterior", d("2026-09-01"), d("2026-09-30"));
  assert.deepEqual([f(m.inicio), f(m.fim)], ["2026-08-01", "2026-08-31"]);
  const h = intervaloAnterior("hoje", d("2026-10-28"), d("2026-10-28"));
  assert.deepEqual([f(h.inicio), f(h.fim)], ["2026-10-27", "2026-10-27"]);
  const s = intervaloAnterior("semana", d("2026-10-26"), d("2026-11-01"));
  assert.deepEqual([f(s.inicio), f(s.fim)], ["2026-10-19", "2026-10-25"]);
  const p = intervaloAnterior("personalizado", d("2026-10-11"), d("2026-10-20"));
  assert.deepEqual([f(p.inicio), f(p.fim)], ["2026-10-01", "2026-10-10"]);
});

test("variação: sem base retorna null; base negativa usa valor absoluto", () => {
  assert.equal(variacaoPercentual(100, 0), null);
  assert.equal(variacaoPercentual(150, 100), 50);
  assert.equal(variacaoPercentual(-50, -100), 50);
});
