CREATE TABLE public.termos_garantia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.termos_garantia TO authenticated;
GRANT ALL ON public.termos_garantia TO service_role;

ALTER TABLE public.termos_garantia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own terms"
ON public.termos_garantia
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
