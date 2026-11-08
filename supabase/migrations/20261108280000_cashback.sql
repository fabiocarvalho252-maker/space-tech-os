-- Cashback: um percentual de cada OS faturada e de cada venda com cliente
-- vira crédito do cliente (com validade), para usar como desconto na próxima
-- OS ou compra. Desligado por padrão (Configurações → Empresa → Cashback).
--
-- Livro por cliente: 'credito' (gerado no faturamento/venda) e 'uso'
-- (desconto aplicado). Cada uso consome primeiro os créditos que vencem antes
-- (cashback_consumo). Saldo = créditos válidos não cancelados menos o que
-- usos não cancelados consumiram deles. Cancelar o faturamento/venda cancela
-- o crédito gerado ali e o uso feito ali (o crédito consumido volta).

CREATE TABLE IF NOT EXISTS public.cashback_config (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT false,
  percentual numeric(5,2) NOT NULL DEFAULT 5 CHECK (percentual > 0 AND percentual <= 50),
  validade_dias integer NOT NULL DEFAULT 90 CHECK (validade_dias BETWEEN 7 AND 730),
  uso_max_percentual integer NOT NULL DEFAULT 50 CHECK (uso_max_percentual BETWEEN 1 AND 100),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cashback_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cashback_config ver" ON public.cashback_config;
CREATE POLICY "cashback_config ver" ON public.cashback_config FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'vendas', 'ver') OR public.has_permission(user_id, 'ordens', 'ver'));
DROP POLICY IF EXISTS "cashback_config gerenciar" ON public.cashback_config;
CREATE POLICY "cashback_config gerenciar" ON public.cashback_config FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'configuracoes', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'configuracoes', 'gerenciar'));
GRANT SELECT, INSERT, UPDATE ON public.cashback_config TO authenticated;

CREATE TABLE IF NOT EXISTS public.cashback_movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('credito', 'uso')),
  valor numeric(12,2) NOT NULL CHECK (valor > 0),
  origem text NOT NULL CHECK (origem IN ('os', 'venda')),
  -- os: id do os_faturamentos; venda: id da venda.
  origem_id uuid NOT NULL,
  descricao text,
  expira_em date,
  cancelado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cashback_mov_cliente_idx ON public.cashback_movimentos (cliente_id, tipo);
CREATE INDEX IF NOT EXISTS cashback_mov_origem_idx ON public.cashback_movimentos (origem, origem_id);
-- Um crédito por faturamento/venda.
CREATE UNIQUE INDEX IF NOT EXISTS cashback_credito_unico
  ON public.cashback_movimentos (origem, origem_id) WHERE tipo = 'credito';
ALTER TABLE public.cashback_movimentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cashback_movimentos ver" ON public.cashback_movimentos;
CREATE POLICY "cashback_movimentos ver" ON public.cashback_movimentos FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'clientes', 'ver')
      OR public.has_permission(user_id, 'vendas', 'ver')
      OR public.has_permission(user_id, 'ordens', 'ver'));
GRANT SELECT ON public.cashback_movimentos TO authenticated;

CREATE TABLE IF NOT EXISTS public.cashback_consumo (
  uso_id uuid NOT NULL REFERENCES public.cashback_movimentos(id) ON DELETE CASCADE,
  credito_id uuid NOT NULL REFERENCES public.cashback_movimentos(id) ON DELETE CASCADE,
  valor numeric(12,2) NOT NULL CHECK (valor > 0),
  PRIMARY KEY (uso_id, credito_id)
);
ALTER TABLE public.cashback_consumo ENABLE ROW LEVEL SECURITY;

-- Quanto ainda resta de cada crédito válido.
CREATE OR REPLACE FUNCTION public.cashback_creditos_disponiveis(p_cliente uuid)
RETURNS TABLE (credito_id uuid, disponivel numeric, expira_em date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.id,
         c.valor - coalesce((SELECT sum(k.valor) FROM public.cashback_consumo k
                               JOIN public.cashback_movimentos u ON u.id = k.uso_id
                              WHERE k.credito_id = c.id AND u.cancelado_em IS NULL), 0),
         c.expira_em
    FROM public.cashback_movimentos c
   WHERE c.cliente_id = p_cliente AND c.tipo = 'credito' AND c.cancelado_em IS NULL
     AND (c.expira_em IS NULL OR c.expira_em >= (now() AT TIME ZONE 'America/Sao_Paulo')::date)
   ORDER BY c.expira_em NULLS LAST, c.created_at;
$$;
REVOKE ALL ON FUNCTION public.cashback_creditos_disponiveis(uuid) FROM PUBLIC, anon, authenticated;

-- Saldo do cliente (para a tela). Confere o acesso pela empresa do cliente.
CREATE OR REPLACE FUNCTION public.cashback_saldo(p_cliente uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa uuid;
  v_saldo numeric;
  v_vence date;
BEGIN
  SELECT user_id INTO v_empresa FROM public.clientes WHERE id = p_cliente;
  IF v_empresa IS NULL OR NOT (public.has_permission(v_empresa, 'vendas', 'ver')
                               OR public.has_permission(v_empresa, 'ordens', 'ver')) THEN
    RETURN NULL;
  END IF;
  SELECT coalesce(sum(disponivel), 0), min(expira_em) FILTER (WHERE disponivel > 0)
    INTO v_saldo, v_vence
    FROM public.cashback_creditos_disponiveis(p_cliente) WHERE disponivel > 0;
  RETURN jsonb_build_object('saldo', round(v_saldo, 2), 'proximo_vencimento', v_vence);
END;
$$;
GRANT EXECUTE ON FUNCTION public.cashback_saldo(uuid) TO authenticated;

-- Registra um uso consumindo os créditos que vencem antes. Interno.
CREATE OR REPLACE FUNCTION public.cashback_registrar_uso(
  p_empresa uuid, p_cliente uuid, p_valor numeric, p_origem text, p_origem_id uuid, p_base numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cfg public.cashback_config;
  v_uso uuid;
  v_falta numeric := round(p_valor, 2);
  v_cred record;
  v_parte numeric;
BEGIN
  SELECT * INTO v_cfg FROM public.cashback_config WHERE user_id = p_empresa;
  IF NOT coalesce(v_cfg.ativo, false) THEN
    RAISE EXCEPTION 'Cashback desligado nesta loja.';
  END IF;
  IF p_cliente IS NULL THEN
    RAISE EXCEPTION 'Selecione o cliente para usar o cashback.';
  END IF;
  IF (SELECT user_id FROM public.clientes WHERE id = p_cliente) IS DISTINCT FROM p_empresa THEN
    RAISE EXCEPTION 'Cliente inválido.';
  END IF;
  IF v_falta > round(p_base * v_cfg.uso_max_percentual / 100.0, 2) + 0.005 THEN
    RAISE EXCEPTION 'O cashback pode pagar no máximo % do valor.', v_cfg.uso_max_percentual || '%';
  END IF;

  -- Um uso de cada vez por cliente (duas telas ao mesmo tempo).
  PERFORM pg_advisory_xact_lock(hashtext('cashback:' || p_cliente::text));
  IF (SELECT coalesce(sum(disponivel), 0) FROM public.cashback_creditos_disponiveis(p_cliente)) + 0.005 < v_falta THEN
    RAISE EXCEPTION 'Saldo de cashback insuficiente.';
  END IF;

  INSERT INTO public.cashback_movimentos (user_id, cliente_id, tipo, valor, origem, origem_id, descricao)
  VALUES (p_empresa, p_cliente, 'uso', v_falta, p_origem, p_origem_id,
          CASE p_origem WHEN 'os' THEN 'Usado no faturamento da OS' ELSE 'Usado na venda' END)
  RETURNING id INTO v_uso;

  FOR v_cred IN SELECT * FROM public.cashback_creditos_disponiveis(p_cliente) WHERE disponivel > 0 LOOP
    EXIT WHEN v_falta <= 0;
    v_parte := least(v_falta, v_cred.disponivel);
    INSERT INTO public.cashback_consumo (uso_id, credito_id, valor) VALUES (v_uso, v_cred.credito_id, v_parte);
    v_falta := v_falta - v_parte;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.cashback_registrar_uso(uuid, uuid, numeric, text, uuid, numeric) FROM PUBLIC, anon, authenticated;

-- Venda do PDV usando cashback: a venda (com o cashback somado ao desconto)
-- e o uso são gravados juntos — ou tudo, ou nada.
CREATE OR REPLACE FUNCTION public.registrar_venda_com_cashback(
  p_empresa_id uuid, p_itens jsonb, p_cliente_id uuid, p_desconto numeric, p_cashback numeric,
  p_forma_pagamento text, p_observacoes text DEFAULT NULL, p_categoria text DEFAULT NULL
)
RETURNS public.vendas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_venda public.vendas;
  v_subtotal numeric;
BEGIN
  IF NOT public.has_permission(p_empresa_id, 'vendas', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para registrar vendas.';
  END IF;
  SELECT coalesce(sum((x.quantidade)::numeric * (x.preco_unitario)::numeric), 0) INTO v_subtotal
    FROM jsonb_to_recordset(p_itens) AS x(quantidade numeric, preco_unitario numeric);

  v_venda := public.registrar_venda(
    p_empresa_id, p_itens, p_cliente_id, coalesce(p_desconto, 0) + coalesce(p_cashback, 0),
    p_forma_pagamento, p_observacoes, p_categoria
  );
  IF coalesce(p_cashback, 0) > 0 THEN
    PERFORM public.cashback_registrar_uso(
      p_empresa_id, p_cliente_id, p_cashback, 'venda', v_venda.id,
      greatest(v_subtotal - coalesce(p_desconto, 0), 0)
    );
  END IF;
  RETURN v_venda;
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_venda_com_cashback(uuid, jsonb, uuid, numeric, numeric, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_venda_com_cashback(uuid, jsonb, uuid, numeric, numeric, text, text, text) TO authenticated;

-- Faturar OS usando cashback: soma o cashback ao desconto da OS, fatura e
-- registra o uso — tudo junto. p_valor_total já vem com o cashback abatido.
CREATE OR REPLACE FUNCTION public.faturar_os_com_cashback(
  p_cashback numeric, p_os_id uuid, p_categoria_id uuid, p_valor_total numeric, p_parcelas jsonb,
  p_tecnicos jsonb DEFAULT '[]'::jsonb, p_observacoes text DEFAULT NULL, p_descricao text DEFAULT NULL,
  p_custo_tecnico numeric DEFAULT 0, p_custo_tecnico_nome text DEFAULT NULL
)
RETURNS public.os_faturamentos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_os public.ordens_servico%ROWTYPE;
  v_base numeric;
  v_fat public.os_faturamentos;
BEGIN
  SELECT * INTO v_os FROM public.ordens_servico WHERE id = p_os_id FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission(v_os.user_id, 'ordens', 'gerenciar') THEN
    RAISE EXCEPTION 'OS não encontrada.';
  END IF;
  SELECT greatest(coalesce(sum(quantidade * preco_unitario), 0) - coalesce(v_os.desconto, 0), 0)
    INTO v_base FROM public.os_itens WHERE os_id = p_os_id;

  IF coalesce(p_cashback, 0) > 0 THEN
    UPDATE public.ordens_servico SET desconto = coalesce(desconto, 0) + p_cashback WHERE id = p_os_id;
  END IF;
  v_fat := public.faturar_os(p_os_id, p_categoria_id, p_valor_total, p_parcelas, p_tecnicos,
                             p_observacoes, p_descricao, p_custo_tecnico, p_custo_tecnico_nome);
  IF coalesce(p_cashback, 0) > 0 THEN
    PERFORM public.cashback_registrar_uso(v_os.user_id, v_os.cliente_id, p_cashback, 'os', v_fat.id, v_base);
  END IF;
  RETURN v_fat;
END;
$$;
REVOKE ALL ON FUNCTION public.faturar_os_com_cashback(numeric, uuid, uuid, numeric, jsonb, jsonb, text, text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.faturar_os_com_cashback(numeric, uuid, uuid, numeric, jsonb, jsonb, text, text, numeric, text) TO authenticated;

-- Crédito automático: OS faturada.
CREATE OR REPLACE FUNCTION public.cashback_credito_os()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cfg public.cashback_config;
  v_os public.ordens_servico%ROWTYPE;
  v_uso numeric;
  v_valor numeric;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'cancelado' THEN
    SELECT * INTO v_cfg FROM public.cashback_config WHERE user_id = NEW.user_id;
    SELECT * INTO v_os FROM public.ordens_servico WHERE id = NEW.os_id;
    IF coalesce(v_cfg.ativo, false) AND v_os.cliente_id IS NOT NULL THEN
      v_valor := round(NEW.valor_total * v_cfg.percentual / 100.0, 2);
      IF v_valor > 0 THEN
        INSERT INTO public.cashback_movimentos (user_id, cliente_id, tipo, valor, origem, origem_id, descricao, expira_em)
        VALUES (NEW.user_id, v_os.cliente_id, 'credito', v_valor, 'os', NEW.id,
                'Cashback da OS #' || v_os.numero,
                (now() AT TIME ZONE 'America/Sao_Paulo')::date + v_cfg.validade_dias)
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'cancelado' AND OLD.status <> 'cancelado' THEN
    UPDATE public.cashback_movimentos SET cancelado_em = now()
     WHERE origem = 'os' AND origem_id = NEW.id AND cancelado_em IS NULL;
    -- O cashback usado nesse faturamento sai do desconto da OS de novo.
    SELECT coalesce(sum(valor), 0) INTO v_uso FROM public.cashback_movimentos
     WHERE origem = 'os' AND origem_id = NEW.id AND tipo = 'uso';
    IF v_uso > 0 THEN
      UPDATE public.ordens_servico SET desconto = greatest(coalesce(desconto, 0) - v_uso, 0)
       WHERE id = NEW.os_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS cashback_os ON public.os_faturamentos;
CREATE TRIGGER cashback_os AFTER INSERT OR UPDATE OF status ON public.os_faturamentos
  FOR EACH ROW EXECUTE FUNCTION public.cashback_credito_os();

-- Crédito automático: venda com cliente (PDV grava como 'aberto' já paga).
CREATE OR REPLACE FUNCTION public.cashback_credito_venda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cfg public.cashback_config;
  v_valor numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.cashback_movimentos SET cancelado_em = now()
     WHERE origem = 'venda' AND origem_id = OLD.id AND cancelado_em IS NULL;
    RETURN NULL;
  END IF;
  IF NEW.status = 'cancelado' THEN
    IF TG_OP = 'UPDATE' AND OLD.status <> 'cancelado' THEN
      UPDATE public.cashback_movimentos SET cancelado_em = now()
       WHERE origem = 'venda' AND origem_id = NEW.id AND cancelado_em IS NULL;
    END IF;
    RETURN NULL;
  END IF;
  IF NEW.cliente_id IS NULL OR NEW.status IN ('orcamento', 'negociacao') THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_cfg FROM public.cashback_config WHERE user_id = NEW.user_id;
  IF NOT coalesce(v_cfg.ativo, false) THEN
    RETURN NULL;
  END IF;
  v_valor := round(NEW.total * v_cfg.percentual / 100.0, 2);
  IF v_valor > 0 THEN
    INSERT INTO public.cashback_movimentos (user_id, cliente_id, tipo, valor, origem, origem_id, descricao, expira_em)
    VALUES (NEW.user_id, NEW.cliente_id, 'credito', v_valor, 'venda', NEW.id,
            'Cashback da venda' || coalesce(' #' || NEW.numero, ''),
            (now() AT TIME ZONE 'America/Sao_Paulo')::date + v_cfg.validade_dias)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS cashback_venda ON public.vendas;
CREATE TRIGGER cashback_venda AFTER INSERT OR UPDATE OF status OR DELETE ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.cashback_credito_venda();

-- Área do Cliente: saldo do cliente da OS do link (só com o cashback ligado).
CREATE OR REPLACE FUNCTION public.cashback_publico(p_identificador text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_os public.ordens_servico%ROWTYPE;
  v_saldo numeric;
  v_vence date;
BEGIN
  IF p_identificador !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_os FROM public.ordens_servico WHERE id = p_identificador::uuid;
  IF v_os.cliente_id IS NULL
     OR NOT coalesce((SELECT ativo FROM public.cashback_config WHERE user_id = v_os.user_id), false) THEN
    RETURN NULL;
  END IF;
  SELECT coalesce(sum(disponivel), 0), min(expira_em) INTO v_saldo, v_vence
    FROM public.cashback_creditos_disponiveis(v_os.cliente_id) WHERE disponivel > 0;
  IF v_saldo <= 0 THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object('saldo', round(v_saldo, 2), 'proximo_vencimento', v_vence);
END;
$$;
REVOKE ALL ON FUNCTION public.cashback_publico(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cashback_publico(text) TO anon, authenticated;
