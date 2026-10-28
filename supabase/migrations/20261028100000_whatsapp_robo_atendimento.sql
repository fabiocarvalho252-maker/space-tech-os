-- Robô de atendimento do WhatsApp (Configurações > WhatsApp). Responde só a
-- quem escreve para a loja, com menu fixo (status da OS, orçamento, garantia,
-- atendente). Vem desligado. Tudo aditivo.
--   robo_ativo: liga/desliga para a empresa.
--   robo_horario: 7 posições (0 = domingo) com {"abre","fecha"} ou null
--     (fechado), em horário de Brasília. Padrão: comercial.
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS robo_ativo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS robo_horario JSONB NOT NULL DEFAULT
    '[null,
      {"abre":"08:00","fecha":"18:00"},
      {"abre":"08:00","fecha":"18:00"},
      {"abre":"08:00","fecha":"18:00"},
      {"abre":"08:00","fecha":"18:00"},
      {"abre":"08:00","fecha":"18:00"},
      {"abre":"08:00","fecha":"12:00"}]'::jsonb;

-- Estado do robô em cada conversa.
--   robo_etapa / robo_dados / robo_atualizado_em: em que pergunta parou.
--   robo_pausado_ate: robô quieto nesta conversa até essa hora (pediu
--     atendente ou alguém da equipe pausou). 'infinity' = pausado até religar.
ALTER TABLE public.whatsapp_conversas
  ADD COLUMN IF NOT EXISTS robo_etapa TEXT,
  ADD COLUMN IF NOT EXISTS robo_dados JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS robo_atualizado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS robo_pausado_ate TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
