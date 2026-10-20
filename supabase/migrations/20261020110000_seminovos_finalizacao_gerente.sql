-- Gerente também pode finalizar a avaliação de seminovos e liberar para venda
-- (antes: só dono da empresa e admin).
CREATE OR REPLACE FUNCTION public.pode_finalizar_seminovo(p_empresa_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NULL
    OR p_empresa_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_empresas ue
      WHERE ue.user_id = auth.uid() AND ue.empresa_id = p_empresa_id
        AND ue.role IN ('admin', 'gerente')
    )
$$;

CREATE OR REPLACE FUNCTION public.seminovos_exigir_finalizacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'disponivel'
     AND (TG_OP = 'INSERT' OR OLD.status NOT IN ('disponivel', 'vendido', 'devolvido')) THEN
    IF NOT public.pode_finalizar_seminovo(NEW.user_id) THEN
      RAISE EXCEPTION 'Somente o dono da empresa, um administrador ou um gerente pode finalizar a avaliação e liberar o aparelho para venda.';
    END IF;
    NEW.finalizado_em := now();
    NEW.finalizado_por := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;
