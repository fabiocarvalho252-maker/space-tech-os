-- Self-service "Planos" page (/assinatura): lets an empresa flag which plan
-- it wants reactivated/upgraded to, without SPACE TECH having a payment
-- gateway of its own yet. The site admin (/admin) sees the request and
-- activates the plan manually, same as before — this just replaces "please
-- contact us" with a concrete, trackable request.
ALTER TABLE public.profiles ADD COLUMN plano_solicitado TEXT
  CHECK (plano_solicitado IN ('mensal', 'trimestral', 'semestral', 'anual', 'vitalicio'));
ALTER TABLE public.profiles ADD COLUMN plano_solicitado_em TIMESTAMPTZ;
