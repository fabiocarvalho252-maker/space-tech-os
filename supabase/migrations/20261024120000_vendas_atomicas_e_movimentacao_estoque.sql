-- Vendas numa única transação + histórico de movimentação de estoque.
--
-- Antes, PDV e Vendas gravavam a venda em 4 chamadas separadas do navegador
-- (venda, itens, baixa de estoque lida-e-regravada, lançamento): uma queda
-- no meio deixava venda sem baixa ou sem receita, duas vendas simultâneas do
-- mesmo produto podiam baixar o estoque errado, e quem tinha permissão de
-- vendas mas não de financeiro ficava com a venda pela metade. Agora
-- registrar_venda/cancelar_venda/excluir_venda fazem tudo ou nada no banco.
--
-- estoque_movimentacoes: toda mudança de produtos.quantidade (de qualquer
-- tela ou gatilho) vira uma linha, com saldo antes/depois. As funções abaixo
-- dizem o motivo via set_config('app.estoque_*'); sem isso fica "ajuste".

CREATE TABLE IF NOT EXISTS public.estoque_movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'entrada', 'saida', 'ajuste', 'venda', 'cancelamento_venda', 'exclusao_venda',
    'uso_os', 'devolucao_os', 'compra', 'cancelamento_compra'
  )),
  quantidade INTEGER NOT NULL,
  saldo_anterior INTEGER NOT NULL,
  saldo_posterior INTEGER NOT NULL,
  origem_id UUID,
  descricao TEXT,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS estoque_mov_produto_idx
  ON public.estoque_movimentacoes (produto_id, created_at DESC);
CREATE INDEX IF NOT EXISTS estoque_mov_empresa_idx
  ON public.estoque_movimentacoes (user_id, created_at DESC);

ALTER TABLE public.estoque_movimentacoes ENABLE ROW LEVEL SECURITY;

-- Só leitura pelo app: as linhas são escritas pelo gatilho abaixo.
DROP POLICY IF EXISTS "estoque_mov ver" ON public.estoque_movimentacoes;
CREATE POLICY "estoque_mov ver" ON public.estoque_movimentacoes
  FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'produtos', 'ver'));

CREATE OR REPLACE FUNCTION public.registrar_movimentacao_estoque()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_anterior INTEGER := CASE WHEN TG_OP = 'INSERT' THEN 0 ELSE COALESCE(OLD.quantidade, 0) END;
  v_posterior INTEGER := COALESCE(NEW.quantidade, 0);
  v_tipo TEXT := NULLIF(current_setting('app.estoque_tipo', true), '');
BEGIN
  -- Serviço fica na mesma tabela, mas não tem estoque de verdade.
  IF NEW.categoria = 'Serviço' OR v_posterior = v_anterior THEN
    RETURN NULL;
  END IF;

  INSERT INTO estoque_movimentacoes (
    user_id, produto_id, tipo, quantidade, saldo_anterior, saldo_posterior, origem_id, descricao
  ) VALUES (
    NEW.user_id, NEW.id,
    COALESCE(v_tipo, CASE WHEN TG_OP = 'INSERT' THEN 'entrada' ELSE 'ajuste' END),
    v_posterior - v_anterior, v_anterior, v_posterior,
    NULLIF(current_setting('app.estoque_origem_id', true), '')::uuid,
    NULLIF(current_setting('app.estoque_descricao', true), '')
  );
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_produtos_movimentacao ON public.produtos;
CREATE TRIGGER trg_produtos_movimentacao
  AFTER INSERT OR UPDATE OF quantidade ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.registrar_movimentacao_estoque();

-- Peça usada / removida da OS: mesmo comportamento de antes, agora com o
-- motivo e a OS de origem no histórico.
CREATE OR REPLACE FUNCTION public.handle_os_item_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF NEW.produto_id IS NOT NULL THEN
            PERFORM set_config('app.estoque_tipo', 'uso_os', true);
            PERFORM set_config('app.estoque_origem_id', NEW.os_id::text, true);
            PERFORM set_config('app.estoque_descricao',
              'Usado na OS #' || COALESCE((SELECT numero::text FROM ordens_servico WHERE id = NEW.os_id), '?'), true);
            UPDATE public.produtos
            SET quantidade = quantidade - NEW.quantidade
            WHERE id = NEW.produto_id;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.produto_id IS NOT NULL THEN
            PERFORM set_config('app.estoque_tipo', 'devolucao_os', true);
            PERFORM set_config('app.estoque_origem_id', OLD.os_id::text, true);
            PERFORM set_config('app.estoque_descricao',
              'Removido da OS #' || COALESCE((SELECT numero::text FROM ordens_servico WHERE id = OLD.os_id), '?'), true);
            UPDATE public.produtos
            SET quantidade = quantidade + OLD.quantidade
            WHERE id = OLD.produto_id;
        END IF;
    END IF;
    PERFORM set_config('app.estoque_tipo', '', true);
    PERFORM set_config('app.estoque_origem_id', '', true);
    PERFORM set_config('app.estoque_descricao', '', true);
    RETURN NULL;
END;
$function$;

-- p_itens: [{ produto_id, descricao, quantidade, preco_unitario }]
CREATE OR REPLACE FUNCTION public.registrar_venda(
  p_empresa_id UUID,
  p_itens JSONB,
  p_cliente_id UUID DEFAULT NULL,
  p_desconto NUMERIC DEFAULT 0,
  p_forma_pagamento TEXT DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL,
  p_categoria TEXT DEFAULT 'Venda',
  p_data DATE DEFAULT NULL,
  p_created_at TIMESTAMPTZ DEFAULT NULL
)
 RETURNS public.vendas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_venda public.vendas;
  v_item RECORD;
  v_produto RECORD;
  v_subtotal NUMERIC := 0;
  v_desconto NUMERIC := COALESCE(p_desconto, 0);
  v_total NUMERIC;
  v_numero_texto TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission(p_empresa_id, 'vendas', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para registrar vendas.';
  END IF;
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Adicione ao menos um item à venda.';
  END IF;
  IF p_cliente_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM clientes WHERE id = p_cliente_id AND user_id = p_empresa_id) THEN
    RAISE EXCEPTION 'Cliente não encontrado.';
  END IF;

  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_itens)
      AS x(produto_id UUID, descricao TEXT, quantidade INTEGER, preco_unitario NUMERIC)
  LOOP
    IF COALESCE(v_item.quantidade, 0) <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida para "%".', v_item.descricao;
    END IF;
    IF COALESCE(v_item.preco_unitario, 0) < 0 THEN
      RAISE EXCEPTION 'Preço inválido para "%".', v_item.descricao;
    END IF;
    IF v_item.produto_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM produtos WHERE id = v_item.produto_id AND user_id = p_empresa_id) THEN
      RAISE EXCEPTION 'Produto "%" não encontrado.', v_item.descricao;
    END IF;
    v_subtotal := v_subtotal + v_item.quantidade * v_item.preco_unitario;
  END LOOP;

  IF v_desconto < 0 OR v_desconto > v_subtotal THEN
    RAISE EXCEPTION 'O desconto não pode ser maior que o subtotal.';
  END IF;
  v_total := v_subtotal - v_desconto;

  INSERT INTO vendas (user_id, cliente_id, total, desconto, forma_pagamento, observacoes, created_at)
    VALUES (p_empresa_id, p_cliente_id, v_total, v_desconto, p_forma_pagamento,
            NULLIF(trim(p_observacoes), ''), COALESCE(p_created_at, now()))
    RETURNING * INTO v_venda;
  v_numero_texto := lpad(COALESCE(v_venda.numero::text, left(v_venda.id::text, 8)), 4, '0');

  INSERT INTO venda_itens (user_id, venda_id, produto_id, descricao, quantidade, preco_unitario)
    SELECT p_empresa_id, v_venda.id, x.produto_id, x.descricao, x.quantidade, x.preco_unitario
      FROM jsonb_to_recordset(p_itens)
        AS x(produto_id UUID, descricao TEXT, quantidade INTEGER, preco_unitario NUMERIC);

  PERFORM set_config('app.estoque_tipo', 'venda', true);
  PERFORM set_config('app.estoque_origem_id', v_venda.id::text, true);
  PERFORM set_config('app.estoque_descricao', 'Venda #' || v_numero_texto, true);
  -- Soma por produto (o mesmo produto pode vir em duas linhas) e trava a
  -- linha: duas vendas ao mesmo tempo esperam uma pela outra. Mantém a regra
  -- de antes de nunca deixar o estoque negativo.
  FOR v_produto IN
    SELECT x.produto_id, sum(x.quantidade)::int AS qtd
      FROM jsonb_to_recordset(p_itens) AS x(produto_id UUID, quantidade INTEGER)
     WHERE x.produto_id IS NOT NULL
     GROUP BY x.produto_id
  LOOP
    UPDATE produtos
       SET quantidade = GREATEST(0, quantidade - v_produto.qtd)
     WHERE id = v_produto.produto_id
       AND categoria IS DISTINCT FROM 'Serviço';
  END LOOP;
  PERFORM set_config('app.estoque_tipo', '', true);
  PERFORM set_config('app.estoque_origem_id', '', true);
  PERFORM set_config('app.estoque_descricao', '', true);

  INSERT INTO lancamentos (user_id, tipo, categoria, descricao, valor, data, created_at, venda_id)
    VALUES (p_empresa_id, 'entrada', COALESCE(NULLIF(trim(p_categoria), ''), 'Venda'),
            'Venda #' || v_numero_texto, v_total,
            COALESCE(p_data, (now() AT TIME ZONE 'America/Sao_Paulo')::date),
            COALESCE(p_created_at, now()), v_venda.id);

  RETURN v_venda;
END;
$function$;

-- Devolve ao estoque os produtos de uma venda (não serviços, não aparelhos).
CREATE OR REPLACE FUNCTION public.devolver_estoque_venda(p_venda_id UUID, p_tipo TEXT, p_descricao TEXT)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_produto RECORD;
BEGIN
  PERFORM set_config('app.estoque_tipo', p_tipo, true);
  PERFORM set_config('app.estoque_origem_id', p_venda_id::text, true);
  PERFORM set_config('app.estoque_descricao', p_descricao, true);
  FOR v_produto IN
    SELECT produto_id, sum(quantidade)::int AS qtd
      FROM venda_itens
     WHERE venda_id = p_venda_id AND produto_id IS NOT NULL
     GROUP BY produto_id
  LOOP
    UPDATE produtos
       SET quantidade = quantidade + v_produto.qtd
     WHERE id = v_produto.produto_id
       AND categoria IS DISTINCT FROM 'Serviço';
  END LOOP;
  PERFORM set_config('app.estoque_tipo', '', true);
  PERFORM set_config('app.estoque_origem_id', '', true);
  PERFORM set_config('app.estoque_descricao', '', true);
END;
$function$;
REVOKE ALL ON FUNCTION public.devolver_estoque_venda(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cancelar_venda(p_venda_id UUID)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_venda public.vendas;
BEGIN
  SELECT * INTO v_venda FROM vendas WHERE id = p_venda_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada.';
  END IF;
  IF auth.uid() IS NULL OR NOT public.has_permission(v_venda.user_id, 'vendas', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para cancelar vendas.';
  END IF;
  IF v_venda.status = 'cancelado' THEN
    RAISE EXCEPTION 'Esta venda já está cancelada.';
  END IF;
  IF EXISTS (SELECT 1 FROM venda_itens WHERE venda_id = p_venda_id AND aparelho_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Venda de aparelho: use cancelar_venda_aparelho.';
  END IF;

  PERFORM public.devolver_estoque_venda(
    p_venda_id, 'cancelamento_venda',
    'Venda #' || lpad(COALESCE(v_venda.numero::text, left(v_venda.id::text, 8)), 4, '0') || ' cancelada');
  UPDATE lancamentos SET status = 'cancelado' WHERE venda_id = p_venda_id;
  UPDATE vendas SET status = 'cancelado' WHERE id = p_venda_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.excluir_venda(p_venda_id UUID)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_venda public.vendas;
BEGIN
  SELECT * INTO v_venda FROM vendas WHERE id = p_venda_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada.';
  END IF;
  IF auth.uid() IS NULL OR NOT public.has_permission(v_venda.user_id, 'vendas', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para excluir vendas.';
  END IF;
  IF v_venda.status <> 'cancelado' THEN
    IF EXISTS (SELECT 1 FROM venda_itens WHERE venda_id = p_venda_id AND aparelho_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Venda de aparelho não pode ser excluída: mude o status para Cancelado — assim o aparelho volta ao estoque e a receita sai do Financeiro.';
    END IF;
    -- Venda já cancelada já devolveu o estoque.
    PERFORM public.devolver_estoque_venda(
      p_venda_id, 'exclusao_venda',
      'Venda #' || lpad(COALESCE(v_venda.numero::text, left(v_venda.id::text, 8)), 4, '0') || ' excluída');
  END IF;
  DELETE FROM vendas WHERE id = p_venda_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.registrar_venda(UUID, JSONB, UUID, NUMERIC, TEXT, TEXT, TEXT, DATE, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancelar_venda(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.excluir_venda(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_venda(UUID, JSONB, UUID, NUMERIC, TEXT, TEXT, TEXT, DATE, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_venda(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_venda(UUID) TO authenticated;
GRANT SELECT ON public.estoque_movimentacoes TO authenticated;

NOTIFY pgrst, 'reload schema';
