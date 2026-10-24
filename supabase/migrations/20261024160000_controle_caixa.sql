-- Controle de caixa (sale_config.tipo_caixa = 'controle_caixa'): abertura com
-- troco inicial, sangria/suprimento e fechamento com conferência do dinheiro.
-- O resumo por forma de pagamento sai dos lançamentos pagos do período em que
-- o caixa ficou aberto — vendas do PDV, faturamento de OS, despesas etc.
-- Sangria e suprimento só movem dinheiro da gaveta; não viram lançamento.

CREATE TABLE IF NOT EXISTS public.caixa_sessoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'fechado')),
  aberto_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  aberto_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  valor_abertura NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (valor_abertura >= 0),
  fechado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  fechado_em TIMESTAMPTZ,
  valor_esperado NUMERIC(12,2),
  valor_contado NUMERIC(12,2),
  diferenca NUMERIC(12,2),
  resumo JSONB,
  observacoes TEXT
);

-- Um caixa aberto por empresa.
CREATE UNIQUE INDEX IF NOT EXISTS caixa_sessoes_um_aberto
  ON public.caixa_sessoes (user_id) WHERE status = 'aberto';
CREATE INDEX IF NOT EXISTS caixa_sessoes_user_aberto_em_idx
  ON public.caixa_sessoes (user_id, aberto_em DESC);

CREATE TABLE IF NOT EXISTS public.caixa_movimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sessao_id UUID NOT NULL REFERENCES public.caixa_sessoes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('sangria', 'suprimento')),
  valor NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  motivo TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS caixa_movimentos_sessao_idx ON public.caixa_movimentos (sessao_id);

ALTER TABLE public.caixa_sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caixa_movimentos ENABLE ROW LEVEL SECURITY;

-- Leitura para quem vê vendas; gravação só pelas funções abaixo.
DROP POLICY IF EXISTS "caixa_sessoes ver" ON public.caixa_sessoes;
CREATE POLICY "caixa_sessoes ver" ON public.caixa_sessoes FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'vendas', 'ver'));
DROP POLICY IF EXISTS "caixa_movimentos ver" ON public.caixa_movimentos;
CREATE POLICY "caixa_movimentos ver" ON public.caixa_movimentos FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'vendas', 'ver'));

GRANT SELECT ON public.caixa_sessoes, public.caixa_movimentos TO authenticated;

-- "pix", "Pix", "Cartão de Débito" etc. viram um nome só por forma.
CREATE OR REPLACE FUNCTION public.caixa_forma_normalizada(p_forma TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_forma IS NULL OR btrim(p_forma) = '' THEN 'Não informado'
    WHEN lower(p_forma) = 'pix' THEN 'PIX'
    WHEN lower(p_forma) LIKE 'dinheiro%' THEN 'Dinheiro'
    WHEN lower(p_forma) LIKE '%débito%' OR lower(p_forma) LIKE '%debito%' THEN 'Débito'
    WHEN lower(p_forma) LIKE '%crédito%' OR lower(p_forma) LIKE '%credito%' THEN 'Crédito'
    ELSE btrim(p_forma)
  END
$$;

-- Resumo do caixa: totais por forma de pagamento e dinheiro esperado na gaveta.
CREATE OR REPLACE FUNCTION public.resumo_caixa(p_sessao_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.caixa_sessoes;
  v_formas JSONB;
  v_suprimentos NUMERIC := 0;
  v_sangrias NUMERIC := 0;
  v_dinheiro_entradas NUMERIC := 0;
  v_dinheiro_saidas NUMERIC := 0;
  v_entradas NUMERIC := 0;
  v_saidas NUMERIC := 0;
  v_qtd_vendas INT := 0;
BEGIN
  SELECT * INTO s FROM public.caixa_sessoes WHERE id = p_sessao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Caixa não encontrado'; END IF;
  IF NOT public.has_permission(s.user_id, 'vendas', 'ver') THEN
    RAISE EXCEPTION 'Sem permissão para ver o caixa';
  END IF;

  WITH mov AS (
    SELECT l.tipo, l.valor, l.venda_id,
           public.caixa_forma_normalizada(COALESCE(pm.nome, v.forma_pagamento)) AS forma
    FROM public.lancamentos l
    LEFT JOIN public.payment_methods pm ON pm.id = l.payment_method_id
    LEFT JOIN public.vendas v ON v.id = l.venda_id
    WHERE l.user_id = s.user_id
      AND l.status = 'pago'
      AND l.created_at >= s.aberto_em
      AND l.created_at < COALESCE(s.fechado_em, now())
  ), por_forma AS (
    SELECT forma,
           SUM(valor) FILTER (WHERE tipo = 'entrada') AS entradas,
           SUM(valor) FILTER (WHERE tipo <> 'entrada') AS saidas
    FROM mov GROUP BY forma
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'forma', forma,
      'entradas', COALESCE(entradas, 0),
      'saidas', COALESCE(saidas, 0)
    ) ORDER BY COALESCE(entradas, 0) DESC), '[]'::jsonb),
    COALESCE(SUM(entradas), 0),
    COALESCE(SUM(saidas), 0),
    COALESCE(SUM(entradas) FILTER (WHERE forma = 'Dinheiro'), 0),
    COALESCE(SUM(saidas) FILTER (WHERE forma = 'Dinheiro'), 0)
  INTO v_formas, v_entradas, v_saidas, v_dinheiro_entradas, v_dinheiro_saidas
  FROM por_forma;

  SELECT COUNT(DISTINCT l.venda_id) INTO v_qtd_vendas
  FROM public.lancamentos l
  WHERE l.user_id = s.user_id AND l.status = 'pago' AND l.venda_id IS NOT NULL
    AND l.created_at >= s.aberto_em AND l.created_at < COALESCE(s.fechado_em, now());

  SELECT COALESCE(SUM(valor) FILTER (WHERE tipo = 'suprimento'), 0),
         COALESCE(SUM(valor) FILTER (WHERE tipo = 'sangria'), 0)
  INTO v_suprimentos, v_sangrias
  FROM public.caixa_movimentos WHERE sessao_id = s.id;

  RETURN jsonb_build_object(
    'formas', v_formas,
    'total_entradas', v_entradas,
    'total_saidas', v_saidas,
    'qtd_vendas', v_qtd_vendas,
    'abertura', s.valor_abertura,
    'suprimentos', v_suprimentos,
    'sangrias', v_sangrias,
    'dinheiro_entradas', v_dinheiro_entradas,
    'dinheiro_saidas', v_dinheiro_saidas,
    'dinheiro_esperado',
      s.valor_abertura + v_suprimentos - v_sangrias + v_dinheiro_entradas - v_dinheiro_saidas
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.abrir_caixa(p_empresa_id UUID, p_valor_abertura NUMERIC)
RETURNS public.caixa_sessoes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.caixa_sessoes;
BEGIN
  IF NOT public.has_permission(p_empresa_id, 'vendas', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para abrir o caixa';
  END IF;
  IF COALESCE(p_valor_abertura, 0) < 0 THEN
    RAISE EXCEPTION 'O valor de abertura não pode ser negativo';
  END IF;
  IF EXISTS (SELECT 1 FROM public.caixa_sessoes WHERE user_id = p_empresa_id AND status = 'aberto') THEN
    RAISE EXCEPTION 'Já existe um caixa aberto';
  END IF;
  INSERT INTO public.caixa_sessoes (user_id, aberto_por, valor_abertura)
  VALUES (p_empresa_id, auth.uid(), round(COALESCE(p_valor_abertura, 0), 2))
  RETURNING * INTO s;
  RETURN s;
END;
$$;

CREATE OR REPLACE FUNCTION public.movimentar_caixa(
  p_sessao_id UUID, p_tipo TEXT, p_valor NUMERIC, p_motivo TEXT
)
RETURNS public.caixa_movimentos
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.caixa_sessoes;
  m public.caixa_movimentos;
BEGIN
  SELECT * INTO s FROM public.caixa_sessoes WHERE id = p_sessao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Caixa não encontrado'; END IF;
  IF NOT public.has_permission(s.user_id, 'vendas', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para movimentar o caixa';
  END IF;
  IF s.status <> 'aberto' THEN RAISE EXCEPTION 'Este caixa já foi fechado'; END IF;
  IF p_tipo NOT IN ('sangria', 'suprimento') THEN RAISE EXCEPTION 'Tipo inválido'; END IF;
  IF COALESCE(p_valor, 0) <= 0 THEN RAISE EXCEPTION 'Informe um valor maior que zero'; END IF;

  INSERT INTO public.caixa_movimentos (user_id, sessao_id, tipo, valor, motivo, created_by)
  VALUES (s.user_id, s.id, p_tipo, round(p_valor, 2), NULLIF(btrim(COALESCE(p_motivo, '')), ''), auth.uid())
  RETURNING * INTO m;
  RETURN m;
END;
$$;

CREATE OR REPLACE FUNCTION public.fechar_caixa(
  p_sessao_id UUID, p_valor_contado NUMERIC, p_observacoes TEXT
)
RETURNS public.caixa_sessoes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.caixa_sessoes;
  v_resumo JSONB;
  v_esperado NUMERIC;
BEGIN
  SELECT * INTO s FROM public.caixa_sessoes WHERE id = p_sessao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Caixa não encontrado'; END IF;
  IF NOT public.has_permission(s.user_id, 'vendas', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para fechar o caixa';
  END IF;
  IF s.status <> 'aberto' THEN RAISE EXCEPTION 'Este caixa já foi fechado'; END IF;
  IF p_valor_contado IS NULL OR p_valor_contado < 0 THEN
    RAISE EXCEPTION 'Informe o dinheiro contado na gaveta';
  END IF;

  -- Congela o período antes de calcular, para o resumo bater com o fechamento.
  UPDATE public.caixa_sessoes SET fechado_em = now() WHERE id = s.id;
  v_resumo := public.resumo_caixa(s.id);
  v_esperado := (v_resumo->>'dinheiro_esperado')::NUMERIC;

  UPDATE public.caixa_sessoes SET
    status = 'fechado',
    fechado_por = auth.uid(),
    valor_esperado = round(v_esperado, 2),
    valor_contado = round(p_valor_contado, 2),
    diferenca = round(p_valor_contado - v_esperado, 2),
    resumo = v_resumo,
    observacoes = NULLIF(btrim(COALESCE(p_observacoes, '')), '')
  WHERE id = s.id
  RETURNING * INTO s;
  RETURN s;
END;
$$;

REVOKE ALL ON FUNCTION public.resumo_caixa(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.abrir_caixa(UUID, NUMERIC) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.movimentar_caixa(UUID, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fechar_caixa(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resumo_caixa(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.abrir_caixa(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.movimentar_caixa(UUID, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fechar_caixa(UUID, NUMERIC, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
