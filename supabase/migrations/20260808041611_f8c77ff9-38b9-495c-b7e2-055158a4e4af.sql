-- Sync OS data and schema
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ordens_servico' AND column_name = 'responsavel') THEN
        ALTER TABLE public.ordens_servico ADD COLUMN responsavel TEXT;
    END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordens_servico TO authenticated;
GRANT ALL ON public.ordens_servico TO service_role;

DO $$
DECLARE
    admin_id UUID;
BEGIN
    SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@spacetech.app';
    
    IF admin_id IS NOT NULL THEN
        DELETE FROM public.ordens_servico WHERE user_id = admin_id;

        -- Re-import 32 OS records
        -- OS 32
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 32, 'Smartphone', 170.00, 'faturado', '2026-08-07', '2026-08-07', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'ana carolina' AND user_id = admin_id LIMIT 1;

        -- OS 31
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 31, 'Smartphone', 40.00, 'faturado', '2026-08-07', '2026-08-07', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'vandi multicell' AND user_id = admin_id LIMIT 1;

        -- OS 30
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 30, 'Smartphone', 540.00, 'faturado', '2026-08-06', '2026-08-06', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'TAMIRES SILVA ALVES' AND user_id = admin_id LIMIT 1;

        -- OS 29
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 29, 'Smartphone', 300.00, 'faturado', '2026-08-06', '2026-08-06', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'NOEMIA BARBALHO' AND user_id = admin_id LIMIT 1;

        -- OS 28
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 28, 'Smartphone', 20.00, 'faturado', '2026-08-06', '2026-08-06', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'PEDRO JUNIOR LOJISTA' AND user_id = admin_id LIMIT 1;

        -- OS 27
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 27, 'Smartphone', 0.00, 'recebido', '2026-08-06', '2026-08-06', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'ADENILDE PEREIRA' AND user_id = admin_id LIMIT 1;

        -- OS 26
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 26, 'Smartphone', 40.00, 'faturado', '2026-08-06', '2026-08-06', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'CARLA LOJISTA' AND user_id = admin_id LIMIT 1;

        -- OS 25
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 25, 'Smartphone', 180.00, 'faturado', '2026-08-06', '2026-08-06', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'NILSON' AND user_id = admin_id LIMIT 1;

        -- OS 24
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 24, 'Smartphone', 50.00, 'faturado', '2026-08-05', '2026-08-05', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'rolanio souza' AND user_id = admin_id LIMIT 1;

        -- OS 23
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 23, 'Smartphone', 0.00, 'recebido', '2026-08-05', '2026-08-05', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'suzana lindaura' AND user_id = admin_id LIMIT 1;

        -- OS 22
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 22, 'Smartphone', 100.00, 'faturado', '2026-08-04', '2026-08-04', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'lucineide moreira' AND user_id = admin_id LIMIT 1;

        -- OS 21
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 21, 'Smartphone', 80.00, 'faturado', '2026-08-04', '2026-08-04', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'rodrigo lojista' AND user_id = admin_id LIMIT 1;

        -- OS 20
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 20, 'Smartphone', 35.00, 'faturado', '2026-08-03', '2026-08-03', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'FELIPE GALDINO LOJISTA' AND user_id = admin_id LIMIT 1;

        -- OS 19
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 19, 'Smartphone', 20.00, 'recebido', '2026-08-03', '2026-08-03', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'ROBERTO TORRES LOJISTA' AND user_id = admin_id LIMIT 1;

        -- OS 18
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 18, 'Smartphone', 200.00, 'faturado', '2026-08-01', '2026-08-01', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'thayane tupina' AND user_id = admin_id LIMIT 1;

        -- OS 17
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 17, 'Smartphone', 50.00, 'faturado', '2026-08-01', '2026-08-01', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'SANDRO' AND user_id = admin_id LIMIT 1;

        -- OS 16
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 16, 'Smartphone', 40.00, 'faturado', '2026-08-01', '2026-08-01', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'FABRICIO LOJISTA' AND user_id = admin_id LIMIT 1;

        -- OS 15
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 15, 'Smartphone', 60.00, 'faturado', '2026-08-01', '2026-08-01', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'FABIO PORTAL LOJISTA' AND user_id = admin_id LIMIT 1;

        -- OS 14
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 14, 'Smartphone', 20.00, 'faturado', '2026-08-01', '2026-08-01', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'davi lojista' AND user_id = admin_id LIMIT 1;

        -- OS 13
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 13, 'Smartphone', 160.00, 'faturado', '2026-08-01', '2026-08-01', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'CINDIA' AND user_id = admin_id LIMIT 1;

        -- OS 12
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 12, 'Smartphone', 40.00, 'faturado', '2026-08-01', '2026-08-01', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'RM LOJISTA' AND user_id = admin_id LIMIT 1;

        -- OS 11
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 11, 'Smartphone', 250.00, 'faturado', '2026-08-01', '2026-08-01', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'DANILA' AND user_id = admin_id LIMIT 1;

        -- OS 10
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 10, 'Smartphone', 40.00, 'faturado', '2026-08-01', '2026-08-01', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'MANUEL NUNES' AND user_id = admin_id LIMIT 1;

        -- OS 9
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 9, 'Smartphone', 30.00, 'faturado', '2026-07-31', '2026-07-31', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'ROBERTO TORRES LOJISTA' AND user_id = admin_id LIMIT 1;

        -- OS 8
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 8, 'Smartphone', 20.00, 'faturado', '2026-07-30', '2026-07-30', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'DEBORAH LIMA SILVA' AND user_id = admin_id LIMIT 1;

        -- OS 7
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 7, 'Smartphone', 50.00, 'faturado', '2026-07-30', '2026-07-30', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'Gabriel Vieira lojista' AND user_id = admin_id LIMIT 1;

        -- OS 6
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 6, 'Smartphone', 30.00, 'faturado', '2026-07-30', '2026-07-30', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'joão marcos lojista' AND user_id = admin_id LIMIT 1;

        -- OS 5
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 5, 'Smartphone', 170.00, 'faturado', '2026-07-30', '2026-07-30', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'ana carolina' AND user_id = admin_id LIMIT 1;

        -- OS 4
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 4, 'Smartphone', 140.00, 'faturado', '2026-07-30', '2026-07-30', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'paulo vitor' AND user_id = admin_id LIMIT 1;

        -- OS 3
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 3, 'Smartphone', 150.00, 'faturado', '2026-07-29', '2026-07-29', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'Camila Fereira' AND user_id = admin_id LIMIT 1;

        -- OS 2
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 2, 'Smartphone', 315.00, 'faturado', '2026-07-28', '2026-07-28', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'ediane cardoso' AND user_id = admin_id LIMIT 1;

        -- OS 1
        INSERT INTO public.ordens_servico (user_id, cliente_id, numero, aparelho, valor, status, created_at, previsao, responsavel)
        SELECT admin_id, id, 1, 'Smartphone', 235.00, 'faturado', '2026-07-28', '2026-07-28', 'FABIO DE CARVALHO SOBREIRA'
        FROM public.clientes WHERE nome = 'ediane cardoso' AND user_id = admin_id LIMIT 1;
    END IF;
END $$;
