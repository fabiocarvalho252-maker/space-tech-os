-- Bug found by actually excluding an aparelho that had itens de conserto:
-- deleting a `seminovos` row cascades (ON DELETE CASCADE) into
-- seminovos_conserto_itens, and that cascade fires
-- seminovos_conserto_itens_after_change() per item exactly like a normal
-- DELETE — but by the time it runs, the parent `seminovos` row is already
-- gone (Postgres removes the row before processing its own cascades), so
-- both the recompute UPDATE and the seminovos_historico INSERT the
-- function does target a seminovo_id that no longer exists — the INSERT
-- fails on seminovos_historico_seminovo_id_fkey and the whole delete
-- (including the seminovos row itself) rolls back.
--
-- Fix: bail out early when the parent row is gone — none of that
-- bookkeeping matters for a seminovo being deleted anyway (its own history
-- rows cascade-delete right along with it).

CREATE OR REPLACE FUNCTION public.seminovos_conserto_itens_after_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_seminovo_id UUID := COALESCE(NEW.seminovo_id, OLD.seminovo_id);
  v_user_id UUID := COALESCE(NEW.user_id, OLD.user_id);
  v_legado NUMERIC;
  v_qtd INTEGER;
  v_label TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM seminovos WHERE id = v_seminovo_id) THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT count(*) INTO v_qtd FROM seminovos_conserto_itens WHERE seminovo_id = v_seminovo_id;
    IF v_qtd = 1 THEN
      SELECT valor_conserto INTO v_legado FROM seminovos WHERE id = v_seminovo_id;
      IF v_legado IS NOT NULL AND v_legado > 0 THEN
        INSERT INTO seminovos_conserto_itens (user_id, seminovo_id, categoria, descricao, valor)
          VALUES (v_user_id, v_seminovo_id, 'outros', 'Valor de conserto (registro anterior)', v_legado);
      END IF;
    END IF;
  END IF;

  UPDATE seminovos SET valor_conserto = (
    SELECT COALESCE(SUM(valor), 0) FROM seminovos_conserto_itens WHERE seminovo_id = v_seminovo_id
  ) WHERE id = v_seminovo_id;

  v_label := CASE COALESCE(NEW.categoria, OLD.categoria)
    WHEN 'tela' THEN 'Tela'
    WHEN 'bateria' THEN 'Bateria'
    WHEN 'tampa' THEN 'Tampa traseira'
    WHEN 'conector' THEN 'Conector de carga'
    WHEN 'camera' THEN 'Câmera'
    WHEN 'botao_flex' THEN 'Botões/Flex'
    WHEN 'carcaca_aro' THEN 'Carcaça/Aro'
    WHEN 'alto_falante' THEN 'Alto-falante/Auricular'
    WHEN 'mao_de_obra' THEN 'Mão de obra'
    WHEN 'kit' THEN 'Kit'
    ELSE 'Outros'
  END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO seminovos_historico (user_id, seminovo_id, evento, descricao, created_by)
      VALUES (v_user_id, v_seminovo_id, 'conserto_item',
        'Custo de conserto adicionado — ' || v_label ||
          COALESCE(': ' || NULLIF(NEW.descricao, ''), '') || ' — R$ ' || NEW.valor,
        auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO seminovos_historico (user_id, seminovo_id, evento, descricao, created_by)
      VALUES (v_user_id, v_seminovo_id, 'conserto_item',
        'Custo de conserto alterado — ' || v_label || ': de R$ ' || OLD.valor || ' para R$ ' || NEW.valor,
        auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO seminovos_historico (user_id, seminovo_id, evento, descricao, created_by)
      VALUES (v_user_id, v_seminovo_id, 'conserto_item',
        'Custo de conserto removido — ' || v_label || ' — R$ ' || OLD.valor,
        auth.uid());
  END IF;

  RETURN NULL;
END;
$$;
