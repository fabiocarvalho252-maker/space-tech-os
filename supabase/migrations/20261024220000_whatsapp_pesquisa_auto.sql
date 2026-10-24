-- Pesquisa de satisfação automática depois da entrega da OS (Configurações >
-- WhatsApp). Desligada por padrão; a coluna antiga pesquisa_pos_os vinha
-- ligada por padrão e só controlava o modelo manual, então não é reaproveitada.
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS notif_pesquisa_auto BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notif_pesquisa_auto_desde TIMESTAMPTZ;

-- Ao ligar, guarda o momento: só OS entregues depois disso recebem a
-- pesquisa — ligar não dispara mensagem para entregas antigas.
CREATE OR REPLACE FUNCTION public.whatsapp_config_pesquisa_desde()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.notif_pesquisa_auto AND (TG_OP = 'INSERT' OR NOT OLD.notif_pesquisa_auto) THEN
    NEW.notif_pesquisa_auto_desde := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS whatsapp_config_pesquisa_desde ON public.whatsapp_config;
CREATE TRIGGER whatsapp_config_pesquisa_desde
  BEFORE INSERT OR UPDATE OF notif_pesquisa_auto ON public.whatsapp_config
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_config_pesquisa_desde();

-- Uma pesquisa automática por OS, mesmo com duas telas abertas ao mesmo tempo.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_pesquisa_auto_os_key
  ON public.whatsapp_messages (os_id)
  WHERE template_id = 'pesquisa_auto';

NOTIFY pgrst, 'reload schema';
