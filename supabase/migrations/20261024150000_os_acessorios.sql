-- Acessórios que o cliente deixou junto com o aparelho (capinha, chip,
-- carregador...). Preenchido na abertura da OS e impresso com o estado físico.
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS acessorios TEXT;

NOTIFY pgrst, 'reload schema';
