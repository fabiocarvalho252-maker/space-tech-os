DO $$
DECLARE
    admin_id UUID;
BEGIN
    SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@spacetech.app';

    IF admin_id IS NOT NULL THEN
        INSERT INTO public.produtos (user_id, nome, preco_venda, preco_custo, categoria, quantidade, estoque_minimo) VALUES
        (admin_id, 'REPARO MEMORIA IPHONE', 600.00, 300.00, 'Serviço', 999, 0),
        (admin_id, 'REPARO MEMORIA', 300.00, 600.00, 'Serviço', 999, 0),
        (admin_id, 'FRONTAL IPHONE XR', 200.00, 65.00, 'Serviço', 999, 0),
        (admin_id, 'TROCA DE TELA SAMSUNG', 180.00, 65.00, 'Serviço', 999, 0),
        (admin_id, 'LOJISTA 4', 40.00, 5.00, 'Serviço', 999, 0),
        (admin_id, 'FRONTAL REALME NOTE 60', 280.00, 95.00, 'Serviço', 999, 0),
        (admin_id, 'TIRA VIRUS', 50.00, 2.00, 'Serviço', 999, 0),
        (admin_id, 'TROCA DO DOCK LOJISTA 4', 40.00, 10.00, 'Serviço', 999, 0),
        (admin_id, 'TROCA FRONTAL LOJISTA 5', 50.00, 10.00, 'Serviço', 999, 0),
        (admin_id, 'serviços lojista 3', 30.00, 3.00, 'Serviço', 999, 0),
        (admin_id, 'TROCA DE FRONTAL G8 POWER', 180.00, 65.00, 'Serviço', 999, 0),
        (admin_id, 'troca frontal g8 play', 180.00, 65.00, 'Serviço', 999, 0),
        (admin_id, 'SERVIÇO DE CONTA', 150.00, 0, 'Serviço', 999, 0),
        (admin_id, 'troca de conector IPhone 11', 150.00, 35.00, 'Serviço', 999, 0),
        (admin_id, 'REPARO PLACA', 200.00, 50.00, 'Serviço', 999, 0),
        (admin_id, 'TROCA DE CONECTOR', 90.00, 20.00, 'Serviço', 999, 0),
        (admin_id, 'TROCA DE TELA XIAOMI NOTE 8', 250.00, 108.00, 'Serviço', 999, 0),
        (admin_id, 'TROCA DE TELA', 260.00, 85.00, 'Serviço', 999, 0);
    END IF;
END $$;