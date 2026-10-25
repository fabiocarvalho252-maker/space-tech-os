-- Limite diário de uso da SPACE TECH IA por empresa (substitui os créditos).
-- A IA roda no Gemini gratuito, cuja cota é compartilhada por todas as
-- empresas; o limite diário evita que uma só esgote a cota das outras.
-- Usado por src/lib/ai/uso-diario.server.ts (só service_role).

CREATE TABLE IF NOT EXISTS public.ia_uso_diario (
  empresa_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dia DATE NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (empresa_id, dia)
);

ALTER TABLE public.ia_uso_diario ENABLE ROW LEVEL SECURITY;

-- Soma 1 uso no dia (horário de Brasília) se ainda couber no limite.
-- Devolve true quando o uso foi registrado, false quando o limite acabou.
CREATE OR REPLACE FUNCTION public.consumir_uso_ia(p_empresa UUID, p_limite INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_dia DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_ok BOOLEAN;
BEGIN
  INSERT INTO public.ia_uso_diario (empresa_id, dia, quantidade)
  VALUES (p_empresa, v_dia, 1)
  ON CONFLICT (empresa_id, dia) DO UPDATE
    SET quantidade = ia_uso_diario.quantidade + 1
    WHERE ia_uso_diario.quantidade < p_limite
  RETURNING true INTO v_ok;
  RETURN COALESCE(v_ok, false);
END;
$$;

-- Devolve o uso quando a IA não respondeu (provedor fora do ar etc.).
CREATE OR REPLACE FUNCTION public.devolver_uso_ia(p_empresa UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.ia_uso_diario
     SET quantidade = GREATEST(quantidade - 1, 0)
   WHERE empresa_id = p_empresa
     AND dia = (now() AT TIME ZONE 'America/Sao_Paulo')::date;
$$;

REVOKE EXECUTE ON FUNCTION public.consumir_uso_ia(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.devolver_uso_ia(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consumir_uso_ia(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.devolver_uso_ia(UUID) TO service_role;
