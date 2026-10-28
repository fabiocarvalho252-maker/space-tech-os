-- Seminovos: status "recusado" — avaliação que não virou compra (a loja ou o
-- vendedor não aceitou). Fica registrada com o valor oferecido, sem
-- assinatura, sem lançamento no Financeiro e fora do estoque e dos relatórios
-- de compra. Aditivo: só amplia a lista de status permitidos.
ALTER TABLE public.seminovos DROP CONSTRAINT IF EXISTS seminovos_status_check;
ALTER TABLE public.seminovos ADD CONSTRAINT seminovos_status_check
  CHECK (status = ANY (ARRAY['pendente', 'aguardando_finalizacao', 'disponivel', 'vendido',
                             'devolvido', 'sucata', 'sem_solucao', 'recusado']));
