-- Fornecedor de onde vem a peça usada no serviço (pedido do usuário, campo do
-- cadastro "Novo serviço"). Fica em produtos porque os serviços são linhas
-- de produtos com categoria 'Serviço'. Opcional; guarda o id do fornecedor.
ALTER TABLE public.produtos
  ADD COLUMN fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS produtos_fornecedor_id_idx ON public.produtos (fornecedor_id);

NOTIFY pgrst, 'reload schema';
