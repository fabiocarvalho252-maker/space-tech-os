-- Central de WhatsApp (tela /whatsapp): conversas com atendente responsável,
-- status, etiquetas, vínculo com cliente, anexos, respostas rápidas e
-- trilha de auditoria. Tudo aditivo — nenhuma coluna existente muda.
--
-- As conversas são montadas por trigger em whatsapp_messages: qualquer
-- caminho que já grava mensagens (fila, automações, OS pronta, PDF da OS,
-- webhook) passa a aparecer na conversa certa sem mudar aquele código.
-- Escrita só pelo servidor (service role); o navegador só lê, pelo RLS.

-- ---------------------------------------------------------------------
-- Permissão do módulo "whatsapp"
-- ---------------------------------------------------------------------
ALTER TABLE public.role_permissions DROP CONSTRAINT role_permissions_modulo_check;
ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_modulo_check
  CHECK (modulo IN (
    'clientes', 'fornecedores', 'produtos', 'ordens', 'vendas',
    'compras', 'financeiro', 'cobrancas', 'garantia', 'configuracoes',
    'agenda', 'seminovos', 'relatorios', 'notas', 'aparelhos', 'crediario',
    'whatsapp'
  ));

-- ver = acompanhar as conversas; gerenciar = responder, assumir, encerrar.
-- Atendente atende; técnico e financeiro não entram por padrão (a loja
-- muda em Usuários → Permissões).
INSERT INTO public.role_permissions (empresa_id, role, modulo, pode_ver, pode_gerenciar)
SELECT p.id, r.role, 'whatsapp',
  r.role IN ('admin', 'gerente', 'atendente'),
  r.role IN ('admin', 'gerente', 'atendente')
FROM public.profiles p
CROSS JOIN (VALUES ('admin'), ('gerente'), ('tecnico'), ('atendente'), ('financeiro')) AS r(role)
ON CONFLICT (empresa_id, role, modulo) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_profile_role_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.role_permissions (empresa_id, role, modulo, pode_ver, pode_gerenciar)
  SELECT NEW.id, r.role, m.modulo,
    CASE
      WHEN r.role = 'admin' THEN true
      WHEN r.role = 'gerente' THEN true
      WHEN r.role = 'tecnico' THEN m.modulo IN ('ordens', 'clientes', 'produtos', 'garantia', 'agenda')
      WHEN r.role = 'atendente' THEN m.modulo IN ('ordens', 'clientes', 'produtos', 'vendas', 'garantia', 'cobrancas', 'agenda', 'seminovos', 'notas', 'aparelhos', 'crediario', 'whatsapp')
      WHEN r.role = 'financeiro' THEN m.modulo IN ('financeiro', 'cobrancas', 'vendas', 'compras', 'clientes', 'seminovos', 'relatorios', 'notas', 'aparelhos', 'crediario')
    END,
    CASE
      WHEN r.role = 'admin' THEN true
      WHEN r.role = 'gerente' THEN m.modulo <> 'configuracoes'
      WHEN r.role = 'tecnico' THEN m.modulo IN ('ordens', 'agenda')
      WHEN r.role = 'atendente' THEN m.modulo IN ('ordens', 'clientes', 'vendas', 'agenda', 'seminovos', 'notas', 'aparelhos', 'whatsapp')
      WHEN r.role = 'financeiro' THEN m.modulo IN ('financeiro', 'cobrancas', 'seminovos', 'relatorios', 'aparelhos', 'crediario')
    END
  FROM (VALUES ('admin'), ('gerente'), ('tecnico'), ('atendente'), ('financeiro')) AS r(role)
  CROSS JOIN (VALUES
    ('clientes'), ('fornecedores'), ('produtos'), ('ordens'), ('vendas'),
    ('compras'), ('financeiro'), ('cobrancas'), ('garantia'), ('configuracoes'),
    ('agenda'), ('seminovos'), ('relatorios'), ('notas'), ('aparelhos'), ('crediario'),
    ('whatsapp')
  ) AS m(modulo)
  ON CONFLICT (empresa_id, role, modulo) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- Telefone → chave da conversa
-- ---------------------------------------------------------------------
-- Mesma regra de chaveTelefone() em src/lib/whatsapp/telefone.ts: o
-- WhatsApp devolve 557498125994 para quem está cadastrado como
-- (74) 99812-5994 — DDD + últimos 8 dígitos casam os dois.
CREATE OR REPLACE FUNCTION public.whatsapp_chave_telefone(p_numero TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  d TEXT := regexp_replace(COALESCE(p_numero, ''), '\D', '', 'g');
BEGIN
  IF d LIKE '55%' AND length(d) >= 12 THEN
    d := substr(d, 3);
  END IF;
  IF length(d) BETWEEN 10 AND 11 THEN
    RETURN substr(d, 1, 2) || right(d, 8);
  END IF;
  RETURN d;
END;
$$;

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chave_telefone TEXT NOT NULL,
  -- Número para onde responder: o último que escreveu (pode vir sem o 9).
  phone_number TEXT NOT NULL,
  contact_name TEXT,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'aberta'
    CHECK (status IN ('aberta', 'aguardando', 'encerrada')),
  atribuida_a UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  prioridade TEXT NOT NULL DEFAULT 'normal'
    CHECK (prioridade IN ('baixa', 'normal', 'alta')),
  etiquetas TEXT[] NOT NULL DEFAULT '{}',
  nao_lidas INTEGER NOT NULL DEFAULT 0,
  ultima_mensagem_em TIMESTAMPTZ,
  ultima_mensagem_preview TEXT,
  ultima_direcao TEXT CHECK (ultima_direcao IN ('inbound', 'outbound')),
  encerrada_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, chave_telefone)
);

CREATE INDEX IF NOT EXISTS whatsapp_conversas_lista_idx
  ON public.whatsapp_conversas (user_id, ultima_mensagem_em DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS whatsapp_conversas_atendente_idx
  ON public.whatsapp_conversas (user_id, atribuida_a);
CREATE INDEX IF NOT EXISTS whatsapp_conversas_cliente_idx
  ON public.whatsapp_conversas (cliente_id);

CREATE TRIGGER whatsapp_conversas_set_updated_at
  BEFORE UPDATE ON public.whatsapp_conversas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS conversa_id UUID REFERENCES public.whatsapp_conversas(id) ON DELETE SET NULL,
  -- Anexo guardado no bucket privado whatsapp-midia (nunca link público).
  ADD COLUMN IF NOT EXISTS midia_tipo TEXT
    CHECK (midia_tipo IN ('imagem', 'documento', 'audio', 'video', 'figurinha')),
  ADD COLUMN IF NOT EXISTS midia_mime TEXT,
  ADD COLUMN IF NOT EXISTS midia_nome TEXT,
  ADD COLUMN IF NOT EXISTS midia_path TEXT,
  ADD COLUMN IF NOT EXISTS midia_tamanho BIGINT,
  -- Confirmação do WhatsApp (MESSAGES_UPDATE): só avança, nunca volta.
  ADD COLUMN IF NOT EXISTS entrega TEXT CHECK (entrega IN ('entregue', 'lido')),
  -- Mensagem citada (id do WhatsApp), quando o cliente responde uma específica.
  ADD COLUMN IF NOT EXISTS resposta_a TEXT;

CREATE INDEX IF NOT EXISTS whatsapp_messages_conversa_idx
  ON public.whatsapp_messages (conversa_id, created_at DESC);

-- Quem assumiu, transferiu, encerrou, vinculou cliente... (auditoria).
CREATE TABLE IF NOT EXISTS public.whatsapp_conversa_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversa_id UUID NOT NULL REFERENCES public.whatsapp_conversas(id) ON DELETE CASCADE,
  autor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'assumiu', 'transferiu', 'liberou', 'encerrou', 'reabriu',
    'vinculou_cliente', 'desvinculou_cliente', 'prioridade', 'etiquetas'
  )),
  detalhes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS whatsapp_conversa_eventos_conversa_idx
  ON public.whatsapp_conversa_eventos (conversa_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.whatsapp_respostas_rapidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  atalho TEXT NOT NULL CHECK (atalho ~ '^[a-z0-9_-]{1,30}$'),
  texto TEXT NOT NULL CHECK (length(texto) BETWEEN 1 AND 4096),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, atalho)
);

-- ---------------------------------------------------------------------
-- Montagem das conversas
-- ---------------------------------------------------------------------
-- Cliente da empresa com o mesmo telefone — só vincula sozinho quando há
-- exatamente um. Com dois ou mais, o atendente escolhe na tela.
CREATE OR REPLACE FUNCTION public.whatsapp_cliente_unico(p_empresa UUID, p_chave TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN count(*) = 1 THEN min(c.id::text)::uuid END
  FROM public.clientes c
  WHERE c.user_id = p_empresa
    AND c.telefone IS NOT NULL
    AND public.whatsapp_chave_telefone(c.telefone) = p_chave
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_messages_definir_conversa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chave TEXT;
  v_id UUID;
BEGIN
  IF NEW.conversa_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  v_chave := public.whatsapp_chave_telefone(NEW.phone_number);
  IF v_chave = '' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_id FROM public.whatsapp_conversas
   WHERE user_id = NEW.user_id AND chave_telefone = v_chave;

  IF v_id IS NULL THEN
    INSERT INTO public.whatsapp_conversas
      (user_id, chave_telefone, phone_number, contact_name, cliente_id, status)
    VALUES (
      NEW.user_id, v_chave, NEW.phone_number,
      CASE WHEN NEW.direction = 'inbound' THEN NEW.contact_name END,
      public.whatsapp_cliente_unico(NEW.user_id, v_chave),
      -- Conversa que nasce de envio automático (pesquisa, aniversário...)
      -- não entra na lista de abertas até o cliente responder.
      CASE
        WHEN NEW.direction = 'inbound' THEN 'aberta'
        WHEN NEW.sent_by IS NOT NULL THEN 'aguardando'
        ELSE 'encerrada'
      END
    )
    ON CONFLICT (user_id, chave_telefone) DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      SELECT id INTO v_id FROM public.whatsapp_conversas
       WHERE user_id = NEW.user_id AND chave_telefone = v_chave;
    END IF;
  END IF;

  NEW.conversa_id := v_id;
  RETURN NEW;
END;
$$;

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
  IF NEW.conversa_id IS NULL OR NEW.status IN ('agendado', 'cancelado') THEN
    RETURN NEW;
  END IF;
  -- Atualização só conta quando a mensagem agendada sai da fila.
  IF NOT v_novo AND OLD.status NOT IN ('agendado', 'cancelado') THEN
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

CREATE TRIGGER whatsapp_messages_definir_conversa
  BEFORE INSERT ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_messages_definir_conversa();

CREATE TRIGGER whatsapp_messages_atualizar_conversa
  AFTER INSERT OR UPDATE OF status ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_messages_atualizar_conversa();

-- ---------------------------------------------------------------------
-- Conversas para o histórico que já existe
-- ---------------------------------------------------------------------
INSERT INTO public.whatsapp_conversas
  (user_id, chave_telefone, phone_number, contact_name, status, created_at)
SELECT DISTINCT ON (m.user_id, public.whatsapp_chave_telefone(m.phone_number))
  m.user_id,
  public.whatsapp_chave_telefone(m.phone_number),
  m.phone_number,
  NULL,
  'encerrada',
  m.created_at
FROM public.whatsapp_messages m
WHERE public.whatsapp_chave_telefone(m.phone_number) <> ''
ORDER BY m.user_id, public.whatsapp_chave_telefone(m.phone_number), m.created_at
ON CONFLICT (user_id, chave_telefone) DO NOTHING;

UPDATE public.whatsapp_messages m
   SET conversa_id = c.id
  FROM public.whatsapp_conversas c
 WHERE m.conversa_id IS NULL
   AND c.user_id = m.user_id
   AND c.chave_telefone = public.whatsapp_chave_telefone(m.phone_number);

UPDATE public.whatsapp_conversas c SET
  ultima_mensagem_em = s.created_at,
  ultima_mensagem_preview = left(COALESCE(s.content, ''), 140),
  ultima_direcao = s.direction,
  phone_number = COALESCE(s.inbound_phone, c.phone_number),
  contact_name = s.inbound_name,
  cliente_id = public.whatsapp_cliente_unico(c.user_id, c.chave_telefone),
  -- Cliente que escreveu nos últimos 3 dias e ficou sem resposta.
  status = CASE
    WHEN s.direction = 'inbound' AND s.created_at > now() - interval '3 days' THEN 'aberta'
    ELSE 'encerrada' END
FROM (
  SELECT cv.id, u.created_at, u.content, u.direction,
         i.phone_number AS inbound_phone, i.contact_name AS inbound_name
  FROM public.whatsapp_conversas cv
  CROSS JOIN LATERAL (
    SELECT m.created_at, m.content, m.direction FROM public.whatsapp_messages m
     WHERE m.conversa_id = cv.id AND m.status NOT IN ('agendado', 'cancelado')
     ORDER BY m.created_at DESC LIMIT 1
  ) u
  LEFT JOIN LATERAL (
    SELECT m.phone_number, m.contact_name FROM public.whatsapp_messages m
     WHERE m.conversa_id = cv.id AND m.direction = 'inbound'
     ORDER BY m.created_at DESC LIMIT 1
  ) i ON true
  WHERE cv.ultima_mensagem_em IS NULL
) s
WHERE c.id = s.id;

-- ---------------------------------------------------------------------
-- Acesso: navegador só lê; escrita é do servidor (service role)
-- ---------------------------------------------------------------------
GRANT SELECT ON public.whatsapp_conversas, public.whatsapp_conversa_eventos,
  public.whatsapp_respostas_rapidas TO authenticated;
GRANT ALL ON public.whatsapp_conversas, public.whatsapp_conversa_eventos,
  public.whatsapp_respostas_rapidas TO service_role;

ALTER TABLE public.whatsapp_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversa_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_respostas_rapidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_conversas ver" ON public.whatsapp_conversas FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'whatsapp', 'ver'));
CREATE POLICY "whatsapp_conversa_eventos ver" ON public.whatsapp_conversa_eventos FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'whatsapp', 'ver'));
CREATE POLICY "whatsapp_respostas_rapidas ver" ON public.whatsapp_respostas_rapidas FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'whatsapp', 'ver'));

-- Anexos: bucket privado, sem policy para o navegador — o servidor confere
-- a permissão e devolve um link assinado de poucos minutos.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('whatsapp-midia', 'whatsapp-midia', false, 16777216)
ON CONFLICT (id) DO NOTHING;
