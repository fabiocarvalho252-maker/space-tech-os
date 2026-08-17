-- A venda "aberto" criada pelo PDV/Vendas (item já escolhido, pagamento já
-- definido) não tem por que passar pelas 6 etapas de negociação de uma OS
-- (orçamento -> negociação -> aprovado -> ... -> finalizado) antes de poder
-- ser faturada. Sem esta transição direta, o botão de status trava em
-- "Aberto" e a venda nunca chega a "Faturado".
INSERT INTO public.sale_status_flows (user_id, origem, destino)
SELECT p.id, 'aberto', 'faturado'
FROM public.profiles p
ON CONFLICT DO NOTHING;
