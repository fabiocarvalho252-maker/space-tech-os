-- Relatório "Produção por técnico": OS faturadas no período agrupadas pelo
-- técnico responsável, com mão de obra, peças e a comissão calculada pelo
-- % de comissão de cada serviço (cadastro de Serviços).
CREATE OR REPLACE FUNCTION public.relatorio_tecnicos(
  p_empresa_id UUID, p_inicio TIMESTAMPTZ, p_fim TIMESTAMPTZ
)
RETURNS TABLE (
  tecnico TEXT,
  tecnico_user_id UUID,
  qtd_os INT,
  faturamento NUMERIC,
  mao_de_obra NUMERIC,
  pecas NUMERIC,
  comissao NUMERIC,
  custo_terceiro NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_permission(p_empresa_id, 'relatorios', 'ver') THEN
    RAISE EXCEPTION 'Sem permissão para ver relatórios';
  END IF;

  RETURN QUERY
  WITH fat AS (
    SELECT f.os_id, f.valor_total, f.custo_tecnico,
           o.responsavel_user_id,
           NULLIF(btrim(COALESCE(o.responsavel, '')), '') AS responsavel
    FROM public.os_faturamentos f
    JOIN public.ordens_servico o ON o.id = f.os_id
    WHERE f.user_id = p_empresa_id
      AND f.status = 'faturado'
      AND f.created_at >= p_inicio AND f.created_at <= p_fim
  ), itens AS (
    SELECT i.os_id,
           SUM(i.quantidade * i.preco_unitario) FILTER (WHERE i.tipo = 'servico') AS mao,
           SUM(i.quantidade * i.preco_unitario) FILTER (WHERE i.tipo <> 'servico') AS pecas,
           SUM(i.quantidade * i.preco_unitario * COALESCE(p.comissao_percentual, 0) / 100)
             FILTER (WHERE i.tipo = 'servico') AS comissao
    FROM public.os_itens i
    LEFT JOIN public.produtos p ON p.id = i.produto_id
    WHERE i.os_id IN (SELECT os_id FROM fat)
    GROUP BY i.os_id
  )
  SELECT
    COALESCE(fat.responsavel, 'Sem técnico')::TEXT,
    fat.responsavel_user_id,
    COUNT(*)::INT,
    ROUND(SUM(fat.valor_total), 2),
    ROUND(COALESCE(SUM(itens.mao), 0), 2),
    ROUND(COALESCE(SUM(itens.pecas), 0), 2),
    ROUND(COALESCE(SUM(itens.comissao), 0), 2),
    ROUND(SUM(fat.custo_tecnico), 2)
  FROM fat
  LEFT JOIN itens ON itens.os_id = fat.os_id
  GROUP BY 1, 2
  ORDER BY 4 DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.relatorio_tecnicos(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.relatorio_tecnicos(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

NOTIFY pgrst, 'reload schema';
