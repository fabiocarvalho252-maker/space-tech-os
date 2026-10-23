-- Venda de aparelho: o lançamento de receita era criado sem venda_id, então
-- ficava solto da venda — cancelar/excluir a venda pela tela de Vendas não
-- tirava a receita do Financeiro. Passa a gravar venda_id e liga os
-- lançamentos antigos pela descrição que a própria função gera
-- ("Venda #NNNN — <descrição do item>"), o mesmo critério que
-- cancelar_venda_aparelho() já usava como fallback.

CREATE OR REPLACE FUNCTION public.vender_aparelho(p_aparelho_id uuid, p_cliente_id uuid, p_preco_venda numeric, p_desconto numeric DEFAULT 0, p_forma_pagamento text DEFAULT 'dinheiro'::text, p_termo_garantia_id uuid DEFAULT NULL::uuid, p_dias_garantia integer DEFAULT NULL::integer, p_observacoes text DEFAULT NULL::text)
 RETURNS aparelhos
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_aparelho public.aparelhos%ROWTYPE;
  v_empresa_id UUID;
  v_valor_final NUMERIC;
  v_categoria_nome TEXT;
  v_venda_id UUID;
  v_venda_numero INT;
  v_descricao TEXT;
BEGIN
  IF p_preco_venda IS NULL OR p_preco_venda < 0 THEN
    RAISE EXCEPTION 'O valor de venda não pode ser negativo.';
  END IF;
  IF p_desconto IS NULL OR p_desconto < 0 THEN
    RAISE EXCEPTION 'O desconto não pode ser negativo.';
  END IF;

  SELECT * INTO v_aparelho FROM aparelhos WHERE id = p_aparelho_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aparelho não encontrado.';
  END IF;
  v_empresa_id := v_aparelho.user_id;

  IF NOT public.has_permission(v_empresa_id, 'aparelhos', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para vender aparelhos.';
  END IF;
  IF NOT public.has_permission(v_empresa_id, 'vendas', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar vendas.';
  END IF;

  -- Um aparelho reservado só pode ser vendido para o próprio cliente da
  -- reserva — vender para outro exige liberar a reserva antes (pedido,
  -- seção 8: "RESERVED: Não pode ser vendido para outro cliente sem
  -- liberar a reserva").
  IF v_aparelho.status = 'reservado' THEN
    IF v_aparelho.reservado_cliente_id IS DISTINCT FROM p_cliente_id THEN
      RAISE EXCEPTION 'Este aparelho está reservado para outro cliente. Libere a reserva antes de vender para um cliente diferente.';
    END IF;
  ELSIF v_aparelho.status <> 'disponivel' THEN
    RAISE EXCEPTION 'Este aparelho não está disponível para venda (status atual: %).', v_aparelho.status;
  END IF;

  IF p_cliente_id IS NOT NULL THEN
    PERFORM 1 FROM clientes WHERE id = p_cliente_id AND user_id = v_empresa_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cliente inválido.';
    END IF;
  END IF;

  v_valor_final := GREATEST(p_preco_venda - p_desconto, 0);
  v_descricao := v_aparelho.marca || ' ' || v_aparelho.modelo
    || CASE WHEN v_aparelho.imei1 IS NOT NULL THEN ' - IMEI final ' || right(v_aparelho.imei1, 4) ELSE '' END;

  INSERT INTO vendas (user_id, cliente_id, total, forma_pagamento, desconto, observacoes, origem)
    VALUES (v_empresa_id, p_cliente_id, v_valor_final, p_forma_pagamento, p_desconto, p_observacoes, 'loja')
    RETURNING id, numero INTO v_venda_id, v_venda_numero;

  INSERT INTO venda_itens (user_id, venda_id, aparelho_id, descricao, quantidade, preco_unitario)
    VALUES (v_empresa_id, v_venda_id, p_aparelho_id, v_descricao, 1, v_valor_final);

  v_categoria_nome := CASE WHEN v_aparelho.tipo = 'lacrado'
    THEN 'Venda de Aparelho Lacrado' ELSE 'Venda de Aparelho Seminovo' END;
  IF NOT EXISTS (SELECT 1 FROM finance_categories WHERE user_id = v_empresa_id AND nome = v_categoria_nome AND tipo = 'entrada') THEN
    INSERT INTO finance_categories (user_id, nome, tipo) VALUES (v_empresa_id, v_categoria_nome, 'entrada');
  END IF;

  INSERT INTO lancamentos (user_id, tipo, categoria, descricao, valor, data, status, venda_id)
    VALUES (v_empresa_id, 'entrada', v_categoria_nome,
      'Venda #' || lpad(v_venda_numero::text, 4, '0') || ' — ' || v_descricao,
      v_valor_final, CURRENT_DATE, 'pago', v_venda_id);

  UPDATE aparelhos SET
    status = 'vendido',
    sold_at = now(),
    reservado_cliente_id = NULL,
    reservado_ate = NULL,
    reservado_observacao = NULL
  WHERE id = p_aparelho_id
  RETURNING * INTO v_aparelho;

  IF p_termo_garantia_id IS NOT NULL AND p_dias_garantia IS NOT NULL AND p_dias_garantia > 0 THEN
    INSERT INTO aparelho_garantias (user_id, aparelho_id, cliente_id, venda_id, termo_id, dias, inicio, fim)
      VALUES (v_empresa_id, p_aparelho_id, p_cliente_id, v_venda_id, p_termo_garantia_id,
        p_dias_garantia, CURRENT_DATE, CURRENT_DATE + p_dias_garantia);
  END IF;

  INSERT INTO aparelho_historico (user_id, aparelho_id, evento, descricao, created_by)
    VALUES (v_empresa_id, p_aparelho_id, 'venda',
      'Aparelho vendido — Venda #' || lpad(v_venda_numero::text, 4, '0')
        || CASE WHEN p_cliente_id IS NOT NULL THEN ' — cliente: ' || (SELECT nome FROM clientes WHERE id = p_cliente_id) ELSE '' END,
      auth.uid());

  RETURN v_aparelho;
END;
$function$;

UPDATE public.lancamentos l
   SET venda_id = v.id
  FROM public.vendas v
  JOIN public.venda_itens vi ON vi.venda_id = v.id AND vi.aparelho_id IS NOT NULL
 WHERE l.venda_id IS NULL
   AND l.user_id = v.user_id
   AND l.descricao = 'Venda #' || lpad(v.numero::text, 4, '0') || ' — ' || vi.descricao;
