-- Vitrine pública (/catalogo/<subdominio>): sem login, só lê o que a loja
-- liberou (loja ativa, produtos com exibir_no_catalogo). Não expõe custo,
-- fornecedor nem quantidade exata — só se há estoque (ou se o estoque é
-- ignorado, tudo aparece como disponível).

CREATE OR REPLACE FUNCTION public.catalogo_publico(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  c public.catalogo_config;
  p public.profiles;
  v_itens jsonb;
BEGIN
  SELECT * INTO c FROM public.catalogo_config
   WHERE lower(subdominio) = lower(btrim(p_slug)) AND coalesce(loja_ativa, true)
   LIMIT 1;
  IF c.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO p FROM public.profiles WHERE id = c.user_id;

  SELECT coalesce(jsonb_agg(x ORDER BY x->>'categoria', x->>'nome'), '[]'::jsonb) INTO v_itens
    FROM (
      SELECT jsonb_build_object(
        'id', pr.id,
        'nome', pr.nome,
        'descricao', pr.descricao,
        'marca', pr.marca,
        'categoria', pr.categoria,
        'preco', pr.preco_venda,
        'imagem', pr.imagem_url,
        'tipo', CASE WHEN pr.categoria = 'Serviço' THEN 'servico' ELSE 'produto' END,
        'tempo_min', pr.tempo_estimado_min,
        'garantia_dias', pr.garantia_dias,
        'disponivel', CASE
          WHEN coalesce(c.ignorar_estoque, true) THEN true
          WHEN pr.categoria = 'Serviço' THEN true
          ELSE pr.quantidade > 0 OR coalesce(c.permitir_vender_sem_estoque, true)
        END
      ) AS x
      FROM public.produtos pr
      WHERE pr.user_id = c.user_id
        AND pr.ativo
        AND coalesce(pr.exibir_no_catalogo, true)
        AND (
          coalesce(c.ignorar_estoque, true)
          OR NOT coalesce(c.exibir_apenas_com_estoque, false)
          OR pr.categoria = 'Serviço'
          OR pr.quantidade > 0
        )
      ORDER BY pr.nome
      LIMIT 400
    ) s;

  RETURN jsonb_build_object(
    'slug', c.subdominio,
    'loja', coalesce(nullif(p.loja, ''), p.nome, 'Loja'),
    'logo', p.logo_url,
    'whatsapp', coalesce(nullif(c.whatsapp_atendimento, ''), p.whatsapp),
    'whatsapp_flutuante', coalesce(c.whatsapp_flutuante_ativo, true),
    'mensagem_inicial', coalesce(c.whatsapp_mensagem_inicial, ''),
    'endereco', nullif(concat_ws(' — ', nullif(p.endereco, ''), nullif(p.cidade, '')), ''),
    'horario', p.horario_funcionamento,
    'itens', v_itens
  );
END;
$$;

REVOKE ALL ON FUNCTION public.catalogo_publico(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalogo_publico(text) TO anon, authenticated;
