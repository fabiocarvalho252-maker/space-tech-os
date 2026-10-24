-- Avisos ao dono da plataforma no WhatsApp (pedido de plano, plano pago,
-- renovação): um aviso por acontecimento, mesmo com webhook repetido do
-- Mercado Pago (template_id = 'aviso_plano_<tipo>_<id>').
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_aviso_plano_key
  ON public.whatsapp_messages (user_id, template_id)
  WHERE template_id LIKE 'aviso\_plano\_%';
