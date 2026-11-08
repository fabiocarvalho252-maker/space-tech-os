-- Peças da OS e o estoque. A peça já sai do estoque ao entrar na OS
-- (handle_os_item_stock). O que faltava: OS reprovada/cancelada devolve as
-- peças não usadas — pela tela, com confirmação (devolver_pecas_os) — e, se
-- a OS for reaberta depois, as peças saem do estoque de novo. Serviços
-- (categoria 'Serviço') não têm estoque e ficam de fora.
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS pecas_devolvidas_em timestamptz;

CREATE OR REPLACE FUNCTION public.devolver_pecas_os(p_os_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_os public.ordens_servico%ROWTYPE;
  v_item record;
  v_qtd integer := 0;
BEGIN
  SELECT * INTO v_os FROM public.ordens_servico WHERE id = p_os_id FOR UPDATE;
  IF NOT FOUND OR NOT public.has_permission(v_os.user_id, 'ordens', 'gerenciar') THEN
    RAISE EXCEPTION 'OS não encontrada';
  END IF;
  IF v_os.status NOT IN ('reprovado', 'cancelado') THEN
    RAISE EXCEPTION 'Só dá para devolver as peças de OS reprovada ou cancelada';
  END IF;
  IF v_os.pecas_devolvidas_em IS NOT NULL THEN
    RETURN 0;
  END IF;

  PERFORM set_config('app.estoque_tipo', 'devolucao_os', true);
  PERFORM set_config('app.estoque_origem_id', v_os.id::text, true);
  PERFORM set_config('app.estoque_descricao',
    'Devolvida: OS #' || v_os.numero || ' ' || v_os.status, true);
  FOR v_item IN
    SELECT i.produto_id, sum(i.quantidade) AS qtd
      FROM public.os_itens i
      JOIN public.produtos p ON p.id = i.produto_id
     WHERE i.os_id = v_os.id AND coalesce(p.categoria, '') <> 'Serviço'
     GROUP BY i.produto_id
  LOOP
    UPDATE public.produtos SET quantidade = quantidade + v_item.qtd WHERE id = v_item.produto_id;
    v_qtd := v_qtd + v_item.qtd;
  END LOOP;
  PERFORM set_config('app.estoque_tipo', '', true);
  PERFORM set_config('app.estoque_origem_id', '', true);
  PERFORM set_config('app.estoque_descricao', '', true);

  UPDATE public.ordens_servico SET pecas_devolvidas_em = now() WHERE id = v_os.id;
  INSERT INTO public.os_historico (user_id, os_id, evento, descricao, created_by)
  VALUES (v_os.user_id, v_os.id, 'pecas', format('%s peça(s) devolvida(s) ao estoque', v_qtd), auth.uid());
  RETURN v_qtd;
END;
$$;
REVOKE ALL ON FUNCTION public.devolver_pecas_os(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.devolver_pecas_os(uuid) TO authenticated;

-- OS reaberta depois da devolução: as peças saem do estoque de novo.
CREATE OR REPLACE FUNCTION public.os_reabrir_pecas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item record;
BEGIN
  IF OLD.pecas_devolvidas_em IS NOT NULL
     AND NEW.pecas_devolvidas_em IS NOT DISTINCT FROM OLD.pecas_devolvidas_em
     AND NEW.status NOT IN ('reprovado', 'cancelado') THEN
    PERFORM set_config('app.estoque_tipo', 'uso_os', true);
    PERFORM set_config('app.estoque_origem_id', NEW.id::text, true);
    PERFORM set_config('app.estoque_descricao', 'OS #' || NEW.numero || ' reaberta', true);
    FOR v_item IN
      SELECT i.produto_id, sum(i.quantidade) AS qtd
        FROM public.os_itens i
        JOIN public.produtos p ON p.id = i.produto_id
       WHERE i.os_id = NEW.id AND coalesce(p.categoria, '') <> 'Serviço'
       GROUP BY i.produto_id
    LOOP
      UPDATE public.produtos SET quantidade = quantidade - v_item.qtd WHERE id = v_item.produto_id;
    END LOOP;
    PERFORM set_config('app.estoque_tipo', '', true);
    PERFORM set_config('app.estoque_origem_id', '', true);
    PERFORM set_config('app.estoque_descricao', '', true);
    NEW.pecas_devolvidas_em := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS os_reabrir_pecas ON public.ordens_servico;
CREATE TRIGGER os_reabrir_pecas
  BEFORE UPDATE OF status ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.os_reabrir_pecas();

-- Item removido/incluído em OS cujas peças já voltaram: não mexe no estoque.
CREATE OR REPLACE FUNCTION public.handle_os_item_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        -- OS com as peças devolvidas (reprovada/cancelada): salvar a edição
        -- regrava os itens, e isso não pode tirar do estoque de novo — a
        -- baixa volta a acontecer se a OS for reaberta (os_reabrir_pecas).
        IF NEW.produto_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM ordens_servico
                            WHERE id = NEW.os_id AND pecas_devolvidas_em IS NOT NULL) THEN
            PERFORM set_config('app.estoque_tipo', 'uso_os', true);
            PERFORM set_config('app.estoque_origem_id', NEW.os_id::text, true);
            PERFORM set_config('app.estoque_descricao',
              'Usado na OS #' || COALESCE((SELECT numero::text FROM ordens_servico WHERE id = NEW.os_id), '?'), true);
            UPDATE public.produtos
            SET quantidade = quantidade - NEW.quantidade
            WHERE id = NEW.produto_id;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.produto_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM ordens_servico
                            WHERE id = OLD.os_id AND pecas_devolvidas_em IS NOT NULL)
           AND coalesce(current_setting('app.os_pecas_ja_devolvidas', true), '') <> OLD.os_id::text THEN
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

-- Excluir OS com as peças já devolvidas: a exclusão em cascata dos itens
-- não pode devolver de novo (a OS some antes dos itens).
CREATE OR REPLACE FUNCTION public.os_marcar_pecas_devolvidas_ao_excluir()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.pecas_devolvidas_em IS NOT NULL THEN
    PERFORM set_config('app.os_pecas_ja_devolvidas', OLD.id::text, true);
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS os_excluir_pecas_devolvidas ON public.ordens_servico;
CREATE TRIGGER os_excluir_pecas_devolvidas
  BEFORE DELETE ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.os_marcar_pecas_devolvidas_ao_excluir();
