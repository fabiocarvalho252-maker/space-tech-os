// Pagamento da assinatura pelo Mercado Pago: chave de ativação e bloqueio no servidor. Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { garantirPagamentoAssinaturaAtivo } from "../src/lib/mercadopago/pagamento-assinatura.ts";

test("com o pagamento desativado, nenhuma cobrança do Mercado Pago é criada", () => {
  assert.throws(() => garantirPagamentoAssinaturaAtivo(false), /indisponível/);
});

test("com o pagamento ativo, a criação segue sem erro", () => {
  assert.doesNotThrow(() => garantirPagamentoAssinaturaAtivo(true));
});

import { montarLinkWhatsappPlano } from "../src/lib/mercadopago/pagamento-assinatura.ts";

const contato = "https://wa.me/5574999294500";

test("link do WhatsApp leva o nome do plano e o preço mensal na mensagem", () => {
  const link = montarLinkWhatsappPlano({ base: contato, nomePlano: "Básico", precoMensal: 40 });
  const url = new URL(link);
  assert.equal(url.origin + url.pathname, "https://wa.me/5574999294500");
  assert.match(url.searchParams.get("text") ?? "", /plano Básico/);
  assert.match(url.searchParams.get("text") ?? "", /R\$\s?40,00\/mês/);
});

test("sem preço mensal, a mensagem traz só o nome do plano", () => {
  const link = montarLinkWhatsappPlano({
    base: contato,
    nomePlano: "Sob consulta",
    precoMensal: null,
  });
  const texto = new URL(link).searchParams.get("text") ?? "";
  assert.match(texto, /plano Sob consulta/);
  assert.doesNotMatch(texto, /\/mês/);
});
