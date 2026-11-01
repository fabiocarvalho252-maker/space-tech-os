-- Aviso à loja de orçamento aprovado/recusado pelo cliente: um por resposta,
-- mesmo com a página do cliente e a conferência do cron tentando juntas
-- (template_id = 'aviso_orcamento_<id do os_historico>').
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_aviso_orcamento_key
  ON public.whatsapp_messages (user_id, template_id)
  WHERE template_id LIKE 'aviso\_orcamento\_%';
