-- The "Faturar OS" modal lets the user edit the invoice's own description
-- (defaulting to "Fatura de OS Nº N", editable) instead of the hardcoded
-- "OS #N — Faturamento" text the first version used. Store it on the
-- invoice header and reuse it as the base text for each installment's
-- lancamento description.
ALTER TABLE public.os_faturamentos ADD COLUMN descricao TEXT;

-- Adding a parameter changes the function's identity in Postgres (it's part
-- of the signature), so CREATE OR REPLACE alone would leave the old 6-arg
-- overload behind — drop it explicitly before creating the 7-arg version.
DROP FUNCTION IF EXISTS public.faturar_os(UUID, UUID, NUMERIC, JSONB, JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.faturar_os(
  p_os_id UUID,
  p_categoria_id UUID,
  p_valor_total NUMERIC,
  p_parcelas JSONB,
  p_tecnicos JSONB DEFAULT '[]'::jsonb,
  p_observacoes TEXT DEFAULT NULL,
  p_descricao TEXT DEFAULT NULL
)
RETURNS public.os_faturamentos
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_os_numero INT;
  v_desconto NUMERIC;
  v_total_itens NUMERIC;
  v_valor_esperado NUMERIC;
  v_categoria_id UUID;
  v_categoria_nome TEXT;
  v_descricao TEXT;
  v_soma_parcelas NUMERIC;
  v_soma_tecnicos NUMERIC;
  v_faturamento public.os_faturamentos;
  v_parcela RECORD;
  v_tecnico RECORD;
  v_lancamento_id UUID;
  v_linhas INT;
BEGIN
  IF p_valor_total <= 0 THEN
    RAISE EXCEPTION 'O valor total da OS deve ser maior que zero para faturar.';
  END IF;
  IF p_parcelas IS NULL OR jsonb_array_length(p_parcelas) < 1 THEN
    RAISE EXCEPTION 'Informe ao menos uma parcela.';
  END IF;

  SELECT user_id, numero, desconto INTO v_empresa_id, v_os_numero, v_desconto
    FROM ordens_servico WHERE id = p_os_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OS não encontrada.';
  END IF;

  IF NOT public.has_permission(v_empresa_id, 'ordens', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar ordens de serviço.';
  END IF;
  IF NOT public.has_permission(v_empresa_id, 'financeiro', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar o financeiro.';
  END IF;

  IF EXISTS (SELECT 1 FROM os_faturamentos WHERE os_id = p_os_id AND status <> 'cancelado') THEN
    RAISE EXCEPTION 'Esta OS já possui um faturamento ativo. Cancele-o antes de faturar novamente.';
  END IF;

  SELECT COALESCE(SUM(quantidade * preco_unitario), 0) INTO v_total_itens
    FROM os_itens WHERE os_id = p_os_id;
  v_valor_esperado := GREATEST(v_total_itens - COALESCE(v_desconto, 0), 0);
  IF abs(v_valor_esperado - p_valor_total) > 0.01 THEN
    RAISE EXCEPTION 'O valor total não confere com os itens da OS (esperado %, recebido %). Recarregue a tela.',
      v_valor_esperado, p_valor_total;
  END IF;

  IF p_categoria_id IS NOT NULL THEN
    SELECT id, nome INTO v_categoria_id, v_categoria_nome
      FROM finance_categories WHERE id = p_categoria_id AND user_id = v_empresa_id AND tipo = 'entrada';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Categoria de receita inválida.';
    END IF;
  ELSE
    SELECT id, nome INTO v_categoria_id, v_categoria_nome
      FROM finance_categories WHERE user_id = v_empresa_id AND nome = 'Faturamento de OS' AND tipo = 'entrada';
    IF NOT FOUND THEN
      INSERT INTO finance_categories (user_id, nome, tipo) VALUES (v_empresa_id, 'Faturamento de OS', 'entrada')
        RETURNING id, nome INTO v_categoria_id, v_categoria_nome;
    END IF;
  END IF;

  v_descricao := COALESCE(NULLIF(trim(p_descricao), ''), 'Fatura de OS Nº ' || v_os_numero);

  SELECT COALESCE(SUM((x.valor)), 0) INTO v_soma_parcelas
    FROM jsonb_to_recordset(p_parcelas) AS x(valor numeric);
  IF abs(v_soma_parcelas - p_valor_total) > 0.01 THEN
    RAISE EXCEPTION 'A soma das parcelas (%) não bate com o valor total (%).', v_soma_parcelas, p_valor_total;
  END IF;

  IF p_tecnicos IS NOT NULL AND jsonb_array_length(p_tecnicos) > 0 THEN
    SELECT COALESCE(SUM((x.valor)), 0) INTO v_soma_tecnicos
      FROM jsonb_to_recordset(p_tecnicos) AS x(valor numeric);
    IF abs(v_soma_tecnicos - p_valor_total) > 0.01 THEN
      RAISE EXCEPTION 'O valor distribuído entre os técnicos (%) precisa corresponder ao valor da OS (%).',
        v_soma_tecnicos, p_valor_total;
    END IF;
  END IF;

  BEGIN
    INSERT INTO os_faturamentos (user_id, os_id, categoria_id, valor_total, observacoes, descricao, created_by)
      VALUES (v_empresa_id, p_os_id, v_categoria_id, p_valor_total, p_observacoes, v_descricao, auth.uid())
      RETURNING * INTO v_faturamento;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Esta OS já possui um faturamento ativo. Cancele-o antes de faturar novamente.';
  END;

  FOR v_parcela IN
    SELECT * FROM jsonb_to_recordset(p_parcelas) AS x(
      numero_parcela INT, valor NUMERIC, vencimento DATE,
      forma_pagamento_id UUID, recebido BOOLEAN, data_recebimento DATE
    )
  LOOP
    INSERT INTO lancamentos (user_id, tipo, categoria, descricao, valor, data, status, vencimento, payment_method_id)
      VALUES (
        v_empresa_id, 'entrada', v_categoria_nome,
        v_descricao || ' — parcela ' || v_parcela.numero_parcela || '/' || jsonb_array_length(p_parcelas),
        v_parcela.valor,
        COALESCE(CASE WHEN v_parcela.recebido THEN v_parcela.data_recebimento ELSE NULL END, CURRENT_DATE),
        CASE WHEN v_parcela.recebido THEN 'pago' ELSE 'pendente' END,
        v_parcela.vencimento,
        v_parcela.forma_pagamento_id
      )
      RETURNING id INTO v_lancamento_id;

    INSERT INTO os_faturamento_parcelas (
      user_id, faturamento_id, numero_parcela, total_parcelas, valor, vencimento,
      forma_pagamento_id, status, data_recebimento, lancamento_id
    ) VALUES (
      v_empresa_id, v_faturamento.id, v_parcela.numero_parcela, jsonb_array_length(p_parcelas),
      v_parcela.valor, v_parcela.vencimento, v_parcela.forma_pagamento_id,
      CASE WHEN v_parcela.recebido THEN 'recebido' ELSE 'pendente' END,
      CASE WHEN v_parcela.recebido THEN COALESCE(v_parcela.data_recebimento, CURRENT_DATE) ELSE NULL END,
      v_lancamento_id
    );
  END LOOP;

  IF p_tecnicos IS NOT NULL THEN
    FOR v_tecnico IN
      SELECT * FROM jsonb_to_recordset(p_tecnicos) AS x(membro_user_id UUID, nome_livre TEXT, valor NUMERIC)
    LOOP
      INSERT INTO os_faturamento_tecnicos (user_id, faturamento_id, membro_user_id, nome_livre, valor)
        VALUES (v_empresa_id, v_faturamento.id, v_tecnico.membro_user_id, v_tecnico.nome_livre, v_tecnico.valor);
    END LOOP;
  END IF;

  UPDATE ordens_servico SET status = 'faturado' WHERE id = p_os_id;
  GET DIAGNOSTICS v_linhas = ROW_COUNT;
  IF v_linhas = 0 THEN
    RAISE EXCEPTION 'Falha ao atualizar a OS (permissão insuficiente ou OS alterada por outra operação).';
  END IF;

  PERFORM public.recalcular_status_pagamento_os(p_os_id);

  RETURN v_faturamento;
END;
$$;
GRANT EXECUTE ON FUNCTION public.faturar_os(UUID, UUID, NUMERIC, JSONB, JSONB, TEXT, TEXT) TO authenticated;
