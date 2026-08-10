-- Backing table for the Configurações → Fiscal settings tab, which was a
-- dead placeholder. Per AGENTS.md §22 this must stay a prepared data model
-- (série/número/status/chave) and never fake real NF-e/NFS-e emission — so
-- this only adds what's genuinely usable today: a configurable default série
-- for new notas_fiscais rows, which until now always silently fell back to
-- the "1" column default with no way to change it.

CREATE TABLE IF NOT EXISTS public.fiscal_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    serie_padrao TEXT NOT NULL DEFAULT '1',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_config TO authenticated;
GRANT ALL ON public.fiscal_config TO service_role;

ALTER TABLE public.fiscal_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own fiscal config"
ON public.fiscal_config
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
