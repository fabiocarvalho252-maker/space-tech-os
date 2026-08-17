// Client-safe (no server-only imports) so both subscription-service.ts and
// the /planos checkout dialog can compute the same number — the price
// shown to the customer before they confirm must match what the server
// actually charges, never a rough estimate.
export type PaymentMethod = "pix" | "credit_card";

// Taxa cobrada pelo Mercado Pago para liberação "na hora" (imediata) do
// valor — conferida em Taxas e parcelas → Checkout na própria conta
// Mercado Pago da SPACE TECH em 2026-08-17. Repassada integralmente ao
// cliente (a pedido explícito), não absorvida pela SPACE TECH: o valor
// configurado em plans.monthly_price/annual_price é sempre o que a SPACE
// TECH efetivamente recebe, nunca o que o cliente paga. Se a conta mudar
// de taxa (negociação, mudança de prazo de liberação etc.), atualizar aqui.
export const TAXA_MERCADO_PAGO_NA_HORA: Record<PaymentMethod, number> = {
  pix: 0.0099,
  credit_card: 0.0498,
};

/** Valor a cobrar do cliente para que, depois do Mercado Pago descontar a
 * taxa "na hora", a SPACE TECH receba exatamente `precoLiquido`. */
export function comTaxaRepassada(precoLiquido: number, paymentMethod: PaymentMethod): number {
  const taxa = TAXA_MERCADO_PAGO_NA_HORA[paymentMethod];
  return Math.round((precoLiquido / (1 - taxa)) * 100) / 100;
}
