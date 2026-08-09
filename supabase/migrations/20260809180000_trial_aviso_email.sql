-- Tracks whether the one-time "trial ending" email has already been sent for
-- a company, so the notification fires exactly once instead of on every
-- visit during the warning window.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_aviso_enviado_em TIMESTAMPTZ;
