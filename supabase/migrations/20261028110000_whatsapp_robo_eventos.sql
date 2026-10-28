-- Eventos do robô de atendimento no histórico da conversa (a lista de tipos
-- permitidos não tinha os do robô e os registros eram recusados).
ALTER TABLE public.whatsapp_conversa_eventos
  DROP CONSTRAINT IF EXISTS whatsapp_conversa_eventos_tipo_check;
ALTER TABLE public.whatsapp_conversa_eventos
  ADD CONSTRAINT whatsapp_conversa_eventos_tipo_check CHECK (tipo = ANY (ARRAY[
    'assumiu', 'transferiu', 'liberou', 'encerrou', 'reabriu',
    'vinculou_cliente', 'desvinculou_cliente', 'prioridade', 'etiquetas',
    'opt_out', 'opt_in',
    'robo_atendente', 'robo_orcamento', 'robo_limite', 'robo_pausado', 'robo_retomado'
  ]));
