DO $$
DECLARE
    admin_id UUID;
BEGIN
    SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@spacetech.app';

    IF admin_id IS NOT NULL THEN
        -- Updates based on the provided list
        UPDATE public.ordens_servico SET status = 'faturado' WHERE numero IN (32, 31, 30, 29, 28, 26, 25, 24, 22, 21, 20, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1) AND user_id = admin_id;
        UPDATE public.ordens_servico SET status = 'recebido' WHERE numero IN (27, 23, 19) AND user_id = admin_id;

        -- We ensure the 'valor' column reflects the final amount. 
        -- The UI will handle displaying the "pre-discount" value based on the numeric value for this demo import.
    END IF;
END $$;
