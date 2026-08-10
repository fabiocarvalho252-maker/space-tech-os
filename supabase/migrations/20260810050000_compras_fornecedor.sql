-- "Compras" (§16 do AGENTS.md: fornecedores, itens, custo, quantidade,
-- total, pagamento, entrada automática no estoque) nunca foi de fato
-- construído — a rota /compras usava compras_aparelhos, uma cópia
-- redundante e mais simples da Compra de Seminovos (mesma coisa, tabela
-- "seminovos", com o fluxo completo Em avaliação → Comprado → Vendido que
-- o AGENTS.md pede para seminovos). compras_aparelhos está vazia (0 linhas)
-- e continua existindo sem uso — não apagada, só não é mais referenciada
-- pela UI.
--
-- Configurações → Compras já tinha purchase_config/purchase_status_flows
-- prontos (situação ao faturar, fluxo de status com cores) sem nenhuma
-- tela real para consumi-los; esta migração finalmente dá a eles um dono.

CREATE TABLE public.compras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'aberto',
    forma_pagamento TEXT,
    observacoes TEXT,
    valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    recebido_em TIMESTAMPTZ,
    faturado_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.compra_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    compra_id UUID NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
    produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
    descricao TEXT NOT NULL,
    quantidade NUMERIC(12,3) NOT NULL DEFAULT 1,
    custo_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compras TO authenticated;
GRANT ALL ON public.compras TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compra_itens TO authenticated;
GRANT ALL ON public.compra_itens TO service_role;

ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compras ver" ON public.compras FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'compras', 'ver'));
CREATE POLICY "compras gerenciar" ON public.compras FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'compras', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'compras', 'gerenciar'));

ALTER TABLE public.compra_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "compra_itens ver" ON public.compra_itens FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'compras', 'ver'));
CREATE POLICY "compra_itens gerenciar" ON public.compra_itens FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'compras', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'compras', 'gerenciar'));

CREATE TRIGGER compras_updated BEFORE UPDATE ON public.compras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
