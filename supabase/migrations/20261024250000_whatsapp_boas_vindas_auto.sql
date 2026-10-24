-- Boas-vindas automáticas no WhatsApp para cliente novo (Configurações >
-- WhatsApp). Desligada por padrão; a coluna antiga boas_vindas vinha ligada
-- por padrão sem enviar nada, então não é reaproveitada.
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS notif_boas_vindas_auto BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notif_boas_vindas_auto_desde TIMESTAMPTZ;

-- Ao ligar, guarda o momento: só clientes cadastrados depois disso recebem
-- as boas-vindas — ligar não dispara mensagem para a base antiga.
CREATE OR REPLACE FUNCTION public.whatsapp_config_boas_vindas_desde()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.notif_boas_vindas_auto
     AND (TG_OP = 'INSERT' OR NOT OLD.notif_boas_vindas_auto) THEN
    NEW.notif_boas_vindas_auto_desde := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS whatsapp_config_boas_vindas_desde ON public.whatsapp_config;
CREATE TRIGGER whatsapp_config_boas_vindas_desde
  BEFORE INSERT OR UPDATE OF notif_boas_vindas_auto ON public.whatsapp_config
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_config_boas_vindas_desde();

-- O texto padrão citava a SpaceTech para toda empresa; agora usa {{loja}}
-- (nome da loja no cadastro). Só troca onde o texto nunca foi editado.
ALTER TABLE public.whatsapp_config
  ALTER COLUMN boas_vindas_texto
  SET DEFAULT 'Olá {{cliente}}, seja bem-vindo(a) à {{loja}}! É um prazer ter você conosco. Salve este número para falar com a gente.';
UPDATE public.whatsapp_config
SET boas_vindas_texto = 'Olá {{cliente}}, seja bem-vindo(a) à {{loja}}! É um prazer ter você conosco. Salve este número para falar com a gente.'
WHERE boas_vindas_texto = 'Olá {{cliente}}, seja bem-vindo à SpaceTech! É um prazer ter você conosco.';

-- Uma mensagem por cliente (template_id = 'boas_vindas_<id do cliente>'),
-- mesmo com duas telas abertas ao mesmo tempo.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_boas_vindas_key
  ON public.whatsapp_messages (user_id, template_id)
  WHERE template_id LIKE 'boas\_vindas\_%';

NOTIFY pgrst, 'reload schema';
