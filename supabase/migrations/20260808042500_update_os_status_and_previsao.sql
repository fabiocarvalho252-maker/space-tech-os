DO $$
DECLARE
    admin_id UUID;
BEGIN
    SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@spacetech.app';

    IF admin_id IS NOT NULL THEN
        -- Fix status colors based on UI request: Faturado = Green, Received = Blue (default)
        -- The UI handles the colors based on status string.
        
        -- Set 'previsao' to match the final date in the prompt so warranty calculation is correct
        UPDATE public.ordens_servico SET previsao = '2026-08-07' WHERE numero IN (32, 31) AND user_id = admin_id;
        UPDATE public.ordens_servico SET previsao = '2026-08-06' WHERE numero IN (30, 29, 28, 27, 26, 25) AND user_id = admin_id;
        UPDATE public.ordens_servico SET previsao = '2026-08-05' WHERE numero IN (24, 23) AND user_id = admin_id;
        UPDATE public.ordens_servico SET previsao = '2026-08-04' WHERE numero IN (22, 21) AND user_id = admin_id;
        UPDATE public.ordens_servico SET previsao = '2026-08-03' WHERE numero IN (20, 19) AND user_id = admin_id;
        UPDATE public.ordens_servico SET previsao = '2026-08-01' WHERE numero IN (18, 17, 16, 15, 14, 13, 12, 11, 10) AND user_id = admin_id;
        UPDATE public.ordens_servico SET previsao = '2026-07-31' WHERE numero = 9 AND user_id = admin_id;
        UPDATE public.ordens_servico SET previsao = '2026-07-30' WHERE numero IN (8, 7, 6, 5, 4) AND user_id = admin_id;
        UPDATE public.ordens_servico SET previsao = '2026-07-29' WHERE numero = 3 AND user_id = admin_id;
        UPDATE public.ordens_servico SET previsao = '2026-07-28' WHERE numero IN (2, 1) AND user_id = admin_id;
    END IF;
END $$;
