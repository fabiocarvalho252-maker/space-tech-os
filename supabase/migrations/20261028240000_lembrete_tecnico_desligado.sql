-- "Equipe: lembrete de visita/entrega ao técnico" passou a enviar de verdade
-- (src/lib/whatsapp/lembrete-tecnico.server.ts). O campo nasceu ligado por
-- padrão quando ainda não fazia nada; para nenhuma loja começar a receber
-- sem ter escolhido, fica desligado por padrão e desligado em todas agora.
ALTER TABLE public.whatsapp_config ALTER COLUMN lembrete_tecnico SET DEFAULT false;
UPDATE public.whatsapp_config SET lembrete_tecnico = false WHERE lembrete_tecnico;
ALTER TABLE public.whatsapp_config ALTER COLUMN lembrete_tecnico_texto
  SET DEFAULT 'Bom dia, {{tecnico}}! Seu dia na {{loja}}:';
UPDATE public.whatsapp_config
   SET lembrete_tecnico_texto = 'Bom dia, {{tecnico}}! Seu dia na {{loja}}:'
 WHERE lembrete_tecnico_texto = 'Olá {{tecnico}}, você tem uma visita/entrega agendada para hoje.';
