-- Replace the generic "ativo" plano with explicit duration tiers, per the
-- site admin's request: mensal/trimestral/semestral/anual instead of a
-- single "ativo" bucket with a freeform date.
ALTER TABLE public.profiles DROP CONSTRAINT profiles_plano_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_plano_check
  CHECK (plano IN ('trial', 'mensal', 'trimestral', 'semestral', 'anual', 'vitalicio', 'suspenso'));

-- No existing rows use 'ativo' yet (the panel just shipped), so no data
-- migration is needed for the old value.
