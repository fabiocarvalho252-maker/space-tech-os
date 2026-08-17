-- Excluir uma venda (src/routes/_authenticated/vendas.tsx) só apagava a
-- linha em "vendas", deixando o lançamento financeiro de entrada criado
-- junto com ela ("Venda #NNNN") órfão e contando pra sempre como receita
-- no Dashboard e no DRE. Vincular o lançamento à venda que o gerou e usar
-- ON DELETE CASCADE faz o lançamento sumir junto quando a venda é excluída.
ALTER TABLE public.lancamentos
  ADD COLUMN venda_id uuid REFERENCES public.vendas(id) ON DELETE CASCADE;

-- Faz o vínculo retroativo dos lançamentos já existentes que ainda têm a
-- venda correspondente (o padrão "Venda #0001" criado em vendas.tsx).
UPDATE public.lancamentos l
SET venda_id = v.id
FROM public.vendas v
WHERE l.venda_id IS NULL
  AND l.user_id = v.user_id
  AND l.categoria = 'Venda'
  AND l.descricao = 'Venda #' || lpad(v.numero::text, 4, '0');
