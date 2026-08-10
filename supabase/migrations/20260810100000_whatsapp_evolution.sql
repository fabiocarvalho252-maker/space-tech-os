-- Real WhatsApp connection state + message log for the Evolution API
-- integration. `whatsapp_config` (existing) stays as-is — it only holds
-- notification message templates. These two tables hold the actual
-- session/connection state and the message history, one row per company
-- (user_id, same "empresa" convention as every other table) and are only
-- ever written by the server (src/lib/whatsapp/*), never directly by the
-- client, since every write requires talking to the Evolution API first.

CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    instance_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'desconectado'
      CHECK (status IN ('desconectado', 'conectando', 'conectado', 'erro')),
    phone_number TEXT,
    qr_code TEXT,
    last_connected_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id),
    UNIQUE (instance_name)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    connection_id UUID REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    phone_number TEXT NOT NULL,
    contact_name TEXT,
    content TEXT,
    status TEXT NOT NULL DEFAULT 'recebido'
      CHECK (status IN ('pendente', 'enviado', 'falhou', 'recebido')),
    evolution_message_id TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Keeps webhook retries from Evolution API from duplicating the same
-- inbound/outbound message row.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_evolution_message_id_key
  ON public.whatsapp_messages (evolution_message_id)
  WHERE evolution_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS whatsapp_messages_user_id_created_at_idx
  ON public.whatsapp_messages (user_id, created_at DESC);

CREATE TRIGGER whatsapp_connections_set_updated_at
  BEFORE UPDATE ON public.whatsapp_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_connections TO authenticated;
GRANT ALL ON public.whatsapp_connections TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;

ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Same permission-matrix gate already used for whatsapp_config: governed by
-- the "configuracoes" module (Configurações → WhatsApp already lives there).
CREATE POLICY "whatsapp_connections ver" ON public.whatsapp_connections FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'configuracoes', 'ver'));
CREATE POLICY "whatsapp_connections gerenciar" ON public.whatsapp_connections FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'configuracoes', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'configuracoes', 'gerenciar'));

CREATE POLICY "whatsapp_messages ver" ON public.whatsapp_messages FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'configuracoes', 'ver'));
CREATE POLICY "whatsapp_messages gerenciar" ON public.whatsapp_messages FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'configuracoes', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'configuracoes', 'gerenciar'));
