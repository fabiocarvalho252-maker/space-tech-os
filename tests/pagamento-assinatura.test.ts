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
