-- Finalização de seminovos: depois que o técnico conserta o aparelho, o dono
-- da empresa (ou um admin) faz a avaliação final antes de liberar para venda.
--
-- Fluxo: pendente (conserto) -> aguardando_finalizacao (conserto concluído)
--        -> Finalizar avaliação: aprovado -> disponivel | reprovado -> pendente
--
-- A regra vale no banco, não só na tela: só o dono/admin coloca em
-- "disponivel" um aparelho que vem de pendente/aguardando/sucata/sem solução
-- (ou que é cadastrado já disponível). Vendido -> disponivel (venda
-- cancelada) e devolvido -> disponivel ("Avaliar retorno") ficam como antes.

ALTER TABLE public.seminovos DROP CONSTRAINT seminovos_status_check;
ALTER TABLE public.seminovos ADD CONSTRAINT seminovos_status_check
  CHECK (status IN ('pendente', 'aguardando_finalizacao', 'disponivel', 'vendido',
                    'devolvido', 'sucata', 'sem_solucao'));

ALTER TABLE public.seminovos
  ADD COLUMN IF NOT EXISTS finalizado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finalizado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS finalizacao_checklist JSONB,
  ADD COLUMN IF NOT EXISTS finalizacao_observacao TEXT;

-- Dono da empresa ou membro com papel admin. Sem auth.uid() (service_role,
-- scripts de manutenção) também pode.
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
      WHERE ue.user_id = auth.uid() AND ue.empresa_id = p_empresa_id AND ue.role = 'admin'
    )
$$;

GRANT EXECUTE ON FUNCTION public.pode_finalizar_seminovo(UUID) TO authenticated;

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
      RAISE EXCEPTION 'Somente o dono da empresa ou um administrador pode finalizar a avaliação e liberar o aparelho para venda.';
    END IF;
    NEW.finalizado_em := now();
    NEW.finalizado_por := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seminovos_exigir_finalizacao ON public.seminovos;
CREATE TRIGGER seminovos_exigir_finalizacao
  BEFORE INSERT OR UPDATE OF status ON public.seminovos
  FOR EACH ROW EXECUTE FUNCTION public.seminovos_exigir_finalizacao();
