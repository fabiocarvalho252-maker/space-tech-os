-- Código de barras (EAN/GTIN) do produto, separado do SKU interno. O PDV
-- adiciona o produto ao carrinho quando o leitor manda o código + Enter.
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS codigo_barras TEXT;

CREATE INDEX IF NOT EXISTS produtos_user_codigo_barras_idx
  ON public.produtos (user_id, codigo_barras)
  WHERE codigo_barras IS NOT NULL;

NOTIFY pgrst, 'reload schema';
