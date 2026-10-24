-- Agente de IA (Gemini) para a pesquisa de satisfação (Configurações >
-- WhatsApp). As duas opções vêm desligadas.
--   ia_agradecer_pesquisa: lê a resposta do cliente à pesquisa, classifica e,
--     se for elogio ou resposta neutra, agradece sozinho; reclamação não
--     recebe resposta automática e vira aviso no sininho.
--   ia_pesquisa_personalizada: a pesquisa automática pós-OS é escrita pela
--     IA com o nome do cliente, o aparelho e o serviço, no lugar do texto fixo.
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS ia_agradecer_pesquisa BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ia_pesquisa_personalizada BOOLEAN NOT NULL DEFAULT false;

-- Na mensagem recebida: a classificação da IA e a pesquisa que ela responde.
-- avaliacao_resolvida marca a reclamação como tratada (some do sininho).
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS avaliacao TEXT
    CHECK (avaliacao IN ('positiva', 'neutra', 'reclamacao', 'outro')),
  ADD COLUMN IF NOT EXISTS pesquisa_msg_id UUID
    REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS avaliacao_resolvida BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS whatsapp_messages_reclamacoes_idx
  ON public.whatsapp_messages (user_id, created_at DESC)
  WHERE avaliacao = 'reclamacao' AND NOT avaliacao_resolvida;

-- Uma resposta classificada por pesquisa e um agradecimento por pesquisa
-- (template_id = 'agradecimento_<id da pesquisa>'), mesmo com webhook repetido.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_pesquisa_resposta_key
  ON public.whatsapp_messages (pesquisa_msg_id)
  WHERE pesquisa_msg_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_agradecimento_key
  ON public.whatsapp_messages (user_id, template_id)
  WHERE template_id LIKE 'agradecimento\_%';

NOTIFY pgrst, 'reload schema';
