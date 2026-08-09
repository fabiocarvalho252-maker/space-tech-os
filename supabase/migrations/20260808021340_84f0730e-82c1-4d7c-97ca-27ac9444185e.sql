ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS senha_dispositivo text;
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS padrao_desbloqueio text;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordens_servico TO authenticated;
GRANT ALL ON public.ordens_servico TO service_role;
