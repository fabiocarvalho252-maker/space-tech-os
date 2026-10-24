-- Aviso automático no WhatsApp quando a OS passa para "Pronto". Desligado por
-- padrão: manda mensagem para o cliente sem ninguém clicar em enviar, então
-- cada loja liga em Configurações > WhatsApp.
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS notif_os_pronta BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notif_os_pronta_texto TEXT NOT NULL DEFAULT
    'Olá {{cliente}}! Seu {{aparelho}} (OS #{{numero}}) está pronto para retirada. Acompanhe pelo link: {{link}}';

NOTIFY pgrst, 'reload schema';
