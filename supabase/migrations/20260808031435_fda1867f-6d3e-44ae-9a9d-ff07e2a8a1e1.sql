-- 1. Create sale_config table
CREATE TABLE public.sale_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    proximo_numero_venda INT DEFAULT 1,
    dias_garantia_padrao INT DEFAULT 90,
    tipo_caixa TEXT DEFAULT 'venda_rapida', -- venda_rapida, controle_caixa
    status_padrao_venda TEXT DEFAULT 'aberto',
    status_padrao_os TEXT DEFAULT 'recebido',
    pagamento_sugerido TEXT DEFAULT 'pix',
    permitir_desconto BOOLEAN DEFAULT true,
    editar_preco_carrinho BOOLEAN DEFAULT true,
    teto_desconto_percentual DECIMAL(5,2) DEFAULT 100.00,
    limite_vendas_abertas INT DEFAULT 10,
    limite_itens_carrinho INT DEFAULT 100,
    cliente_balcao_id UUID,
    texto_proposta TEXT DEFAULT 'Formas de pagamento: Pix, dinheiro, cartão de débito ou crédito.\nParcelamento: em até 3x no cartão.\nPrazo de entrega: até 5 dias úteis após a confirmação do pedido.\nValidade desta proposta: 7 dias.\nGarantia: 90 dias contra defeito de fabricação.\n\nEsta proposta é uma previsão de valores, não uma cobrança. Os valores valem para os produtos e as quantidades descritos e podem mudar se o pedido for alterado ou se algum item estiver indisponível no estoque.',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_config TO authenticated;
GRANT ALL ON public.sale_config TO service_role;

ALTER TABLE public.sale_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own sale_config"
ON public.sale_config
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. Create sale_status_flows table
CREATE TABLE public.sale_status_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    origem TEXT NOT NULL,
    destino TEXT NOT NULL,
    ativo BOOLEAN DEFAULT true,
    cor TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, origem, destino)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_status_flows TO authenticated;
GRANT ALL ON public.sale_status_flows TO service_role;

ALTER TABLE public.sale_status_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own sale_status_flows"
ON public.sale_status_flows
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);