-- Importação de dados de outro sistema (tela /importar, src/lib/importacao/).
-- A empresa envia uma planilha (Excel/CSV) de clientes, fornecedores,
-- produtos ou serviços; cada linha gravada leva o importacao_id para que a
-- importação possa ser desfeita depois.
CREATE TABLE IF NOT EXISTS public.importacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('clientes', 'fornecedores', 'produtos', 'servicos')),
  arquivo TEXT,
  inseridos INTEGER NOT NULL DEFAULT 0,
  pulados INTEGER NOT NULL DEFAULT 0,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  desfeita_em TIMESTAMPTZ,
  desfeita_mantidos INTEGER
);
CREATE INDEX IF NOT EXISTS importacoes_user_id_idx ON public.importacoes (user_id, created_at DESC);

-- Só o servidor grava (src/lib/importacao/importacao.functions.ts confere a
-- permissão do módulo antes); quem tem acesso às configurações vê o histórico.
ALTER TABLE public.importacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "importacoes ver" ON public.importacoes;
CREATE POLICY "importacoes ver" ON public.importacoes FOR SELECT TO authenticated
  USING (has_permission(user_id, 'configuracoes', 'ver'));

ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS importacao_id UUID
  REFERENCES public.importacoes(id) ON DELETE SET NULL;
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS importacao_id UUID
  REFERENCES public.importacoes(id) ON DELETE SET NULL;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS importacao_id UUID
  REFERENCES public.importacoes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS clientes_importacao_id_idx ON public.clientes (importacao_id) WHERE importacao_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS fornecedores_importacao_id_idx ON public.fornecedores (importacao_id) WHERE importacao_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS produtos_importacao_id_idx ON public.produtos (importacao_id) WHERE importacao_id IS NOT NULL;

-- Desfaz uma importação: apaga só os registros que ainda não foram usados.
-- Cliente que já tem OS, venda, agendamento etc. fica — apagar levaria o
-- vínculo embora (as FKs são ON DELETE SET NULL). Produto já vendido,
-- comprado, usado em OS ou com estoque mexido depois da importação também
-- fica. Devolve quantos foram apagados e quantos ficaram.
CREATE OR REPLACE FUNCTION public.desfazer_importacao(p_importacao UUID)
RETURNS TABLE (apagados INTEGER, mantidos INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_imp public.importacoes%ROWTYPE;
  v_modulo TEXT;
  v_apagados INTEGER := 0;
  v_total INTEGER := 0;
BEGIN
  SELECT * INTO v_imp FROM public.importacoes WHERE id = p_importacao;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Importação não encontrada.';
  END IF;
  IF v_imp.desfeita_em IS NOT NULL THEN
    RAISE EXCEPTION 'Esta importação já foi desfeita.';
  END IF;
  v_modulo := CASE v_imp.tipo WHEN 'servicos' THEN 'produtos' ELSE v_imp.tipo END;
  IF NOT has_permission(v_imp.user_id, v_modulo, 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para desfazer esta importação.';
  END IF;

  IF v_imp.tipo = 'clientes' THEN
    SELECT count(*) INTO v_total FROM clientes WHERE importacao_id = p_importacao;
    WITH apagados AS (
      DELETE FROM clientes c
      WHERE c.importacao_id = p_importacao
        AND c.auth_user_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM ordens_servico x WHERE x.cliente_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM vendas x WHERE x.cliente_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM agendamentos x WHERE x.cliente_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM seminovos x WHERE x.cliente_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM notas_fiscais x WHERE x.cliente_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM aparelhos x WHERE x.reservado_cliente_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM aparelho_garantias x WHERE x.cliente_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM compras_aparelhos x WHERE x.cliente_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM cobrancas x WHERE x.cliente_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM crediario_contratos x WHERE x.cliente_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM devices x WHERE x.customer_id = c.id)
      RETURNING 1
    )
    SELECT count(*) INTO v_apagados FROM apagados;
  ELSIF v_imp.tipo = 'fornecedores' THEN
    SELECT count(*) INTO v_total FROM fornecedores WHERE importacao_id = p_importacao;
    WITH apagados AS (
      DELETE FROM fornecedores f
      WHERE f.importacao_id = p_importacao
        AND NOT EXISTS (SELECT 1 FROM compras x WHERE x.fornecedor_id = f.id)
        AND NOT EXISTS (SELECT 1 FROM produtos x WHERE x.fornecedor_id = f.id
                        AND x.importacao_id IS DISTINCT FROM p_importacao)
      RETURNING 1
    )
    SELECT count(*) INTO v_apagados FROM apagados;
  ELSE
    SELECT count(*) INTO v_total FROM produtos WHERE importacao_id = p_importacao;
    WITH apagados AS (
      DELETE FROM produtos p
      WHERE p.importacao_id = p_importacao
        AND NOT EXISTS (SELECT 1 FROM venda_itens x WHERE x.produto_id = p.id)
        AND NOT EXISTS (SELECT 1 FROM compra_itens x WHERE x.produto_id = p.id)
        AND NOT EXISTS (SELECT 1 FROM os_itens x WHERE x.produto_id = p.id)
        -- a entrada inicial da importação é a única movimentação permitida
        AND (SELECT count(*) FROM estoque_movimentacoes x WHERE x.produto_id = p.id) <= 1
      RETURNING 1
    )
    SELECT count(*) INTO v_apagados FROM apagados;
  END IF;

  UPDATE public.importacoes
     SET desfeita_em = now(), desfeita_mantidos = v_total - v_apagados
   WHERE id = p_importacao;

  RETURN QUERY SELECT v_apagados, v_total - v_apagados;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.desfazer_importacao(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.desfazer_importacao(UUID) TO authenticated;
