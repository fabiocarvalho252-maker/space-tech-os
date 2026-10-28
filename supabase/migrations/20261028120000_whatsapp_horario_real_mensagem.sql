-- Horário real das mensagens: o webhook agora grava created_at com a hora em
-- que a mensagem foi enviada no WhatsApp (não a hora em que chegou ao
-- servidor — quando a sessão trava, chegam todas juntas depois). A conversa
-- passa a usar esse horário, e uma mensagem atrasada que é mais antiga que a
-- última não troca a prévia nem a hora da lista.
CREATE OR REPLACE FUNCTION public.whatsapp_messages_atualizar_conversa()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_preview TEXT;
  v_novo BOOLEAN := TG_OP = 'INSERT';
  v_quando TIMESTAMPTZ;
BEGIN
  IF NEW.conversa_id IS NULL OR NEW.status IN ('agendado', 'cancelado', 'aguardando_aprovacao') THEN
    RETURN NEW;
  END IF;
  -- Atualização só conta quando a mensagem agendada sai da fila.
  IF NOT v_novo AND OLD.status NOT IN ('agendado', 'cancelado', 'aguardando_aprovacao') THEN
    RETURN NEW;
  END IF;

  v_preview := left(COALESCE(NULLIF(trim(NEW.content), ''),
    CASE NEW.midia_tipo
      WHEN 'imagem' THEN '📷 Imagem'
      WHEN 'documento' THEN '📄 ' || COALESCE(NEW.midia_nome, 'Documento')
      WHEN 'audio' THEN '🎤 Áudio'
      WHEN 'video' THEN '🎬 Vídeo'
      WHEN 'figurinha' THEN 'Figurinha'
      ELSE ''
    END), 140);

  -- Mensagem nova: a hora de envio no WhatsApp; agendada saindo da fila: agora.
  v_quando := CASE WHEN v_novo THEN LEAST(NEW.created_at, now()) ELSE now() END;

  UPDATE public.whatsapp_conversas c SET
    ultima_mensagem_em = GREATEST(COALESCE(c.ultima_mensagem_em, v_quando), v_quando),
    ultima_mensagem_preview = CASE
      WHEN c.ultima_mensagem_em IS NULL OR v_quando >= c.ultima_mensagem_em THEN v_preview
      ELSE c.ultima_mensagem_preview END,
    ultima_direcao = CASE
      WHEN c.ultima_mensagem_em IS NULL OR v_quando >= c.ultima_mensagem_em THEN NEW.direction
      ELSE c.ultima_direcao END,
    nao_lidas = c.nao_lidas + CASE WHEN v_novo AND NEW.direction = 'inbound' THEN 1 ELSE 0 END,
    phone_number = CASE WHEN NEW.direction = 'inbound' THEN NEW.phone_number ELSE c.phone_number END,
    contact_name = CASE
      WHEN NEW.direction = 'inbound' AND NEW.contact_name IS NOT NULL THEN NEW.contact_name
      ELSE c.contact_name END,
    status = CASE
      WHEN NEW.direction = 'inbound' THEN 'aberta'
      WHEN NEW.sent_by IS NOT NULL THEN 'aguardando'
      ELSE c.status END,
    encerrada_em = CASE
      WHEN NEW.direction = 'inbound' OR NEW.sent_by IS NOT NULL THEN NULL
      ELSE c.encerrada_em END
  WHERE c.id = NEW.conversa_id;
  RETURN NEW;
END;
$function$;
