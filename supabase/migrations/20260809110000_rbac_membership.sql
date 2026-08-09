-- RBAC: repurpose user_empresas as the canonical team-membership + role table.
-- Role vocabulary matches the (previously unused) user_roles.role CHECK values.
ALTER TABLE public.user_empresas ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.user_empresas ALTER COLUMN role TYPE TEXT USING role::text;
ALTER TABLE public.user_empresas ALTER COLUMN role SET DEFAULT 'atendente';
ALTER TABLE public.user_empresas
  ADD CONSTRAINT user_empresas_role_check CHECK (role IN ('admin', 'gerente', 'tecnico', 'atendente', 'financeiro'));

ALTER TABLE public.empresa_convites ALTER COLUMN permissao DROP DEFAULT;
ALTER TABLE public.empresa_convites ALTER COLUMN permissao TYPE TEXT USING permissao::text;
ALTER TABLE public.empresa_convites ALTER COLUMN permissao SET DEFAULT 'atendente';
ALTER TABLE public.empresa_convites
  ADD CONSTRAINT empresa_convites_permissao_check CHECK (permissao IN ('admin', 'gerente', 'tecnico', 'atendente', 'financeiro'));

-- Every company owner is implicitly an admin member of their own company.
INSERT INTO public.user_empresas (user_id, empresa_id, role)
SELECT id, id, 'admin' FROM public.profiles
ON CONFLICT (user_id, empresa_id) DO UPDATE SET role = 'admin';

CREATE OR REPLACE FUNCTION public.handle_new_profile_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_empresas (user_id, empresa_id, role)
  VALUES (NEW.id, NEW.id, 'admin')
  ON CONFLICT (user_id, empresa_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_profile_membership ON public.profiles;
CREATE TRIGGER trg_new_profile_membership
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_profile_membership();

-- Returns the caller's role within the given company ("empresa_id" = the
-- company owner's profiles.id, which is how every business table already
-- scopes its rows via its own user_id column). NULL if no membership.
CREATE OR REPLACE FUNCTION public.empresa_role(p_empresa_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_empresa_id = auth.uid() THEN 'admin'
    ELSE (
      SELECT role FROM public.user_empresas
      WHERE user_id = auth.uid() AND empresa_id = p_empresa_id
      LIMIT 1
    )
  END
$$;

-- Redeem an invite code: creates/updates the caller's membership in the
-- inviting company and marks the invite as used. Runs as SECURITY DEFINER
-- because a plain client INSERT into user_empresas is only allowed for the
-- company owner (see updated RLS below) — the invited user isn't the owner.
CREATE OR REPLACE FUNCTION public.aceitar_convite(p_codigo TEXT)
RETURNS public.user_empresas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_convite public.empresa_convites;
  v_membership public.user_empresas;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO v_convite FROM public.empresa_convites WHERE codigo = p_codigo FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite não encontrado';
  END IF;
  IF v_convite.usado_em IS NOT NULL THEN
    RAISE EXCEPTION 'Convite já utilizado';
  END IF;
  IF v_convite.expira_em < now() THEN
    RAISE EXCEPTION 'Convite expirado';
  END IF;
  IF v_convite.empresa_id = auth.uid() THEN
    RAISE EXCEPTION 'Você já é o administrador desta empresa';
  END IF;

  INSERT INTO public.user_empresas (user_id, empresa_id, role)
  VALUES (auth.uid(), v_convite.empresa_id, v_convite.permissao)
  ON CONFLICT (user_id, empresa_id) DO UPDATE SET role = EXCLUDED.role
  RETURNING * INTO v_membership;

  UPDATE public.empresa_convites SET usado_em = now(), usado_por = auth.uid() WHERE id = v_convite.id;

  RETURN v_membership;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aceitar_convite(TEXT) TO authenticated;

-- Client code can't query auth.users directly via PostgREST; this exposes
-- just enough (email) to render a member roster, gated by membership.
CREATE OR REPLACE FUNCTION public.get_empresa_membros(p_empresa_id UUID)
RETURNS TABLE (user_id UUID, email TEXT, role TEXT, created_at TIMESTAMPTZ)
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
    SELECT ue.user_id, au.email::TEXT, ue.role, ue.created_at
    FROM public.user_empresas ue
    JOIN auth.users au ON au.id = ue.user_id
    WHERE ue.empresa_id = p_empresa_id
    ORDER BY ue.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_empresa_membros(UUID) TO authenticated;

-- Invite codes are now redeemed through aceitar_convite() (SECURITY DEFINER,
-- bypasses RLS for its own lookup), so client code no longer needs blanket
-- SELECT access to look codes up itself — tighten the old "anyone" policy.
DROP POLICY IF EXISTS "Anyone can select a specific invitation to use it" ON public.empresa_convites;
CREATE POLICY "Members can see invites for their own record" ON public.empresa_convites
  FOR SELECT TO authenticated
  USING (usado_por = auth.uid());

-- Members can see who else shares a company with them (not just their own row).
DROP POLICY IF EXISTS "Users can see their own company connections" ON public.user_empresas;
CREATE POLICY "Members can see their company roster" ON public.user_empresas
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.empresa_role(empresa_id) IS NOT NULL);

DROP POLICY IF EXISTS "Admins can manage company connections" ON public.user_empresas;
CREATE POLICY "Owner manages company roster" ON public.user_empresas
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = auth.uid());
CREATE POLICY "Owner updates company roster" ON public.user_empresas
  FOR UPDATE TO authenticated
  USING (empresa_id = auth.uid())
  WITH CHECK (empresa_id = auth.uid());
CREATE POLICY "Owner removes from company roster" ON public.user_empresas
  FOR DELETE TO authenticated
  USING (empresa_id = auth.uid() AND user_id <> auth.uid());
