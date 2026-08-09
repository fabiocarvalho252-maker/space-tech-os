-- Table for OS configuration (terms, conditions, etc.)
CREATE TABLE IF NOT EXISTS public.os_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    termos_condicoes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_config TO authenticated;
GRANT ALL ON public.os_config TO service_role;
ALTER TABLE public.os_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own OS config" ON public.os_config
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Table for OS Checklists
CREATE TABLE IF NOT EXISTS public.os_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    itens JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_checklists TO authenticated;
GRANT ALL ON public.os_checklists TO service_role;
ALTER TABLE public.os_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own OS checklists" ON public.os_checklists
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Insert default OS config for existing users
INSERT INTO public.os_config (user_id, termos_condicoes)
SELECT id, 'Parcelamento: em até 3x no cartão.
Prazo de execução: até 5 dias úteis após a aprovação.
Validade deste orçamento: 7 dias.
Garantia: 90 dias sobre o serviço executado.

Este orçamento é uma previsão de valores, não uma cobrança. Se durante a execução aparecer outro problema, você é avisado antes e nada é feito sem a sua aprovação. A aprovação autoriza a execução dos serviços e a aplicação das peças listadas.'
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- Insert default checklists for existing users
INSERT INTO public.os_checklists (user_id, nome, itens)
SELECT id, 'Banho Químico (Aparelho Molhado)', '["Oxidação visível", "Consumo na fonte", "Limpeza ultrassônica", "Teste de periféricos"]'::jsonb FROM public.profiles
ON CONFLICT DO NOTHING;

INSERT INTO public.os_checklists (user_id, nome, itens)
SELECT id, 'Triagem / Entrada de Equipamento', '["Tela quebrada", "Carcaça riscada", "Liga/Não liga", "WiFi/Bluetooth", "Câmeras", "Microfone/Alto-falante"]'::jsonb FROM public.profiles
ON CONFLICT DO NOTHING;

INSERT INTO public.os_checklists (user_id, nome, itens)
SELECT id, 'Troca de Bateria / Não Liga', '["Saúde da bateria", "Ciclos", "Teste de carga", "Consumo em standby"]'::jsonb FROM public.profiles
ON CONFLICT DO NOTHING;

INSERT INTO public.os_checklists (user_id, nome, itens)
SELECT id, 'Troca de Tela / Display', '["Touch working", "FaceID/TouchID", "Sensor de proximidade", "True Tone", "Brilho"]'::jsonb FROM public.profiles
ON CONFLICT DO NOTHING;
