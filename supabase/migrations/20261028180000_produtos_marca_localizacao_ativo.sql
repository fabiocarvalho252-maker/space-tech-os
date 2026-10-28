-- Produtos: marca, localização (prateleira/gaveta) e ativo/inativo.
-- Inativo some do PDV, das vendas, da OS e das compras, mas continua no
-- cadastro e no histórico (em vez de apagar). Vale também para serviços,
-- que moram na mesma tabela (categoria "Serviço"). Tudo aditivo.
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS marca TEXT,
  ADD COLUMN IF NOT EXISTS localizacao TEXT,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS produtos_user_ativo_idx ON public.produtos (user_id, ativo);

NOTIFY pgrst, 'reload schema';
