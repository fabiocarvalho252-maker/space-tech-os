-- Orçamento com opções: itens da OS com o mesmo opcao_grupo (ex.: "Tela")
-- são alternativas — o cliente escolhe uma de cada grupo ao aprovar pela
-- Área do Cliente. As não escolhidas saem da OS (a peça volta ao estoque
-- pelo handle_os_item_stock) e o valor da OS é recalculado.
ALTER TABLE public.os_itens ADD COLUMN IF NOT EXISTS opcao_grupo text;

-- Itens públicos agora trazem o id (para a escolha) e o grupo de opção.
DROP FUNCTION IF EXISTS public.itens_os_publica(text);
CREATE FUNCTION public.itens_os_publica(p_identificador text)
RETURNS TABLE(id uuid, descricao text, tipo text, quantidade integer, preco_unitario numeric,
              desconto numeric, opcao_grupo text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_identificador !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT i.id, i.descricao, i.tipo, i.quantidade, i.preco_unitario, COALESCE(o.desconto, 0),
         nullif(btrim(i.opcao_grupo), '')
    FROM public.os_itens i
    JOIN public.ordens_servico o ON o.id = i.os_id
   WHERE i.os_id = p_identificador::uuid
   ORDER BY i.tipo DESC, i.created_at;
END;
$$;
REVOKE ALL ON FUNCTION public.itens_os_publica(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.itens_os_publica(text) TO anon, authenticated, service_role;

-- Aprovar/recusar pelo link, agora com a escolha das opções.
DROP FUNCTION IF EXISTS public.decidir_orcamento_por_link(uuid, boolean);
CREATE FUNCTION public.decidir_orcamento_por_link(
  p_os_id uuid,
  p_aprovar boolean,
  p_escolhas uuid[] DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_os public.ordens_servico%ROWTYPE;
  v_novo_status text;
  v_grupos text[];
  v_grupo text;
  v_escolhidos text;
  v_qtd_escolha integer;
BEGIN
  SELECT * INTO v_os FROM public.ordens_servico WHERE id = p_os_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de serviço não encontrada';
  END IF;
  IF v_os.status NOT IN ('orcamento', 'aguardando_aprovacao') THEN
    RAISE EXCEPTION 'Este orçamento não está mais aguardando resposta';
  END IF;

  SELECT array_agg(DISTINCT btrim(opcao_grupo)) INTO v_grupos
    FROM public.os_itens
   WHERE os_id = p_os_id AND nullif(btrim(opcao_grupo), '') IS NOT NULL;

  IF p_aprovar AND v_grupos IS NOT NULL THEN
    -- Uma escolha, e só uma, para cada grupo.
    FOREACH v_grupo IN ARRAY v_grupos LOOP
      SELECT count(*) INTO v_qtd_escolha FROM public.os_itens
       WHERE os_id = p_os_id AND btrim(opcao_grupo) = v_grupo
         AND id = ANY (coalesce(p_escolhas, '{}'));
      IF v_qtd_escolha <> 1 THEN
        RAISE EXCEPTION 'Escolha uma opção de "%"', v_grupo;
      END IF;
    END LOOP;

    SELECT string_agg(btrim(opcao_grupo) || ': ' || descricao, ', ' ORDER BY opcao_grupo)
      INTO v_escolhidos
      FROM public.os_itens
     WHERE os_id = p_os_id AND id = ANY (p_escolhas);

    -- Sai o que não foi escolhido (peça volta ao estoque pelo gatilho).
    DELETE FROM public.os_itens
     WHERE os_id = p_os_id AND nullif(btrim(opcao_grupo), '') IS NOT NULL
       AND NOT (id = ANY (p_escolhas));
    UPDATE public.os_itens SET opcao_grupo = NULL WHERE os_id = p_os_id;

    UPDATE public.ordens_servico
       SET valor = greatest(
             coalesce((SELECT sum(quantidade * preco_unitario) FROM public.os_itens WHERE os_id = p_os_id), 0)
             - coalesce(v_os.desconto, 0), 0)
     WHERE id = p_os_id;
  END IF;

  v_novo_status := CASE WHEN p_aprovar THEN 'aprovado' ELSE 'reprovado' END;
  UPDATE public.ordens_servico SET status = v_novo_status WHERE id = p_os_id;

  INSERT INTO public.os_historico (user_id, os_id, evento, descricao, created_by)
  VALUES (
    v_os.user_id, p_os_id, 'aprovacao_cliente',
    CASE WHEN p_aprovar
      THEN 'Cliente aprovou o orçamento pelo link'
           || CASE WHEN v_escolhidos IS NOT NULL THEN ' — escolheu ' || v_escolhidos ELSE '' END
      ELSE 'Cliente recusou o orçamento pelo link'
    END,
    NULL
  );
  RETURN v_novo_status;
END;
$$;
REVOKE ALL ON FUNCTION public.decidir_orcamento_por_link(uuid, boolean, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decidir_orcamento_por_link(uuid, boolean, uuid[]) TO anon, authenticated, service_role;
