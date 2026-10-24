-- Mensagem de aniversário automática no WhatsApp (Configurações > WhatsApp).
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS data_nascimento DATE;

-- Desligada por padrão; a coluna antiga feliz_aniversario vinha ligada por
-- padrão sem enviar nada, então não é reaproveitada.
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS notif_aniversario_auto BOOLEAN NOT NULL DEFAULT false;

-- O texto padrão citava a SpaceTech para toda empresa; troca pelo neutro
-- (só onde o texto nunca foi editado).
ALTER TABLE public.whatsapp_config
  ALTER COLUMN feliz_aniversario_texto
  SET DEFAULT 'Parabéns, {{cliente}}! 🎉 Desejamos um feliz aniversário e um ótimo dia!';
UPDATE public.whatsapp_config
SET feliz_aniversario_texto = 'Parabéns, {{cliente}}! 🎉 Desejamos um feliz aniversário e um ótimo dia!'
WHERE feliz_aniversario_texto = 'Parabéns {{cliente}}! A SpaceTech te deseja um feliz aniversário.';

-- Uma mensagem por número por ano (template_id = 'aniversario_<ano>'),
-- mesmo com duas telas abertas ao mesmo tempo.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_aniversario_key
  ON public.whatsapp_messages (user_id, phone_number, template_id)
  WHERE template_id LIKE 'aniversario\_%';

NOTIFY pgrst, 'reload schema';
