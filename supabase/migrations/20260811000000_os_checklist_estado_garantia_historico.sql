-- Real gaps found in an audit of the OS module against the full spec:
-- no functional entry checklist (liga/desliga/tela/touch/...), no physical
-- condition assessment, no per-OS warranty expiry (only a fixed 90-day hack
-- computed client-side off "previsao"), and no audit trail/timeline at all.
-- This migration adds all four, reusing the has_permission('ordens', ...)
-- RLS pattern already used for every other ordens_servico satellite table.

ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS checklist_entrada JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS estado_fisico JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS estado_fisico_obs TEXT,
  ADD COLUMN IF NOT EXISTS data_entrega TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS garantia_dias INTEGER;

-- Vencimento only makes sense once the device was actually handed back —
-- warranty on a repair starts at delivery, not at OS creation — so it's
-- NULL (shown as "—") until data_entrega is set. Kept as a plain column
-- (not GENERATED ALWAYS AS) because casting timestamptz->date depends on
-- the session TimeZone GUC, which Postgres refuses to treat as immutable;
-- the BEFORE INSERT/UPDATE triggers below keep it in sync instead.
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS garantia_vencimento DATE;

-- Immutable audit trail: every row is an event, nothing is ever updated or
-- deleted (no UPDATE/DELETE grant), matching how "histórico" is described
-- in the spec — a timeline, not an editable log.
CREATE TABLE public.os_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  os_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  evento TEXT NOT NULL,
  descricao TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON public.os_historico (os_id, created_at);
CREATE INDEX ON public.os_historico (user_id);

GRANT SELECT, INSERT ON public.os_historico TO authenticated;
GRANT ALL ON public.os_historico TO service_role;

ALTER TABLE public.os_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "os_historico ver" ON public.os_historico FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'ordens', 'ver'));
CREATE POLICY "os_historico inserir" ON public.os_historico FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(user_id, 'ordens', 'gerenciar'));

-- Defaults garantia_dias from the company's os_config on creation (when the
-- form didn't set one explicitly) and logs "OS criada".
CREATE OR REPLACE FUNCTION public.os_historico_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.garantia_dias IS NULL THEN
    SELECT dias_garantia_padrao INTO NEW.garantia_dias
      FROM os_config WHERE user_id = NEW.user_id;
  END IF;

  IF NEW.data_entrega IS NOT NULL AND NEW.garantia_dias IS NOT NULL THEN
    NEW.garantia_vencimento := NEW.data_entrega::date + NEW.garantia_dias;
  END IF;

  INSERT INTO os_historico (user_id, os_id, evento, descricao, created_by)
    VALUES (NEW.user_id, NEW.id, 'criacao', 'OS criada', auth.uid());

  RETURN NEW;
END;
$$;

CREATE TRIGGER os_historico_on_insert
  BEFORE INSERT ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.os_historico_on_insert();

-- Auto-stamps data_entrega the first time status flips to 'entregue', and
-- logs the meaningful, discrete changes a user actually made — not a diff
-- of every column, which would be noisy given the edit screen rewrites
-- valor/status/status_pagamento on every "Salvar" regardless of whether
-- they changed.
CREATE OR REPLACE FUNCTION public.os_historico_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'entregue' AND OLD.status <> 'entregue' AND NEW.data_entrega IS NULL THEN
    NEW.data_entrega := now();
  END IF;

  IF NEW.data_entrega IS NOT NULL AND NEW.garantia_dias IS NOT NULL THEN
    NEW.garantia_vencimento := NEW.data_entrega::date + NEW.garantia_dias;
  ELSE
    NEW.garantia_vencimento := NULL;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO os_historico (user_id, os_id, evento, descricao, created_by)
      VALUES (NEW.user_id, NEW.id, 'status',
        'Status alterado de "' || OLD.status || '" para "' || NEW.status || '"', auth.uid());
  END IF;

  IF NEW.valor IS DISTINCT FROM OLD.valor THEN
    INSERT INTO os_historico (user_id, os_id, evento, descricao, created_by)
      VALUES (NEW.user_id, NEW.id, 'valor',
        'Valor da OS alterado de ' || OLD.valor || ' para ' || NEW.valor, auth.uid());
  END IF;

  IF NEW.status_pagamento IS DISTINCT FROM OLD.status_pagamento THEN
    INSERT INTO os_historico (user_id, os_id, evento, descricao, created_by)
      VALUES (NEW.user_id, NEW.id, 'pagamento',
        'Situação de pagamento alterada para "' || NEW.status_pagamento || '"', auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER os_historico_on_update
  BEFORE UPDATE ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.os_historico_on_update();
