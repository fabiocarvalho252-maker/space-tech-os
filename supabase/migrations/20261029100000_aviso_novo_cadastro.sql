-- Aviso ao dono da plataforma de nova empresa cadastrada: um por empresa,
-- mesmo com a página de cadastro e a conferência do cron tentando juntas
-- (template_id = 'aviso_novo_cadastro_<id da empresa>').
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_aviso_novo_cadastro_key
  ON public.whatsapp_messages (user_id, template_id)
  WHERE template_id LIKE 'aviso\_novo\_cadastro\_%';
