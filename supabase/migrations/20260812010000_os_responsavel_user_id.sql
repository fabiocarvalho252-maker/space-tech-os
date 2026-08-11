-- Link the OS "técnico responsável" to a real team member instead of free text.
-- Keeps the existing `responsavel` TEXT column (still used by print templates,
-- WhatsApp messages, the client portal and AI tools as a denormalized display
-- name) and adds `responsavel_user_id` so the OS form can select from the
-- same roster of técnicos already used in faturamento.
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS responsavel_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- get_empresa_membros previously returned only e-mail, forcing técnico pickers
-- to show addresses instead of names. Add the profile nome so the OS form and
-- faturamento can display a proper name and fall back to e-mail only when
-- nome is empty.
-- CREATE OR REPLACE can't change a function's return type (new nome column),
-- so the old signature must be dropped first.
DROP FUNCTION IF EXISTS public.get_empresa_membros(UUID);

CREATE FUNCTION public.get_empresa_membros(p_empresa_id UUID)
RETURNS TABLE (user_id UUID, email TEXT, nome TEXT, role TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.empresa_role(p_empresa_id) IS NULL THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa';
  END IF;
  RETURN QUERY
    SELECT ue.user_id, au.email::TEXT, p.nome, ue.role, ue.created_at
    FROM public.user_empresas ue
    JOIN auth.users au ON au.id = ue.user_id
    LEFT JOIN public.profiles p ON p.id = ue.user_id
    WHERE ue.empresa_id = p_empresa_id
    ORDER BY ue.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_empresa_membros(UUID) TO authenticated;
