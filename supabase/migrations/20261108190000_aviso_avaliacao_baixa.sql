-- Alerta à loja de avaliação baixa (1–2★, OS ou venda): um por avaliação,
-- mesmo com a página do cliente e a conferência do cron tentando juntas
-- (template_id = 'aviso_avaliacao_<id da avaliação>').
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_aviso_avaliacao_key
  ON public.whatsapp_messages (user_id, template_id)
  WHERE template_id LIKE 'aviso\_avaliacao\_%';
