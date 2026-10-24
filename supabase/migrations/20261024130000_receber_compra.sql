-- Entrada de estoque de uma compra numa transação só: antes o navegador lia
-- e regravava a quantidade de cada produto (duas operações ao mesmo tempo
-- podiam perder unidades) e uma falha no meio deixava a compra metade dentro
-- do estoque. Também marca o motivo "compra" no histórico de estoque.
CREATE OR REPLACE FUNCTION public.receber_compra(p_compra_id UUID, p_status TEXT DEFAULT 'recebido')
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_compra RECORD;
  v_item RECORD;
BEGIN
  SELECT * INTO v_compra FROM compras WHERE id = p_compra_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compra não encontrada.';
  END IF;
  IF auth.uid() IS NULL OR NOT public.has_permission(v_compra.user_id, 'compras', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar compras.';
  END IF;

  -- Só uma entrada por compra: reabrir/mudar o status de novo não duplica.
  IF v_compra.recebido_em IS NULL THEN
    PERFORM set_config('app.estoque_tipo', 'compra', true);
    PERFORM set_config('app.estoque_origem_id', p_compra_id::text, true);
    PERFORM set_config('app.estoque_descricao', 'Compra #' || left(p_compra_id::text, 8), true);
    FOR v_item IN
      SELECT produto_id, sum(quantidade) AS qtd
        FROM compra_itens
       WHERE compra_id = p_compra_id AND produto_id IS NOT NULL
       GROUP BY produto_id
    LOOP
      UPDATE produtos
         SET quantidade = COALESCE(quantidade, 0) + round(v_item.qtd)::int
       WHERE id = v_item.produto_id AND user_id = v_compra.user_id;
    END LOOP;
    PERFORM set_config('app.estoque_tipo', '', true);
    PERFORM set_config('app.estoque_origem_id', '', true);
    PERFORM set_config('app.estoque_descricao', '', true);
    UPDATE compras SET recebido_em = now() WHERE id = p_compra_id;
  END IF;

  UPDATE compras SET status = p_status WHERE id = p_compra_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.receber_compra(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receber_compra(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
