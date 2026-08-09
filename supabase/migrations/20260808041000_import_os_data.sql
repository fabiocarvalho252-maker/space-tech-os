DO $$
DECLARE
    admin_id UUID;
BEGIN
    SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@spacetech.app';

    IF admin_id IS NOT NULL THEN
        -- OS 32: ana carolina
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 32, 'Smartphone', 170.00, 'faturado', '2026-08-07', '2026-08-07'
        FROM public.clientes WHERE nome = 'ana carolina' AND user_id = admin_id LIMIT 1;

        -- OS 31: vandi multicell
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 31, 'Smartphone', 40.00, 'faturado', '2026-08-07', '2026-08-07'
        FROM public.clientes WHERE nome = 'vandi multicell' AND user_id = admin_id LIMIT 1;

        -- OS 30: TAMIRES SILVA ALVES
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 30, 'Smartphone', 540.00, 'faturado', '2026-08-06', '2026-08-06'
        FROM public.clientes WHERE nome = 'TAMIRES SILVA ALVES' AND user_id = admin_id LIMIT 1;

        -- OS 29: NOEMIA BARBALHO
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 29, 'Smartphone', 300.00, 'faturado', '2026-08-06', '2026-08-06'
        FROM public.clientes WHERE nome = 'NOEMIA BARBALHO' AND user_id = admin_id LIMIT 1;

        -- OS 28: PEDRO JUNIOR LOJISTA
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 28, 'Smartphone', 20.00, 'faturado', '2026-08-06', '2026-08-06'
        FROM public.clientes WHERE nome = 'PEDRO JUNIOR LOJISTA' AND user_id = admin_id LIMIT 1;

        -- OS 27: ADENILDE PEREIRA
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 27, 'Smartphone', 0.00, 'recebido', '2026-08-06', '2026-08-06'
        FROM public.clientes WHERE nome = 'ADENILDE PEREIRA' AND user_id = admin_id LIMIT 1;

        -- OS 26: CARLA LOJISTA
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 26, 'Smartphone', 40.00, 'faturado', '2026-08-06', '2026-08-06'
        FROM public.clientes WHERE nome = 'CARLA LOJISTA' AND user_id = admin_id LIMIT 1;

        -- OS 25: NILSON
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 25, 'Smartphone', 180.00, 'faturado', '2026-08-06', '2026-08-06'
        FROM public.clientes WHERE nome = 'NILSON' AND user_id = admin_id LIMIT 1;

        -- OS 24: rolanio souza
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 24, 'Smartphone', 50.00, 'faturado', '2026-08-05', '2026-08-05'
        FROM public.clientes WHERE nome = 'rolanio souza' AND user_id = admin_id LIMIT 1;

        -- OS 23: suzana lindaura
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 23, 'Smartphone', 0.00, 'recebido', '2026-08-05', '2026-08-05'
        FROM public.clientes WHERE nome = 'suzana lindaura' AND user_id = admin_id LIMIT 1;

        -- OS 22: lucineide moreira
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 22, 'Smartphone', 100.00, 'faturado', '2026-08-04', '2026-08-04'
        FROM public.clientes WHERE nome = 'lucineide moreira' AND user_id = admin_id LIMIT 1;

        -- OS 21: rodrigo lojista
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 21, 'Smartphone', 80.00, 'faturado', '2026-08-04', '2026-08-04'
        FROM public.clientes WHERE nome = 'rodrigo lojista' AND user_id = admin_id LIMIT 1;

        -- OS 20: FELIPE GALDINO LOJISTA
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 20, 'Smartphone', 35.00, 'faturado', '2026-08-03', '2026-08-03'
        FROM public.clientes WHERE nome = 'FELIPE GALDINO LOJISTA' AND user_id = admin_id LIMIT 1;

        -- OS 19: ROBERTO TORRES LOJISTA
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 19, 'Smartphone', 20.00, 'recebido', '2026-08-03', '2026-08-03'
        FROM public.clientes WHERE nome = 'ROBERTO TORRES LOJISTA' AND user_id = admin_id LIMIT 1;

        -- OS 18: thayane tupina
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 18, 'Smartphone', 200.00, 'faturado', '2026-08-01', '2026-08-01'
        FROM public.clientes WHERE nome = 'thayane tupina' AND user_id = admin_id LIMIT 1;

        -- OS 17: SANDRO
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 17, 'Smartphone', 50.00, 'faturado', '2026-08-01', '2026-08-01'
        FROM public.clientes WHERE nome = 'SANDRO' AND user_id = admin_id LIMIT 1;

        -- OS 16: FABRICIO LOJISTA
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 16, 'Smartphone', 40.00, 'faturado', '2026-08-01', '2026-08-01'
        FROM public.clientes WHERE nome = 'FABRICIO LOJISTA' AND user_id = admin_id LIMIT 1;

        -- OS 15: FABIO PORTAL LOJISTA
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 15, 'Smartphone', 60.00, 'faturado', '2026-08-01', '2026-08-01'
        FROM public.clientes WHERE nome = 'FABIO PORTAL LOJISTA' AND user_id = admin_id LIMIT 1;

        -- OS 14: davi lojista
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 14, 'Smartphone', 20.00, 'faturado', '2026-08-01', '2026-08-01'
        FROM public.clientes WHERE nome = 'davi lojista' AND user_id = admin_id LIMIT 1;

        -- OS 13: CINDIA
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 13, 'Smartphone', 160.00, 'faturado', '2026-08-01', '2026-08-01'
        FROM public.clientes WHERE nome = 'CINDIA' AND user_id = admin_id LIMIT 1;

        -- OS 12: RM LOJISTA
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 12, 'Smartphone', 40.00, 'faturado', '2026-08-01', '2026-08-01'
        FROM public.clientes WHERE nome = 'RM LOJISTA' AND user_id = admin_id LIMIT 1;

        -- OS 11: DANILA
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 11, 'Smartphone', 250.00, 'faturado', '2026-08-01', '2026-08-01'
        FROM public.clientes WHERE nome = 'DANILA' AND user_id = admin_id LIMIT 1;

        -- OS 10: MANUEL NUNES
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 10, 'Smartphone', 40.00, 'faturado', '2026-08-01', '2026-08-01'
        FROM public.clientes WHERE nome = 'MANUEL NUNES' AND user_id = admin_id LIMIT 1;

        -- OS 9: ROBERTO TORRES LOJISTA (Already handled 19, this is 9)
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 9, 'Smartphone', 30.00, 'faturado', '2026-07-31', '2026-07-31'
        FROM public.clientes WHERE nome = 'ROBERTO TORRES LOJISTA' AND user_id = admin_id LIMIT 1;

        -- OS 8: DEBORAH LIMA SILVA
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 8, 'Smartphone', 20.00, 'faturado', '2026-07-30', '2026-07-30'
        FROM public.clientes WHERE nome = 'DEBORAH LIMA SILVA' AND user_id = admin_id LIMIT 1;

        -- OS 7: Gabriel Vieira lojista
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 7, 'Smartphone', 50.00, 'faturado', '2026-07-30', '2026-07-30'
        FROM public.clientes WHERE nome = 'Gabriel Vieira lojista' AND user_id = admin_id LIMIT 1;

        -- OS 6: joão marcos lojista
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 6, 'Smartphone', 30.00, 'faturado', '2026-07-30', '2026-07-30'
        FROM public.clientes WHERE nome = 'joão marcos lojista' AND user_id = admin_id LIMIT 1;

        -- OS 5: ana carolina
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 5, 'Smartphone', 170.00, 'faturado', '2026-07-30', '2026-07-30'
        FROM public.clientes WHERE nome = 'ana carolina' AND user_id = admin_id LIMIT 1;

        -- OS 4: paulo vitor
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 4, 'Smartphone', 140.00, 'faturado', '2026-07-30', '2026-07-30'
        FROM public.clientes WHERE nome = 'paulo vitor' AND user_id = admin_id LIMIT 1;

        -- OS 3: Camila Fereira
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 3, 'Smartphone', 150.00, 'faturado', '2026-07-29', '2026-07-29'
        FROM public.clientes WHERE nome = 'Camila Fereira' AND user_id = admin_id LIMIT 1;

        -- OS 2: ediane cardoso
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 2, 'Smartphone', 315.00, 'faturado', '2026-07-28', '2026-07-28'
        FROM public.clientes WHERE nome = 'ediane cardoso' AND user_id = admin_id LIMIT 1;

        -- OS 1: ediane cardoso
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao)
        SELECT admin_id, id, 1, 'Smartphone', 235.00, 'faturado', '2026-07-28', '2026-07-28'
        FROM public.clientes WHERE nome = 'ediane cardoso' AND user_id = admin_id LIMIT 1;
    END IF;
END $$;
