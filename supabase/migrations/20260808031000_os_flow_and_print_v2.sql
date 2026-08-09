-- Add new configuration columns to public.os_config
ALTER TABLE public.os_config 
ADD COLUMN IF NOT EXISTS exibir_fotos_impressao BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS imprimir_duas_vias BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS imprimir_qrcode_cliente BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS modelo_impressao TEXT DEFAULT 'padrao',
ADD COLUMN IF NOT EXISTS proximo_numero_os INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS dias_garantia_padrao INTEGER DEFAULT 90;

-- Table for OS Status Transitions (Flow)
CREATE TABLE IF NOT EXISTS public.os_status_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    origem TEXT NOT NULL,
    destino TEXT NOT NULL,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, origem, destino)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_status_flows TO authenticated;
GRANT ALL ON public.os_status_flows TO service_role;
ALTER TABLE public.os_status_flows ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'os_status_flows' AND policyname = 'Users can manage their own status flows') THEN
        CREATE POLICY "Users can manage their own status flows" ON public.os_status_flows
            FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Seed default flows for all users
INSERT INTO public.os_status_flows (user_id, origem, destino)
SELECT p.id, t.origem, t.destino
FROM public.profiles p
CROSS JOIN (
    VALUES 
    ('recebido', 'em_analise'),
    ('em_analise', 'orcamento'),
    ('orcamento', 'aprovado'),
    ('orcamento', 'reprovado'),
    ('aprovado', 'aguardando_peca'),
    ('aguardando_peca', 'em_reparo'),
    ('em_reparo', 'pronto'),
    ('pronto', 'entregue'),
    ('pronto', 'faturado')
) AS t(origem, destino)
ON CONFLICT DO NOTHING;
