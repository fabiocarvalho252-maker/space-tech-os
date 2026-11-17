-- Métricas do Instagram (painel do /admin/marketing).
-- Coleta diária pela Graph API oficial, gravada aqui pelo servidor.
-- Acesso: só o servidor (service role). RLS ligado e sem policies para
-- anon/authenticated, então o navegador nunca lê estas tabelas direto; quem
-- lê é a server function, que confere checarSiteAdmin antes.

-- Um ponto por conta e dia: seguidores e métricas diárias da conta.
CREATE TABLE IF NOT EXISTS public.ig_conta_diaria (
  ig_user_id      text        NOT NULL,
  dia             date        NOT NULL,
  seguidores      integer,
  alcance         integer,
  visitas_perfil  integer,
  cliques_link    integer,
  coletado_em     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ig_user_id, dia)
);

-- Uma linha por post/Reel e dia de coleta: as métricas mudam ao longo do tempo.
CREATE TABLE IF NOT EXISTS public.ig_midia_metricas (
  ig_media_id        text        NOT NULL,
  ig_user_id         text        NOT NULL,
  dia_coleta         date        NOT NULL,
  tipo               text,
  publicado_em       timestamptz,
  legenda            text,
  miniatura_url      text,
  permalink          text,
  alcance            integer,
  curtidas           integer,
  comentarios        integer,
  salvamentos        integer,
  compartilhamentos  integer,
  visualizacoes      integer,
  coletado_em        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ig_media_id, dia_coleta)
);

CREATE INDEX IF NOT EXISTS ig_midia_metricas_conta_dia_idx
  ON public.ig_midia_metricas (ig_user_id, dia_coleta DESC);

-- Registro de cada execução (diária ou "Atualizar agora"), inclusive falhas,
-- para o painel mostrar o que faltou (ex.: permissão de insights não concedida).
CREATE TABLE IF NOT EXISTS public.ig_coleta_log (
  id           bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  executado_em timestamptz NOT NULL DEFAULT now(),
  origem       text        NOT NULL CHECK (origem IN ('diaria', 'manual')),
  ok           boolean     NOT NULL,
  mensagem     text,
  detalhes     jsonb       NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ig_coleta_log_executado_idx
  ON public.ig_coleta_log (executado_em DESC);

ALTER TABLE public.ig_conta_diaria   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ig_midia_metricas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ig_coleta_log     ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ig_conta_diaria, public.ig_midia_metricas, public.ig_coleta_log
  FROM anon, authenticated;
