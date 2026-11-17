-- Nota de entrada do fornecedor (NF-e de compra lida de XML).
-- Registra a compra com a chave de acesso e lança os itens no estoque
-- numa transação só. Produtos ainda não cadastrados são criados aqui.

ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS chave_acesso TEXT,
  ADD COLUMN IF NOT EXISTS numero_nota TEXT,
  ADD COLUMN IF NOT EXISTS serie_nota TEXT,
  ADD COLUMN IF NOT EXISTS data_emissao TIMESTAMPTZ;

-- Mesma nota não entra duas vezes na mesma empresa.
CREATE UNIQUE INDEX IF NOT EXISTS compras_chave_acesso_unica
  ON public.compras (user_id, chave_acesso)
  WHERE chave_acesso IS NOT NULL;

CREATE OR REPLACE FUNCTION public.importar_nota_compra(
  p_fornecedor_id UUID,
  p_chave_acesso TEXT,
  p_numero_nota TEXT,
  p_serie_nota TEXT,
  p_data_emissao TIMESTAMPTZ,
  p_itens JSONB
)
 RETURNS UUID
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_compra_id UUID;
  v_item JSONB;
  v_produto_id UUID;
  v_quantidade NUMERIC;
  v_custo NUMERIC;
  v_valor_total NUMERIC := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão expirada. Entre novamente.';
  END IF;

  SELECT user_id INTO v_user_id FROM fornecedores WHERE id = p_fornecedor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fornecedor não encontrado.';
  END IF;
  IF NOT public.has_permission(v_user_id, 'compras', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar compras.';
  END IF;

  IF p_chave_acesso IS NOT NULL AND EXISTS (
    SELECT 1 FROM compras WHERE user_id = v_user_id AND chave_acesso = p_chave_acesso
  ) THEN
    RAISE EXCEPTION 'Esta nota fiscal já foi importada.';
  END IF;

  IF jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'A nota não tem itens.';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_quantidade := (v_item->>'quantidade')::numeric;
    v_custo := (v_item->>'custo_unitario')::numeric;
    IF v_quantidade IS NULL OR v_quantidade <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida em "%".', v_item->>'descricao';
    END IF;
    IF v_custo IS NULL OR v_custo < 0 THEN
      RAISE EXCEPTION 'Custo inválido em "%".', v_item->>'descricao';
    END IF;
    v_valor_total := v_valor_total + v_quantidade * v_custo;
  END LOOP;

  INSERT INTO compras (
    user_id, fornecedor_id, status, observacoes, valor_total,
    chave_acesso, numero_nota, serie_nota, data_emissao
  ) VALUES (
    v_user_id, p_fornecedor_id, 'aberto',
    'Nota fiscal nº ' || COALESCE(p_numero_nota, '—') || ' série ' || COALESCE(p_serie_nota, '—'),
    v_valor_total,
    p_chave_acesso, p_numero_nota, p_serie_nota, p_data_emissao
  ) RETURNING id INTO v_compra_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_produto_id := NULLIF(v_item->>'produto_id', '')::uuid;

    IF v_produto_id IS NULL THEN
      -- Produto novo: cadastrado a partir da nota, estoque começa em zero
      -- (a entrada abaixo soma a quantidade).
      INSERT INTO produtos (user_id, nome, codigo_barras, sku, preco_custo, preco_venda, quantidade, fornecedor_id)
      VALUES (
        v_user_id,
        left(COALESCE(NULLIF(v_item->>'nome_novo', ''), v_item->>'descricao'), 200),
        NULLIF(v_item->>'codigo_barras', ''),
        NULLIF(v_item->>'sku', ''),
        (v_item->>'custo_unitario')::numeric,
        0,
        0,
        p_fornecedor_id
      )
      RETURNING id INTO v_produto_id;
    ELSIF NOT EXISTS (SELECT 1 FROM produtos WHERE id = v_produto_id AND user_id = v_user_id) THEN
      RAISE EXCEPTION 'Produto de outra empresa ou inexistente.';
    END IF;

    INSERT INTO compra_itens (user_id, compra_id, produto_id, descricao, quantidade, custo_unitario)
    VALUES (
      v_user_id,
      v_compra_id,
      v_produto_id,
      left(v_item->>'descricao', 300),
      (v_item->>'quantidade')::numeric,
      (v_item->>'custo_unitario')::numeric
    );
  END LOOP;

  -- Mesma rotina da compra manual: entrada no estoque e histórico "compra".
  PERFORM public.receber_compra(v_compra_id, 'recebido');

  RETURN v_compra_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.importar_nota_compra(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.importar_nota_compra(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
