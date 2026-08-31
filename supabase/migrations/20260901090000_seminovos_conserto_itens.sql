-- Detalhamento do custo de conserto (pedido do usuário, aprimoramento da
-- Compra de Seminovos): até aqui `seminovos.valor_conserto` era um único
-- número editado à mão (via RegistrarConsertoDialog, que fica retirado
-- nesta mudança). Agora ele passa a ser SOMA dos itens detalhados abaixo,
-- recalculada automaticamente por trigger — nada muda nas colunas
-- GENERATED existentes (valor_total_gasto/lucro_minimo/lucro_previsto), que
-- já dependem de valor_conserto e continuam corretas sem alteração.
--
-- Compatibilidade com dados existentes (pedido, seção 16): um aparelho que
-- já tinha valor_conserto > 0 sem nenhum item detalhado teria esse valor
-- silenciosamente zerado assim que o primeiro item fosse cadastrado (a soma
-- passaria a contar só os itens novos). Para não perder esse valor, a
-- trigger abaixo, ao ver o primeiro item de um aparelho, semeia um item
-- "Outros — Valor de conserto (registro anterior)" com o valor legado antes
-- de recalcular — o valor antigo continua contando para o total, agora como
-- uma linha detalhada normal (editável/removível como qualquer outra).

CREATE TABLE public.seminovos_conserto_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seminovo_id UUID NOT NULL REFERENCES public.seminovos(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL CHECK (categoria IN (
    'tela', 'bateria', 'tampa', 'conector', 'camera', 'botao_flex',
    'carcaca_aro', 'alto_falante', 'mao_de_obra', 'kit', 'outros'
  )),
  descricao TEXT,
  fornecedor TEXT,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (valor >= 0),
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON public.seminovos_conserto_itens (seminovo_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seminovos_conserto_itens TO authenticated;
GRANT ALL ON public.seminovos_conserto_itens TO service_role;
ALTER TABLE public.seminovos_conserto_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seminovos_conserto_itens ver" ON public.seminovos_conserto_itens FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'seminovos', 'ver'));
CREATE POLICY "seminovos_conserto_itens gerenciar" ON public.seminovos_conserto_itens FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'seminovos', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'seminovos', 'gerenciar'));

CREATE TRIGGER seminovos_conserto_itens_updated BEFORE UPDATE ON public.seminovos_conserto_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- A somatória dos itens (com a semeadura do valor legado, se for o caso) e
-- o log de histórico por item vivem na mesma função — os dois precisam
-- acontecer atomicamente a cada INSERT/UPDATE/DELETE de um item.
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

CREATE TRIGGER seminovos_conserto_itens_after_change
  AFTER INSERT OR UPDATE OR DELETE ON public.seminovos_conserto_itens
  FOR EACH ROW EXECUTE FUNCTION public.seminovos_conserto_itens_after_change();

-- O log genérico de "valor_conserto alterado" em seminovos_historico_on_update
-- fica redundante (e ficaria duplicado) agora que cada item loga sua própria
-- mudança acima — a UPDATE que a trigger de recálculo faz em `seminovos`
-- passaria a gerar uma segunda entrada genérica para a mesma ação. Reemite a
-- função sem esse branch; os demais (status/preco_venda/preco_lojista/
-- venda/devolução) continuam exatamente iguais.
CREATE OR REPLACE FUNCTION public.seminovos_historico_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO seminovos_historico (user_id, seminovo_id, evento, descricao, created_by)
      VALUES (NEW.user_id, NEW.id, 'status',
        'Status alterado de "' || OLD.status || '" para "' || NEW.status || '"', auth.uid());
  END IF;

  IF NEW.preco_venda IS DISTINCT FROM OLD.preco_venda THEN
    INSERT INTO seminovos_historico (user_id, seminovo_id, evento, descricao, created_by)
      VALUES (NEW.user_id, NEW.id, 'preco',
        'Preço para cliente alterado de ' || COALESCE('R$ ' || OLD.preco_venda, '—') ||
          ' para ' || COALESCE('R$ ' || NEW.preco_venda, '—'),
        auth.uid());
  END IF;

  IF NEW.preco_lojista IS DISTINCT FROM OLD.preco_lojista THEN
    INSERT INTO seminovos_historico (user_id, seminovo_id, evento, descricao, created_by)
      VALUES (NEW.user_id, NEW.id, 'preco_lojista',
        'Preço para lojista alterado de ' || COALESCE('R$ ' || OLD.preco_lojista, '—') ||
          ' para ' || COALESCE('R$ ' || NEW.preco_lojista, '—'),
        auth.uid());
  END IF;

  IF NEW.status = 'vendido' AND OLD.status IS DISTINCT FROM 'vendido' THEN
    INSERT INTO seminovos_historico (user_id, seminovo_id, evento, descricao, created_by)
      VALUES (NEW.user_id, NEW.id, 'venda',
        'Aparelho vendido' || CASE WHEN NEW.preco_venda IS NOT NULL THEN ' — R$ ' || NEW.preco_venda ELSE '' END,
        auth.uid());
  END IF;

  IF NEW.status = 'devolvido' AND OLD.status IS DISTINCT FROM 'devolvido' THEN
    INSERT INTO seminovos_historico (user_id, seminovo_id, evento, descricao, created_by)
      VALUES (NEW.user_id, NEW.id, 'devolucao',
        'Aparelho devolvido' || CASE WHEN NEW.devolucao_motivo IS NOT NULL THEN ' — ' || NEW.devolucao_motivo ELSE '' END,
        auth.uid());
  END IF;

  RETURN NEW;
END;
$$;
