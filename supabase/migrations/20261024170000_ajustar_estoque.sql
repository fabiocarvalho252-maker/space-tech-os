-- Ajuste de estoque com motivo (Produtos > Ajustar estoque): entrada, saída ou
-- contagem (define a quantidade exata). O motivo vai para o histórico
-- (estoque_movimentacoes) pelo gatilho registrar_movimentacao_estoque.
CREATE OR REPLACE FUNCTION public.ajustar_estoque(
  p_produto_id UUID, p_tipo TEXT, p_quantidade INT, p_motivo TEXT
)
RETURNS public.produtos
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.produtos;
  v_nova INT;
  v_motivo TEXT := NULLIF(btrim(COALESCE(p_motivo, '')), '');
BEGIN
  SELECT * INTO p FROM public.produtos WHERE id = p_produto_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
  IF NOT public.has_permission(p.user_id, 'produtos', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para ajustar o estoque';
  END IF;
  IF p.categoria = 'Serviço' THEN RAISE EXCEPTION 'Serviço não tem estoque'; END IF;
  IF v_motivo IS NULL THEN RAISE EXCEPTION 'Informe o motivo do ajuste'; END IF;
  IF p_quantidade IS NULL OR p_quantidade < 0 OR (p_tipo <> 'contagem' AND p_quantidade = 0) THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;

  v_nova := CASE p_tipo
    WHEN 'entrada' THEN p.quantidade + p_quantidade
    WHEN 'saida' THEN p.quantidade - p_quantidade
    WHEN 'contagem' THEN p_quantidade
  END;
  IF v_nova IS NULL THEN RAISE EXCEPTION 'Tipo de ajuste inválido'; END IF;
  IF v_nova < 0 THEN
    RAISE EXCEPTION 'Saída maior que o estoque atual (% un.)', p.quantidade;
  END IF;
  IF v_nova = p.quantidade THEN RETURN p; END IF;

  PERFORM set_config('app.estoque_tipo',
    CASE p_tipo WHEN 'entrada' THEN 'entrada' WHEN 'saida' THEN 'saida' ELSE 'ajuste' END, true);
  PERFORM set_config('app.estoque_descricao',
    CASE WHEN p_tipo = 'contagem' THEN 'Contagem: ' || v_motivo ELSE v_motivo END, true);

  UPDATE public.produtos SET quantidade = v_nova WHERE id = p.id RETURNING * INTO p;

  PERFORM set_config('app.estoque_tipo', '', true);
  PERFORM set_config('app.estoque_descricao', '', true);
  RETURN p;
END;
$$;

REVOKE ALL ON FUNCTION public.ajustar_estoque(UUID, TEXT, INT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ajustar_estoque(UUID, TEXT, INT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
