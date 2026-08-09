CREATE TABLE IF NOT EXISTS public.catalogo_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    loja_ativa BOOLEAN DEFAULT true,
    subdominio TEXT UNIQUE,
    dominio_proprio TEXT,
    ignorar_estoque BOOLEAN DEFAULT true,
    exibir_apenas_com_estoque BOOLEAN DEFAULT false,
    permitir_vender_sem_estoque BOOLEAN DEFAULT true,
    whatsapp_flutuante_ativo BOOLEAN DEFAULT true,
    whatsapp_atendimento TEXT,
    whatsapp_mensagem_inicial TEXT DEFAULT 'Olá, gostaria de mais informações sobre seus produtos.',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogo_config TO authenticated;
GRANT ALL ON public.catalogo_config TO service_role;

ALTER TABLE public.catalogo_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own catalogo config" 
ON public.catalogo_config 
FOR ALL 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Link products to catalog categories or tags (optional for now, but good to have)
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS exibir_no_catalogo BOOLEAN DEFAULT true;
