-- Extend vendas with a proper sales-history workflow (numero, status, desconto, observacoes)
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS numero SERIAL,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'aberto',
  ADD COLUMN IF NOT EXISTS desconto NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- Seed default status flow for all existing users, mirroring the os_status_flows pattern
INSERT INTO public.sale_status_flows (user_id, origem, destino)
SELECT p.id, t.origem, t.destino
FROM public.profiles p
CROSS JOIN (
    VALUES
    ('aberto', 'orcamento'),
    ('aberto', 'cancelado'),
    ('orcamento', 'negociacao'),
    ('orcamento', 'cancelado'),
    ('negociacao', 'aprovado'),
    ('negociacao', 'cancelado'),
    ('aprovado', 'aguardando_pecas'),
    ('aprovado', 'em_andamento'),
    ('aguardando_pecas', 'em_andamento'),
    ('em_andamento', 'finalizado'),
    ('finalizado', 'faturado')
) AS t(origem, destino)
ON CONFLICT DO NOTHING;
