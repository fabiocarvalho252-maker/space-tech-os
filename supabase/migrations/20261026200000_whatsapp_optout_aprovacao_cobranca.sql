-- Central de WhatsApp, parte 2:
--   1. PARAR: o cliente pede para não receber mensagens automáticas;
--   2. aprovação humana por automação (a mensagem espera alguém aprovar);
--   3. automações de cobrança Pix (lembrete perto do vencimento e
--      confirmação de pagamento);
--   4. foto de perfil do contato e tempo real das conversas.
-- Tudo aditivo.

-- ---------------------------------------------------------------------
-- Conversa: PARAR e foto
-- ---------------------------------------------------------------------
ALTER TABLE public.whatsapp_conversas
  ADD COLUMN IF NOT EXISTS opt_out_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS foto_atualizada_em TIMESTAMPTZ;

ALTER TABLE public.whatsapp_conversa_eventos DROP CONSTRAINT IF EXISTS whatsapp_conversa_eventos_tipo_check;
ALTER TABLE public.whatsapp_conversa_eventos ADD CONSTRAINT whatsapp_conversa_eventos_tipo_check
  CHECK (tipo IN (
    'assumiu', 'transferiu', 'liberou', 'encerrou', 'reabriu',
    'vinculou_cliente', 'desvinculou_cliente', 'prioridade', 'etiquetas',
    'opt_out', 'opt_in'
  ));

-- ---------------------------------------------------------------------
-- Mensagem esperando aprovação
-- ---------------------------------------------------------------------
ALTER TABLE public.whatsapp_messages DROP CONSTRAINT IF EXISTS whatsapp_messages_status_check;
ALTER TABLE public.whatsapp_messages ADD CONSTRAINT whatsapp_messages_status_check
  CHECK (status = ANY (ARRAY['pendente', 'enviado', 'falhou', 'recebido', 'agendado', 'cancelado', 'aguardando_aprovacao']));

CREATE INDEX IF NOT EXISTS whatsapp_messages_aprovacao_idx
  ON public.whatsapp_messages (user_id, created_at DESC)
  WHERE status = 'aguardando_aprovacao';

-- ---------------------------------------------------------------------
-- Configuração
-- ---------------------------------------------------------------------
ALTER TABLE public.whatsapp_config
  -- Automações (chaves de whatsapp_automacao_chave) que só saem aprovadas.
  ADD COLUMN IF NOT EXISTS aprovacao_automacoes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notif_cobranca_lembrete_auto BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cobranca_lembrete_texto TEXT NOT NULL DEFAULT
    'Olá {{cliente}}! Passando para lembrar do pagamento de {{valor}} na {{loja}}. O Pix vence {{vencimento}}. Segue abaixo o código Pix copia e cola. Se já pagou, desconsidere 🙂',
  ADD COLUMN IF NOT EXISTS notif_cobranca_paga_auto BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cobranca_paga_texto TEXT NOT NULL DEFAULT
    'Olá {{cliente}}! Recebemos seu pagamento de {{valor}}. Obrigado pela confiança na {{loja}}! ✅',
  ADD COLUMN IF NOT EXISTS notif_cobranca_desde TIMESTAMPTZ;

-- Cobranças contam só a partir de quando a loja ligou alguma das duas
-- (mesma ideia das outras automações): ligar não dispara nada antigo.
CREATE OR REPLACE FUNCTION public.whatsapp_config_cobranca_desde()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.notif_cobranca_lembrete_auto OR NEW.notif_cobranca_paga_auto)
     AND (TG_OP = 'INSERT'
          OR NOT (COALESCE(OLD.notif_cobranca_lembrete_auto, false) OR COALESCE(OLD.notif_cobranca_paga_auto, false))) THEN
    NEW.notif_cobranca_desde := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS whatsapp_config_cobranca_desde ON public.whatsapp_config;
CREATE TRIGGER whatsapp_config_cobranca_desde
  BEFORE INSERT OR UPDATE ON public.whatsapp_config
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_config_cobranca_desde();

-- Uma mensagem de cada tipo por cobrança.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_cobranca_key
  ON public.whatsapp_messages (user_id, template_id)
  WHERE template_id LIKE 'cobranca\_%';

-- ---------------------------------------------------------------------
-- Regras na hora de gravar uma mensagem automática
-- ---------------------------------------------------------------------
-- Automação de cada template_id (null = mensagem manual/de atendimento).
-- Mesmas chaves de AUTOMACOES em src/lib/whatsapp/automacoes.ts.
CREATE OR REPLACE FUNCTION public.whatsapp_automacao_chave(p_template TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_template IS NULL THEN NULL
    WHEN p_template = 'os_pronta' THEN 'os_pronta'
    WHEN p_template = 'pesquisa_auto' THEN 'pesquisa_auto'
    WHEN p_template LIKE 'pos\_venda\_%' THEN 'pos_venda'
    WHEN p_template LIKE 'boas\_vindas\_%' THEN 'boas_vindas'
    WHEN p_template LIKE 'aniversario\_%' THEN 'aniversario'
    WHEN p_template LIKE 'agradecimento\_%' THEN 'agradecimento'
    WHEN p_template LIKE 'cobranca\_lembrete\_%' OR p_template LIKE 'cobranca\_pix\_%' THEN 'cobranca_lembrete'
    WHEN p_template LIKE 'cobranca\_paga\_%' THEN 'cobranca_paga'
    ELSE NULL
  END
$$;

-- 'ok' | 'opt_out' | 'aprovacao' para uma automação desta empresa e número.
CREATE OR REPLACE FUNCTION public.whatsapp_regra_automacao(p_empresa UUID, p_numero TEXT, p_template TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN public.whatsapp_automacao_chave(p_template) IS NULL THEN 'ok'
    WHEN EXISTS (
      SELECT 1 FROM public.whatsapp_conversas c
       WHERE c.user_id = p_empresa
         AND c.chave_telefone = public.whatsapp_chave_telefone(p_numero)
         AND c.opt_out_em IS NOT NULL
    ) THEN 'opt_out'
    WHEN EXISTS (
      SELECT 1 FROM public.whatsapp_config w
       WHERE w.user_id = p_empresa
         AND public.whatsapp_automacao_chave(p_template) = ANY (w.aprovacao_automacoes)
    ) THEN 'aprovacao'
    ELSE 'ok'
  END
$$;

-- Toda mensagem automática gravada para sair (fila ou envio direto) passa
-- por aqui: contato que pediu PARAR → cancelada; automação que exige
-- aprovação → espera alguém aprovar. Roda depois de definir a conversa
-- (ordem alfabética dos triggers).
CREATE OR REPLACE FUNCTION public.whatsapp_messages_regras_automacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_regra TEXT;
BEGIN
  IF NEW.direction <> 'outbound' OR NEW.status NOT IN ('agendado', 'pendente') THEN
    RETURN NEW;
  END IF;
  v_regra := public.whatsapp_regra_automacao(NEW.user_id, NEW.phone_number, NEW.template_id);
  IF v_regra = 'opt_out' THEN
    NEW.status := 'cancelado';
    NEW.error := 'O cliente pediu para não receber mensagens automáticas (PARAR).';
  ELSIF v_regra = 'aprovacao' THEN
    NEW.status := 'aguardando_aprovacao';
    NEW.scheduled_at := COALESCE(NEW.scheduled_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS whatsapp_messages_regras_automacao ON public.whatsapp_messages;
CREATE TRIGGER whatsapp_messages_regras_automacao
  BEFORE INSERT ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_messages_regras_automacao();

-- A conversa não mostra como "última mensagem" algo que ainda não saiu.
CREATE OR REPLACE FUNCTION public.whatsapp_messages_atualizar_conversa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preview TEXT;
  v_novo BOOLEAN := TG_OP = 'INSERT';
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

  UPDATE public.whatsapp_conversas c SET
    ultima_mensagem_em = now(),
    ultima_mensagem_preview = v_preview,
    ultima_direcao = NEW.direction,
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
$$;

-- ---------------------------------------------------------------------
-- Tempo real: o navegador assina as conversas da empresa (o RLS de
-- whatsapp_conversas — módulo whatsapp/ver — vale também no Realtime).
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_conversas'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversas;
  END IF;
END $$;
