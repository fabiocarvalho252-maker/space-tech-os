-- Robô pausado porque a loja apagou, no celular, uma mensagem da conversa.
ALTER TABLE public.whatsapp_conversa_eventos
  DROP CONSTRAINT whatsapp_conversa_eventos_tipo_check;
ALTER TABLE public.whatsapp_conversa_eventos
  ADD CONSTRAINT whatsapp_conversa_eventos_tipo_check CHECK (tipo = ANY (ARRAY[
    'assumiu', 'transferiu', 'liberou', 'encerrou', 'reabriu',
    'vinculou_cliente', 'desvinculou_cliente', 'prioridade', 'etiquetas',
    'opt_out', 'opt_in', 'robo_atendente', 'robo_orcamento', 'robo_limite',
    'robo_pausado', 'robo_retomado', 'robo_apagada'
  ]));
