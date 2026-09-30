-- Vincula "Compra de Seminovos" (`seminovos`) ao estoque de "Aparelhos"
-- (`aparelhos`) — pedido do usuário. Até aqui eram dois módulos soltos: um
-- seminovo comprado e pronto para venda precisava ser recadastrado à mão em
-- Aparelhos.
--
-- Regra: quando uma compra de seminovo fica "disponivel", ela ganha um
-- registro espelho em `aparelhos` (tipo 'seminovo'), ligado por
-- `aparelhos.seminovo_id`. Daí em diante os dois lados se mantêm em
-- sincronia por triggers:
--   * dados do aparelho (marca, modelo, IMEI, cor, armazenamento, RAM,
--     estado, bateria) e preço de venda, nos dois sentidos;
--   * custo do aparelho = `seminovos.valor_total_gasto` (pago + conserto +
--     outros custos), sempre vindo de Seminovos — é lá que o conserto é
--     lançado;
--   * status, nos dois sentidos (vender/devolver em qualquer tela reflete
--     na outra).
--
-- Venda: cada tela continua criando a SUA venda (`vendas` + lançamento no
-- Financeiro) e o trigger só marca o outro lado como vendido — nunca cria
-- uma segunda venda/receita.
--
-- Os triggers são SECURITY DEFINER porque o espelhamento precisa acontecer
-- mesmo quando quem mexe tem permissão só em um dos dois módulos (ex.:
-- atendente com "seminovos" mas sem "aparelhos"); eles só tocam o registro
-- já ligado, da mesma empresa (user_id), nunca dados de outra empresa.
--
-- Anti-loop: um lado atualiza o outro com `app.sync_seminovo_aparelho` =
-- 'on' (local à transação); o trigger do outro lado vê a flag e não
-- devolve a atualização.

ALTER TABLE public.aparelhos
  ADD COLUMN IF NOT EXISTS seminovo_id UUID REFERENCES public.seminovos(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS aparelhos_seminovo_uk
  ON public.aparelhos (seminovo_id) WHERE seminovo_id IS NOT NULL;

-- ------------------------------------------------------------------
-- Seminovos -> Aparelhos
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_seminovo_para_aparelho()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ap public.aparelhos%ROWTYPE;
  v_imei TEXT;
  v_status TEXT;
  v_item_id UUID;
BEGIN
  IF current_setting('app.sync_seminovo_aparelho', true) = 'on' THEN
    RETURN NULL;
  END IF;

  v_imei := NULLIF(btrim(NEW.imei), '');

  SELECT * INTO v_ap FROM aparelhos WHERE seminovo_id = NEW.id;

  IF NOT FOUND THEN
    -- Só entra no estoque de Aparelhos quando fica pronto para venda.
    IF NEW.status <> 'disponivel' THEN
      RETURN NULL;
    END IF;

    -- Se alguém já cadastrou esse mesmo aparelho à mão em Aparelhos (mesmo
    -- IMEI), liga a esse cadastro em vez de duplicar (o IMEI é único por
    -- empresa em `aparelhos`, o INSERT falharia de qualquer jeito).
    IF v_imei IS NOT NULL THEN
      SELECT * INTO v_ap FROM aparelhos
        WHERE user_id = NEW.user_id AND seminovo_id IS NULL
          AND (imei1 = v_imei OR imei2 = v_imei)
        LIMIT 1;
    END IF;

    PERFORM set_config('app.sync_seminovo_aparelho', 'on', true);
    IF v_ap.id IS NOT NULL THEN
      UPDATE aparelhos SET
        seminovo_id = NEW.id,
        preco_custo = COALESCE(NEW.valor_total_gasto, 0),
        preco_venda = COALESCE(NEW.preco_venda, preco_venda)
      WHERE id = v_ap.id;
      INSERT INTO aparelho_historico (user_id, aparelho_id, evento, descricao, created_by)
        VALUES (NEW.user_id, v_ap.id, 'vinculo',
          'Vinculado à Compra de Seminovos (mesmo IMEI)', auth.uid());
    ELSE
      INSERT INTO aparelhos (
        user_id, tipo, status, marca, modelo, armazenamento, ram, cor, imei1,
        estado_conservacao, saude_bateria, preco_custo, preco_venda,
        observacoes, seminovo_id, created_by
      ) VALUES (
        NEW.user_id, 'seminovo', 'disponivel', NEW.marca, NEW.modelo,
        NEW.armazenamento, NEW.ram, NEW.cor, v_imei,
        NEW.estado, NEW.bateria_percentual,
        COALESCE(NEW.valor_total_gasto, 0), COALESCE(NEW.preco_venda, 0),
        NEW.observacoes, NEW.id, COALESCE(auth.uid(), NEW.user_id)
      ) RETURNING * INTO v_ap;
      INSERT INTO aparelho_historico (user_id, aparelho_id, evento, descricao, created_by)
        VALUES (NEW.user_id, v_ap.id, 'vinculo',
          'Entrou no estoque a partir da Compra de Seminovos', auth.uid());
    END IF;
    PERFORM set_config('app.sync_seminovo_aparelho', 'off', true);
    RETURN NULL;
  END IF;

  -- Já ligado: espelha status (só quando mudou) e os dados.
  v_status := v_ap.status;
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_status := CASE NEW.status
      WHEN 'disponivel' THEN CASE WHEN v_ap.status = 'reservado' THEN 'reservado' ELSE 'disponivel' END
      WHEN 'vendido' THEN 'vendido'
      WHEN 'devolvido' THEN 'devolvido'
      -- pendente (voltou para conserto/avaliação), sucata, sem solução:
      -- sai do estoque de venda.
      ELSE 'cancelado'
    END;
  END IF;

  PERFORM set_config('app.sync_seminovo_aparelho', 'on', true);
  UPDATE aparelhos SET
    marca = NEW.marca,
    modelo = NEW.modelo,
    armazenamento = NEW.armazenamento,
    ram = NEW.ram,
    cor = NEW.cor,
    imei1 = v_imei,
    estado_conservacao = NEW.estado,
    saude_bateria = NEW.bateria_percentual,
    preco_custo = COALESCE(NEW.valor_total_gasto, 0),
    preco_venda = COALESCE(NEW.preco_venda, preco_venda),
    status = v_status,
    sold_at = CASE
      WHEN v_status = 'vendido' THEN COALESCE(sold_at, now())
      WHEN v_status IN ('disponivel', 'reservado', 'cancelado') THEN NULL
      ELSE sold_at
    END,
    reservado_cliente_id = CASE WHEN v_status = 'reservado' THEN reservado_cliente_id END,
    reservado_ate = CASE WHEN v_status = 'reservado' THEN reservado_ate END,
    reservado_observacao = CASE WHEN v_status = 'reservado' THEN reservado_observacao END
  WHERE id = v_ap.id;

  -- Venda feita pela tela de Seminovos: liga o item da venda ao aparelho,
  -- para a venda/comprovante aparecerem também no detalhe em Aparelhos.
  IF v_status = 'vendido' AND NEW.venda_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM venda_itens WHERE venda_id = NEW.venda_id AND aparelho_id = v_ap.id) THEN
    SELECT id INTO v_item_id FROM venda_itens
      WHERE venda_id = NEW.venda_id AND aparelho_id IS NULL
      ORDER BY created_at LIMIT 1;
    IF v_item_id IS NOT NULL THEN
      UPDATE venda_itens SET aparelho_id = v_ap.id WHERE id = v_item_id;
    END IF;
  END IF;
  PERFORM set_config('app.sync_seminovo_aparelho', 'off', true);

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_seminovo_para_aparelho ON public.seminovos;
CREATE TRIGGER sync_seminovo_para_aparelho
  AFTER INSERT OR UPDATE ON public.seminovos
  FOR EACH ROW EXECUTE FUNCTION public.sync_seminovo_para_aparelho();

-- Compra de seminovo apagada: o espelho ainda à venda sai do estoque (o FK
-- só zeraria seminovo_id e deixaria um aparelho "fantasma" disponível).
CREATE OR REPLACE FUNCTION public.sync_seminovo_excluido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE aparelhos SET
    status = 'cancelado',
    reservado_cliente_id = NULL,
    reservado_ate = NULL,
    reservado_observacao = NULL
  WHERE seminovo_id = OLD.id AND status IN ('disponivel', 'reservado');
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS sync_seminovo_excluido ON public.seminovos;
CREATE TRIGGER sync_seminovo_excluido
  BEFORE DELETE ON public.seminovos
  FOR EACH ROW EXECUTE FUNCTION public.sync_seminovo_excluido();

-- ------------------------------------------------------------------
-- Aparelhos -> Seminovos
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_aparelho_para_seminovo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status_seminovo TEXT;
  v_novo TEXT;
  v_venda_id UUID;
BEGIN
  IF current_setting('app.sync_seminovo_aparelho', true) = 'on' THEN
    RETURN NULL;
  END IF;
  IF NEW.seminovo_id IS NULL OR NEW.seminovo_id IS DISTINCT FROM OLD.seminovo_id THEN
    RETURN NULL;
  END IF;

  SELECT status INTO v_status_seminovo FROM seminovos WHERE id = NEW.seminovo_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_novo := CASE NEW.status
      WHEN 'vendido' THEN 'vendido'
      WHEN 'devolvido' THEN 'devolvido'
      -- Seminovos não tem "reservado": continua disponível lá.
      WHEN 'disponivel' THEN 'disponivel'
      WHEN 'reservado' THEN 'disponivel'
      -- Retirado do estoque em Aparelhos: volta para "pendente" em
      -- Seminovos (reavaliar), se ainda estava à venda lá.
      WHEN 'cancelado' THEN CASE WHEN v_status_seminovo = 'disponivel' THEN 'pendente' END
    END;
  END IF;

  IF v_novo = 'vendido' THEN
    SELECT vi.venda_id INTO v_venda_id FROM venda_itens vi
      WHERE vi.aparelho_id = NEW.id ORDER BY vi.created_at DESC LIMIT 1;
  END IF;

  PERFORM set_config('app.sync_seminovo_aparelho', 'on', true);
  UPDATE seminovos s SET
    marca = CASE WHEN NEW.marca IS DISTINCT FROM OLD.marca THEN NEW.marca ELSE s.marca END,
    modelo = CASE WHEN NEW.modelo IS DISTINCT FROM OLD.modelo THEN NEW.modelo ELSE s.modelo END,
    armazenamento = CASE WHEN NEW.armazenamento IS DISTINCT FROM OLD.armazenamento THEN NEW.armazenamento ELSE s.armazenamento END,
    ram = CASE WHEN NEW.ram IS DISTINCT FROM OLD.ram THEN NEW.ram ELSE s.ram END,
    cor = CASE WHEN NEW.cor IS DISTINCT FROM OLD.cor THEN NEW.cor ELSE s.cor END,
    imei = CASE WHEN NEW.imei1 IS DISTINCT FROM OLD.imei1 THEN NEW.imei1 ELSE s.imei END,
    estado = CASE WHEN NEW.estado_conservacao IS DISTINCT FROM OLD.estado_conservacao THEN NEW.estado_conservacao ELSE s.estado END,
    bateria_percentual = CASE WHEN NEW.saude_bateria IS DISTINCT FROM OLD.saude_bateria THEN NEW.saude_bateria ELSE s.bateria_percentual END,
    preco_venda = CASE WHEN NEW.preco_venda IS DISTINCT FROM OLD.preco_venda THEN NEW.preco_venda ELSE s.preco_venda END,
    status = COALESCE(v_novo, s.status),
    venda_id = CASE
      WHEN v_novo = 'vendido' THEN COALESCE(v_venda_id, s.venda_id)
      WHEN v_novo IN ('disponivel', 'pendente') THEN NULL
      ELSE s.venda_id
    END,
    devolucao_data = CASE WHEN v_novo = 'devolvido' THEN now() ELSE s.devolucao_data END,
    devolucao_motivo = CASE
      WHEN v_novo = 'devolvido' THEN COALESCE(s.devolucao_motivo, 'Devolução registrada em Aparelhos')
      ELSE s.devolucao_motivo
    END
  WHERE s.id = NEW.seminovo_id;
  PERFORM set_config('app.sync_seminovo_aparelho', 'off', true);

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_aparelho_para_seminovo ON public.aparelhos;
CREATE TRIGGER sync_aparelho_para_seminovo
  AFTER UPDATE ON public.aparelhos
  FOR EACH ROW EXECUTE FUNCTION public.sync_aparelho_para_seminovo();

-- ------------------------------------------------------------------
-- cancelar_venda_aparelho: dois ajustes para aparelhos vindos de Seminovos
--   1. volta para "disponivel" (o aparelho continua na loja) em vez de
--      "cancelado" — "cancelado" tiraria o seminovo de circulação;
--   2. cancela também o lançamento ligado por venda_id — a venda feita pela
--      tela de Seminovos grava o lançamento com outra descrição, então o
--      casamento por descrição abaixo não o encontraria.
-- O resto é idêntico à versão de 20260813023106_aparelhos.sql.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancelar_venda_aparelho(
  p_venda_id UUID,
  p_motivo TEXT DEFAULT NULL
)
RETURNS public.aparelhos
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_aparelho_id UUID;
  v_aparelho public.aparelhos%ROWTYPE;
  v_empresa_id UUID;
  v_venda_numero INT;
BEGIN
  SELECT vi.aparelho_id, v.user_id, v.numero INTO v_aparelho_id, v_empresa_id, v_venda_numero
    FROM venda_itens vi JOIN vendas v ON v.id = vi.venda_id
    WHERE vi.venda_id = p_venda_id AND vi.aparelho_id IS NOT NULL
    LIMIT 1;
  IF v_aparelho_id IS NULL THEN
    RAISE EXCEPTION 'Esta venda não corresponde a uma venda de aparelho.';
  END IF;

  SELECT * INTO v_aparelho FROM aparelhos WHERE id = v_aparelho_id FOR UPDATE;

  IF NOT public.has_permission(v_empresa_id, 'aparelhos', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para cancelar vendas de aparelhos.';
  END IF;
  IF v_aparelho.status <> 'vendido' THEN
    RAISE EXCEPTION 'Este aparelho não está com uma venda ativa (status atual: %).', v_aparelho.status;
  END IF;

  UPDATE aparelhos SET
    status = CASE WHEN seminovo_id IS NOT NULL THEN 'disponivel' ELSE 'cancelado' END,
    sold_at = NULL
  WHERE id = v_aparelho_id RETURNING * INTO v_aparelho;

  UPDATE vendas SET status = 'cancelado' WHERE id = p_venda_id;

  UPDATE lancamentos SET status = 'cancelado'
    WHERE user_id = v_empresa_id AND status = 'pago'
      AND (
        venda_id = p_venda_id
        OR descricao = 'Venda #' || lpad(v_venda_numero::text, 4, '0') || ' — ' ||
          (SELECT descricao FROM venda_itens WHERE venda_id = p_venda_id AND aparelho_id = v_aparelho_id LIMIT 1)
      );

  UPDATE aparelho_garantias SET status = 'cancelada' WHERE venda_id = p_venda_id AND status = 'ativa';

  INSERT INTO aparelho_historico (user_id, aparelho_id, evento, descricao, created_by)
    VALUES (v_empresa_id, v_aparelho_id, 'venda_cancelada',
      'Venda #' || lpad(v_venda_numero::text, 4, '0') || ' cancelada'
        || CASE WHEN p_motivo IS NOT NULL THEN ' — motivo: ' || p_motivo ELSE '' END,
      auth.uid());

  RETURN v_aparelho;
END;
$$;
GRANT EXECUTE ON FUNCTION public.cancelar_venda_aparelho(UUID, TEXT) TO authenticated;

-- ------------------------------------------------------------------
-- Carga inicial: seminovos já disponíveis entram no estoque de Aparelhos
-- (mesmo caminho do trigger — um UPDATE "vazio" dispara a criação).
-- ------------------------------------------------------------------
UPDATE public.seminovos s SET status = s.status
  WHERE s.status = 'disponivel'
    AND NOT EXISTS (SELECT 1 FROM public.aparelhos a WHERE a.seminovo_id = s.id);
