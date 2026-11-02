-- "Menor preço" (pedido do usuário, 02/11/2026) também em Aparelhos: é o
-- preco_lojista de Seminovos (renomeado só na tela) e fica espelhado nos dois
-- sentidos pelos triggers de vínculo seminovo <-> aparelho.
ALTER TABLE public.aparelhos ADD COLUMN IF NOT EXISTS preco_minimo numeric(12,2);

UPDATE public.aparelhos a SET preco_minimo = s.preco_lojista
  FROM public.seminovos s
  WHERE a.seminovo_id = s.id AND s.preco_lojista IS NOT NULL AND a.preco_minimo IS NULL;

CREATE OR REPLACE FUNCTION public.sync_seminovo_para_aparelho()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        preco_venda = COALESCE(NEW.preco_venda, preco_venda),
        preco_minimo = COALESCE(NEW.preco_lojista, preco_minimo)
      WHERE id = v_ap.id;
      INSERT INTO aparelho_historico (user_id, aparelho_id, evento, descricao, created_by)
        VALUES (NEW.user_id, v_ap.id, 'vinculo',
          'Vinculado à Compra de Seminovos (mesmo IMEI)', auth.uid());
    ELSE
      INSERT INTO aparelhos (
        user_id, tipo, status, marca, modelo, armazenamento, ram, cor, imei1,
        estado_conservacao, saude_bateria, preco_custo, preco_venda, preco_minimo,
        observacoes, seminovo_id, created_by
      ) VALUES (
        NEW.user_id, 'seminovo', 'disponivel', NEW.marca, NEW.modelo,
        NEW.armazenamento, NEW.ram, NEW.cor, v_imei,
        NEW.estado, NEW.bateria_percentual,
        COALESCE(NEW.valor_total_gasto, 0), COALESCE(NEW.preco_venda, 0), NEW.preco_lojista,
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
    preco_minimo = NEW.preco_lojista,
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
$function$;

CREATE OR REPLACE FUNCTION public.sync_aparelho_para_seminovo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    preco_lojista = CASE WHEN NEW.preco_minimo IS DISTINCT FROM OLD.preco_minimo THEN NEW.preco_minimo ELSE s.preco_lojista END,
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
$function$;
