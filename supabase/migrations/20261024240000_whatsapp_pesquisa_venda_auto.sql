-- Pesquisa pós-venda automática no WhatsApp (Configurações > WhatsApp).
-- Desligada por padrão; a coluna antiga pesquisa_pos_venda vinha ligada por
-- padrão sem enviar nada, então não é reaproveitada.
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS notif_pesquisa_venda_auto BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notif_pesquisa_venda_auto_desde TIMESTAMPTZ;

-- Ao ligar, guarda o momento: só vendas feitas depois disso recebem a
-- pesquisa — ligar não dispara mensagem para vendas antigas.
CREATE OR REPLACE FUNCTION public.whatsapp_config_pesquisa_venda_desde()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.notif_pesquisa_venda_auto
     AND (TG_OP = 'INSERT' OR NOT OLD.notif_pesquisa_venda_auto) THEN
    NEW.notif_pesquisa_venda_auto_desde := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS whatsapp_config_pesquisa_venda_desde ON public.whatsapp_config;
CREATE TRIGGER whatsapp_config_pesquisa_venda_desde
  BEFORE INSERT OR UPDATE OF notif_pesquisa_venda_auto ON public.whatsapp_config
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_config_pesquisa_venda_desde();

-- Uma pesquisa por venda (template_id = 'pos_venda_<id da venda>'), mesmo
-- com duas telas abertas ao mesmo tempo.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_pos_venda_key
  ON public.whatsapp_messages (user_id, template_id)
  WHERE template_id LIKE 'pos\_venda\_%';

NOTIFY pgrst, 'reload schema';
