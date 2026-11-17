-- Nota de entrada com aprovação antes do estoque.
--
-- 1. A importação (XML ou foto) cria a compra e os produtos, com valor de
--    revenda opcional, e NÃO dá entrada no estoque.
-- 2. A entrada só acontece em aprovar_entrada_nota, depois que o usuário
--    confere o valor de revenda final na aba Produtos.
-- 3. Notas que já deram entrada antes desta migração (importação anterior)
--    continuam no estoque; ficam listadas para conferir o valor final e
--    aprovar, sem somar a quantidade de novo.

ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS nota_importada BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS entrada_aprovada_em TIMESTAMPTZ;

-- Notas já importadas: pela chave de acesso, ou pelo texto gravado na
-- importação (notas lidas por foto podem vir sem chave).
UPDATE public.compras
   SET nota_importada = true
 WHERE nota_importada = false
   AND (chave_acesso IS NOT NULL OR observacoes LIKE 'Nota fiscal nº %');

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
  v_preco_venda NUMERIC;
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
    v_preco_venda := NULLIF(v_item->>'preco_venda', '')::numeric;
    IF v_quantidade IS NULL OR v_quantidade <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida em "%".', v_item->>'descricao';
    END IF;
    IF v_custo IS NULL OR v_custo < 0 THEN
      RAISE EXCEPTION 'Custo inválido em "%".', v_item->>'descricao';
    END IF;
    IF v_preco_venda IS NOT NULL AND v_preco_venda < 0 THEN
      RAISE EXCEPTION 'Valor de revenda inválido em "%".', v_item->>'descricao';
    END IF;
    v_valor_total := v_valor_total + v_quantidade * v_custo;
  END LOOP;

  INSERT INTO compras (
    user_id, fornecedor_id, status, observacoes, valor_total,
    chave_acesso, numero_nota, serie_nota, data_emissao, nota_importada
  ) VALUES (
    v_user_id, p_fornecedor_id, 'aberto',
    'Nota fiscal nº ' || COALESCE(p_numero_nota, '—') || ' série ' || COALESCE(p_serie_nota, '—'),
    v_valor_total,
    p_chave_acesso, p_numero_nota, p_serie_nota, p_data_emissao, true
  ) RETURNING id INTO v_compra_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_produto_id := NULLIF(v_item->>'produto_id', '')::uuid;
    v_preco_venda := NULLIF(v_item->>'preco_venda', '')::numeric;

    IF v_produto_id IS NULL THEN
      -- Produto novo: estoque começa em zero; a quantidade entra na aprovação.
      INSERT INTO produtos (user_id, nome, codigo_barras, sku, preco_custo, preco_venda, quantidade, fornecedor_id)
      VALUES (
        v_user_id,
        left(COALESCE(NULLIF(v_item->>'nome_novo', ''), v_item->>'descricao'), 200),
        NULLIF(v_item->>'codigo_barras', ''),
        NULLIF(v_item->>'sku', ''),
        (v_item->>'custo_unitario')::numeric,
        COALESCE(v_preco_venda, 0),
        0,
        p_fornecedor_id
      )
      RETURNING id INTO v_produto_id;
    ELSE
      IF NOT EXISTS (SELECT 1 FROM produtos WHERE id = v_produto_id AND user_id = v_user_id) THEN
        RAISE EXCEPTION 'Produto de outra empresa ou inexistente.';
      END IF;
      IF v_preco_venda IS NOT NULL THEN
        UPDATE produtos SET preco_venda = v_preco_venda
         WHERE id = v_produto_id AND user_id = v_user_id;
      END IF;
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

  RETURN v_compra_id;
END;
$function$;

-- Aprova a entrada: grava o valor final de revenda dos produtos da nota e,
-- se a entrada ainda não foi lançada no estoque, lança agora. Notas da
-- importação anterior já estão no estoque: só o valor é confirmado.
CREATE OR REPLACE FUNCTION public.aprovar_entrada_nota(p_compra_id UUID, p_precos JSONB)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_compra RECORD;
  v_item JSONB;
  v_preco NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão expirada. Entre novamente.';
  END IF;

  SELECT * INTO v_compra FROM compras WHERE id = p_compra_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entrada não encontrada.';
  END IF;
  IF NOT public.has_permission(v_compra.user_id, 'compras', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar compras.';
  END IF;
  IF NOT v_compra.nota_importada THEN
    RAISE EXCEPTION 'Esta compra não veio de uma nota de entrada.';
  END IF;
  IF v_compra.entrada_aprovada_em IS NOT NULL THEN
    RAISE EXCEPTION 'Esta entrada já foi aprovada.';
  END IF;

  IF p_precos IS NOT NULL AND jsonb_typeof(p_precos) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_precos) LOOP
      v_preco := NULLIF(v_item->>'preco_venda', '')::numeric;
      IF v_preco IS NULL THEN
        CONTINUE;
      END IF;
      IF v_preco < 0 THEN
        RAISE EXCEPTION 'Valor de revenda não pode ser negativo.';
      END IF;
      -- Só produtos desta própria nota.
      UPDATE produtos SET preco_venda = v_preco
       WHERE id = (v_item->>'produto_id')::uuid
         AND user_id = v_compra.user_id
         AND id IN (SELECT produto_id FROM compra_itens WHERE compra_id = p_compra_id);
    END LOOP;
  END IF;

  -- Entrada ainda não lançada: lança agora. Já lançada (importação anterior): não soma de novo.
  IF v_compra.recebido_em IS NULL THEN
    PERFORM public.receber_compra(p_compra_id, 'recebido');
  END IF;

  UPDATE compras SET entrada_aprovada_em = now() WHERE id = p_compra_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.importar_nota_compra(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.importar_nota_compra(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB) TO authenticated;
REVOKE ALL ON FUNCTION public.aprovar_entrada_nota(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aprovar_entrada_nota(UUID, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
