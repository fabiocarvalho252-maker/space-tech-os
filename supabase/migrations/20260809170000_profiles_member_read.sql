-- Company members (not just the owner) need to read the owner's profile row
-- — e.g. the trial gate in _authenticated/route.tsx resolves trial start
-- from the *company's* profiles.created_at, which an invited team member's
-- own auth.uid() doesn't otherwise have SELECT access to. Writes stay
-- owner-only (unchanged: "Users can update own profile").
DROP POLICY IF EXISTS "own profile" ON public.profiles;

CREATE POLICY "profiles ver" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.empresa_role(id) IS NOT NULL);
CREATE POLICY "profiles gerenciar" ON public.profiles FOR ALL TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
