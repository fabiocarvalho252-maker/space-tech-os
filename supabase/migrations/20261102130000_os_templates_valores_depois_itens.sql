-- O editor de modelos salvava "valores" sempre logo depois do cabeçalho (e a
-- renderização o forçava ali), então todo modelo mostrava o total ANTES da
-- lista de serviços. Agora a ordem é livre; os modelos salvos com esse
-- defeito ("valores" na 2ª posição e "itens" mais abaixo) passam a ter
-- "valores" logo depois de "itens".
DO $$
DECLARE
  r RECORD;
  v_secoes text[];
  v_novas text[];
  s text;
BEGIN
  FOR r IN SELECT id, config FROM public.os_templates LOOP
    SELECT array_agg(e ORDER BY ord) INTO v_secoes
      FROM jsonb_array_elements_text(r.config->'secoes') WITH ORDINALITY AS t(e, ord);
    IF v_secoes IS NULL OR array_length(v_secoes, 1) < 3
       OR v_secoes[2] <> 'valores' OR NOT ('itens' = ANY (v_secoes)) THEN
      CONTINUE;
    END IF;
    v_novas := '{}';
    FOREACH s IN ARRAY v_secoes LOOP
      IF s = 'valores' THEN CONTINUE; END IF;
      v_novas := v_novas || s;
      IF s = 'itens' THEN v_novas := v_novas || 'valores'::text; END IF;
    END LOOP;
    UPDATE public.os_templates
      SET config = jsonb_set(config, '{secoes}', to_jsonb(v_novas))
      WHERE id = r.id;
  END LOOP;
END $$;
