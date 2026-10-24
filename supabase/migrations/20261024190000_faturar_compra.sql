-- Faturar compra numa transação só: grava a saída no financeiro uma única vez
-- e marca faturado_em. Antes o navegador inseria o lançamento sem conferir o
-- erro — quem tinha acesso a Compras mas não ao Financeiro marcava a compra
-- como faturada e a despesa sumia. Também liga a forma de pagamento da compra
-- (para o controle de caixa saber se saiu dinheiro da gaveta).
CREATE OR REPLACE FUNCTION public.faturar_compra(p_compra_id UUID, p_status TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.compras;
  v_pm UUID;
BEGIN
  SELECT * INTO c FROM public.compras WHERE id = p_compra_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Compra não encontrada.'; END IF;
  IF auth.uid() IS NULL OR NOT public.has_permission(c.user_id, 'compras', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar compras.';
  END IF;

  IF c.faturado_em IS NULL THEN
    IF c.forma_pagamento IS NOT NULL THEN
      SELECT id INTO v_pm FROM public.payment_methods
       WHERE user_id = c.user_id
         AND public.caixa_forma_normalizada(nome) = public.caixa_forma_normalizada(c.forma_pagamento)
       ORDER BY created_at LIMIT 1;
    END IF;
    INSERT INTO public.lancamentos (user_id, tipo, categoria, descricao, valor, payment_method_id)
    VALUES (c.user_id, 'saida', 'Compra de fornecedor', 'Compra #' || left(c.id::text, 8),
            c.valor_total, v_pm);
    UPDATE public.compras SET faturado_em = now() WHERE id = c.id;
  END IF;

  UPDATE public.compras SET status = p_status WHERE id = c.id;
END;
$$;

REVOKE ALL ON FUNCTION public.faturar_compra(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.faturar_compra(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
