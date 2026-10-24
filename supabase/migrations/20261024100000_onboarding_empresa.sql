-- Configuração inicial (/bem-vindo): uma empresa recém-cadastrada cai nessa
-- tela no primeiro acesso (logo, dados, endereço, garantia) antes de usar o
-- sistema. NULL = ainda não passou por ela. Quem já usava o sistema antes
-- desta migração não é obrigado a passar pelo assistente.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_concluido_em TIMESTAMPTZ;

UPDATE public.profiles
  SET onboarding_concluido_em = now()
  WHERE onboarding_concluido_em IS NULL;

NOTIFY pgrst, 'reload schema';
