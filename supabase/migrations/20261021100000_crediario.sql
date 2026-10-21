-- Módulo "Crediário": venda de aparelho parcelada com bloqueio remoto do
-- aparelho em caso de atraso (modelo PayJoy).
--
-- Regras:
--   * aviso no dia do vencimento (comando "mensagem" na fila do aparelho);
--   * parcela vencida vira "atrasada"; com N dias de atraso (dias_tolerancia,
--     padrão 1) o aparelho é bloqueado;
--   * liberação automática assim que não houver mais parcela em atraso além
--     da tolerância;
--   * quitação (ou cancelamento) remove a proteção do aparelho de vez.
--
-- O banco guarda o ESTADO DESEJADO do aparelho (crediario_contratos.
-- status_aparelho) e uma fila de comandos (crediario_comandos) que o futuro
-- app Android consome via servidor (service_role) — o app nunca fala com o
-- PostgREST direto. A fila é só um "empurrão": ao se conectar, o app deve
-- sempre obedecer status_aparelho, que é a fonte da verdade.
--
-- Segue os padrões do resto do schema: user_id = empresa, TEXT+CHECK em vez
-- de enum, RLS via has_permission(). Diferente da maioria dos módulos, o
-- usuário só tem SELECT nas tabelas: toda escrita passa por funções
-- SECURITY DEFINER que checam permissão, para que ninguém mude status,
-- marque parcela como paga ou destrave um aparelho pelo navegador sem passar
-- pelas regras. Cada parcela vira um lançamento pendente no Financeiro
-- (contas a receber), no mesmo molde de faturar_os().

-- ---------------------------------------------------------------------
-- Permissão do módulo
-- ---------------------------------------------------------------------
ALTER TABLE public.role_permissions DROP CONSTRAINT role_permissions_modulo_check;
ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_modulo_check
  CHECK (modulo IN (
    'clientes', 'fornecedores', 'produtos', 'ordens', 'vendas',
    'compras', 'financeiro', 'cobrancas', 'garantia', 'configuracoes',
    'agenda', 'seminovos', 'relatorios', 'notas', 'aparelhos', 'crediario'
  ));

-- Bloquear o celular de um cliente é sensível: atendente só consulta;
-- gerenciar (criar contrato, receber, bloquear/liberar) fica com admin,
-- gerente e financeiro. Técnico não vê.
INSERT INTO public.role_permissions (empresa_id, role, modulo, pode_ver, pode_gerenciar)
SELECT p.id, r.role, 'crediario',
  r.role IN ('admin', 'gerente', 'atendente', 'financeiro'),
  r.role IN ('admin', 'gerente', 'financeiro')
FROM public.profiles p
CROSS JOIN (VALUES ('admin'), ('gerente'), ('tecnico'), ('atendente'), ('financeiro')) AS r(role)
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
      WHEN r.role = 'atendente' THEN m.modulo IN ('ordens', 'clientes', 'produtos', 'vendas', 'garantia', 'cobrancas', 'agenda', 'seminovos', 'notas', 'aparelhos', 'crediario')
      WHEN r.role = 'financeiro' THEN m.modulo IN ('financeiro', 'cobrancas', 'vendas', 'compras', 'clientes', 'seminovos', 'relatorios', 'notas', 'aparelhos', 'crediario')
    END,
    CASE
      WHEN r.role = 'admin' THEN true
      WHEN r.role = 'gerente' THEN m.modulo <> 'configuracoes'
      WHEN r.role = 'tecnico' THEN m.modulo IN ('ordens', 'agenda')
      WHEN r.role = 'atendente' THEN m.modulo IN ('ordens', 'clientes', 'vendas', 'agenda', 'seminovos', 'notas', 'aparelhos')
      WHEN r.role = 'financeiro' THEN m.modulo IN ('financeiro', 'cobrancas', 'seminovos', 'relatorios', 'aparelhos', 'crediario')
    END
  FROM (VALUES ('admin'), ('gerente'), ('tecnico'), ('atendente'), ('financeiro')) AS r(role)
  CROSS JOIN (VALUES
    ('clientes'), ('fornecedores'), ('produtos'), ('ordens'), ('vendas'),
    ('compras'), ('financeiro'), ('cobrancas'), ('garantia'), ('configuracoes'),
    ('agenda'), ('seminovos'), ('relatorios'), ('notas'), ('aparelhos'), ('crediario')
  ) AS m(modulo)
  ON CONFLICT (empresa_id, role, modulo) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------

-- "Hoje" no fuso da loja. current_date do banco é UTC: depois das 21h em
-- Brasília já seria amanhã e o bloqueio dispararia 3h antes da hora.
CREATE OR REPLACE FUNCTION public.crediario_hoje()
RETURNS DATE
LANGUAGE sql
STABLE
AS $$ SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date $$;

CREATE TABLE public.crediario_contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,

  marca TEXT NOT NULL,
  modelo TEXT NOT NULL,
  imei TEXT NOT NULL CHECK (imei ~ '^[0-9]{15}$'),

  valor_aparelho NUMERIC(12,2) NOT NULL CHECK (valor_aparelho > 0),
  entrada NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (entrada >= 0),
  num_parcelas INTEGER NOT NULL CHECK (num_parcelas BETWEEN 1 AND 24),
  valor_parcela NUMERIC(12,2) NOT NULL CHECK (valor_parcela > 0),
  primeiro_vencimento DATE NOT NULL,
  -- CDC art. 52 §1º: multa moratória máx. 2%; juros de mora 1% a.m.
  multa_pct NUMERIC(5,2) NOT NULL DEFAULT 2 CHECK (multa_pct BETWEEN 0 AND 2),
  juros_mes_pct NUMERIC(5,2) NOT NULL DEFAULT 1 CHECK (juros_mes_pct BETWEEN 0 AND 1),
  dias_tolerancia INTEGER NOT NULL DEFAULT 1 CHECK (dias_tolerancia BETWEEN 1 AND 30),

  status TEXT NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo', 'atrasado', 'bloqueado', 'quitado', 'cancelado')),
  status_aparelho TEXT NOT NULL DEFAULT 'liberado'
    CHECK (status_aparelho IN ('liberado', 'bloqueado', 'removido')),
  -- Bloqueio pedido pela loja independente de atraso; a rotina automática
  -- não desfaz enquanto estiver true.
  bloqueio_manual BOOLEAN NOT NULL DEFAULT false,
  -- Liberação manual com atraso em aberto: a rotina não bloqueia até esta
  -- data (inclusive). Sem isso, a próxima rodada horária bloquearia de novo.
  liberado_ate DATE,

  termo_aceito_em TIMESTAMPTZ NOT NULL,
  observacoes TEXT,

  -- Preenchidos pelo app de proteção (fase futura). provisionado_em nulo =
  -- app ainda não instalado no aparelho.
  provisionado_em TIMESTAMPTZ,
  ultimo_contato TIMESTAMPTZ,

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (entrada < valor_aparelho),
  UNIQUE (user_id, numero)
);

-- O mesmo aparelho não pode estar em dois contratos ativos da mesma loja.
CREATE UNIQUE INDEX crediario_contratos_imei_ativo_uk ON public.crediario_contratos (user_id, imei)
  WHERE status NOT IN ('quitado', 'cancelado');
CREATE INDEX crediario_contratos_user_status_idx ON public.crediario_contratos (user_id, status);
CREATE INDEX crediario_contratos_cliente_idx ON public.crediario_contratos (cliente_id);

CREATE TRIGGER crediario_contratos_updated BEFORE UPDATE ON public.crediario_contratos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.crediario_parcelas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contrato_id UUID NOT NULL REFERENCES public.crediario_contratos(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  vencimento DATE NOT NULL,
  valor NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  status TEXT NOT NULL DEFAULT 'aberta'
    CHECK (status IN ('aberta', 'atrasada', 'paga', 'cancelada')),
  pago_em DATE,
  valor_pago NUMERIC(12,2),
  payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  pix_txid TEXT,
  lancamento_id UUID REFERENCES public.lancamentos(id) ON DELETE SET NULL,
  recebido_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contrato_id, numero)
);

CREATE UNIQUE INDEX crediario_parcelas_pix_txid_uk ON public.crediario_parcelas (pix_txid)
  WHERE pix_txid IS NOT NULL;
CREATE INDEX crediario_parcelas_user_status_venc_idx
  ON public.crediario_parcelas (user_id, status, vencimento);

CREATE TABLE public.crediario_comandos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contrato_id UUID NOT NULL REFERENCES public.crediario_contratos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('bloquear', 'liberar', 'mensagem', 'remover_protecao')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  motivo TEXT,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'enviado', 'confirmado', 'cancelado')),
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- null = automático
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviado_em TIMESTAMPTZ,
  confirmado_em TIMESTAMPTZ
);

CREATE INDEX crediario_comandos_contrato_status_idx
  ON public.crediario_comandos (contrato_id, status, created_at);

-- Linha do tempo imutável, mesmo espírito de os_historico.
CREATE TABLE public.crediario_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contrato_id UUID NOT NULL REFERENCES public.crediario_contratos(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX crediario_eventos_contrato_idx ON public.crediario_eventos (contrato_id, created_at);

-- Só leitura para a equipe; escrita só pelas funções abaixo.
GRANT SELECT ON public.crediario_contratos, public.crediario_parcelas,
  public.crediario_comandos, public.crediario_eventos TO authenticated;
GRANT ALL ON public.crediario_contratos, public.crediario_parcelas,
  public.crediario_comandos, public.crediario_eventos TO service_role;

ALTER TABLE public.crediario_contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crediario_parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crediario_comandos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crediario_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crediario_contratos ver" ON public.crediario_contratos FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'crediario', 'ver'));
CREATE POLICY "crediario_parcelas ver" ON public.crediario_parcelas FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'crediario', 'ver'));
CREATE POLICY "crediario_comandos ver" ON public.crediario_comandos FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'crediario', 'ver'));
CREATE POLICY "crediario_eventos ver" ON public.crediario_eventos FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'crediario', 'ver'));

-- ---------------------------------------------------------------------
-- Funções internas (sem EXECUTE para a equipe; usadas pelas funções
-- públicas abaixo, que rodam como dono do banco)
-- ---------------------------------------------------------------------

-- Valor devido numa data: multa única + juros de mora pro rata dia.
CREATE OR REPLACE FUNCTION public.crediario_valor_atualizado(
  p_valor NUMERIC, p_vencimento DATE, p_multa_pct NUMERIC, p_juros_mes_pct NUMERIC, p_em DATE
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_em <= p_vencimento THEN p_valor
    ELSE round(
      p_valor
      + p_valor * p_multa_pct / 100
      + p_valor * p_juros_mes_pct / 100 / 30 * (p_em - p_vencimento),
    2)
  END
$$;

CREATE OR REPLACE FUNCTION public.crediario_log(p_contrato UUID, p_descricao TEXT)
RETURNS VOID
LANGUAGE sql
SET search_path = public
AS $$
  INSERT INTO crediario_eventos (user_id, contrato_id, descricao, created_by)
  SELECT user_id, id, p_descricao, auth.uid() FROM crediario_contratos WHERE id = p_contrato;
$$;

-- Bloquear/liberar cancelam o oposto ainda pendente (senão o app poderia
-- executar os dois fora de ordem); remover_protecao cancela ambos. Não
-- duplica comando igual pendente.
CREATE OR REPLACE FUNCTION public.crediario_enfileirar(
  p_contrato UUID, p_tipo TEXT, p_motivo TEXT, p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF p_tipo IN ('bloquear', 'liberar', 'remover_protecao') THEN
    UPDATE crediario_comandos SET status = 'cancelado'
    WHERE contrato_id = p_contrato AND status = 'pendente'
      AND tipo IN ('bloquear', 'liberar') AND tipo <> p_tipo;

    IF EXISTS (
      SELECT 1 FROM crediario_comandos
      WHERE contrato_id = p_contrato AND status = 'pendente' AND tipo = p_tipo
    ) THEN
      RETURN;
    END IF;
  END IF;

  INSERT INTO crediario_comandos (user_id, contrato_id, tipo, motivo, payload, criado_por)
  SELECT user_id, id, p_tipo, p_motivo, p_payload, auth.uid()
  FROM crediario_contratos WHERE id = p_contrato;
END;
$$;

-- Recalcula o estado do contrato a partir das parcelas: marca atrasos,
-- quita, bloqueia ou libera. Única fonte das transições automáticas.
CREATE OR REPLACE FUNCTION public.crediario_recalcular(p_contrato UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  c crediario_contratos%ROWTYPE;
  v_hoje DATE := public.crediario_hoje();
  v_abertas INT;
  v_atraso_max INT;
  v_liberado_ate DATE;
  v_bloquear BOOLEAN;
  r RECORD;
BEGIN
  SELECT * INTO c FROM crediario_contratos WHERE id = p_contrato FOR UPDATE;
  IF NOT FOUND OR c.status IN ('quitado', 'cancelado') THEN
    RETURN;
  END IF;

  FOR r IN
    UPDATE crediario_parcelas SET status = 'atrasada'
    WHERE contrato_id = p_contrato AND status = 'aberta' AND vencimento < v_hoje
    RETURNING numero
  LOOP
    PERFORM public.crediario_log(p_contrato,
      'Parcela ' || r.numero || '/' || c.num_parcelas || ' venceu sem pagamento');
  END LOOP;

  SELECT count(*) FILTER (WHERE status IN ('aberta', 'atrasada')),
         max(v_hoje - vencimento) FILTER (WHERE status = 'atrasada')
    INTO v_abertas, v_atraso_max
    FROM crediario_parcelas WHERE contrato_id = p_contrato;

  IF v_abertas = 0 THEN
    UPDATE crediario_contratos
       SET status = 'quitado', status_aparelho = 'removido',
           bloqueio_manual = false, liberado_ate = NULL
     WHERE id = p_contrato;
    PERFORM public.crediario_enfileirar(p_contrato, 'remover_protecao', 'Contrato quitado');
    PERFORM public.crediario_log(p_contrato, 'Contrato quitado — proteção do aparelho removida');
    RETURN;
  END IF;

  -- Liberação manual vencida ou sem atraso a cobrir: descarta.
  v_liberado_ate := CASE
    WHEN c.liberado_ate < v_hoje OR v_atraso_max IS NULL THEN NULL
    ELSE c.liberado_ate
  END;

  -- coalesce: sem atraso, v_atraso_max é NULL e deixaria v_bloquear NULL,
  -- pulando os dois ramos abaixo (aparelho "liberado" sem comando liberar).
  v_bloquear := c.bloqueio_manual
    OR (coalesce(v_atraso_max, 0) >= c.dias_tolerancia AND v_liberado_ate IS NULL);

  IF v_bloquear AND c.status_aparelho <> 'bloqueado' THEN
    PERFORM public.crediario_enfileirar(p_contrato, 'bloquear',
      CASE WHEN c.bloqueio_manual THEN 'Bloqueio manual'
           ELSE 'Atraso de ' || v_atraso_max || ' dia(s)' END);
    IF NOT c.bloqueio_manual THEN
      PERFORM public.crediario_log(p_contrato,
        'Aparelho bloqueado automaticamente (atraso de ' || v_atraso_max || ' dia(s))');
    END IF;
  ELSIF NOT v_bloquear AND c.status_aparelho = 'bloqueado' THEN
    PERFORM public.crediario_enfileirar(p_contrato, 'liberar',
      CASE WHEN v_liberado_ate IS NOT NULL THEN 'Liberação manual' ELSE 'Sem parcelas em atraso' END);
    PERFORM public.crediario_log(p_contrato, 'Aparelho liberado');
  END IF;

  UPDATE crediario_contratos SET
    status = CASE WHEN v_bloquear THEN 'bloqueado'
                  WHEN v_atraso_max IS NOT NULL THEN 'atrasado'
                  ELSE 'ativo' END,
    status_aparelho = CASE WHEN v_bloquear THEN 'bloqueado' ELSE 'liberado' END,
    liberado_ate = v_liberado_ate
  WHERE id = p_contrato;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crediario_log(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crediario_enfileirar(UUID, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crediario_recalcular(UUID) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- Operações (chamadas via supabase.rpc)
-- ---------------------------------------------------------------------

-- Cria o contrato, as parcelas mensais e os lançamentos no Financeiro
-- (entrada já paga + uma conta a receber por parcela), tudo atômico.
-- p_valor_parcela nulo = divide o valor financiado sem juros, com o
-- arredondamento na última parcela; informado = parcela fixa (com juros do
-- financiamento embutidos), nunca abaixo do valor financiado.
CREATE OR REPLACE FUNCTION public.criar_contrato_crediario(
  p_cliente_id UUID,
  p_marca TEXT,
  p_modelo TEXT,
  p_imei TEXT,
  p_valor_aparelho NUMERIC,
  p_entrada NUMERIC,
  p_num_parcelas INT,
  p_primeiro_vencimento DATE,
  p_termo_aceito BOOLEAN,
  p_valor_parcela NUMERIC DEFAULT NULL,
  p_multa_pct NUMERIC DEFAULT 2,
  p_juros_mes_pct NUMERIC DEFAULT 1,
  p_dias_tolerancia INT DEFAULT 1,
  p_forma_entrada_id UUID DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL
)
RETURNS public.crediario_contratos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_imei TEXT := regexp_replace(coalesce(p_imei, ''), '\D', '', 'g');
  v_entrada NUMERIC := coalesce(p_entrada, 0);
  v_financiado NUMERIC;
  v_base NUMERIC;
  v_valor NUMERIC;
  v_numero INT;
  v_categoria TEXT;
  v_contrato crediario_contratos%ROWTYPE;
  v_lancamento_id UUID;
  v_venc DATE;
BEGIN
  SELECT user_id INTO v_empresa_id FROM clientes WHERE id = p_cliente_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado.';
  END IF;
  IF NOT public.has_permission(v_empresa_id, 'crediario', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar o crediário.';
  END IF;

  IF NOT coalesce(p_termo_aceito, false) THEN
    RAISE EXCEPTION 'O cliente precisa aceitar o termo de bloqueio do aparelho.';
  END IF;
  IF length(v_imei) <> 15 THEN
    RAISE EXCEPTION 'IMEI inválido: informe os 15 dígitos.';
  END IF;
  IF coalesce(trim(p_marca), '') = '' OR coalesce(trim(p_modelo), '') = '' THEN
    RAISE EXCEPTION 'Informe marca e modelo do aparelho.';
  END IF;
  IF p_valor_aparelho IS NULL OR p_valor_aparelho <= 0 THEN
    RAISE EXCEPTION 'Informe o valor do aparelho.';
  END IF;
  IF v_entrada < 0 OR v_entrada >= p_valor_aparelho THEN
    RAISE EXCEPTION 'A entrada deve ser menor que o valor do aparelho.';
  END IF;
  IF p_num_parcelas IS NULL OR p_num_parcelas NOT BETWEEN 1 AND 24 THEN
    RAISE EXCEPTION 'O número de parcelas deve ser entre 1 e 24.';
  END IF;
  IF p_primeiro_vencimento IS NULL OR p_primeiro_vencimento < public.crediario_hoje() THEN
    RAISE EXCEPTION 'O primeiro vencimento não pode ser no passado.';
  END IF;

  v_financiado := p_valor_aparelho - v_entrada;
  IF p_valor_parcela IS NULL THEN
    v_base := floor(v_financiado * 100 / p_num_parcelas) / 100;
  ELSE
    v_base := round(p_valor_parcela, 2);
    IF v_base * p_num_parcelas < v_financiado - 0.01 THEN
      RAISE EXCEPTION 'O total das parcelas (%) não pode ser menor que o valor financiado (%).',
        v_base * p_num_parcelas, v_financiado;
    END IF;
  END IF;
  IF v_base <= 0 THEN
    RAISE EXCEPTION 'Valor de parcela inválido.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM crediario_contratos
    WHERE user_id = v_empresa_id AND imei = v_imei AND status NOT IN ('quitado', 'cancelado')
  ) THEN
    RAISE EXCEPTION 'Este IMEI já está em um contrato ativo.';
  END IF;

  IF p_forma_entrada_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM payment_methods WHERE id = p_forma_entrada_id AND user_id = v_empresa_id
  ) THEN
    RAISE EXCEPTION 'Forma de pagamento inválida.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('crediario:' || v_empresa_id::text));
  SELECT coalesce(max(numero), 0) + 1 INTO v_numero
    FROM crediario_contratos WHERE user_id = v_empresa_id;

  INSERT INTO crediario_contratos (
    user_id, numero, cliente_id, marca, modelo, imei, valor_aparelho, entrada,
    num_parcelas, valor_parcela, primeiro_vencimento, multa_pct, juros_mes_pct,
    dias_tolerancia, termo_aceito_em, observacoes, created_by
  ) VALUES (
    v_empresa_id, v_numero, p_cliente_id, trim(p_marca), trim(p_modelo), v_imei,
    p_valor_aparelho, v_entrada, p_num_parcelas, v_base, p_primeiro_vencimento,
    coalesce(p_multa_pct, 2), coalesce(p_juros_mes_pct, 1), coalesce(p_dias_tolerancia, 1),
    now(), nullif(trim(p_observacoes), ''), auth.uid()
  ) RETURNING * INTO v_contrato;

  SELECT nome INTO v_categoria FROM finance_categories
    WHERE user_id = v_empresa_id AND nome = 'Crediário' AND tipo = 'entrada' LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO finance_categories (user_id, nome, tipo) VALUES (v_empresa_id, 'Crediário', 'entrada')
      RETURNING nome INTO v_categoria;
  END IF;

  IF v_entrada > 0 THEN
    INSERT INTO lancamentos (user_id, tipo, categoria, descricao, valor, data, status, payment_method_id)
    VALUES (v_empresa_id, 'entrada', v_categoria,
      'Crediário CR-' || lpad(v_numero::text, 4, '0') || ' — entrada',
      v_entrada, public.crediario_hoje(), 'pago', p_forma_entrada_id);
  END IF;

  FOR n IN 1..p_num_parcelas LOOP
    v_venc := (p_primeiro_vencimento + make_interval(months => n - 1))::date;
    v_valor := CASE
      WHEN p_valor_parcela IS NULL AND n = p_num_parcelas THEN v_financiado - v_base * (p_num_parcelas - 1)
      ELSE v_base
    END;

    INSERT INTO lancamentos (user_id, tipo, categoria, descricao, valor, data, status, vencimento)
    VALUES (v_empresa_id, 'entrada', v_categoria,
      'Crediário CR-' || lpad(v_numero::text, 4, '0') || ' — parcela ' || n || '/' || p_num_parcelas,
      v_valor, public.crediario_hoje(), 'pendente', v_venc)
    RETURNING id INTO v_lancamento_id;

    INSERT INTO crediario_parcelas (user_id, contrato_id, numero, vencimento, valor, lancamento_id)
    VALUES (v_empresa_id, v_contrato.id, n, v_venc, v_valor, v_lancamento_id);
  END LOOP;

  PERFORM public.crediario_log(v_contrato.id,
    'Contrato criado com ' || p_num_parcelas || ' parcela(s); termo de bloqueio aceito pelo cliente');

  RETURN v_contrato;
END;
$$;

-- Recebe uma parcela (pelo painel ou, no futuro, pelo webhook do Pix, que
-- roda sem auth.uid()). Cobra no mínimo o valor atualizado com multa e
-- juros, a não ser que a loja dispense os encargos explicitamente.
CREATE OR REPLACE FUNCTION public.registrar_pagamento_crediario(
  p_parcela_id UUID,
  p_valor NUMERIC,
  p_data DATE DEFAULT NULL,
  p_payment_method_id UUID DEFAULT NULL,
  p_dispensar_encargos BOOLEAN DEFAULT false,
  p_pix_txid TEXT DEFAULT NULL
)
RETURNS public.crediario_parcelas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parcela crediario_parcelas%ROWTYPE;
  c crediario_contratos%ROWTYPE;
  v_data DATE := coalesce(p_data, public.crediario_hoje());
  v_devido NUMERIC;
  v_minimo NUMERIC;
BEGIN
  SELECT * INTO v_parcela FROM crediario_parcelas WHERE id = p_parcela_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parcela não encontrada.';
  END IF;
  IF auth.uid() IS NOT NULL
     AND NOT public.has_permission(v_parcela.user_id, 'crediario', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar o crediário.';
  END IF;
  IF v_parcela.status = 'paga' THEN
    RAISE EXCEPTION 'Esta parcela já foi paga.';
  END IF;
  IF v_parcela.status = 'cancelada' THEN
    RAISE EXCEPTION 'Esta parcela foi cancelada.';
  END IF;
  IF v_data > public.crediario_hoje() THEN
    RAISE EXCEPTION 'A data do pagamento não pode ser no futuro.';
  END IF;
  IF p_payment_method_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM payment_methods WHERE id = p_payment_method_id AND user_id = v_parcela.user_id
  ) THEN
    RAISE EXCEPTION 'Forma de pagamento inválida.';
  END IF;

  SELECT * INTO c FROM crediario_contratos WHERE id = v_parcela.contrato_id;

  v_devido := public.crediario_valor_atualizado(
    v_parcela.valor, v_parcela.vencimento, c.multa_pct, c.juros_mes_pct, v_data);
  v_minimo := CASE WHEN p_dispensar_encargos THEN v_parcela.valor ELSE v_devido END;
  IF p_valor IS NULL OR p_valor < v_minimo - 0.01 THEN
    RAISE EXCEPTION 'Valor menor que o devido (R$ %).', v_minimo;
  END IF;

  UPDATE crediario_parcelas SET
    status = 'paga',
    pago_em = v_data,
    valor_pago = p_valor,
    payment_method_id = p_payment_method_id,
    pix_txid = p_pix_txid,
    recebido_por = auth.uid()
  WHERE id = p_parcela_id
  RETURNING * INTO v_parcela;

  UPDATE lancamentos SET
    status = 'pago',
    data = v_data,
    valor = p_valor,
    payment_method_id = coalesce(p_payment_method_id, payment_method_id)
  WHERE id = v_parcela.lancamento_id;

  PERFORM public.crediario_log(c.id,
    'Parcela ' || v_parcela.numero || '/' || c.num_parcelas || ' paga'
    || CASE WHEN p_valor > v_parcela.valor + 0.01 THEN ' com multa/juros' ELSE '' END
    || CASE WHEN p_dispensar_encargos AND v_devido > v_parcela.valor + 0.01
            THEN ' (encargos dispensados)' ELSE '' END
    || coalesce(' via Pix ' || p_pix_txid, ''));

  PERFORM public.crediario_recalcular(c.id);
  RETURN v_parcela;
END;
$$;

-- Bloqueio/liberação manual. Liberar com atraso em aberto vale até
-- p_liberar_ate (padrão: só hoje); depois disso a rotina volta a bloquear.
CREATE OR REPLACE FUNCTION public.alterar_bloqueio_crediario(
  p_contrato_id UUID,
  p_bloquear BOOLEAN,
  p_motivo TEXT,
  p_liberar_ate DATE DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c crediario_contratos%ROWTYPE;
  v_ate DATE := coalesce(p_liberar_ate, public.crediario_hoje());
BEGIN
  SELECT * INTO c FROM crediario_contratos WHERE id = p_contrato_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato não encontrado.';
  END IF;
  IF NOT public.has_permission(c.user_id, 'crediario', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar o crediário.';
  END IF;
  IF c.status IN ('quitado', 'cancelado') THEN
    RAISE EXCEPTION 'Contrato encerrado: o aparelho não tem mais proteção.';
  END IF;
  IF length(trim(coalesce(p_motivo, ''))) < 3 THEN
    RAISE EXCEPTION 'Informe o motivo.';
  END IF;

  IF p_bloquear THEN
    UPDATE crediario_contratos SET bloqueio_manual = true, liberado_ate = NULL WHERE id = c.id;
    PERFORM public.crediario_log(c.id, 'Bloqueio manual: ' || trim(p_motivo));
  ELSE
    IF v_ate < public.crediario_hoje() THEN
      RAISE EXCEPTION 'A data de liberação não pode ser no passado.';
    END IF;
    UPDATE crediario_contratos SET bloqueio_manual = false, liberado_ate = v_ate WHERE id = c.id;
    PERFORM public.crediario_log(c.id,
      'Liberação manual até ' || to_char(v_ate, 'DD/MM/YYYY') || ': ' || trim(p_motivo));
  END IF;

  PERFORM public.crediario_recalcular(c.id);
END;
$$;

-- Cancela o contrato (ex.: aparelho devolvido). Parcelas pagas continuam
-- pagas; as em aberto e seus lançamentos são cancelados. Remove a proteção.
CREATE OR REPLACE FUNCTION public.cancelar_contrato_crediario(p_contrato_id UUID, p_motivo TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c crediario_contratos%ROWTYPE;
BEGIN
  SELECT * INTO c FROM crediario_contratos WHERE id = p_contrato_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato não encontrado.';
  END IF;
  IF NOT public.has_permission(c.user_id, 'crediario', 'gerenciar') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar o crediário.';
  END IF;
  IF c.status IN ('quitado', 'cancelado') THEN
    RAISE EXCEPTION 'Este contrato já está encerrado.';
  END IF;
  IF length(trim(coalesce(p_motivo, ''))) < 3 THEN
    RAISE EXCEPTION 'Informe o motivo do cancelamento.';
  END IF;

  UPDATE lancamentos SET status = 'cancelado'
  WHERE id IN (
    SELECT lancamento_id FROM crediario_parcelas
    WHERE contrato_id = c.id AND status IN ('aberta', 'atrasada')
  );
  UPDATE crediario_parcelas SET status = 'cancelada'
  WHERE contrato_id = c.id AND status IN ('aberta', 'atrasada');

  UPDATE crediario_contratos
     SET status = 'cancelado', status_aparelho = 'removido',
         bloqueio_manual = false, liberado_ate = NULL
   WHERE id = c.id;
  PERFORM public.crediario_enfileirar(c.id, 'remover_protecao', 'Contrato cancelado');
  PERFORM public.crediario_log(c.id, 'Contrato cancelado: ' || trim(p_motivo));
END;
$$;

-- Rotina de inadimplência: marca atrasos, bloqueia/libera e enfileira o
-- aviso do dia do vencimento. Roda de hora em hora pelo pg_cron (sem
-- auth.uid(), todas as empresas) e também quando a tela do Crediário abre
-- (só a empresa de quem está logado), para não depender só do agendamento.
CREATE OR REPLACE FUNCTION public.processar_inadimplencia_crediario(p_empresa_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoje DATE := public.crediario_hoje();
  v_qtd INT := 0;
  r RECORD;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF p_empresa_id IS NULL OR NOT public.has_permission(p_empresa_id, 'crediario', 'ver') THEN
      RAISE EXCEPTION 'Sem permissão para o crediário.';
    END IF;
  END IF;

  FOR r IN
    SELECT c.id FROM crediario_contratos c
    WHERE c.status IN ('ativo', 'atrasado', 'bloqueado')
      AND (p_empresa_id IS NULL OR c.user_id = p_empresa_id)
      AND (c.status <> 'ativo' OR c.bloqueio_manual OR EXISTS (
        SELECT 1 FROM crediario_parcelas p
        WHERE p.contrato_id = c.id AND p.status = 'aberta' AND p.vencimento < v_hoje
      ))
  LOOP
    PERFORM public.crediario_recalcular(r.id);
    v_qtd := v_qtd + 1;
  END LOOP;

  FOR r IN
    SELECT p.id, p.contrato_id, p.numero, p.valor, c.num_parcelas
    FROM crediario_parcelas p
    JOIN crediario_contratos c ON c.id = p.contrato_id
    WHERE p.status = 'aberta' AND p.vencimento = v_hoje
      AND c.status IN ('ativo', 'atrasado', 'bloqueado')
      AND (p_empresa_id IS NULL OR p.user_id = p_empresa_id)
      AND NOT EXISTS (
        SELECT 1 FROM crediario_comandos k
        WHERE k.contrato_id = p.contrato_id AND k.tipo = 'mensagem'
          AND k.payload->>'parcela_id' = p.id::text
      )
  LOOP
    PERFORM public.crediario_enfileirar(r.contrato_id, 'mensagem', 'Aviso de vencimento',
      jsonb_build_object(
        'parcela_id', r.id,
        'texto', 'Sua parcela ' || r.numero || '/' || r.num_parcelas
          || ' vence hoje. Pague para evitar o bloqueio do aparelho.'
      ));
  END LOOP;

  RETURN v_qtd;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.criar_contrato_crediario(UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INT, DATE, BOOLEAN, NUMERIC, NUMERIC, NUMERIC, INT, UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.registrar_pagamento_crediario(UUID, NUMERIC, DATE, UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.alterar_bloqueio_crediario(UUID, BOOLEAN, TEXT, DATE) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancelar_contrato_crediario(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.processar_inadimplencia_crediario(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_contrato_crediario(UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INT, DATE, BOOLEAN, NUMERIC, NUMERIC, NUMERIC, INT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_pagamento_crediario(UUID, NUMERIC, DATE, UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.alterar_bloqueio_crediario(UUID, BOOLEAN, TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_contrato_crediario(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.processar_inadimplencia_crediario(UUID) TO authenticated;

-- ---------------------------------------------------------------------
-- Visões para a tela (security_invoker: respeitam o RLS das tabelas).
-- LEFT JOIN em clientes para quem vê o crediário mas não o cadastro de
-- clientes ainda enxergar o contrato (só sem o nome).
-- ---------------------------------------------------------------------
CREATE VIEW public.vw_crediario_contratos WITH (security_invoker = on) AS
SELECT c.*,
  cl.nome AS cliente_nome,
  cl.telefone AS cliente_telefone,
  count(p.id) FILTER (WHERE p.status = 'paga') AS parcelas_pagas,
  min(p.vencimento) FILTER (WHERE p.status IN ('aberta', 'atrasada')) AS proximo_vencimento,
  coalesce(sum(p.valor) FILTER (WHERE p.status IN ('aberta', 'atrasada')), 0) AS saldo_devedor,
  coalesce(sum(p.valor_pago) FILTER (WHERE p.status = 'paga'), 0) AS total_recebido,
  max(public.crediario_hoje() - p.vencimento) FILTER (WHERE p.status = 'atrasada') AS dias_atraso
FROM public.crediario_contratos c
LEFT JOIN public.clientes cl ON cl.id = c.cliente_id
LEFT JOIN public.crediario_parcelas p ON p.contrato_id = c.id
GROUP BY c.id, cl.id;

CREATE VIEW public.vw_crediario_parcelas WITH (security_invoker = on) AS
SELECT p.*,
  CASE WHEN p.status IN ('aberta', 'atrasada') THEN
    public.crediario_valor_atualizado(p.valor, p.vencimento, c.multa_pct, c.juros_mes_pct, public.crediario_hoje())
  END AS valor_atualizado,
  CASE WHEN p.status = 'atrasada' THEN public.crediario_hoje() - p.vencimento END AS dias_atraso
FROM public.crediario_parcelas p
JOIN public.crediario_contratos c ON c.id = p.contrato_id;

GRANT SELECT ON public.vw_crediario_contratos, public.vw_crediario_parcelas TO authenticated;
GRANT SELECT ON public.vw_crediario_contratos, public.vw_crediario_parcelas TO service_role;

-- ---------------------------------------------------------------------
-- Agendamento: de hora em hora (minuto 5).
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
SELECT cron.schedule(
  'crediario-inadimplencia',
  '5 * * * *',
  $$SELECT public.processar_inadimplencia_crediario()$$
);
