ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS whatsapp TEXT,
ADD COLUMN IF NOT EXISTS endereco TEXT,
ADD COLUMN IF NOT EXISTS cidade TEXT,
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS cnpj_cpf TEXT;

COMMENT ON COLUMN public.profiles.whatsapp IS 'WhatsApp de contato da empresa';
COMMENT ON COLUMN public.profiles.endereco IS 'Endereço físico da empresa';
COMMENT ON COLUMN public.profiles.cidade IS 'Cidade da empresa';
COMMENT ON COLUMN public.profiles.logo_url IS 'URL do logotipo da empresa';
COMMENT ON COLUMN public.profiles.cnpj_cpf IS 'CNPJ ou CPF da empresa';
