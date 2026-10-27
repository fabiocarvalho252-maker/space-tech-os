-- Consultar Peças pelo WhatsApp conectado da empresa (Evolution), além do
-- link wa.me. Novas situações:
--   enviada  — a Evolution aceitou a mensagem (envio real, não suposição);
--   falhou   — a Evolution recusou; dá para tentar de novo.
-- E "respondida" passa a ser marcada sozinha quando chega uma mensagem do
-- fornecedor depois do envio (até 7 dias). Tudo aditivo.

ALTER TABLE public.fornecedor_consultas_pecas
  ADD COLUMN IF NOT EXISTS enviada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS erro TEXT,
  ADD COLUMN IF NOT EXISTS conversa_id UUID REFERENCES public.whatsapp_conversas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS chave_telefone TEXT
    GENERATED ALWAYS AS (public.whatsapp_chave_telefone(whatsapp)) STORED;

ALTER TABLE public.fornecedor_consultas_pecas
  DROP CONSTRAINT IF EXISTS fornecedor_consultas_pecas_status_check;
ALTER TABLE public.fornecedor_consultas_pecas
  ADD CONSTRAINT fornecedor_consultas_pecas_status_check
  CHECK (status IN ('preparada', 'conversa_aberta', 'enviada', 'falhou', 'respondida'));

CREATE INDEX IF NOT EXISTS fornecedor_consultas_pecas_aguardando_idx
  ON public.fornecedor_consultas_pecas (user_id, chave_telefone)
  WHERE status = 'enviada';

-- Mensagem recebida do fornecedor depois do envio = resposta real.
CREATE OR REPLACE FUNCTION public.consultas_pecas_marcar_respondida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.fornecedor_consultas_pecas
     SET status = 'respondida', respondida_em = NEW.created_at
   WHERE user_id = NEW.user_id
     AND status = 'enviada'
     AND chave_telefone = public.whatsapp_chave_telefone(NEW.phone_number)
     AND enviada_em < NEW.created_at
     AND enviada_em > NEW.created_at - INTERVAL '7 days';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS consultas_pecas_resposta ON public.whatsapp_messages;
CREATE TRIGGER consultas_pecas_resposta
  AFTER INSERT ON public.whatsapp_messages
  FOR EACH ROW
  WHEN (NEW.direction = 'inbound')
  EXECUTE FUNCTION public.consultas_pecas_marcar_respondida();
