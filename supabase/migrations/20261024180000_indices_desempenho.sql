-- Índices por empresa (user_id) e pelas ligações entre tabelas. Até aqui as
-- telas e as regras de acesso liam a tabela inteira (de todas as empresas)
-- para achar as linhas de uma empresa; com o volume crescendo isso pesa.
CREATE INDEX IF NOT EXISTS ordens_servico_user_created_idx ON public.ordens_servico (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ordens_servico_cliente_idx ON public.ordens_servico (cliente_id) WHERE cliente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ordens_servico_responsavel_idx ON public.ordens_servico (responsavel_user_id) WHERE responsavel_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS os_itens_produto_idx ON public.os_itens (produto_id) WHERE produto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS service_order_photos_os_idx ON public.service_order_photos (service_order_id);

CREATE INDEX IF NOT EXISTS lancamentos_user_data_idx ON public.lancamentos (user_id, data DESC);
CREATE INDEX IF NOT EXISTS lancamentos_user_created_idx ON public.lancamentos (user_id, created_at);
CREATE INDEX IF NOT EXISTS lancamentos_venda_idx ON public.lancamentos (venda_id) WHERE venda_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS vendas_user_created_idx ON public.vendas (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS vendas_cliente_idx ON public.vendas (cliente_id) WHERE cliente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS venda_itens_venda_idx ON public.venda_itens (venda_id);
CREATE INDEX IF NOT EXISTS venda_itens_produto_idx ON public.venda_itens (produto_id) WHERE produto_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS clientes_user_nome_idx ON public.clientes (user_id, nome);
CREATE INDEX IF NOT EXISTS produtos_user_nome_idx ON public.produtos (user_id, nome);

CREATE INDEX IF NOT EXISTS cobrancas_user_created_idx ON public.cobrancas (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cobrancas_cliente_idx ON public.cobrancas (cliente_id) WHERE cliente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS compras_user_created_idx ON public.compras (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS compra_itens_compra_idx ON public.compra_itens (compra_id);
CREATE INDEX IF NOT EXISTS notas_fiscais_user_created_idx ON public.notas_fiscais (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS seminovos_cliente_idx ON public.seminovos (cliente_id) WHERE cliente_id IS NOT NULL;

ANALYZE public.ordens_servico, public.lancamentos, public.vendas, public.venda_itens,
  public.clientes, public.produtos, public.os_itens, public.cobrancas, public.compras;
