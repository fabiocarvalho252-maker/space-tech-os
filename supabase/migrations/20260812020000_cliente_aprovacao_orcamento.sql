-- Lets the client portal (área do cliente) actually act on an OS instead of
-- being read-only: a customer can approve or reject the orçamento while the
-- OS sits in "aguardando_aprovacao", closing the gap where "Cliente aprovou"
-- could only ever be recorded by staff manually changing the status.
--
-- No RLS UPDATE policy is added for clientes on ordens_servico — a raw
-- policy would let a customer PATCH any column (valor, desconto, ...) via
-- the REST API. Instead, same pattern as meu_cliente_id()/get_empresa_membros,
-- a narrow SECURITY DEFINER RPC (owned by postgres, which has BYPASSRLS)
-- is the only path: it re-checks ownership and the current status itself,
-- so a customer can only flip their own OS from aguardando_aprovacao to
-- aprovado/reprovado — nothing else.
CREATE OR REPLACE FUNCTION public.cliente_decidir_orcamento(p_os_id UUID, p_aprovar BOOLEAN)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id UUID;
  v_user_id UUID;
  v_status TEXT;
  v_novo_status TEXT;
BEGIN
  v_cliente_id := public.meu_cliente_id();
  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Sem acesso a esta ordem de serviço';
  END IF;

  SELECT user_id, status INTO v_user_id, v_status
    FROM public.ordens_servico
    WHERE id = p_os_id AND cliente_id = v_cliente_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de serviço não encontrada';
  END IF;

  IF v_status <> 'aguardando_aprovacao' THEN
    RAISE EXCEPTION 'Esta ordem de serviço não está aguardando aprovação do orçamento';
  END IF;

  v_novo_status := CASE WHEN p_aprovar THEN 'aprovado' ELSE 'reprovado' END;

  UPDATE public.ordens_servico SET status = v_novo_status WHERE id = p_os_id;

  -- os_historico_on_update already logs a generic "Status alterado de ...
  -- para ..." row; add a friendlier, explicit one so the timeline reads
  -- as the spec describes ("Cliente aprovou"), not just a raw status diff.
  INSERT INTO public.os_historico (user_id, os_id, evento, descricao, created_by)
    VALUES (
      v_user_id, p_os_id, 'aprovacao_cliente',
      CASE WHEN p_aprovar THEN 'Cliente aprovou o orçamento' ELSE 'Cliente reprovou o orçamento' END,
      auth.uid()
    );

  RETURN v_novo_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cliente_decidir_orcamento(UUID, BOOLEAN) TO authenticated;
