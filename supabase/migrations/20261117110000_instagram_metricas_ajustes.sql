-- Ajustes das métricas do Instagram (depois da 20261117100000).
-- Aditiva: nada é apagado. Motivos:
--  * ig_coleta_log ganha ig_user_id, para o log não misturar contas diferentes;
--  * a trava da coleta manual passa a ser reserva no banco (índice por origem e data);
--  * permissões do service role ficam explícitas, sem depender dos padrões do Supabase.

ALTER TABLE public.ig_coleta_log ADD COLUMN IF NOT EXISTS ig_user_id text;

CREATE INDEX IF NOT EXISTS ig_coleta_log_origem_janela_idx
  ON public.ig_coleta_log (origem, executado_em DESC, id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ig_conta_diaria, public.ig_midia_metricas, public.ig_coleta_log
  TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.ig_coleta_log_id_seq TO service_role;
