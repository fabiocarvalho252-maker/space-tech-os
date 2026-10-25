-- Fila WhatsApp (tela /whatsapp-fila, src/lib/whatsapp/whatsapp-service.ts →
-- processarFila). Mensagens "agendado" agora saem por um worker no servidor
-- (POST /api/whatsapp/fila/cron, cron de minuto em minuto), não só com o
-- sistema aberto, e respeitam proteções contra bloqueio do número:
-- intervalo mínimo entre envios, horário permitido e limite por hora.

ALTER TABLE public.whatsapp_messages DROP CONSTRAINT IF EXISTS whatsapp_messages_status_check;
ALTER TABLE public.whatsapp_messages ADD CONSTRAINT whatsapp_messages_status_check
  CHECK (status = ANY (ARRAY['pendente', 'enviado', 'falhou', 'recebido', 'agendado', 'cancelado']));

-- Momento em que a fila reservou a mensagem para envio (base do intervalo e
-- do limite por hora). Envios diretos (tela de OS, manual) ficam sem e usam
-- created_at.
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS enviado_em TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS whatsapp_messages_fila_idx
  ON public.whatsapp_messages (user_id, status, scheduled_at)
  WHERE status IN ('agendado', 'pendente', 'falhou', 'cancelado');

ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS fila_intervalo_seg INTEGER NOT NULL DEFAULT 20
    CHECK (fila_intervalo_seg BETWEEN 5 AND 600),
  ADD COLUMN IF NOT EXISTS fila_hora_inicio INTEGER NOT NULL DEFAULT 8
    CHECK (fila_hora_inicio BETWEEN 0 AND 23),
  ADD COLUMN IF NOT EXISTS fila_hora_fim INTEGER NOT NULL DEFAULT 20
    CHECK (fila_hora_fim BETWEEN 1 AND 24),
  ADD COLUMN IF NOT EXISTS fila_limite_hora INTEGER NOT NULL DEFAULT 30
    CHECK (fila_limite_hora BETWEEN 1 AND 500);

-- Envios da empresa que contam para intervalo e limite: tudo que saiu (ou
-- está saindo) pelo número dela.
CREATE OR REPLACE FUNCTION public.whatsapp_fila_regras(p_empresa UUID)
RETURNS TABLE (
  intervalo_seg INTEGER,
  hora_inicio INTEGER,
  hora_fim INTEGER,
  limite_hora INTEGER,
  hora_atual INTEGER,
  ultimo_envio TIMESTAMPTZ,
  envios_ultima_hora INTEGER
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    COALESCE(c.fila_intervalo_seg, 20),
    COALESCE(c.fila_hora_inicio, 8),
    COALESCE(c.fila_hora_fim, 20),
    COALESCE(c.fila_limite_hora, 30),
    EXTRACT(HOUR FROM now() AT TIME ZONE 'America/Sao_Paulo')::INTEGER,
    e.ultimo,
    e.qtd
  FROM (SELECT 1) um
  LEFT JOIN public.whatsapp_config c ON c.user_id = p_empresa
  CROSS JOIN LATERAL (
    SELECT max(COALESCE(m.enviado_em, m.created_at)) AS ultimo, count(*)::INTEGER AS qtd
    FROM public.whatsapp_messages m
    WHERE m.user_id = p_empresa
      AND m.direction = 'outbound'
      AND m.status IN ('enviado', 'pendente')
      AND m.created_at > now() - interval '1 day'
      AND COALESCE(m.enviado_em, m.created_at) > now() - interval '1 hour'
  ) e
$$;

-- Reserva a próxima mensagem vencida da fila (agendado → pendente), se as
-- regras deixarem. Um lock por empresa garante o intervalo mesmo com o
-- worker e telas abertas rodando ao mesmo tempo. Sem reserva, devolve o
-- motivo e quantos segundos esperar (intervalo).
CREATE OR REPLACE FUNCTION public.whatsapp_fila_reservar(p_empresa UUID)
RETURNS TABLE (mensagem_id UUID, motivo TEXT, espera_seg INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  v_id UUID;
  v_espera INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('whatsapp_fila:' || p_empresa::text, 0));

  -- Envio que travou no meio (servidor reiniciou etc.) vira falha visível,
  -- para a loja conferir se o cliente recebeu antes de reenviar.
  UPDATE public.whatsapp_messages
     SET status = 'falhou',
         error = 'Envio interrompido. Confira se o cliente recebeu antes de reenviar.'
   WHERE user_id = p_empresa
     AND status = 'pendente'
     AND direction = 'outbound'
     AND COALESCE(enviado_em, created_at) < now() - interval '15 minutes';

  SELECT * INTO r FROM public.whatsapp_fila_regras(p_empresa);

  IF NOT EXISTS (
    SELECT 1 FROM public.whatsapp_messages
     WHERE user_id = p_empresa AND status = 'agendado' AND scheduled_at <= now()
  ) THEN
    RETURN QUERY SELECT NULL::UUID, 'vazia'::TEXT, NULL::INTEGER;
    RETURN;
  END IF;
  IF r.hora_atual < r.hora_inicio OR r.hora_atual >= r.hora_fim THEN
    RETURN QUERY SELECT NULL::UUID, 'fora_do_horario'::TEXT, NULL::INTEGER;
    RETURN;
  END IF;
  IF r.envios_ultima_hora >= r.limite_hora THEN
    RETURN QUERY SELECT NULL::UUID, 'limite_hora'::TEXT, NULL::INTEGER;
    RETURN;
  END IF;
  IF r.ultimo_envio IS NOT NULL
     AND r.ultimo_envio > now() - make_interval(secs => r.intervalo_seg) THEN
    v_espera := CEIL(EXTRACT(EPOCH FROM (r.ultimo_envio + make_interval(secs => r.intervalo_seg) - now())))::INTEGER;
    RETURN QUERY SELECT NULL::UUID, 'intervalo'::TEXT, GREATEST(v_espera, 1);
    RETURN;
  END IF;

  UPDATE public.whatsapp_messages
     SET status = 'pendente', enviado_em = now()
   WHERE id = (
     SELECT id FROM public.whatsapp_messages
      WHERE user_id = p_empresa AND status = 'agendado' AND scheduled_at <= now()
      ORDER BY scheduled_at, created_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED
   )
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, CASE WHEN v_id IS NULL THEN 'vazia' ELSE 'ok' END, NULL::INTEGER;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.whatsapp_fila_regras(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.whatsapp_fila_reservar(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_fila_regras(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_fila_reservar(UUID) TO service_role;
