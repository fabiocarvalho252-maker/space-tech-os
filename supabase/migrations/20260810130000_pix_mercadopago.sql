-- Real Mercado Pago Pix integration — cobrancas.tsx currently mocks the QR
-- code (see the "Mock de geração de Pix" comment there). This adds what the
-- real flow needs on top of the already-existing pagamento_config table
-- (per-empresa Mercado Pago Public Key / Access Token, entered in
-- Configurações → Mercado Pago).

-- Webhook signature secret (from the empresa's own Mercado Pago
-- "Notificações" dashboard) — separate from the Access Token, used only to
-- validate that a webhook call really came from Mercado Pago. Optional: the
-- webhook still works without it (falls back to re-fetching the payment
-- from Mercado Pago's own API as the source of truth either way), but
-- signature validation is skipped with a logged warning until it's set.
ALTER TABLE public.pagamento_config
  ADD COLUMN IF NOT EXISTS mercado_pago_webhook_secret TEXT;

-- Tracks which financeiro entry (if any) a paid Pix charge already booked,
-- so a duplicate webhook delivery for the same payment can't double-count
-- revenue.
ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS lancamento_id UUID REFERENCES public.lancamentos(id) ON DELETE SET NULL;
