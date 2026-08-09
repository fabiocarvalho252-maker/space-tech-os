-- venda_itens was created without created_at (unlike os_itens/lancamentos),
-- which broke the dashboard's "vendas do mês" query (PostgREST 400 on an
-- unknown column filter). Add it to match the sibling item tables.
ALTER TABLE public.venda_itens ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
