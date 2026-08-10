-- Lets the site admin panel (/admin) actually control a company's access
-- instead of every empresa being stuck on the hardcoded 7-day trial. plano
-- defaults to 'trial' so nothing changes for existing/new signups unless the
-- site admin explicitly grants something.
ALTER TABLE public.profiles ADD COLUMN plano TEXT NOT NULL DEFAULT 'trial'
  CHECK (plano IN ('trial', 'ativo', 'vitalicio', 'suspenso'));

-- Only meaningful when plano = 'ativo': the date the paid access itself
-- expires. Null means "no expiration set" (treated as not expired).
ALTER TABLE public.profiles ADD COLUMN acesso_ate DATE;
