-- Criar tabela de itens da OS para vincular produtos e serviços
CREATE TABLE public.os_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    os_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
    produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
    descricao TEXT NOT NULL,
    quantidade INTEGER NOT NULL DEFAULT 1,
    preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_itens TO authenticated;
GRANT ALL ON public.os_itens TO service_role;

-- RLS
ALTER TABLE public.os_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own os_itens" ON public.os_itens 
    FOR ALL TO authenticated 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

-- Índice para performance
CREATE INDEX idx_os_itens_os_id ON public.os_itens(os_id);

-- Trigger para atualizar estoque ao inserir item na OS
CREATE OR REPLACE FUNCTION public.handle_os_item_stock() 
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF NEW.produto_id IS NOT NULL THEN
            UPDATE public.produtos 
            SET quantidade = quantidade - NEW.quantidade
            WHERE id = NEW.produto_id;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.produto_id IS NOT NULL THEN
            UPDATE public.produtos 
            SET quantidade = quantidade + OLD.quantidade
            WHERE id = OLD.produto_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_os_item_stock
AFTER INSERT OR DELETE ON public.os_itens
FOR EACH ROW EXECUTE FUNCTION public.handle_os_item_stock();
