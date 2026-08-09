-- Add responsavel column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordens_servico' AND column_name = 'responsavel') THEN
        ALTER TABLE public.ordens_servico ADD COLUMN responsavel TEXT;
    END IF;
END $$;

DO $$
DECLARE
    admin_id UUID;
BEGIN
    SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@spacetech.app';

    IF admin_id IS NOT NULL THEN
        -- Set technician names for the imported OS
        UPDATE public.ordens_servico SET responsavel = 'FABIO DE CARVALHO SOBREIRA' WHERE numero BETWEEN 1 AND 32 AND user_id = admin_id;
    END IF;
END $$;
