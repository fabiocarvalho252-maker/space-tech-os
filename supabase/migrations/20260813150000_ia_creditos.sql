-- Per-empresa credit balance for IA SPACE TECH (chat + geração de
-- diagnóstico/orçamento/etc). The Anthropic key behind it is a real, paid API
-- key now (see src/lib/ai/provider.server.ts) — new empresas start at 0
-- credits (IA off) and the site admin tops up credits for whoever asks,
-- instead of every empresa getting unmetered access by default.
ALTER TABLE public.profiles ADD COLUMN ia_creditos INTEGER NOT NULL DEFAULT 0;

-- Atomic decrement so two concurrent IA requests from the same empresa can't
-- both read a balance of 1 and each think they're allowed to spend it.
-- Returns false (and leaves the balance untouched) when there's nothing left.
CREATE OR REPLACE FUNCTION public.descontar_credito_ia(p_empresa_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  linhas_afetadas int;
BEGIN
  UPDATE public.profiles
  SET ia_creditos = ia_creditos - 1
  WHERE id = p_empresa_id AND ia_creditos > 0;
  GET DIAGNOSTICS linhas_afetadas = ROW_COUNT;
  RETURN linhas_afetadas > 0;
END;
$$;
