DO $$
DECLARE
    admin_id UUID;
BEGIN
    SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@spacetech.app';

    IF admin_id IS NOT NULL THEN
        INSERT INTO public.clientes (user_id, nome, telefone, documento, email) VALUES
        (admin_id, 'vandi multicell', '(74) 98837-9174', NULL, NULL),
        (admin_id, 'TAMIRES SILVA ALVES', '(74) 99141-8874', '064.207.725-83', NULL),
        (admin_id, 'NOEMIA BARBALHO', NULL, NULL, NULL),
        (admin_id, 'PEDRO JUNIOR LOJISTA', '(74) 99800-8545', NULL, NULL),
        (admin_id, 'ADENILDE PEREIRA', '(74) 98816-1243', NULL, NULL),
        (admin_id, 'CARLA LOJISTA', '(74) 99159-6891', NULL, NULL),
        (admin_id, 'NILSON', NULL, NULL, NULL),
        (admin_id, 'rolanio souza', '(74) 98825-6065', NULL, NULL),
        (admin_id, 'suzana lindaura', '(74) 98802-7171', '480.715.105-30', NULL),
        (admin_id, 'lucineide moreira', '(74) 99803-4972', NULL, NULL),
        (admin_id, 'rodrigo lojista', '(87) 98131-2906', NULL, NULL),
        (admin_id, 'FELIPE GALDINO LOJISTA', NULL, NULL, NULL),
        (admin_id, 'thayane tupina', '(74) 88156-0395', '097.402.495-31', NULL),
        (admin_id, 'FABRICIO LOJISTA', '(74) 98108-6799', NULL, NULL),
        (admin_id, 'FABIO PORTAL LOJISTA', '(74) 98807-6275', NULL, NULL),
        (admin_id, 'davi lojista', '(74) 98108-4664', NULL, NULL),
        (admin_id, 'SANDRO', '(74) 98863-7854', NULL, NULL),
        (admin_id, 'CINDIA', '(74) 99927-5193', '846.554.105-15', NULL),
        (admin_id, 'RM LOJISTA', '(74) 98833-9285', NULL, NULL),
        (admin_id, 'DANILA', '(74) 98118-2281', '057.213.515-78', NULL),
        (admin_id, 'MANUEL NUNES', '(74) 98141-6812', NULL, NULL),
        (admin_id, 'ROBERTO TORRES LOJISTA', '(74) 99948-9393', NULL, NULL),
        (admin_id, 'VITOR GABRIEL', '(74) 98138-2980', NULL, NULL),
        (admin_id, 'Gabriel Vieira lojista', '(74) 98817-2780', NULL, NULL),
        (admin_id, 'joão marcos lojista', '(74) 99938-8893', NULL, NULL),
        (admin_id, 'Consumidor Final', NULL, NULL, NULL),
        (admin_id, 'ana carolina', NULL, '110.025.745-44', NULL),
        (admin_id, 'paulo vitor', '(74) 99963-2366', '050.135.125-65', NULL),
        (admin_id, 'Camila Fereira', '(74) 98811-8444', NULL, 'camila13ferreirasilva@gmail.com'),
        (admin_id, 'DEBORAH LIMA SILVA', '(88) 98195-9532', NULL, NULL),
        (admin_id, 'ediane cardoso', '(28) 98100-6277', NULL, 'anny.adn.19@gmail.com');
    END IF;
END $$;
