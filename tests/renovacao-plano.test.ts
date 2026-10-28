// Testes da renovação do plano (data de acesso e comprovante). Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { novoAcessoAte } from "../src/lib/acesso.ts";
import { linhasComprovante, textoComprovanteWhatsapp } from "../src/lib/planos/comprovante.ts";

const hoje = "2026-10-28";

test("renovação antes de vencer soma ao vencimento atual", () => {
  assert.equal(novoAcessoAte("mensal", "2026-11-10", hoje, "monthly"), "2026-12-10");
  assert.equal(novoAcessoAte("mensal", "2026-11-10", hoje, "yearly"), "2027-11-10");
  assert.equal(novoAcessoAte("anual", "2026-10-28", hoje, "monthly"), "2026-11-28");
});

test("vencido, teste grátis ou sem data: conta a partir de hoje", () => {
  assert.equal(novoAcessoAte("mensal", "2026-10-01", hoje, "monthly"), "2026-11-28");
  assert.equal(novoAcessoAte("trial", "2027-01-01", hoje, "monthly"), "2026-11-28");
  assert.equal(novoAcessoAte("suspenso", null, hoje, "monthly"), "2026-11-28");
  assert.equal(novoAcessoAte(null, null, hoje, "yearly"), "2027-10-28");
});

test("fim de mês não pula para o mês seguinte e vitalício não muda", () => {
  assert.equal(novoAcessoAte("mensal", "2027-01-31", hoje, "monthly"), "2027-02-28");
  assert.equal(novoAcessoAte("vitalicio", null, hoje, "monthly"), null);
});

test("comprovante: linhas e texto do WhatsApp", () => {
  const dados = {
    loja: "Loja do Zé",
    plano: "Básico",
    ciclo: "monthly" as const,
    metodo: "pix" as const,
    valor: 40.4,
    pagoEm: "2026-10-28T13:05:00Z",
    acessoAte: "2026-11-28",
    codigo: "123456789",
  };
  const linhas = Object.fromEntries(linhasComprovante(dados));
  assert.equal(linhas["Plano"], "Básico (mensal)");
  assert.equal(linhas["Pago em"], "28/10/2026, 10:05");
  assert.equal(linhas["Acesso liberado até"], "28/11/2026");
  const texto = textoComprovanteWhatsapp(dados).replace(/\s/g, " ");
  assert.match(texto, /Pagamento confirmado/);
  assert.match(texto, /\*Valor pago:\* R\$ 40,40/);
});
