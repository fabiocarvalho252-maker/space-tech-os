-- Garantia da OS: data_entrega só era gravada quando a OS virava "entregue",
-- mas a maioria das OS vai direto para "faturado" — ficavam sem data de
-- entrega e, portanto, sem garantia_vencimento ("—" na lista). Agora
-- "faturado" também marca a entrega, e garantia_dias nulo cai no padrão da
-- empresa (os_config) também no UPDATE, não só no INSERT.
CREATE OR REPLACE FUNCTION public.os_historico_on_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IN ('entregue', 'faturado') AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.data_entrega IS NULL THEN
    NEW.data_entrega := now();
  END IF;

  IF NEW.garantia_dias IS NULL AND NEW.data_entrega IS NOT NULL THEN
    SELECT dias_garantia_padrao INTO NEW.garantia_dias
      FROM os_config WHERE user_id = NEW.user_id;
  END IF;

  IF NEW.data_entrega IS NOT NULL AND NEW.garantia_dias IS NOT NULL THEN
    NEW.garantia_vencimento := NEW.data_entrega::date + NEW.garantia_dias;
  ELSE
    NEW.garantia_vencimento := NULL;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO os_historico (user_id, os_id, evento, descricao, created_by)
      VALUES (NEW.user_id, NEW.id, 'status',
        'Status alterado de "' || OLD.status || '" para "' || NEW.status || '"', auth.uid());
  END IF;

  IF NEW.valor IS DISTINCT FROM OLD.valor THEN
    INSERT INTO os_historico (user_id, os_id, evento, descricao, created_by)
      VALUES (NEW.user_id, NEW.id, 'valor',
        'Valor da OS alterado de ' || OLD.valor || ' para ' || NEW.valor, auth.uid());
  END IF;

  IF NEW.status_pagamento IS DISTINCT FROM OLD.status_pagamento THEN
    INSERT INTO os_historico (user_id, os_id, evento, descricao, created_by)
      VALUES (NEW.user_id, NEW.id, 'pagamento',
        'Situação de pagamento alterada para "' || NEW.status_pagamento || '"', auth.uid());
  END IF;

  RETURN NEW;
END;
$function$;

-- OS já faturadas/entregues sem data de entrega: usa a data do faturamento
-- ativo (ou, sem faturamento, a última alteração da OS). Os triggers ficam
-- desligados só nesta transação para não gerar histórico nem mexer em
-- updated_at — por isso o vencimento é calculado aqui mesmo.
BEGIN;
SET LOCAL session_replication_role = replica;

UPDATE public.ordens_servico o
   SET data_entrega = COALESCE(
         (SELECT min(f.created_at) FROM public.os_faturamentos f
           WHERE f.os_id = o.id AND f.status <> 'cancelado'),
         o.updated_at)
 WHERE o.status IN ('faturado', 'entregue')
   AND o.data_entrega IS NULL;

UPDATE public.ordens_servico o
   SET garantia_dias = COALESCE(
         (SELECT c.dias_garantia_padrao FROM public.os_config c WHERE c.user_id = o.user_id), 90)
 WHERE o.status IN ('faturado', 'entregue')
   AND o.garantia_dias IS NULL;

UPDATE public.ordens_servico
   SET garantia_vencimento = data_entrega::date + garantia_dias
 WHERE data_entrega IS NOT NULL
   AND garantia_dias IS NOT NULL
   AND garantia_vencimento IS DISTINCT FROM data_entrega::date + garantia_dias;
COMMIT;

NOTIFY pgrst, 'reload schema';
