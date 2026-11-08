-- Pesquisa de satisfação automática pós-OS: opção de incluir o link da Área
-- do Cliente para avaliar com estrelas (os_avaliacoes). Desligada por padrão.
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS pesquisa_link_avaliacao boolean NOT NULL DEFAULT false;
