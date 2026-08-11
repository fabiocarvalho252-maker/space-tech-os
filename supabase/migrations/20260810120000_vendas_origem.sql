-- "Compras e Vendas" on the Área do Cliente needs a real (not merely
-- visual) filter between "Pedidos online" and "Compras na loja" — there was
-- no column distinguishing them. Every sale today goes through the PDV, so
-- 'loja' is the correct default for existing and new rows; 'online' is
-- ready for whenever a real storefront/cart checkout exists to set it.
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'loja'
    CHECK (origem IN ('loja', 'online'));
