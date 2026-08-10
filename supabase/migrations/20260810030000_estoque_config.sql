-- Backing tables for the Configurações → Estoque settings tab, which was a
-- dead placeholder ("estará disponível em breve") with nothing behind it.
-- Mirrors the existing purchase_config/whatsapp_config singleton-per-user
-- pattern rather than inventing a new shape.

CREATE TABLE IF NOT EXISTS public.estoque_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    estoque_minimo_padrao INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

-- A managed list of product categories. produtos.categoria stays a plain
-- text column (existing data isn't migrated into a foreign key), but the
-- Estoque form uses this list to suggest/autocomplete instead of leaving
-- every user to retype categories freehand.
CREATE TABLE IF NOT EXISTS public.produto_categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, nome)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque_config TO authenticated;
GRANT ALL ON public.estoque_config TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produto_categorias TO authenticated;
GRANT ALL ON public.produto_categorias TO service_role;

ALTER TABLE public.estoque_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own estoque config"
ON public.estoque_config
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own produto categorias"
ON public.produto_categorias
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
