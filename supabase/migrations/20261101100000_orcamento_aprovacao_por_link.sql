-- Aprovação do orçamento pelo link da OS (/consulta/:id), sem login: o
-- cliente recebe o link no WhatsApp junto com o orçamento, vê os serviços e
-- peças e toca em "Aprovar" ou "Recusar".
--
-- Mesmo modelo de consultar_os_publica(): o UUID da OS (que só sai no link
-- e no QR Code, nunca o número sequencial) é a chave de acesso, e as funções
-- são SECURITY DEFINER com escopo estreito — nada de policy para "anon" em
-- ordens_servico/os_itens.

-- Itens do orçamento (serviços e peças) para a página pública.
CREATE OR REPLACE FUNCTION public.itens_os_publica(p_identificador text)
RETURNS TABLE(descricao text, tipo text, quantidade integer, preco_unitario numeric, desconto numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_identificador !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT i.descricao, i.tipo, i.quantidade, i.preco_unitario, COALESCE(o.desconto, 0)
  FROM public.os_itens i
  JOIN public.ordens_servico o ON o.id = i.os_id
  WHERE i.os_id = p_identificador::uuid
  ORDER BY i.tipo DESC, i.created_at;
END;
$$;

-- O cliente aprova ou recusa pelo link. Só muda o status de uma OS que está
-- em "orcamento" ou "aguardando_aprovacao" — qualquer outro estado (já
-- aprovada, em reparo, cancelada...) é recusado, então reabrir o link depois
-- não desfaz nada.
CREATE OR REPLACE FUNCTION public.decidir_orcamento_por_link(p_os_id uuid, p_aprovar boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_status text;
  v_novo_status text;
BEGIN
  SELECT user_id, status INTO v_user_id, v_status
    FROM public.ordens_servico
    WHERE id = p_os_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de serviço não encontrada';
  END IF;

  IF v_status NOT IN ('orcamento', 'aguardando_aprovacao') THEN
    RAISE EXCEPTION 'Este orçamento não está mais aguardando resposta';
  END IF;

  v_novo_status := CASE WHEN p_aprovar THEN 'aprovado' ELSE 'reprovado' END;

  UPDATE public.ordens_servico SET status = v_novo_status WHERE id = p_os_id;

  INSERT INTO public.os_historico (user_id, os_id, evento, descricao, created_by)
    VALUES (
      v_user_id, p_os_id, 'aprovacao_cliente',
      CASE WHEN p_aprovar
        THEN 'Cliente aprovou o orçamento pelo link'
        ELSE 'Cliente recusou o orçamento pelo link'
      END,
      NULL
    );

  RETURN v_novo_status;
END;
$$;

REVOKE ALL ON FUNCTION public.itens_os_publica(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decidir_orcamento_por_link(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.itens_os_publica(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decidir_orcamento_por_link(uuid, boolean) TO anon, authenticated;
