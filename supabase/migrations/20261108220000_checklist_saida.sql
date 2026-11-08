-- Checklist de saída: os mesmos testes da entrada, refeitos na entrega
-- (protege a loja em reclamação). Fica na OS, no PDF e na Área do Cliente.
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS checklist_saida jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS checklist_saida_em timestamptz;

-- Área do Cliente: detalhes_os_publica() passa a devolver também o
-- checklist de saída (o resto da função não mudou).
CREATE OR REPLACE FUNCTION public.detalhes_os_publica(p_identificador text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_os public.ordens_servico%ROWTYPE;
  v_mascara CONSTANT text := '•••• ';
BEGIN
  IF p_identificador !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_os FROM public.ordens_servico WHERE id = p_identificador::uuid;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'cor', v_os.cor,
    'imei', CASE WHEN length(coalesce(v_os.imei, '')) > 4
                 THEN v_mascara || right(v_os.imei, 4) ELSE nullif(v_os.imei, '') END,
    'serie', CASE WHEN length(coalesce(v_os.serial_number, '')) > 4
                  THEN v_mascara || right(v_os.serial_number, 4) ELSE nullif(v_os.serial_number, '') END,
    'acessorios', nullif(v_os.acessorios, ''),
    'checklist_entrada', coalesce(v_os.checklist_entrada, '{}'::jsonb),
    'checklist_saida', CASE WHEN v_os.checklist_saida_em IS NOT NULL THEN v_os.checklist_saida ELSE '{}'::jsonb END,
    'checklist_saida_em', v_os.checklist_saida_em,
    'estado_fisico', coalesce(v_os.estado_fisico, '{}'::jsonb),
    'estado_fisico_obs', nullif(v_os.estado_fisico_obs, ''),
    'laudo_tecnico', nullif(v_os.laudo_tecnico, ''),
    'previsao', v_os.previsao,
    'data_entrega', v_os.data_entrega,
    'garantia_dias', v_os.garantia_dias,
    'garantia_vencimento', v_os.garantia_vencimento,
    'historico', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'data', h.created_at,
               'evento', h.evento,
               -- status: só o novo status ("... para "em_reparo"") — o
               -- texto vira rótulo amigável na página.
               'status', CASE WHEN h.evento = 'status'
                              THEN substring(h.descricao from 'para "([^"]+)"') END,
               'descricao', CASE WHEN h.evento = 'aprovacao_cliente' THEN h.descricao END
             ) ORDER BY h.created_at)
        FROM public.os_historico h
       WHERE h.os_id = v_os.id
         AND h.evento IN ('criacao', 'status', 'aprovacao_cliente')
    ), '[]'::jsonb),
    'desconto', coalesce(v_os.desconto, 0),
    'valor_pago', coalesce(v_os.valor_pago, 0),
    'status_pagamento', v_os.status_pagamento,
    'pagamentos', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'parcela', p.numero_parcela,
               'total_parcelas', p.total_parcelas,
               'valor', p.valor,
               'forma', pm.nome,
               'status', p.status,
               'vencimento', p.vencimento,
               'recebido_em', p.data_recebimento
             ) ORDER BY f.created_at, p.numero_parcela)
        FROM public.os_faturamentos f
        JOIN public.os_faturamento_parcelas p ON p.faturamento_id = f.id
        LEFT JOIN public.payment_methods pm ON pm.id = p.forma_pagamento_id
       WHERE f.os_id = v_os.id
         AND f.status <> 'cancelado'
    ), '[]'::jsonb),
    'termos', coalesce(
      (SELECT nullif(c.termos_condicoes, '') FROM public.os_config c WHERE c.user_id = v_os.user_id),
      (SELECT t.conteudo FROM public.termos_garantia t
        WHERE t.user_id = v_os.user_id AND t.is_default AND t.ativo LIMIT 1)
    ),
    'qtd_fotos', (
      SELECT count(*) FROM public.service_order_photos f
       WHERE f.service_order_id = v_os.id
         AND coalesce(f.category, '') NOT IN ('assinatura_cliente', 'assinatura_tecnico')
    )
  );
END;
$function$

;
