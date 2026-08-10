-- Faturar OS: turns a completed/approved service order into real financial
-- revenue. Until now the "Faturar" button on the OS edit screen only
-- stamped ordens_servico.status='faturado' — no lancamento was ever
-- created, no installments existed anywhere in the app, and nothing
-- prevented invoicing the same OS twice. This adds the real ledger link:
-- an os_faturamentos header, one row per installment (each carrying its own
-- lancamento from creation, reusing lancamentos.status='pendente'/'pago' as
-- the existing "contas a receber" mechanism — no new receivables table), and
-- an optional value split across technicians. Commission/repasse is
-- intentionally out of scope: no such mechanism exists anywhere in the
-- system today, and inventing a percentage here would be a business rule
-- nobody asked for.
CREATE TABLE public.os_faturamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  os_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE RESTRICT,
  numero SERIAL,
  categoria_id UUID REFERENCES public.finance_categories(id) ON DELETE SET NULL,
  valor_total NUMERIC(12,2) NOT NULL CHECK (valor_total >= 0),
  status TEXT NOT NULL DEFAULT 'faturado' CHECK (status IN ('faturado', 'cancelado')),
  observacoes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelado_em TIMESTAMPTZ,
  cancelado_por UUID REFERENCES auth.users(id),
  motivo_cancelamento TEXT
);

-- One active invoice per OS at a time; cancelling frees it up to re-invoice.
CREATE UNIQUE INDEX os_faturamentos_os_id_ativo_uk
  ON public.os_faturamentos (os_id) WHERE status <> 'cancelado';
CREATE INDEX ON public.os_faturamentos (user_id);
CREATE INDEX ON public.os_faturamentos (categoria_id);

CREATE TABLE public.os_faturamento_parcelas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  faturamento_id UUID NOT NULL REFERENCES public.os_faturamentos(id) ON DELETE CASCADE,
  numero_parcela INT NOT NULL CHECK (numero_parcela > 0),
  total_parcelas INT NOT NULL CHECK (total_parcelas BETWEEN 1 AND 60),
  valor NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  vencimento DATE NOT NULL,
  forma_pagamento_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'recebido', 'cancelado')),
  data_recebimento DATE,
  lancamento_id UUID REFERENCES public.lancamentos(id) ON DELETE SET NULL,
  lancamento_estorno_id UUID REFERENCES public.lancamentos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (faturamento_id, numero_parcela)
);

CREATE INDEX ON public.os_faturamento_parcelas (user_id);
CREATE INDEX ON public.os_faturamento_parcelas (status, vencimento);
CREATE INDEX ON public.os_faturamento_parcelas (lancamento_id);

CREATE TABLE public.os_faturamento_tecnicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  faturamento_id UUID NOT NULL REFERENCES public.os_faturamentos(id) ON DELETE CASCADE,
  membro_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nome_livre TEXT,
  valor NUMERIC(12,2) NOT NULL CHECK (valor >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (membro_user_id IS NOT NULL OR nome_livre IS NOT NULL)
);

CREATE UNIQUE INDEX os_faturamento_tecnicos_membro_uk
  ON public.os_faturamento_tecnicos (faturamento_id, membro_user_id) WHERE membro_user_id IS NOT NULL;
CREATE INDEX ON public.os_faturamento_tecnicos (faturamento_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_faturamentos TO authenticated;
GRANT ALL ON public.os_faturamentos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_faturamento_parcelas TO authenticated;
GRANT ALL ON public.os_faturamento_parcelas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_faturamento_tecnicos TO authenticated;
GRANT ALL ON public.os_faturamento_tecnicos TO service_role;

-- RLS reuses the existing 'financeiro' permission module (this is
-- fundamentally a financial operation) — no new module registered in
-- role_permissions.modulo, matching what was agreed with the user.
ALTER TABLE public.os_faturamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "os_faturamentos ver" ON public.os_faturamentos FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'financeiro', 'ver'));
CREATE POLICY "os_faturamentos gerenciar" ON public.os_faturamentos FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'financeiro', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'financeiro', 'gerenciar'));

ALTER TABLE public.os_faturamento_parcelas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "os_faturamento_parcelas ver" ON public.os_faturamento_parcelas FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'financeiro', 'ver'));
CREATE POLICY "os_faturamento_parcelas gerenciar" ON public.os_faturamento_parcelas FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'financeiro', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'financeiro', 'gerenciar'));

ALTER TABLE public.os_faturamento_tecnicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "os_faturamento_tecnicos ver" ON public.os_faturamento_tecnicos FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'financeiro', 'ver'));
CREATE POLICY "os_faturamento_tecnicos gerenciar" ON public.os_faturamento_tecnicos FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'financeiro', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'financeiro', 'gerenciar'));

-- Shared by all three RPCs below: derives ordens_servico.status_pagamento
-- and valor_pago from the active invoice's installments, reusing the
-- pendente/parcial/pago values already used elsewhere in the OS screen.
-- Not exposed directly over PostgREST — only called from within the
-- permission-checked functions below (RLS on the UPDATE still applies,
-- since this runs SECURITY INVOKER, but skipping the explicit grant keeps
-- it out of the public RPC surface).
CREATE OR REPLACE FUNCTION public.recalcular_status_pagamento_os(p_os_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_faturamento_id UUID;
  v_recebidas INT;
  v_pendentes INT;
  v_pago NUMERIC;
BEGIN
  SELECT id INTO v_faturamento_id FROM os_faturamentos
    WHERE os_id = p_os_id AND status <> 'cancelado'
    ORDER BY created_at DESC LIMIT 1;

  IF v_faturamento_id IS NULL THEN
    UPDATE ordens_servico SET status_pagamento = 'pendente', valor_pago = 0 WHERE id = p_os_id;
    RETURN;
  END IF;

  SELECT count(*) FILTER (WHERE status = 'recebido'),
         count(*) FILTER (WHERE status = 'pendente'),
         COALESCE(SUM(valor) FILTER (WHERE status = 'recebido'), 0)
    INTO v_recebidas, v_pendentes, v_pago
    FROM os_faturamento_parcelas
    WHERE faturamento_id = v_faturamento_id;

  UPDATE ordens_servico SET
    valor_pago = v_pago,
    status_pagamento = CASE
      WHEN v_pendentes = 0 THEN 'pago'
      WHEN v_recebidas = 0 THEN 'pendente'
      ELSE 'parcial'
    END
  WHERE id = p_os_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.recalcular_status_pagamento_os(UUID) FROM PUBLIC;

-- Main entry point: creates the invoice header, one lancamento + installment
-- row per parcela (pendente for future ones, pago for anything received up
-- front), and the optional technician split — all inside a single Postgres
-- function, which is the one real multi-statement transaction the
-- PostgREST/Supabase client can get (a bare .rpc() call is one HTTP
-- request; any RAISE EXCEPTION rolls back everything already done in this
-- function body).
CREATE OR REPLACE FUNCTION public.faturar_os(
  p_os_id UUID,
  p_categoria_id UUID,
  p_valor_total NUMERIC,
  p_parcelas JSONB,
  p_tecnicos JSONB DEFAULT '[]'::jsonb,
  p_observacoes TEXT DEFAULT NULL
)
RETURNS public.os_faturamentos
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_os_numero INT;
  v_desconto NUMERIC;
  v_total_itens NUMERIC;
  v_valor_esperado NUMERIC;
  v_categoria_id UUID;
  v_categoria_nome TEXT;
  v_soma_parcelas NUMERIC;
  v_soma_tecnicos NUMERIC;
  v_faturamento public.os_faturamentos;
  v_parcela RECORD;
  v_tecnico RECORD;
  v_lancamento_id UUID;
  v_linhas INT;
BEGIN
  IF p_valor_total <= 0 THEN
    RAISE EXCEPTION 'O valor total da OS deve ser maior que zero para faturar.';
  END IF;
  IF p_parcelas IS NULL OR jsonb_array_length(p_parcelas) < 1 THEN
    RAISE EXCEPTION 'Informe ao menos uma parcela.';
  END IF;

  SELECT user_id, numero, desconto INTO v_empresa_id, v_os_numero, v_desconto
    FROM ordens_servico WHERE id = p_os_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OS não encontrada.';
  END IF;

  IF NOT public.has_permission(v_empresa_id, 'ordens', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar ordens de serviço.';
  END IF;
  IF NOT public.has_permission(v_empresa_id, 'financeiro', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar o financeiro.';
  END IF;

  IF EXISTS (SELECT 1 FROM os_faturamentos WHERE os_id = p_os_id AND status <> 'cancelado') THEN
    RAISE EXCEPTION 'Esta OS já possui um faturamento ativo. Cancele-o antes de faturar novamente.';
  END IF;

  SELECT COALESCE(SUM(quantidade * preco_unitario), 0) INTO v_total_itens
    FROM os_itens WHERE os_id = p_os_id;
  v_valor_esperado := GREATEST(v_total_itens - COALESCE(v_desconto, 0), 0);
  IF abs(v_valor_esperado - p_valor_total) > 0.01 THEN
    RAISE EXCEPTION 'O valor total não confere com os itens da OS (esperado %, recebido %). Recarregue a tela.',
      v_valor_esperado, p_valor_total;
  END IF;

  IF p_categoria_id IS NOT NULL THEN
    SELECT id, nome INTO v_categoria_id, v_categoria_nome
      FROM finance_categories WHERE id = p_categoria_id AND user_id = v_empresa_id AND tipo = 'entrada';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Categoria de receita inválida.';
    END IF;
  ELSE
    SELECT id, nome INTO v_categoria_id, v_categoria_nome
      FROM finance_categories WHERE user_id = v_empresa_id AND nome = 'Faturamento de OS' AND tipo = 'entrada';
    IF NOT FOUND THEN
      INSERT INTO finance_categories (user_id, nome, tipo) VALUES (v_empresa_id, 'Faturamento de OS', 'entrada')
        RETURNING id, nome INTO v_categoria_id, v_categoria_nome;
    END IF;
  END IF;

  SELECT COALESCE(SUM((x.valor)), 0) INTO v_soma_parcelas
    FROM jsonb_to_recordset(p_parcelas) AS x(valor numeric);
  IF abs(v_soma_parcelas - p_valor_total) > 0.01 THEN
    RAISE EXCEPTION 'A soma das parcelas (%) não bate com o valor total (%).', v_soma_parcelas, p_valor_total;
  END IF;

  IF p_tecnicos IS NOT NULL AND jsonb_array_length(p_tecnicos) > 0 THEN
    SELECT COALESCE(SUM((x.valor)), 0) INTO v_soma_tecnicos
      FROM jsonb_to_recordset(p_tecnicos) AS x(valor numeric);
    IF abs(v_soma_tecnicos - p_valor_total) > 0.01 THEN
      RAISE EXCEPTION 'O valor distribuído entre os técnicos (%) precisa corresponder ao valor da OS (%).',
        v_soma_tecnicos, p_valor_total;
    END IF;
  END IF;

  BEGIN
    INSERT INTO os_faturamentos (user_id, os_id, categoria_id, valor_total, observacoes, created_by)
      VALUES (v_empresa_id, p_os_id, v_categoria_id, p_valor_total, p_observacoes, auth.uid())
      RETURNING * INTO v_faturamento;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Esta OS já possui um faturamento ativo. Cancele-o antes de faturar novamente.';
  END;

  FOR v_parcela IN
    SELECT * FROM jsonb_to_recordset(p_parcelas) AS x(
      numero_parcela INT, valor NUMERIC, vencimento DATE,
      forma_pagamento_id UUID, recebido BOOLEAN, data_recebimento DATE
    )
  LOOP
    INSERT INTO lancamentos (user_id, tipo, categoria, descricao, valor, data, status, vencimento, payment_method_id)
      VALUES (
        v_empresa_id, 'entrada', v_categoria_nome,
        'OS #' || v_os_numero || ' — parcela ' || v_parcela.numero_parcela || '/' || jsonb_array_length(p_parcelas),
        v_parcela.valor,
        COALESCE(CASE WHEN v_parcela.recebido THEN v_parcela.data_recebimento ELSE NULL END, CURRENT_DATE),
        CASE WHEN v_parcela.recebido THEN 'pago' ELSE 'pendente' END,
        v_parcela.vencimento,
        v_parcela.forma_pagamento_id
      )
      RETURNING id INTO v_lancamento_id;

    INSERT INTO os_faturamento_parcelas (
      user_id, faturamento_id, numero_parcela, total_parcelas, valor, vencimento,
      forma_pagamento_id, status, data_recebimento, lancamento_id
    ) VALUES (
      v_empresa_id, v_faturamento.id, v_parcela.numero_parcela, jsonb_array_length(p_parcelas),
      v_parcela.valor, v_parcela.vencimento, v_parcela.forma_pagamento_id,
      CASE WHEN v_parcela.recebido THEN 'recebido' ELSE 'pendente' END,
      CASE WHEN v_parcela.recebido THEN COALESCE(v_parcela.data_recebimento, CURRENT_DATE) ELSE NULL END,
      v_lancamento_id
    );
  END LOOP;

  IF p_tecnicos IS NOT NULL THEN
    FOR v_tecnico IN
      SELECT * FROM jsonb_to_recordset(p_tecnicos) AS x(membro_user_id UUID, nome_livre TEXT, valor NUMERIC)
    LOOP
      INSERT INTO os_faturamento_tecnicos (user_id, faturamento_id, membro_user_id, nome_livre, valor)
        VALUES (v_empresa_id, v_faturamento.id, v_tecnico.membro_user_id, v_tecnico.nome_livre, v_tecnico.valor);
    END LOOP;
  END IF;

  UPDATE ordens_servico SET status = 'faturado' WHERE id = p_os_id;
  GET DIAGNOSTICS v_linhas = ROW_COUNT;
  IF v_linhas = 0 THEN
    RAISE EXCEPTION 'Falha ao atualizar a OS (permissão insuficiente ou OS alterada por outra operação).';
  END IF;

  PERFORM public.recalcular_status_pagamento_os(p_os_id);

  RETURN v_faturamento;
END;
$$;
GRANT EXECUTE ON FUNCTION public.faturar_os(UUID, UUID, NUMERIC, JSONB, JSONB, TEXT) TO authenticated;

-- Marks one pending installment as received: flips its own row, flips the
-- linked lancamento to 'pago' (never inserts a second one), and recomputes
-- the OS payment status.
CREATE OR REPLACE FUNCTION public.receber_parcela_faturamento(
  p_parcela_id UUID,
  p_data_recebimento DATE DEFAULT CURRENT_DATE,
  p_forma_pagamento_id UUID DEFAULT NULL
)
RETURNS public.os_faturamento_parcelas
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_parcela public.os_faturamento_parcelas%ROWTYPE;
  v_os_id UUID;
  v_empresa_id UUID;
BEGIN
  SELECT * INTO v_parcela FROM os_faturamento_parcelas WHERE id = p_parcela_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parcela não encontrada.';
  END IF;
  IF v_parcela.status <> 'pendente' THEN
    RAISE EXCEPTION 'Esta parcela não está pendente (status atual: %).', v_parcela.status;
  END IF;

  SELECT os_id INTO v_os_id FROM os_faturamentos WHERE id = v_parcela.faturamento_id;

  v_empresa_id := v_parcela.user_id;
  IF NOT public.has_permission(v_empresa_id, 'financeiro', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar o financeiro.';
  END IF;

  UPDATE lancamentos SET
    status = 'pago',
    data = p_data_recebimento,
    payment_method_id = COALESCE(p_forma_pagamento_id, payment_method_id)
  WHERE id = v_parcela.lancamento_id;

  UPDATE os_faturamento_parcelas SET
    status = 'recebido',
    data_recebimento = p_data_recebimento,
    forma_pagamento_id = COALESCE(p_forma_pagamento_id, forma_pagamento_id)
  WHERE id = p_parcela_id
  RETURNING * INTO v_parcela;

  PERFORM public.recalcular_status_pagamento_os(v_os_id);
  RETURN v_parcela;
END;
$$;
GRANT EXECUTE ON FUNCTION public.receber_parcela_faturamento(UUID, DATE, UUID) TO authenticated;

-- Cancels an invoice without ever deleting financial history. Installments
-- never billed yet are cancelled outright (their lancamento moves to
-- 'cancelado', same as any other lancamento cancellation in this app).
-- Installments already received keep their 'recebido' status — that money
-- really was received — and get a compensating 'saida' lancamento
-- (estorno) instead, so nothing is erased and the books stay auditable.
CREATE OR REPLACE FUNCTION public.cancelar_faturamento_os(
  p_faturamento_id UUID,
  p_motivo TEXT DEFAULT NULL
)
RETURNS public.os_faturamentos
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_fat public.os_faturamentos%ROWTYPE;
  v_parcela RECORD;
  v_categoria_estorno_id UUID;
  v_estorno_id UUID;
BEGIN
  SELECT * INTO v_fat FROM os_faturamentos WHERE id = p_faturamento_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Faturamento não encontrado.';
  END IF;
  IF v_fat.status = 'cancelado' THEN
    RAISE EXCEPTION 'Este faturamento já está cancelado.';
  END IF;

  IF NOT public.has_permission(v_fat.user_id, 'financeiro', 'gerenciar')
     OR NOT public.has_permission(v_fat.user_id, 'ordens', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para cancelar este faturamento.';
  END IF;

  SELECT id INTO v_categoria_estorno_id FROM finance_categories
    WHERE user_id = v_fat.user_id AND nome = 'Estorno de Faturamento' AND tipo = 'saida';
  IF NOT FOUND THEN
    INSERT INTO finance_categories (user_id, nome, tipo) VALUES (v_fat.user_id, 'Estorno de Faturamento', 'saida')
      RETURNING id INTO v_categoria_estorno_id;
  END IF;

  FOR v_parcela IN SELECT * FROM os_faturamento_parcelas WHERE faturamento_id = p_faturamento_id LOOP
    IF v_parcela.status = 'pendente' THEN
      UPDATE lancamentos SET status = 'cancelado' WHERE id = v_parcela.lancamento_id;
      UPDATE os_faturamento_parcelas SET status = 'cancelado' WHERE id = v_parcela.id;
    ELSIF v_parcela.status = 'recebido' THEN
      INSERT INTO lancamentos (user_id, tipo, categoria, descricao, valor, data, status)
        VALUES (
          v_fat.user_id, 'saida', 'Estorno de Faturamento',
          'Estorno — faturamento #' || v_fat.numero || ', parcela ' || v_parcela.numero_parcela,
          v_parcela.valor, CURRENT_DATE, 'pago'
        )
        RETURNING id INTO v_estorno_id;
      UPDATE os_faturamento_parcelas SET lancamento_estorno_id = v_estorno_id WHERE id = v_parcela.id;
    END IF;
  END LOOP;

  UPDATE os_faturamentos SET
    status = 'cancelado',
    cancelado_em = now(),
    cancelado_por = auth.uid(),
    motivo_cancelamento = p_motivo
  WHERE id = p_faturamento_id
  RETURNING * INTO v_fat;

  PERFORM public.recalcular_status_pagamento_os(v_fat.os_id);
  RETURN v_fat;
END;
$$;
GRANT EXECUTE ON FUNCTION public.cancelar_faturamento_os(UUID, TEXT) TO authenticated;
