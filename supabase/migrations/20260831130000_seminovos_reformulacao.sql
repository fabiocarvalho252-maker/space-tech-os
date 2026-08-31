-- Reformulação do módulo "Compra de Seminovos" (pedido do usuário): a tabela
-- `seminovos` só cobria a etapa de avaliação/compra (marca, modelo, valor
-- oferecido/pago). O pedido cobre o ciclo completo até a revenda —
-- conserto, custo total, preço para cliente/lojista, lucro mínimo/previsto,
-- status de estoque e integração com o fluxo de venda já existente
-- (`vendas`/`venda_itens`/`lancamentos`, mesma receita usada em vendas.tsx
-- e compras.tsx: inserts diretos do client, sem RPC nova) — sem tocar na
-- tabela/telas de "aparelhos" (módulo separado, fora de escopo).
--
-- Tabela tinha 0 linhas em produção neste momento (checado antes de migrar),
-- então o remapeamento de status abaixo é apenas defensivo para outros
-- ambientes, não uma migração de dados real.

ALTER TABLE public.seminovos
  ADD COLUMN IF NOT EXISTS valor_conserto NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outros_custos NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preco_venda NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS preco_lojista NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS venda_id UUID REFERENCES public.vendas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS devolucao_motivo TEXT,
  ADD COLUMN IF NOT EXISTS devolucao_data TIMESTAMPTZ;

ALTER TABLE public.seminovos
  ADD CONSTRAINT seminovos_valor_conserto_check CHECK (valor_conserto >= 0),
  ADD CONSTRAINT seminovos_outros_custos_check CHECK (outros_custos >= 0),
  ADD CONSTRAINT seminovos_preco_venda_check CHECK (preco_venda IS NULL OR preco_venda >= 0),
  ADD CONSTRAINT seminovos_preco_lojista_check CHECK (preco_lojista IS NULL OR preco_lojista >= 0),
  ADD CONSTRAINT seminovos_valor_pago_check CHECK (valor_pago IS NULL OR valor_pago >= 0),
  ADD CONSTRAINT seminovos_valor_oferecido_check CHECK (valor_oferecido IS NULL OR valor_oferecido >= 0);

-- Custo total: sempre recalculado no banco (nunca confia em valor enviado
-- pelo navegador), soma o que foi pago ao vendedor + conserto + outros
-- custos eventuais.
ALTER TABLE public.seminovos
  ADD COLUMN IF NOT EXISTS valor_total_gasto NUMERIC(12,2)
    GENERATED ALWAYS AS (COALESCE(valor_pago, 0) + valor_conserto + outros_custos) STORED;

-- "Lucro mínimo" = cenário de repasse para lojista (pior caso realista);
-- "lucro previsto" = cenário de venda direta ao cliente final. Não existia
-- regra de precificação mínima prévia no sistema para reaproveitar, então
-- esta é a estrutura simples pedida na seção 12 do pedido, amarrada aos
-- dois preços de saída que o módulo já coleta.
ALTER TABLE public.seminovos
  ADD COLUMN IF NOT EXISTS lucro_minimo NUMERIC(12,2)
    GENERATED ALWAYS AS (
      COALESCE(preco_lojista, 0) - (COALESCE(valor_pago, 0) + valor_conserto + outros_custos)
    ) STORED,
  ADD COLUMN IF NOT EXISTS lucro_previsto NUMERIC(12,2)
    GENERATED ALWAYS AS (
      COALESCE(preco_venda, 0) - (COALESCE(valor_pago, 0) + valor_conserto + outros_custos)
    ) STORED;

-- Remapeia o vocabulário antigo de status para o novo antes de trocar a
-- constraint (defensivo — ver nota acima, não há linhas hoje).
UPDATE public.seminovos SET status = 'pendente' WHERE status = 'em_avaliacao';
UPDATE public.seminovos SET status = 'disponivel' WHERE status IN ('aprovado', 'comprado');
UPDATE public.seminovos SET status = 'sem_solucao' WHERE status = 'recusado';

ALTER TABLE public.seminovos DROP CONSTRAINT seminovos_status_check;
ALTER TABLE public.seminovos ALTER COLUMN status SET DEFAULT 'pendente';
ALTER TABLE public.seminovos ADD CONSTRAINT seminovos_status_check
  CHECK (status IN ('pendente', 'disponivel', 'vendido', 'devolvido', 'sucata', 'sem_solucao'));

CREATE INDEX IF NOT EXISTS seminovos_status_idx ON public.seminovos (user_id, status);

-- Histórico aditivo (linha do tempo), mesma receita de `os_historico`
-- (20260811000000_...sql): tabela append-only (só SELECT/INSERT concedidos)
-- com triggers BEFORE INSERT/UPDATE em `seminovos` que registram os eventos
-- automaticamente, sem depender do frontend lembrar de logar cada ação.
CREATE TABLE public.seminovos_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seminovo_id UUID NOT NULL REFERENCES public.seminovos(id) ON DELETE CASCADE,
  evento TEXT NOT NULL,
  descricao TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON public.seminovos_historico (seminovo_id, created_at);
CREATE INDEX ON public.seminovos_historico (user_id);

GRANT SELECT, INSERT ON public.seminovos_historico TO authenticated;
GRANT ALL ON public.seminovos_historico TO service_role;

ALTER TABLE public.seminovos_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seminovos_historico ver" ON public.seminovos_historico FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'seminovos', 'ver'));
CREATE POLICY "seminovos_historico inserir" ON public.seminovos_historico FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(user_id, 'seminovos', 'gerenciar'));

CREATE OR REPLACE FUNCTION public.seminovos_historico_on_insert()
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
        CASE WHEN NEW.valor_pago IS NOT NULL THEN ' — R$ ' || NEW.valor_pago ELSE '' END,
      auth.uid()
    );
  RETURN NEW;
END;
$$;

CREATE TRIGGER seminovos_historico_on_insert
  BEFORE INSERT ON public.seminovos
  FOR EACH ROW EXECUTE FUNCTION public.seminovos_historico_on_insert();

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

  IF NEW.valor_conserto IS DISTINCT FROM OLD.valor_conserto THEN
    INSERT INTO seminovos_historico (user_id, seminovo_id, evento, descricao, created_by)
      VALUES (NEW.user_id, NEW.id, 'conserto',
        'Custo de conserto alterado de R$ ' || OLD.valor_conserto || ' para R$ ' || NEW.valor_conserto,
        auth.uid());
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

  RETURN NEW;
END;
$$;

CREATE TRIGGER seminovos_historico_on_update
  BEFORE UPDATE ON public.seminovos
  FOR EACH ROW EXECUTE FUNCTION public.seminovos_historico_on_update();
