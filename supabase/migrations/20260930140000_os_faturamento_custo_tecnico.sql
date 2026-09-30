-- Pagamento do técnico no faturamento da OS — pedido do usuário: poder
-- informar, ao faturar, um valor pago ao técnico que fez o reparo, como
-- despesa (custo) da OS.
--
-- Diferente de os_faturamento_tecnicos (que só DIVIDE a receita da OS entre
-- técnicos), este valor é custo: vira um lançamento de saída "Pagamento de
-- técnico" (pago) no Financeiro e entra na despesa/lucro da OS. Cancelar o
-- faturamento cancela esse lançamento.

ALTER TABLE public.os_faturamentos
  ADD COLUMN IF NOT EXISTS custo_tecnico NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_tecnico_nome TEXT,
  ADD COLUMN IF NOT EXISTS lancamento_custo_tecnico_id UUID
    REFERENCES public.lancamentos(id) ON DELETE SET NULL;

ALTER TABLE public.os_faturamentos
  DROP CONSTRAINT IF EXISTS os_faturamentos_custo_tecnico_check;
ALTER TABLE public.os_faturamentos
  ADD CONSTRAINT os_faturamentos_custo_tecnico_check CHECK (custo_tecnico >= 0);

-- Assinatura nova (2 parâmetros a mais, com default) — remove a antiga para
-- não ficarem duas sobrecargas ambíguas para o PostgREST.
DROP FUNCTION IF EXISTS public.faturar_os(uuid, uuid, numeric, jsonb, jsonb, text, text);

CREATE OR REPLACE FUNCTION public.faturar_os(p_os_id uuid, p_categoria_id uuid, p_valor_total numeric, p_parcelas jsonb, p_tecnicos jsonb DEFAULT '[]'::jsonb, p_observacoes text DEFAULT NULL::text, p_descricao text DEFAULT NULL::text, p_custo_tecnico numeric DEFAULT 0, p_custo_tecnico_nome text DEFAULT NULL::text)
 RETURNS os_faturamentos
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
  v_custo_tecnico NUMERIC := COALESCE(p_custo_tecnico, 0);
  v_lancamento_tecnico_id UUID;
BEGIN
  IF p_valor_total <= 0 THEN
    RAISE EXCEPTION 'O valor total da OS deve ser maior que zero para faturar.';
  END IF;
  IF v_custo_tecnico < 0 THEN
    RAISE EXCEPTION 'O pagamento do técnico não pode ser negativo.';
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

  -- Pagamento do técnico: despesa (custo) da OS, lançada como saída paga
  -- no Financeiro para entrar na despesa do dia/mês e no lucro da OS.
  IF v_custo_tecnico > 0 THEN
    IF NOT EXISTS (SELECT 1 FROM finance_categories
                    WHERE user_id = v_empresa_id AND nome = 'Pagamento de técnico' AND tipo = 'saida') THEN
      INSERT INTO finance_categories (user_id, nome, tipo) VALUES (v_empresa_id, 'Pagamento de técnico', 'saida');
    END IF;
    INSERT INTO lancamentos (user_id, tipo, categoria, descricao, valor, data, status)
      VALUES (
        v_empresa_id, 'saida', 'Pagamento de técnico',
        'Pagamento de técnico' || COALESCE(' (' || NULLIF(trim(p_custo_tecnico_nome), '') || ')', '')
          || ' — OS Nº ' || v_os_numero,
        v_custo_tecnico, CURRENT_DATE, 'pago'
      )
      RETURNING id INTO v_lancamento_tecnico_id;
    UPDATE os_faturamentos SET
      custo_tecnico = v_custo_tecnico,
      custo_tecnico_nome = NULLIF(trim(p_custo_tecnico_nome), ''),
      lancamento_custo_tecnico_id = v_lancamento_tecnico_id
    WHERE id = v_faturamento.id
    RETURNING * INTO v_faturamento;
  END IF;

  UPDATE ordens_servico SET status = 'faturado' WHERE id = p_os_id;
  GET DIAGNOSTICS v_linhas = ROW_COUNT;
  IF v_linhas = 0 THEN
    RAISE EXCEPTION 'Falha ao atualizar a OS (permissão insuficiente ou OS alterada por outra operação).';
  END IF;

  PERFORM public.recalcular_status_pagamento_os(p_os_id);

  RETURN v_faturamento;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.faturar_os(uuid, uuid, numeric, jsonb, jsonb, text, text, numeric, text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cancelar_faturamento_os(p_faturamento_id uuid, p_motivo text DEFAULT NULL::text)
 RETURNS os_faturamentos
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fat public.os_faturamentos%ROWTYPE;
  v_parcela RECORD;
  v_categoria_estorno_id UUID;
  v_estorno_id UUID;
BEGIN
  SELECT * INTO v_fat FROM os_faturamentos WHERE id = p_faturamento_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Faturamento não encontrado.';
  END IF;
  IF v_fat.status = 'cancelado' THEN
    RAISE EXCEPTION 'Este faturamento já está cancelado.';
  END IF;

  IF NOT public.has_permission(v_fat.user_id, 'financeiro', 'gerenciar')
     OR NOT public.has_permission(v_fat.user_id, 'ordens', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para cancelar este faturamento.';
  END IF;

  SELECT id INTO v_categoria_estorno_id FROM finance_categories
    WHERE user_id = v_fat.user_id AND nome = 'Estorno de Faturamento' AND tipo = 'saida';
  IF NOT FOUND THEN
    INSERT INTO finance_categories (user_id, nome, tipo) VALUES (v_fat.user_id, 'Estorno de Faturamento', 'saida')
      RETURNING id INTO v_categoria_estorno_id;
  END IF;

  FOR v_parcela IN SELECT * FROM os_faturamento_parcelas WHERE faturamento_id = p_faturamento_id LOOP
    IF v_parcela.status = 'pendente' THEN
      UPDATE lancamentos SET status = 'cancelado' WHERE id = v_parcela.lancamento_id;
      UPDATE os_faturamento_parcelas SET status = 'cancelado' WHERE id = v_parcela.id;
    ELSIF v_parcela.status = 'recebido' THEN
      INSERT INTO lancamentos (user_id, tipo, categoria, descricao, valor, data, status)
        VALUES (
          v_fat.user_id, 'saida', 'Estorno de Faturamento',
          'Estorno — faturamento #' || v_fat.numero || ', parcela ' || v_parcela.numero_parcela,
          v_parcela.valor, CURRENT_DATE, 'pago'
        )
        RETURNING id INTO v_estorno_id;
      UPDATE os_faturamento_parcelas SET lancamento_estorno_id = v_estorno_id WHERE id = v_parcela.id;
    END IF;
  END LOOP;

  -- O pagamento do técnico só existiu por causa deste faturamento.
  IF v_fat.lancamento_custo_tecnico_id IS NOT NULL THEN
    UPDATE lancamentos SET status = 'cancelado' WHERE id = v_fat.lancamento_custo_tecnico_id;
  END IF;

  UPDATE os_faturamentos SET
    status = 'cancelado',
    cancelado_em = now(),
    cancelado_por = auth.uid(),
    motivo_cancelamento = p_motivo
  WHERE id = p_faturamento_id
  RETURNING * INTO v_fat;

  PERFORM public.recalcular_status_pagamento_os(v_fat.os_id);
  RETURN v_fat;
END;
$function$;

NOTIFY pgrst, 'reload schema';
