-- Previsão de entrega sugerida: quanto tempo as OS da loja levaram da
-- abertura até a primeira troca para Pronto/Entregue/Faturado nos últimos
-- 180 dias (percentil 75 — margem conservadora). Com serviços informados,
-- usa só as OS que tiveram algum deles (se houver 3+); senão, a loja toda.
-- SECURITY INVOKER: o RLS limita à empresa de quem pergunta.
CREATE OR REPLACE FUNCTION public.previsao_sugerida(p_produtos uuid[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_horas numeric;
  v_qtd integer;
  v_base text := 'loja';
BEGIN
  IF p_produtos IS NOT NULL AND cardinality(p_produtos) > 0 THEN
    SELECT count(*), percentile_cont(0.75) WITHIN GROUP (ORDER BY horas)
      INTO v_qtd, v_horas
      FROM (
        SELECT extract(epoch FROM min(h.created_at) - o.created_at) / 3600 AS horas
          FROM public.ordens_servico o
          JOIN public.os_historico h
            ON h.os_id = o.id AND h.evento = 'status'
           AND h.descricao ~ 'para "(pronto|entregue|faturado)"'
         WHERE o.created_at > now() - interval '180 days'
           AND EXISTS (SELECT 1 FROM public.os_itens i
                        WHERE i.os_id = o.id AND i.produto_id = ANY (p_produtos))
         GROUP BY o.id, o.created_at
      ) t;
    IF v_qtd >= 3 THEN
      v_base := 'servicos';
    END IF;
  END IF;

  IF v_base = 'loja' THEN
    SELECT count(*), percentile_cont(0.75) WITHIN GROUP (ORDER BY horas)
      INTO v_qtd, v_horas
      FROM (
        SELECT extract(epoch FROM min(h.created_at) - o.created_at) / 3600 AS horas
          FROM public.ordens_servico o
          JOIN public.os_historico h
            ON h.os_id = o.id AND h.evento = 'status'
           AND h.descricao ~ 'para "(pronto|entregue|faturado)"'
         WHERE o.created_at > now() - interval '180 days'
         GROUP BY o.id, o.created_at
      ) t;
  END IF;

  IF coalesce(v_qtd, 0) < 3 THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'horas', round(v_horas, 1),
    'dias', CASE WHEN v_horas < 24 THEN 0 ELSE ceil(v_horas / 24)::int END,
    'amostra', v_qtd,
    'base', v_base
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.previsao_sugerida(uuid[]) TO authenticated;
