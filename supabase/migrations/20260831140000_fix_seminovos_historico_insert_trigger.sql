-- Bug found by actually creating a seminovo through the UI: exact same
-- mistake already fixed once in this codebase for os_historico (see
-- 20260811020000_fix_os_historico_insert_trigger.sql) —
-- seminovos_historico_on_insert ran as a BEFORE INSERT trigger and tried to
-- INSERT INTO seminovos_historico referencing NEW.id via a FK to
-- seminovos(id), but that row doesn't exist yet at BEFORE INSERT time (it's
-- only written once every BEFORE trigger returns), so every "Comprar
-- aparelho" failed with seminovos_historico_seminovo_id_fkey. Moves the
-- "Compra registrada" log to a new AFTER INSERT trigger, once the row
-- genuinely exists; the BEFORE INSERT trigger (which had no other work to
-- do) is dropped entirely.

DROP TRIGGER IF EXISTS seminovos_historico_on_insert ON public.seminovos;
DROP FUNCTION IF EXISTS public.seminovos_historico_on_insert();

CREATE OR REPLACE FUNCTION public.seminovos_historico_log_criacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  INSERT INTO seminovos_historico (user_id, seminovo_id, evento, descricao, created_by)
    VALUES (
      NEW.user_id, NEW.id, 'compra',
      'Compra registrada — ' || NEW.marca || ' ' || NEW.modelo ||
        CASE WHEN NEW.valor_pago IS NOT NULL THEN ' — R$ ' || NEW.valor_pago ELSE '' END,
      auth.uid()
    );
  RETURN NEW;
END;
$$;

CREATE TRIGGER seminovos_historico_log_criacao
  AFTER INSERT ON public.seminovos
  FOR EACH ROW EXECUTE FUNCTION public.seminovos_historico_log_criacao();
