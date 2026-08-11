-- Extends whatsapp_messages so a WhatsApp send can be tied back to the OS
-- that triggered it (for the OS timeline and for "which OS was this
-- message about"), carry which attachments were requested, and support
-- scheduled sends ("agendar na fila") — there is no cron/worker in this
-- project, so a scheduled row just sits with status='agendado' until the
-- next time someone visits Ordens, which opportunistically flushes any
-- whose scheduled_at has passed (see processarNotificacoesAgendadasOs).

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS os_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_id TEXT,
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error TEXT,
  ADD COLUMN IF NOT EXISTS sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.whatsapp_messages DROP CONSTRAINT IF EXISTS whatsapp_messages_status_check;
ALTER TABLE public.whatsapp_messages ADD CONSTRAINT whatsapp_messages_status_check
  CHECK (status IN ('pendente', 'enviado', 'falhou', 'recebido', 'agendado'));

CREATE INDEX IF NOT EXISTS whatsapp_messages_os_id_idx
  ON public.whatsapp_messages (os_id) WHERE os_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS whatsapp_messages_agendadas_idx
  ON public.whatsapp_messages (user_id, scheduled_at) WHERE status = 'agendado';
