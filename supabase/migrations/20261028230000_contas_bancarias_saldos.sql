-- Contas bancárias de verdade: conta padrão, conta de cada forma de
-- pagamento e lançamento novo caindo sozinho na conta certa; saldos por
-- conta para a tela Contas Bancárias. Tudo aditivo.

ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS padrao BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS bank_accounts_um_padrao_por_empresa
  ON public.bank_accounts (user_id) WHERE padrao;

ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS lancamentos_user_conta_idx
  ON public.lancamentos (user_id, bank_account_id);

-- Lançamento sem conta: usa a conta da forma de pagamento (pela forma
-- informada no lançamento ou, se veio de uma venda, pela forma da venda);
-- senão a conta padrão da empresa. Só olha dados da própria empresa.
CREATE OR REPLACE FUNCTION public.lancamentos_definir_conta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_forma TEXT;
  v_padrao TEXT;
BEGIN
  IF NEW.bank_account_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.payment_method_id IS NOT NULL THEN
    SELECT pm.bank_account_id INTO NEW.bank_account_id
      FROM payment_methods pm
     WHERE pm.id = NEW.payment_method_id AND pm.user_id = NEW.user_id;
  END IF;

  IF NEW.bank_account_id IS NULL AND NEW.venda_id IS NOT NULL THEN
    SELECT lower(translate(v.forma_pagamento, 'áàâãéêíóôõúç', 'aaaaeeiooouc')) INTO v_forma
      FROM vendas v WHERE v.id = NEW.venda_id AND v.user_id = NEW.user_id;
    v_padrao := CASE
      WHEN v_forma LIKE '%pix%' THEN '%pix%'
      WHEN v_forma LIKE '%dinheiro%' THEN '%dinheiro%'
      WHEN v_forma LIKE '%credito%' THEN '%credito%'
      WHEN v_forma LIKE '%debito%' THEN '%debito%'
      WHEN v_forma LIKE '%boleto%' THEN '%boleto%'
      WHEN v_forma LIKE '%transf%' THEN '%transf%'
    END;
    IF v_padrao IS NOT NULL THEN
      SELECT pm.bank_account_id INTO NEW.bank_account_id
        FROM payment_methods pm
       WHERE pm.user_id = NEW.user_id
         AND pm.bank_account_id IS NOT NULL
         AND lower(translate(pm.nome, 'áàâãéêíóôõúçÁÉÍÓÚÇ', 'aaaaeeiooouceeiouc')) LIKE v_padrao
       ORDER BY pm.created_at
       LIMIT 1;
    END IF;
  END IF;

  IF NEW.bank_account_id IS NULL THEN
    SELECT b.id INTO NEW.bank_account_id
      FROM bank_accounts b WHERE b.user_id = NEW.user_id AND b.padrao;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.lancamentos_definir_conta() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS lancamentos_definir_conta ON public.lancamentos;
CREATE TRIGGER lancamentos_definir_conta
  BEFORE INSERT ON public.lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.lancamentos_definir_conta();

-- Saldos por conta (null = lançamentos sem conta). Só lançamentos pagos.
-- SECURITY INVOKER: o RLS de lançamentos/contas vale para quem chama.
CREATE OR REPLACE FUNCTION public.saldos_contas_bancarias(p_empresa UUID, p_inicio DATE, p_fim DATE)
RETURNS TABLE (
  bank_account_id UUID,
  movimento_total NUMERIC,
  entradas_periodo NUMERIC,
  saidas_periodo NUMERIC,
  qtd_periodo BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT
    l.bank_account_id,
    COALESCE(SUM(CASE WHEN l.tipo = 'entrada' THEN l.valor ELSE -l.valor END), 0),
    COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'entrada' AND l.data BETWEEN p_inicio AND p_fim), 0),
    COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'saida' AND l.data BETWEEN p_inicio AND p_fim), 0),
    COUNT(*) FILTER (WHERE l.data BETWEEN p_inicio AND p_fim)
  FROM lancamentos l
  WHERE l.user_id = p_empresa AND l.status = 'pago'
  GROUP BY l.bank_account_id
$$;
REVOKE ALL ON FUNCTION public.saldos_contas_bancarias(UUID, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saldos_contas_bancarias(UUID, DATE, DATE) TO authenticated;

NOTIFY pgrst, 'reload schema';
