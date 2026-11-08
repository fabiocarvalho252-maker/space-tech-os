-- Agendamento online: página pública /agendar/<slug> onde o cliente escolhe
-- dia e horário livre (pelo horário de funcionamento da loja, sem conflito
-- com a Agenda) e informa nome, WhatsApp, aparelho e problema. O horário
-- cai na Agenda como compromisso (origem 'online'). Desligado por padrão
-- (Configurações → Agenda online).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS agenda_online boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agenda_slug text,
  ADD COLUMN IF NOT EXISTS agenda_duracao_min integer NOT NULL DEFAULT 60
    CHECK (agenda_duracao_min BETWEEN 15 AND 240),
  ADD COLUMN IF NOT EXISTS agenda_antecedencia_h integer NOT NULL DEFAULT 2
    CHECK (agenda_antecedencia_h BETWEEN 0 AND 168),
  ADD COLUMN IF NOT EXISTS agenda_dias integer NOT NULL DEFAULT 14
    CHECK (agenda_dias BETWEEN 1 AND 60);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_agenda_slug_key
  ON public.profiles (lower(agenda_slug)) WHERE agenda_slug IS NOT NULL;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_agenda_slug_formato;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_agenda_slug_formato
  CHECK (agenda_slug IS NULL OR agenda_slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$');

ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'interno',
  ADD COLUMN IF NOT EXISTS contato_nome text,
  ADD COLUMN IF NOT EXISTS contato_telefone text;

CREATE INDEX IF NOT EXISTS agendamentos_user_inicio_idx ON public.agendamentos (user_id, inicio);

-- Empresa da página pública (só com a agenda online ligada).
CREATE OR REPLACE FUNCTION public.agenda_empresa_publica(p_slug text)
RETURNS public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT * FROM public.profiles
   WHERE agenda_online AND lower(agenda_slug) = lower(btrim(p_slug))
   LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.agenda_empresa_publica(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.agenda_publica(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  p public.profiles;
BEGIN
  p := public.agenda_empresa_publica(p_slug);
  IF p.id IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'loja', coalesce(nullif(p.loja, ''), p.nome),
    'logo', p.logo_url,
    'whatsapp', p.whatsapp,
    'endereco', nullif(concat_ws(' — ', nullif(p.endereco, ''), nullif(p.cidade, '')), ''),
    'duracao', p.agenda_duracao_min,
    'dias', p.agenda_dias,
    'horario', p.horario_funcionamento
  );
END;
$$;

-- Horários livres de um dia (início de cada horário, em UTC).
CREATE OR REPLACE FUNCTION public.agenda_horarios_livres(p_slug text, p_data date)
RETURNS SETOF timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  p public.profiles;
  v_dia jsonb;
  v_abre timestamptz;
  v_fecha timestamptz;
  v_slot timestamptz;
  v_dur interval;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  p := public.agenda_empresa_publica(p_slug);
  IF p.id IS NULL OR p_data < v_hoje OR p_data > v_hoje + p.agenda_dias THEN
    RETURN;
  END IF;
  v_dia := p.horario_funcionamento -> extract(dow FROM p_data)::int;
  IF v_dia IS NULL OR jsonb_typeof(v_dia) <> 'object' THEN
    RETURN;
  END IF;
  v_dur := make_interval(mins => p.agenda_duracao_min);
  v_abre := (p_data + (v_dia ->> 'abre')::time) AT TIME ZONE 'America/Sao_Paulo';
  v_fecha := (p_data + (v_dia ->> 'fecha')::time) AT TIME ZONE 'America/Sao_Paulo';
  v_slot := v_abre;
  WHILE v_slot + v_dur <= v_fecha LOOP
    IF v_slot >= now() + make_interval(hours => p.agenda_antecedencia_h)
       AND NOT EXISTS (
         SELECT 1 FROM public.agendamentos a
          WHERE a.user_id = p.id AND a.status <> 'cancelado'
            AND a.inicio < v_slot + v_dur AND coalesce(a.fim, a.inicio + v_dur) > v_slot
       ) THEN
      RETURN NEXT v_slot;
    END IF;
    v_slot := v_slot + v_dur;
  END LOOP;
END;
$$;

-- Marca o horário. Devolve 'ok' ou o motivo ('indisponivel', 'dados', 'limite').
CREATE OR REPLACE FUNCTION public.agendar_publica(
  p_slug text, p_inicio timestamptz, p_nome text, p_telefone text,
  p_aparelho text DEFAULT NULL, p_problema text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  p public.profiles;
  v_tel text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_nome text := left(btrim(coalesce(p_nome, '')), 80);
  v_aparelho text := nullif(left(btrim(coalesce(p_aparelho, '')), 80), '');
  v_problema text := nullif(left(btrim(coalesce(p_problema, '')), 500), '');
  v_cliente uuid;
BEGIN
  p := public.agenda_empresa_publica(p_slug);
  IF p.id IS NULL THEN
    RETURN 'indisponivel';
  END IF;
  IF length(v_nome) < 2 OR length(v_tel) NOT BETWEEN 10 AND 13 THEN
    RETURN 'dados';
  END IF;

  -- Duas pessoas no mesmo horário: a segunda espera a primeira terminar.
  PERFORM pg_advisory_xact_lock(hashtext('agenda_online:' || p.id::text));

  -- Contra abuso: até 2 horários futuros por WhatsApp e 30 marcações online por dia.
  IF (SELECT count(*) FROM public.agendamentos
       WHERE user_id = p.id AND origem = 'online' AND status <> 'cancelado'
         AND inicio > now() AND regexp_replace(coalesce(contato_telefone, ''), '\D', '', 'g') = v_tel) >= 2
     OR (SELECT count(*) FROM public.agendamentos
          WHERE user_id = p.id AND origem = 'online' AND created_at > now() - interval '1 day') >= 30 THEN
    RETURN 'limite';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.agenda_horarios_livres(p_slug, (p_inicio AT TIME ZONE 'America/Sao_Paulo')::date) s
                  WHERE s = p_inicio) THEN
    RETURN 'indisponivel';
  END IF;

  SELECT c.id INTO v_cliente FROM public.clientes c
   WHERE c.user_id = p.id
     AND right(regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g'), 11) = right(v_tel, 11)
   LIMIT 1;

  INSERT INTO public.agendamentos (user_id, titulo, tipo, cliente_id, inicio, fim, status,
                                   observacoes, origem, contato_nome, contato_telefone)
  VALUES (
    p.id,
    'Online: ' || v_nome || coalesce(' — ' || v_aparelho, ''),
    'compromisso', v_cliente, p_inicio,
    p_inicio + make_interval(mins => p.agenda_duracao_min),
    'agendado',
    concat_ws(E'\n', 'Agendado pelo cliente na página online.',
              'WhatsApp: ' || v_tel,
              CASE WHEN v_aparelho IS NOT NULL THEN 'Aparelho: ' || v_aparelho END,
              CASE WHEN v_problema IS NOT NULL THEN 'Problema: ' || v_problema END),
    'online', v_nome, v_tel
  );
  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.agenda_publica(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agenda_horarios_livres(text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agendar_publica(text, timestamptz, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agenda_publica(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agenda_horarios_livres(text, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agendar_publica(text, timestamptz, text, text, text, text) TO anon, authenticated;
