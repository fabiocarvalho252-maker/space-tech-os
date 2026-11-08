-- Selo de nota da loja nas páginas públicas (Área do Cliente e avaliação da
-- venda): média de todas as avaliações de OS e de vendas da empresa dona da
-- OS/venda do link. Só aparece a partir de 3 avaliações. Só pelo UUID.
CREATE OR REPLACE FUNCTION public.nota_publica_loja(p_tipo text, p_identificador text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa uuid;
  v_total integer;
  v_media numeric;
BEGIN
  IF p_identificador !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  IF p_tipo = 'os' THEN
    SELECT user_id INTO v_empresa FROM public.ordens_servico WHERE id = p_identificador::uuid;
  ELSIF p_tipo = 'venda' THEN
    SELECT user_id INTO v_empresa FROM public.vendas WHERE id = p_identificador::uuid;
  END IF;
  IF v_empresa IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT count(*), avg(nota) INTO v_total, v_media FROM (
    SELECT nota FROM public.os_avaliacoes WHERE user_id = v_empresa
    UNION ALL
    SELECT nota FROM public.venda_avaliacoes WHERE user_id = v_empresa
  ) t;
  IF v_total < 3 THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object('media', round(v_media, 1), 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.nota_publica_loja(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nota_publica_loja(text, text) TO anon, authenticated;
