-- Módulo "Aparelhos": estoque próprio da loja (lacrados e seminovos) para
-- VENDA, rastreado por unidade/IMEI, com lucro por unidade — diferente de
-- `seminovos` (compra de usados DE clientes) e `compras_aparelhos` (tabela
-- solta sem nenhuma tela hoje). Reaproveita `vendas`/`venda_itens` (uma
-- venda de aparelho é uma venda normal com um item ligado a `aparelhos`),
-- `lancamentos`/`finance_categories` (financeiro), `termos_garantia`
-- (modelo de termo) e `clientes` — nada disso é recriado.
--
-- Segue exatamente os padrões já estabelecidos no restante do banco:
-- TEXT+CHECK em vez de enum nativo (só um resquício antigo usa enum, todo
-- o resto do schema atual usa TEXT+CHECK), RLS via has_permission(), e a
-- operação crítica (vender) como função Postgres SECURITY INVOKER chamada
-- via supabase.rpc(), no mesmo molde de faturar_os/receber_parcela_
-- faturamento/cancelar_faturamento_os (20260810000000_os_faturamento.sql).

CREATE TABLE public.aparelhos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero SERIAL,
  tipo TEXT NOT NULL CHECK (tipo IN ('lacrado', 'seminovo')),
  status TEXT NOT NULL DEFAULT 'disponivel'
    CHECK (status IN ('disponivel', 'reservado', 'vendido', 'devolvido', 'garantia', 'cancelado')),

  marca TEXT NOT NULL,
  modelo TEXT NOT NULL,
  variante TEXT,
  armazenamento TEXT,
  ram TEXT,
  cor TEXT,
  imei1 TEXT,
  imei2 TEXT,
  numero_serie TEXT,

  -- Só relevante para tipo='seminovo'. Checklist por item ('ok' |
  -- 'com_detalhe' | 'nao_testado' | 'nao_possui'), chaves livres definidas
  -- no frontend (tela, bateria, camera, alto_falante, microfone, biometria,
  -- face_id, touch_id, conector, carcaca, ...) — jsonb em vez de uma coluna
  -- por item porque a lista de itens do checklist é puramente de UI, não
  -- precisa de índice/consulta própria no banco.
  checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  estado_conservacao TEXT,
  saude_bateria INTEGER CHECK (saude_bateria BETWEEN 0 AND 100),
  ciclos_bateria INTEGER CHECK (ciclos_bateria >= 0),

  preco_custo NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (preco_custo >= 0),
  preco_venda NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (preco_venda >= 0),

  observacoes TEXT,

  -- Preenchidos por reservar_aparelho()/cancelar_reserva_aparelho() abaixo.
  reservado_cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  reservado_ate TIMESTAMPTZ,
  reservado_observacao TEXT,

  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sold_at TIMESTAMPTZ
);

ALTER TABLE public.aparelhos ADD CONSTRAINT aparelhos_numero_key UNIQUE (numero);

-- Únicos só dentro da mesma empresa, e só quando preenchidos — o pedido
-- explicitamente permite cadastrar sem IMEI (ex.: alguns seminovos sem
-- IMEI legível), então não pode ser NOT NULL nem UNIQUE global.
CREATE UNIQUE INDEX aparelhos_user_imei1_uk ON public.aparelhos (user_id, imei1) WHERE imei1 IS NOT NULL AND imei1 <> '';
CREATE UNIQUE INDEX aparelhos_user_imei2_uk ON public.aparelhos (user_id, imei2) WHERE imei2 IS NOT NULL AND imei2 <> '';
CREATE UNIQUE INDEX aparelhos_user_serial_uk ON public.aparelhos (user_id, numero_serie) WHERE numero_serie IS NOT NULL AND numero_serie <> '';
CREATE INDEX aparelhos_user_status_idx ON public.aparelhos (user_id, status);
CREATE INDEX aparelhos_user_created_idx ON public.aparelhos (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aparelhos TO authenticated;
GRANT ALL ON public.aparelhos TO service_role;
ALTER TABLE public.aparelhos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aparelhos ver" ON public.aparelhos FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'aparelhos', 'ver'));
CREATE POLICY "aparelhos gerenciar" ON public.aparelhos FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'aparelhos', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'aparelhos', 'gerenciar'));

CREATE TRIGGER aparelhos_updated BEFORE UPDATE ON public.aparelhos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fotos tipadas (frente/trás/lateral/tela/IMEI/caixa/acessórios/outras) —
-- tabela própria em vez do text[] simples que `seminovos.fotos` usa,
-- porque aqui o tipo de cada foto importa para a UI (grid por categoria).
CREATE TABLE public.aparelho_fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aparelho_id UUID NOT NULL REFERENCES public.aparelhos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL
    CHECK (tipo IN ('front', 'back', 'side', 'screen', 'imei', 'box', 'accessories', 'other')),
  path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX aparelho_fotos_aparelho_idx ON public.aparelho_fotos (aparelho_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aparelho_fotos TO authenticated;
GRANT ALL ON public.aparelho_fotos TO service_role;
ALTER TABLE public.aparelho_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aparelho_fotos ver" ON public.aparelho_fotos FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'aparelhos', 'ver'));
CREATE POLICY "aparelho_fotos gerenciar" ON public.aparelho_fotos FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'aparelhos', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'aparelhos', 'gerenciar'));

-- Linha do tempo imutável (mesmo padrão de os_historico): nunca é
-- atualizada nem apagada — só SELECT/INSERT concedidos.
CREATE TABLE public.aparelho_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aparelho_id UUID NOT NULL REFERENCES public.aparelhos(id) ON DELETE CASCADE,
  evento TEXT NOT NULL,
  descricao TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX aparelho_historico_aparelho_idx ON public.aparelho_historico (aparelho_id, created_at);

GRANT SELECT, INSERT ON public.aparelho_historico TO authenticated;
GRANT ALL ON public.aparelho_historico TO service_role;
ALTER TABLE public.aparelho_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aparelho_historico ver" ON public.aparelho_historico FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'aparelhos', 'ver'));
CREATE POLICY "aparelho_historico inserir" ON public.aparelho_historico FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(user_id, 'aparelhos', 'gerenciar'));

-- "OS criada"-style bug already hit once in this codebase
-- (20260811020000_fix_os_historico_insert_trigger.sql): a BEFORE INSERT
-- trigger can't INSERT INTO a table referencing NEW.id via FK, because the
-- row doesn't exist yet. Goes straight to AFTER INSERT here.
CREATE OR REPLACE FUNCTION public.aparelho_historico_log_criacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  INSERT INTO aparelho_historico (user_id, aparelho_id, evento, descricao, created_by)
    VALUES (NEW.user_id, NEW.id, 'cadastro',
      'Aparelho cadastrado (' || NEW.tipo || '): ' || NEW.marca || ' ' || NEW.modelo, auth.uid());
  RETURN NEW;
END;
$$;

CREATE TRIGGER aparelho_historico_log_criacao
  AFTER INSERT ON public.aparelhos
  FOR EACH ROW EXECUTE FUNCTION public.aparelho_historico_log_criacao();

-- Loga automaticamente as duas mudanças que importam quando feitas por
-- fora das funções RPC abaixo (edição manual do cadastro): status e preço
-- de venda. As transições de venda/reserva/devolução em si já logam com
-- descrições mais específicas dentro das próprias funções RPC — este
-- trigger é só uma rede de segurança para não perder o registro se algo
-- mudar o status fora delas.
CREATE OR REPLACE FUNCTION public.aparelho_historico_log_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO aparelho_historico (user_id, aparelho_id, evento, descricao, created_by)
      VALUES (NEW.user_id, NEW.id, 'status',
        'Status alterado de "' || OLD.status || '" para "' || NEW.status || '"', auth.uid());
  END IF;

  IF NEW.preco_venda IS DISTINCT FROM OLD.preco_venda THEN
    INSERT INTO aparelho_historico (user_id, aparelho_id, evento, descricao, created_by)
      VALUES (NEW.user_id, NEW.id, 'preco',
        'Preço de venda alterado de ' || OLD.preco_venda || ' para ' || NEW.preco_venda, auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER aparelho_historico_log_update
  AFTER UPDATE ON public.aparelhos
  FOR EACH ROW EXECUTE FUNCTION public.aparelho_historico_log_update();

-- Garantia emitida (instância real ligada a uma venda) — termos_garantia
-- continua sendo só o modelo de texto reutilizável; esta tabela é o que
-- faltava para "consultar a garantia depois" (pedido, seção 21/59).
CREATE TABLE public.aparelho_garantias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero SERIAL,
  aparelho_id UUID NOT NULL REFERENCES public.aparelhos(id) ON DELETE RESTRICT,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  venda_id UUID REFERENCES public.vendas(id) ON DELETE SET NULL,
  termo_id UUID REFERENCES public.termos_garantia(id) ON DELETE SET NULL,
  dias INTEGER NOT NULL CHECK (dias > 0),
  inicio DATE NOT NULL,
  fim DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'expirada', 'cancelada', 'acionada')),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.aparelho_garantias ADD CONSTRAINT aparelho_garantias_numero_key UNIQUE (numero);
CREATE INDEX aparelho_garantias_aparelho_idx ON public.aparelho_garantias (aparelho_id);
CREATE INDEX aparelho_garantias_cliente_idx ON public.aparelho_garantias (cliente_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aparelho_garantias TO authenticated;
GRANT ALL ON public.aparelho_garantias TO service_role;
ALTER TABLE public.aparelho_garantias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aparelho_garantias ver" ON public.aparelho_garantias FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'aparelhos', 'ver'));
CREATE POLICY "aparelho_garantias gerenciar" ON public.aparelho_garantias FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'aparelhos', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'aparelhos', 'gerenciar'));
-- Área do Cliente: o mesmo cliente já pode ver suas próprias vendas
-- (policy "vendas cliente ve proprias") — estende a mesma leitura própria
-- para a garantia do aparelho que ele comprou.
CREATE POLICY "aparelho_garantias cliente ve propria" ON public.aparelho_garantias FOR SELECT TO authenticated
  USING (cliente_id = public.meu_cliente_id());

CREATE TRIGGER aparelho_garantias_updated BEFORE UPDATE ON public.aparelho_garantias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Liga o item de venda ao aparelho específico vendido — assim a venda de
-- aparelho é uma `vendas`/`venda_itens` normal (aparece em Cobranças/Notas
-- Fiscais/relatório de Vendas de graça) e não uma segunda estrutura de
-- venda paralela.
ALTER TABLE public.venda_itens
  ADD COLUMN aparelho_id UUID REFERENCES public.aparelhos(id) ON DELETE RESTRICT;
CREATE INDEX venda_itens_aparelho_idx ON public.venda_itens (aparelho_id) WHERE aparelho_id IS NOT NULL;

-- Registra "aparelhos" como módulo de permissão (mesmo sistema usado por
-- todo o resto — ver 20260809110100_role_permissions.sql). Acesso default
-- espelha "seminovos": todo mundo menos técnico.
ALTER TABLE public.role_permissions DROP CONSTRAINT role_permissions_modulo_check;
ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_modulo_check
  CHECK (modulo IN (
    'clientes', 'fornecedores', 'produtos', 'ordens', 'vendas', 'compras',
    'financeiro', 'cobrancas', 'garantia', 'configuracoes', 'agenda',
    'seminovos', 'relatorios', 'notas', 'aparelhos'
  ));

INSERT INTO public.role_permissions (empresa_id, role, modulo, pode_ver, pode_gerenciar)
SELECT DISTINCT empresa_id, role, 'aparelhos',
  role <> 'tecnico',
  role <> 'tecnico'
FROM public.role_permissions
ON CONFLICT (empresa_id, role, modulo) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_profile_role_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.role_permissions (empresa_id, role, modulo, pode_ver, pode_gerenciar)
  SELECT NEW.id, r.role, m.modulo,
    CASE
      WHEN r.role = 'admin' THEN true
      WHEN r.role = 'gerente' THEN true
      WHEN r.role = 'tecnico' THEN m.modulo IN ('ordens', 'clientes', 'produtos', 'garantia', 'agenda')
      WHEN r.role = 'atendente' THEN m.modulo IN ('ordens', 'clientes', 'produtos', 'vendas', 'garantia', 'cobrancas', 'agenda', 'seminovos', 'notas', 'aparelhos')
      WHEN r.role = 'financeiro' THEN m.modulo IN ('financeiro', 'cobrancas', 'vendas', 'compras', 'clientes', 'seminovos', 'relatorios', 'notas', 'aparelhos')
    END,
    CASE
      WHEN r.role = 'admin' THEN true
      WHEN r.role = 'gerente' THEN m.modulo <> 'configuracoes'
      WHEN r.role = 'tecnico' THEN m.modulo IN ('ordens', 'agenda')
      WHEN r.role = 'atendente' THEN m.modulo IN ('ordens', 'clientes', 'vendas', 'agenda', 'seminovos', 'notas', 'aparelhos')
      WHEN r.role = 'financeiro' THEN m.modulo IN ('financeiro', 'cobrancas', 'seminovos', 'relatorios', 'aparelhos')
    END
  FROM (VALUES ('admin'), ('gerente'), ('tecnico'), ('atendente'), ('financeiro')) AS r(role)
  CROSS JOIN (VALUES
    ('clientes'), ('fornecedores'), ('produtos'), ('ordens'), ('vendas'),
    ('compras'), ('financeiro'), ('cobrancas'), ('garantia'), ('configuracoes'),
    ('agenda'), ('seminovos'), ('relatorios'), ('notas'), ('aparelhos')
  ) AS m(modulo)
  ON CONFLICT (empresa_id, role, modulo) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Custo/lucro são informação administrativa (pedido, seção 17/27): quem
-- pode ver depende do ROLE do chamador, não do módulo 'aparelhos' em si
-- (um atendente pode ter permissão total de gerenciar aparelhos — cadastrar,
-- vender — sem poder ver quanto a loja pagou/lucrou). Não existe hoje no
-- schema uma dimensão de permissão por campo dentro de role_permissions, e
-- criar uma só para isto seria desproporcional; em vez disso esta função
-- decide o acesso a custo/lucro e é usada pelas server functions de
-- listagem (src/lib/aparelhos/aparelhos.functions.ts), que fazem a
-- redação de fato antes de devolver os dados ao cliente — a checagem não
-- fica só no frontend.
CREATE OR REPLACE FUNCTION public.pode_ver_custo_aparelho(p_empresa_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_empresa_id = auth.uid() THEN true
    ELSE COALESCE((
      SELECT ue.role IN ('admin', 'gerente', 'financeiro')
      FROM public.user_empresas ue
      WHERE ue.user_id = auth.uid() AND ue.empresa_id = p_empresa_id
      LIMIT 1
    ), false)
  END
$$;
GRANT EXECUTE ON FUNCTION public.pode_ver_custo_aparelho(UUID) TO authenticated;

-- ============================================================
-- Funções RPC (mesmo molde de faturar_os/receber_parcela_faturamento/
-- cancelar_faturamento_os): cada uma é a ÚNICA transação real que o
-- PostgREST/Supabase client consegue (um .rpc() é uma request HTTP; um
-- RAISE EXCEPTION desfaz tudo que a função já tinha feito).
-- ============================================================

-- Vende um aparelho disponível: cria a venda (vendas/venda_itens, reaproveitando
-- a estrutura existente), marca o aparelho como vendido, lança a receita no
-- Financeiro (categoria auto-criada se não existir, mesma lógica de
-- faturar_os), e opcionalmente emite a garantia. Tudo ou nada.
CREATE OR REPLACE FUNCTION public.vender_aparelho(
  p_aparelho_id UUID,
  p_cliente_id UUID,
  p_preco_venda NUMERIC,
  p_desconto NUMERIC DEFAULT 0,
  p_forma_pagamento TEXT DEFAULT 'dinheiro',
  p_termo_garantia_id UUID DEFAULT NULL,
  p_dias_garantia INTEGER DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL
)
RETURNS public.aparelhos
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_aparelho public.aparelhos%ROWTYPE;
  v_empresa_id UUID;
  v_valor_final NUMERIC;
  v_categoria_nome TEXT;
  v_venda_id UUID;
  v_venda_numero INT;
  v_descricao TEXT;
BEGIN
  IF p_preco_venda IS NULL OR p_preco_venda < 0 THEN
    RAISE EXCEPTION 'O valor de venda não pode ser negativo.';
  END IF;
  IF p_desconto IS NULL OR p_desconto < 0 THEN
    RAISE EXCEPTION 'O desconto não pode ser negativo.';
  END IF;

  SELECT * INTO v_aparelho FROM aparelhos WHERE id = p_aparelho_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aparelho não encontrado.';
  END IF;
  v_empresa_id := v_aparelho.user_id;

  IF NOT public.has_permission(v_empresa_id, 'aparelhos', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para vender aparelhos.';
  END IF;
  IF NOT public.has_permission(v_empresa_id, 'vendas', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar vendas.';
  END IF;

  -- Um aparelho reservado só pode ser vendido para o próprio cliente da
  -- reserva — vender para outro exige liberar a reserva antes (pedido,
  -- seção 8: "RESERVED: Não pode ser vendido para outro cliente sem
  -- liberar a reserva").
  IF v_aparelho.status = 'reservado' THEN
    IF v_aparelho.reservado_cliente_id IS DISTINCT FROM p_cliente_id THEN
      RAISE EXCEPTION 'Este aparelho está reservado para outro cliente. Libere a reserva antes de vender para um cliente diferente.';
    END IF;
  ELSIF v_aparelho.status <> 'disponivel' THEN
    RAISE EXCEPTION 'Este aparelho não está disponível para venda (status atual: %).', v_aparelho.status;
  END IF;

  IF p_cliente_id IS NOT NULL THEN
    PERFORM 1 FROM clientes WHERE id = p_cliente_id AND user_id = v_empresa_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cliente inválido.';
    END IF;
  END IF;

  v_valor_final := GREATEST(p_preco_venda - p_desconto, 0);
  v_descricao := v_aparelho.marca || ' ' || v_aparelho.modelo
    || CASE WHEN v_aparelho.imei1 IS NOT NULL THEN ' - IMEI final ' || right(v_aparelho.imei1, 4) ELSE '' END;

  INSERT INTO vendas (user_id, cliente_id, total, forma_pagamento, desconto, observacoes, origem)
    VALUES (v_empresa_id, p_cliente_id, v_valor_final, p_forma_pagamento, p_desconto, p_observacoes, 'loja')
    RETURNING id, numero INTO v_venda_id, v_venda_numero;

  INSERT INTO venda_itens (user_id, venda_id, aparelho_id, descricao, quantidade, preco_unitario)
    VALUES (v_empresa_id, v_venda_id, p_aparelho_id, v_descricao, 1, v_valor_final);

  v_categoria_nome := CASE WHEN v_aparelho.tipo = 'lacrado'
    THEN 'Venda de Aparelho Lacrado' ELSE 'Venda de Aparelho Seminovo' END;
  IF NOT EXISTS (SELECT 1 FROM finance_categories WHERE user_id = v_empresa_id AND nome = v_categoria_nome AND tipo = 'entrada') THEN
    INSERT INTO finance_categories (user_id, nome, tipo) VALUES (v_empresa_id, v_categoria_nome, 'entrada');
  END IF;

  INSERT INTO lancamentos (user_id, tipo, categoria, descricao, valor, data, status)
    VALUES (v_empresa_id, 'entrada', v_categoria_nome,
      'Venda #' || lpad(v_venda_numero::text, 4, '0') || ' — ' || v_descricao,
      v_valor_final, CURRENT_DATE, 'pago');

  UPDATE aparelhos SET
    status = 'vendido',
    sold_at = now(),
    reservado_cliente_id = NULL,
    reservado_ate = NULL,
    reservado_observacao = NULL
  WHERE id = p_aparelho_id
  RETURNING * INTO v_aparelho;

  IF p_termo_garantia_id IS NOT NULL AND p_dias_garantia IS NOT NULL AND p_dias_garantia > 0 THEN
    INSERT INTO aparelho_garantias (user_id, aparelho_id, cliente_id, venda_id, termo_id, dias, inicio, fim)
      VALUES (v_empresa_id, p_aparelho_id, p_cliente_id, v_venda_id, p_termo_garantia_id,
        p_dias_garantia, CURRENT_DATE, CURRENT_DATE + p_dias_garantia);
  END IF;

  INSERT INTO aparelho_historico (user_id, aparelho_id, evento, descricao, created_by)
    VALUES (v_empresa_id, p_aparelho_id, 'venda',
      'Aparelho vendido — Venda #' || lpad(v_venda_numero::text, 4, '0')
        || CASE WHEN p_cliente_id IS NOT NULL THEN ' — cliente: ' || (SELECT nome FROM clientes WHERE id = p_cliente_id) ELSE '' END,
      auth.uid());

  RETURN v_aparelho;
END;
$$;
GRANT EXECUTE ON FUNCTION public.vender_aparelho(UUID, UUID, NUMERIC, NUMERIC, TEXT, UUID, INTEGER, TEXT) TO authenticated;

-- Reserva um aparelho disponível para um cliente (não pode ser vendido
-- para outro enquanto reservado).
CREATE OR REPLACE FUNCTION public.reservar_aparelho(
  p_aparelho_id UUID,
  p_cliente_id UUID,
  p_expira_em TIMESTAMPTZ DEFAULT NULL,
  p_observacao TEXT DEFAULT NULL
)
RETURNS public.aparelhos
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_aparelho public.aparelhos%ROWTYPE;
  v_empresa_id UUID;
  v_cliente_nome TEXT;
BEGIN
  SELECT * INTO v_aparelho FROM aparelhos WHERE id = p_aparelho_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aparelho não encontrado.';
  END IF;
  v_empresa_id := v_aparelho.user_id;

  IF NOT public.has_permission(v_empresa_id, 'aparelhos', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para reservar aparelhos.';
  END IF;
  IF v_aparelho.status <> 'disponivel' THEN
    RAISE EXCEPTION 'Este aparelho não está disponível para reserva (status atual: %).', v_aparelho.status;
  END IF;

  SELECT nome INTO v_cliente_nome FROM clientes WHERE id = p_cliente_id AND user_id = v_empresa_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente inválido.';
  END IF;

  UPDATE aparelhos SET
    status = 'reservado',
    reservado_cliente_id = p_cliente_id,
    reservado_ate = p_expira_em,
    reservado_observacao = p_observacao
  WHERE id = p_aparelho_id
  RETURNING * INTO v_aparelho;

  INSERT INTO aparelho_historico (user_id, aparelho_id, evento, descricao, created_by)
    VALUES (v_empresa_id, p_aparelho_id, 'reserva', 'Reservado para ' || v_cliente_nome, auth.uid());

  RETURN v_aparelho;
END;
$$;
GRANT EXECUTE ON FUNCTION public.reservar_aparelho(UUID, UUID, TIMESTAMPTZ, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancelar_reserva_aparelho(p_aparelho_id UUID)
RETURNS public.aparelhos
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_aparelho public.aparelhos%ROWTYPE;
  v_empresa_id UUID;
BEGIN
  SELECT * INTO v_aparelho FROM aparelhos WHERE id = p_aparelho_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aparelho não encontrado.';
  END IF;
  v_empresa_id := v_aparelho.user_id;

  IF NOT public.has_permission(v_empresa_id, 'aparelhos', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para liberar reservas.';
  END IF;
  IF v_aparelho.status <> 'reservado' THEN
    RAISE EXCEPTION 'Este aparelho não está reservado (status atual: %).', v_aparelho.status;
  END IF;

  UPDATE aparelhos SET
    status = 'disponivel',
    reservado_cliente_id = NULL,
    reservado_ate = NULL,
    reservado_observacao = NULL
  WHERE id = p_aparelho_id
  RETURNING * INTO v_aparelho;

  INSERT INTO aparelho_historico (user_id, aparelho_id, evento, descricao, created_by)
    VALUES (v_empresa_id, p_aparelho_id, 'reserva_cancelada', 'Reserva liberada', auth.uid());

  RETURN v_aparelho;
END;
$$;
GRANT EXECUTE ON FUNCTION public.cancelar_reserva_aparelho(UUID) TO authenticated;

-- Devolução: SOLD -> RETURNED, preservando a venda (não apaga nada). Sem
-- estorno financeiro automático — o pedido (seção 32) pede explicitamente
-- para não estornar sem confirmar as regras; o usuário lança o estorno
-- pelo Financeiro existente quando decidir o valor/forma correta.
CREATE OR REPLACE FUNCTION public.devolver_aparelho(
  p_aparelho_id UUID,
  p_motivo TEXT,
  p_condicao TEXT DEFAULT NULL
)
RETURNS public.aparelhos
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_aparelho public.aparelhos%ROWTYPE;
  v_empresa_id UUID;
BEGIN
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Informe o motivo da devolução.';
  END IF;

  SELECT * INTO v_aparelho FROM aparelhos WHERE id = p_aparelho_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aparelho não encontrado.';
  END IF;
  v_empresa_id := v_aparelho.user_id;

  IF NOT public.has_permission(v_empresa_id, 'aparelhos', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para devolver aparelhos.';
  END IF;
  IF v_aparelho.status <> 'vendido' THEN
    RAISE EXCEPTION 'Só é possível devolver um aparelho vendido (status atual: %).', v_aparelho.status;
  END IF;

  UPDATE aparelhos SET status = 'devolvido' WHERE id = p_aparelho_id RETURNING * INTO v_aparelho;

  INSERT INTO aparelho_historico (user_id, aparelho_id, evento, descricao, created_by)
    VALUES (v_empresa_id, p_aparelho_id, 'devolucao',
      'Aparelho devolvido — motivo: ' || p_motivo
        || CASE WHEN p_condicao IS NOT NULL THEN ' — condição: ' || p_condicao ELSE '' END,
      auth.uid());

  RETURN v_aparelho;
END;
$$;
GRANT EXECUTE ON FUNCTION public.devolver_aparelho(UUID, TEXT, TEXT) TO authenticated;

-- Cancela a venda de um aparelho (ex.: venda feita por engano) — devolve o
-- aparelho para disponível e cancela o lançamento financeiro gerado,
-- preservando o histórico da venda em si (não apaga vendas/venda_itens).
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

  UPDATE aparelhos SET status = 'cancelado', sold_at = NULL WHERE id = v_aparelho_id RETURNING * INTO v_aparelho;

  UPDATE vendas SET status = 'cancelado' WHERE id = p_venda_id;

  UPDATE lancamentos SET status = 'cancelado'
    WHERE user_id = v_empresa_id AND status = 'pago'
      AND descricao = 'Venda #' || lpad(v_venda_numero::text, 4, '0') || ' — ' ||
        (SELECT descricao FROM venda_itens WHERE venda_id = p_venda_id AND aparelho_id = v_aparelho_id LIMIT 1);

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

-- Bucket de fotos, mesmo padrão (já corrigido para multiusuário) dos
-- buckets os-fotos/seminovos-fotos — ver 20260812040000_fix_storage_
-- multiuser_access.sql: chave da pasta é o empresa_id (primeiro segmento
-- do path), checado via has_permission(), não "= auth.uid()".
INSERT INTO storage.buckets (id, name, public)
SELECT 'aparelhos-fotos', 'aparelhos-fotos', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'aparelhos-fotos');

CREATE POLICY "aparelhos fotos ver" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'aparelhos-fotos'
    AND public.has_permission((storage.foldername(name))[1]::uuid, 'aparelhos', 'ver')
  );
CREATE POLICY "aparelhos fotos gravar" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'aparelhos-fotos'
    AND public.has_permission((storage.foldername(name))[1]::uuid, 'aparelhos', 'gerenciar')
  );
CREATE POLICY "aparelhos fotos excluir" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'aparelhos-fotos'
    AND public.has_permission((storage.foldername(name))[1]::uuid, 'aparelhos', 'gerenciar')
  );
