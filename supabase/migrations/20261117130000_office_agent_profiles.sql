-- não aplicada; aguarda aprovação
--
-- Equipe (perfis em português dos agentes e skills do ECC, editáveis pelo admin).
--
-- Quem lê e edita: só o administrador do site, pelo e-mail do login (mesmo critério
-- de SITE_ADMIN_EMAIL no app e no runner). Quem grava linhas novas: só o runner, com
-- a service role (que ignora RLS). Não há policy de INSERT para usuários.

CREATE TABLE IF NOT EXISTS public.office_agent_profiles (
  agent_id             text PRIMARY KEY CHECK (char_length(agent_id) <= 120),
  kind                 text NOT NULL CHECK (kind IN ('agent', 'skill')),
  display_name         text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 24),
  role_title           text NOT NULL CHECK (char_length(role_title) BETWEEN 1 AND 60),
  summary_pt_br        text NOT NULL CHECK (char_length(summary_pt_br) BETWEEN 1 AND 140),
  description_pt_br    text NOT NULL CHECK (char_length(description_pt_br) BETWEEN 1 AND 1200),
  when_to_use          jsonb NOT NULL CHECK (
                         jsonb_typeof(when_to_use) = 'array' AND jsonb_array_length(when_to_use) = 3
                       ),
  sector               text NOT NULL CHECK (char_length(sector) BETWEEN 1 AND 40),
  appearance           jsonb NOT NULL CHECK (jsonb_typeof(appearance) = 'object'),
  original_description text NOT NULL DEFAULT '' CHECK (char_length(original_description) <= 2000),
  source_hash          text NOT NULL DEFAULT '' CHECK (char_length(source_hash) <= 128),
  edited               boolean NOT NULL DEFAULT false,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- RLS: ligado. Leitura e edição só para o admin; INSERT sem policy (só service role).
ALTER TABLE public.office_agent_profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.office_agent_profiles FROM anon, authenticated;
GRANT SELECT ON public.office_agent_profiles TO authenticated;
GRANT UPDATE (
  display_name,
  role_title,
  summary_pt_br,
  description_pt_br,
  when_to_use,
  sector,
  appearance,
  edited,
  updated_at
) ON public.office_agent_profiles TO authenticated;

CREATE POLICY "office_agent_profiles: leitura só do admin do site"
  ON public.office_agent_profiles FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = 'admin@spacetech.app');

CREATE POLICY "office_agent_profiles: edição só do admin do site"
  ON public.office_agent_profiles FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'admin@spacetech.app')
  WITH CHECK ((auth.jwt() ->> 'email') = 'admin@spacetech.app');
