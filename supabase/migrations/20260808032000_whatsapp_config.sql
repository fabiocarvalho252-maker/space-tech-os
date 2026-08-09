CREATE TABLE IF NOT EXISTS public.whatsapp_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    status TEXT DEFAULT 'Desconectado',
    instancia_id TEXT,
    notif_os_criada BOOLEAN DEFAULT true,
    notif_os_criada_texto TEXT DEFAULT 'Olá {{cliente}}, sua OS #{{numero}} foi aberta com sucesso!',
    notif_os_editada BOOLEAN DEFAULT true,
    notif_os_editada_texto TEXT DEFAULT 'Olá {{cliente}}, sua OS #{{numero}} foi atualizada para o status: {{status}}.',
    notif_nfe_emitida BOOLEAN DEFAULT true,
    notif_nfe_emitida_texto TEXT DEFAULT 'Olá {{cliente}}, sua NF-e referente à venda #{{numero}} foi emitida.',
    boas_vindas BOOLEAN DEFAULT true,
    boas_vindas_texto TEXT DEFAULT 'Olá {{cliente}}, seja bem-vindo à SpaceTech! É um prazer ter você conosco.',
    pesquisa_pos_os BOOLEAN DEFAULT true,
    pesquisa_pos_os_texto TEXT DEFAULT 'Olá {{cliente}}, como foi sua experiência com a OS #{{numero}}? Sua avaliação é muito importante.',
    pesquisa_pos_venda BOOLEAN DEFAULT true,
    pesquisa_pos_venda_texto TEXT DEFAULT 'Olá {{cliente}}, o que achou da sua compra #{{numero}}?',
    relatorio_semanal_ia BOOLEAN DEFAULT false,
    relatorio_semanal_ia_texto TEXT DEFAULT 'Seu resumo semanal está pronto! Confira o desempenho da sua loja.',
    feliz_aniversario BOOLEAN DEFAULT true,
    feliz_aniversario_texto TEXT DEFAULT 'Parabéns {{cliente}}! A SpaceTech te deseja um feliz aniversário.',
    lembrete_tecnico BOOLEAN DEFAULT true,
    lembrete_tecnico_texto TEXT DEFAULT 'Olá {{tecnico}}, você tem uma visita/entrega agendada para hoje.',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_config TO authenticated;
GRANT ALL ON public.whatsapp_config TO service_role;

ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own whatsapp config" 
ON public.whatsapp_config 
FOR ALL 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
