-- Escritório IA (Fase 3): histórico de missões, eventos e aprovações.
--
-- Quem lê: só o administrador do site, pelo e-mail do login (mesmo critério de
-- SITE_ADMIN_EMAIL no app e no runner). Quem escreve: só o runner, com a service
-- role (que ignora RLS). Nenhum usuário comum consegue ler nem escrever.
--
-- Não aplicar sem revisão. Não apaga nada existente.

CREATE TABLE IF NOT EXISTS public.office_missions (
  id              text PRIMARY KEY,
  created_by      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt          text NOT NULL CHECK (char_length(prompt) BETWEEN 3 AND 4000),
  project_id      text NOT NULL CHECK (project_id ~ '^[a-z0-9][a-z0-9_-]{0,59}$'),
  mode            text NOT NULL CHECK (mode IN ('seguro', 'automatico')),
  status          text NOT NULL DEFAULT 'fila'
                  CHECK (status IN ('fila', 'rodando', 'concluida', 'falhou', 'cancelada')),
  result_markdown text CHECK (char_length(result_markdown) <= 8000),
  error           text CHECK (char_length(error) <= 500),
  input_tokens    integer NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens   integer NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  cost_usd        numeric(10, 4) NOT NULL DEFAULT 0 CHECK (cost_usd >= 0),
  started_at      timestamptz,
  finished_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.office_events (
  id              text PRIMARY KEY,
  mission_id      text NOT NULL REFERENCES public.office_missions(id) ON DELETE CASCADE,
  ts              timestamptz NOT NULL,
  agent_id        text NOT NULL CHECK (char_length(agent_id) <= 120),
  parent_agent_id text CHECK (char_length(parent_agent_id) <= 120),
  type            text NOT NULL CHECK (char_length(type) <= 60),
  state           text CHECK (char_length(state) <= 60),
  text            text CHECK (char_length(text) <= 500),
  tool            jsonb,
  usage           jsonb,
  detail          jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS office_events_mission_idx
  ON public.office_events (mission_id, id);

CREATE TABLE IF NOT EXISTS public.office_approvals (
  id          text PRIMARY KEY,
  mission_id  text NOT NULL REFERENCES public.office_missions(id) ON DELETE CASCADE,
  agent_id    text NOT NULL CHECK (char_length(agent_id) <= 120),
  tool_name   text NOT NULL CHECK (char_length(tool_name) <= 120),
  tool_input  jsonb,
  status      text NOT NULL DEFAULT 'pendente'
              CHECK (status IN ('pendente', 'permitida', 'negada', 'expirada')),
  decided_by  uuid REFERENCES auth.users(id),
  decided_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS: ligado em tudo. Leitura só para o admin; sem policy de escrita para
-- usuários, então só a service role do runner grava.
ALTER TABLE public.office_missions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_approvals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.office_missions, public.office_events, public.office_approvals
  FROM anon, authenticated;
GRANT SELECT ON public.office_missions, public.office_events, public.office_approvals
  TO authenticated;

CREATE POLICY "office_missions: leitura só do admin do site"
  ON public.office_missions FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = 'admin@spacetech.app');

CREATE POLICY "office_events: leitura só do admin do site"
  ON public.office_events FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = 'admin@spacetech.app');

CREATE POLICY "office_approvals: leitura só do admin do site"
  ON public.office_approvals FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = 'admin@spacetech.app');
