-- CPF + assinatura digital do vendedor no momento da compra (pedido do
-- usuário) — reaproveita a tabela `clientes` existente quando a pessoa já
-- está cadastrada (campo `documento`, sem coluna dedicada nova lá) e o
-- bucket `seminovos-fotos` já criado para as fotos do aparelho (mesma
-- convenção de path `${empresaId}/${seminovoId}/...`), sem bucket novo.
--
-- CPF fica opcional no banco (não pode virar NOT NULL sem quebrar o
-- registro real já existente antes desta migration) — a obrigatoriedade no
-- momento da compra é aplicada no formulário; o banco só garante que,
-- quando presente, o valor é um CPF matematicamente válido (dígitos
-- verificadores), nunca uma sequência de números aleatórios.

CREATE OR REPLACE FUNCTION public.validar_cpf(p_cpf text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_digits text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_soma integer;
  v_resto integer;
  i integer;
BEGIN
  IF length(v_digits) <> 11 THEN
    RETURN false;
  END IF;
  -- Sequências como 111.111.111-11 passam no cálculo do dígito verificador
  -- mas nunca são CPFs reais emitidos — a Receita Federal também as rejeita.
  IF v_digits ~ '^(\d)\1{10}$' THEN
    RETURN false;
  END IF;

  v_soma := 0;
  FOR i IN 0..8 LOOP
    v_soma := v_soma + (substring(v_digits FROM i + 1 FOR 1)::integer) * (10 - i);
  END LOOP;
  v_resto := (v_soma * 10) % 11;
  IF v_resto >= 10 THEN v_resto := 0; END IF;
  IF v_resto <> (substring(v_digits FROM 10 FOR 1)::integer) THEN
    RETURN false;
  END IF;

  v_soma := 0;
  FOR i IN 0..9 LOOP
    v_soma := v_soma + (substring(v_digits FROM i + 1 FOR 1)::integer) * (11 - i);
  END LOOP;
  v_resto := (v_soma * 10) % 11;
  IF v_resto >= 10 THEN v_resto := 0; END IF;
  IF v_resto <> (substring(v_digits FROM 11 FOR 1)::integer) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

ALTER TABLE public.seminovos
  ADD COLUMN IF NOT EXISTS vendedor_documento TEXT,
  ADD COLUMN IF NOT EXISTS assinatura_url TEXT,
  ADD COLUMN IF NOT EXISTS assinatura_coletada_em TIMESTAMPTZ;

ALTER TABLE public.seminovos
  ADD CONSTRAINT seminovos_vendedor_documento_check
    CHECK (vendedor_documento IS NULL OR public.validar_cpf(vendedor_documento));

-- "Compra registrada" (trigger de criação, ver 20260831140000_...sql) passa
-- a citar vendedor + CPF mascarado, como no exemplo da seção 9 do pedido —
-- o CPF completo nunca vai para uma linha de histórico.
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
        CASE WHEN NEW.vendedor_nome IS NOT NULL THEN ' — vendedor: ' || NEW.vendedor_nome ELSE '' END ||
        CASE WHEN NEW.vendedor_documento IS NOT NULL
          THEN ' — CPF: ***.***.***-' || right(regexp_replace(NEW.vendedor_documento, '\D', '', 'g'), 2)
          ELSE '' END ||
        CASE WHEN NEW.valor_pago IS NOT NULL THEN ' — R$ ' || NEW.valor_pago ELSE '' END,
      auth.uid()
    );
  RETURN NEW;
END;
$$;

-- Acrescenta os eventos de assinatura coletada/substituída ao trigger de
-- atualização (mesma função de 20260901090000_...sql, só com os dois IFs
-- novos no fim — o resto é idêntico).
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

  IF NEW.assinatura_url IS NOT NULL AND OLD.assinatura_url IS NULL THEN
    INSERT INTO seminovos_historico (user_id, seminovo_id, evento, descricao, created_by)
      VALUES (NEW.user_id, NEW.id, 'assinatura',
        'Assinatura coletada — ' || to_char(now(), 'DD/MM/YYYY HH24:MI'), auth.uid());
  ELSIF NEW.assinatura_url IS NOT NULL AND OLD.assinatura_url IS NOT NULL
    AND NEW.assinatura_url IS DISTINCT FROM OLD.assinatura_url THEN
    INSERT INTO seminovos_historico (user_id, seminovo_id, evento, descricao, created_by)
      VALUES (NEW.user_id, NEW.id, 'assinatura',
        'Assinatura substituída — ' || to_char(now(), 'DD/MM/YYYY HH24:MI'), auth.uid());
  END IF;

  RETURN NEW;
END;
$$;
