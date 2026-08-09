-- Per-company, per-role, per-module permission matrix. Two tiers: "ver" (read)
-- and "gerenciar" (create/update/delete). Configurable later from the Usuários
-- screen; seeded here with sensible defaults per role.
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'gerente', 'tecnico', 'atendente', 'financeiro')),
  modulo TEXT NOT NULL CHECK (modulo IN (
    'clientes', 'fornecedores', 'produtos', 'ordens', 'vendas',
    'compras', 'financeiro', 'cobrancas', 'garantia', 'configuracoes'
  )),
  pode_ver BOOLEAN NOT NULL DEFAULT false,
  pode_gerenciar BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, role, modulo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their company's permission matrix" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (empresa_id = auth.uid() OR public.empresa_role(empresa_id) IS NOT NULL);

CREATE POLICY "Owner manages the permission matrix" ON public.role_permissions
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = auth.uid());
CREATE POLICY "Owner updates the permission matrix" ON public.role_permissions
  FOR UPDATE TO authenticated
  USING (empresa_id = auth.uid())
  WITH CHECK (empresa_id = auth.uid());
CREATE POLICY "Owner deletes from the permission matrix" ON public.role_permissions
  FOR DELETE TO authenticated
  USING (empresa_id = auth.uid());

CREATE TRIGGER role_permissions_updated BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Central RLS check: does the caller have `p_acao` ('ver'|'gerenciar') on
-- `p_modulo` within the company owned by `p_empresa_id`? The owner always
-- has full access; everyone else is looked up via user_empresas + this matrix.
CREATE OR REPLACE FUNCTION public.has_permission(p_empresa_id UUID, p_modulo TEXT, p_acao TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_empresa_id = auth.uid() THEN true
    ELSE COALESCE((
      SELECT CASE p_acao
        WHEN 'ver' THEN rp.pode_ver
        WHEN 'gerenciar' THEN rp.pode_gerenciar
        ELSE false
      END
      FROM public.user_empresas ue
      JOIN public.role_permissions rp
        ON rp.empresa_id = ue.empresa_id AND rp.role = ue.role AND rp.modulo = p_modulo
      WHERE ue.user_id = auth.uid() AND ue.empresa_id = p_empresa_id
      LIMIT 1
    ), false)
  END
$$;

-- Seed a sensible default matrix for every existing company.
INSERT INTO public.role_permissions (empresa_id, role, modulo, pode_ver, pode_gerenciar)
SELECT p.id, r.role, m.modulo,
  CASE
    WHEN r.role = 'admin' THEN true
    WHEN r.role = 'gerente' THEN true
    WHEN r.role = 'tecnico' THEN m.modulo IN ('ordens', 'clientes', 'produtos', 'garantia')
    WHEN r.role = 'atendente' THEN m.modulo IN ('ordens', 'clientes', 'produtos', 'vendas', 'garantia', 'cobrancas')
    WHEN r.role = 'financeiro' THEN m.modulo IN ('financeiro', 'cobrancas', 'vendas', 'compras', 'clientes')
  END AS pode_ver,
  CASE
    WHEN r.role = 'admin' THEN true
    WHEN r.role = 'gerente' THEN m.modulo <> 'configuracoes'
    WHEN r.role = 'tecnico' THEN m.modulo = 'ordens'
    WHEN r.role = 'atendente' THEN m.modulo IN ('ordens', 'clientes', 'vendas')
    WHEN r.role = 'financeiro' THEN m.modulo IN ('financeiro', 'cobrancas')
  END AS pode_gerenciar
FROM public.profiles p
CROSS JOIN (VALUES ('admin'), ('gerente'), ('tecnico'), ('atendente'), ('financeiro')) AS r(role)
CROSS JOIN (VALUES
  ('clientes'), ('fornecedores'), ('produtos'), ('ordens'), ('vendas'),
  ('compras'), ('financeiro'), ('cobrancas'), ('garantia'), ('configuracoes')
) AS m(modulo)
ON CONFLICT (empresa_id, role, modulo) DO NOTHING;

-- Keep the matrix seeded for every future company too.
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
      WHEN r.role = 'tecnico' THEN m.modulo IN ('ordens', 'clientes', 'produtos', 'garantia')
      WHEN r.role = 'atendente' THEN m.modulo IN ('ordens', 'clientes', 'produtos', 'vendas', 'garantia', 'cobrancas')
      WHEN r.role = 'financeiro' THEN m.modulo IN ('financeiro', 'cobrancas', 'vendas', 'compras', 'clientes')
    END,
    CASE
      WHEN r.role = 'admin' THEN true
      WHEN r.role = 'gerente' THEN m.modulo <> 'configuracoes'
      WHEN r.role = 'tecnico' THEN m.modulo = 'ordens'
      WHEN r.role = 'atendente' THEN m.modulo IN ('ordens', 'clientes', 'vendas')
      WHEN r.role = 'financeiro' THEN m.modulo IN ('financeiro', 'cobrancas')
    END
  FROM (VALUES ('admin'), ('gerente'), ('tecnico'), ('atendente'), ('financeiro')) AS r(role)
  CROSS JOIN (VALUES
    ('clientes'), ('fornecedores'), ('produtos'), ('ordens'), ('vendas'),
    ('compras'), ('financeiro'), ('cobrancas'), ('garantia'), ('configuracoes')
  ) AS m(modulo)
  ON CONFLICT (empresa_id, role, modulo) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_profile_role_permissions ON public.profiles;
CREATE TRIGGER trg_new_profile_role_permissions
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_profile_role_permissions();
