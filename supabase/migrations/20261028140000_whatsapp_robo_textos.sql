-- Textos e opções do robô de atendimento editáveis pela loja
-- (Configurações > WhatsApp > Robô de atendimento). {} = textos padrão;
-- campo vazio também cai no padrão (ver lerTextos em src/lib/whatsapp/robo.ts).
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS robo_textos JSONB NOT NULL DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';
