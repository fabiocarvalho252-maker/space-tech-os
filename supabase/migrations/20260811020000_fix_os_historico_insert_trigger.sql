-- Bug found by actually creating an OS through the UI: os_historico_on_insert
-- ran as a BEFORE INSERT trigger and tried to INSERT INTO os_historico
-- referencing NEW.id via a FK to ordens_servico(id) — but the row doesn't
-- exist in ordens_servico yet at BEFORE INSERT time (it's only written once
-- every BEFORE trigger returns), so every single "Criar OS" failed with
-- os_historico_os_id_fkey. Splits the function in two: the BEFORE INSERT
-- half keeps only what has to run before the row is written (defaulting
-- garantia_dias/garantia_vencimento), and a new AFTER INSERT trigger logs
-- "OS criada" once the row genuinely exists.

CREATE OR REPLACE FUNCTION public.os_historico_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.garantia_dias IS NULL THEN
    SELECT dias_garantia_padrao INTO NEW.garantia_dias
      FROM os_config WHERE user_id = NEW.user_id;
  END IF;

  IF NEW.data_entrega IS NOT NULL AND NEW.garantia_dias IS NOT NULL THEN
    NEW.garantia_vencimento := NEW.data_entrega::date + NEW.garantia_dias;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.os_historico_log_criacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  INSERT INTO os_historico (user_id, os_id, evento, descricao, created_by)
    VALUES (NEW.user_id, NEW.id, 'criacao', 'OS criada', auth.uid());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS os_historico_log_criacao ON public.ordens_servico;
CREATE TRIGGER os_historico_log_criacao
  AFTER INSERT ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.os_historico_log_criacao();
