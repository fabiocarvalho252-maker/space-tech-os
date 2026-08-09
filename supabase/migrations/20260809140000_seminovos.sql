-- Add "seminovos" as a permission module (same permission-matrix system used
-- by every other module — see 20260809110100_role_permissions.sql).
ALTER TABLE public.role_permissions DROP CONSTRAINT role_permissions_modulo_check;
ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_modulo_check
  CHECK (modulo IN (
    'clientes', 'fornecedores', 'produtos', 'ordens', 'vendas', 'compras',
    'financeiro', 'cobrancas', 'garantia', 'configuracoes', 'agenda', 'seminovos'
  ));

-- Seed default seminovos permissions for every existing company + role.
-- Same shape as "compras": everyone but "tecnico" can see/manage by default.
INSERT INTO public.role_permissions (empresa_id, role, modulo, pode_ver, pode_gerenciar)
SELECT DISTINCT empresa_id, role, 'seminovos',
  role <> 'tecnico',
  role <> 'tecnico'
FROM public.role_permissions
ON CONFLICT (empresa_id, role, modulo) DO NOTHING;

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
      WHEN r.role = 'tecnico' THEN m.modulo IN ('ordens', 'clientes', 'produtos', 'garantia', 'agenda')
      WHEN r.role = 'atendente' THEN m.modulo IN ('ordens', 'clientes', 'produtos', 'vendas', 'garantia', 'cobrancas', 'agenda', 'seminovos')
      WHEN r.role = 'financeiro' THEN m.modulo IN ('financeiro', 'cobrancas', 'vendas', 'compras', 'clientes', 'seminovos')
    END,
    CASE
      WHEN r.role = 'admin' THEN true
      WHEN r.role = 'gerente' THEN m.modulo <> 'configuracoes'
      WHEN r.role = 'tecnico' THEN m.modulo IN ('ordens', 'agenda')
      WHEN r.role = 'atendente' THEN m.modulo IN ('ordens', 'clientes', 'vendas', 'agenda', 'seminovos')
      WHEN r.role = 'financeiro' THEN m.modulo IN ('financeiro', 'cobrancas', 'seminovos')
    END
  FROM (VALUES ('admin'), ('gerente'), ('tecnico'), ('atendente'), ('financeiro')) AS r(role)
  CROSS JOIN (VALUES
    ('clientes'), ('fornecedores'), ('produtos'), ('ordens'), ('vendas'),
    ('compras'), ('financeiro'), ('cobrancas'), ('garantia'), ('configuracoes'),
    ('agenda'), ('seminovos')
  ) AS m(modulo)
  ON CONFLICT (empresa_id, role, modulo) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TABLE public.seminovos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  vendedor_nome TEXT,
  vendedor_telefone TEXT,
  marca TEXT NOT NULL,
  modelo TEXT NOT NULL,
  imei TEXT,
  armazenamento TEXT,
  ram TEXT,
  cor TEXT,
  estado TEXT,
  bateria_percentual INTEGER CHECK (bateria_percentual BETWEEN 0 AND 100),
  acessorios TEXT,
  observacoes TEXT,
  fotos TEXT[] NOT NULL DEFAULT '{}',
  valor_oferecido NUMERIC(12,2),
  valor_pago NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'em_avaliacao'
    CHECK (status IN ('em_avaliacao', 'aprovado', 'recusado', 'comprado', 'vendido')),
  data_avaliacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seminovos TO authenticated;
GRANT ALL ON public.seminovos TO service_role;
ALTER TABLE public.seminovos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seminovos ver" ON public.seminovos FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'seminovos', 'ver'));
CREATE POLICY "seminovos gerenciar" ON public.seminovos FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'seminovos', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'seminovos', 'gerenciar'));

CREATE TRIGGER seminovos_updated BEFORE UPDATE ON public.seminovos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Photo storage bucket, same convention as "os-fotos" (see
-- 20260808015726_...sql): private bucket, path prefixed by the owner's
-- auth.uid() so RLS on storage.objects can scope access per company.
INSERT INTO storage.buckets (id, name, public)
SELECT 'seminovos-fotos', 'seminovos-fotos', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'seminovos-fotos');

CREATE POLICY "seminovos fotos select own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'seminovos-fotos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "seminovos fotos insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'seminovos-fotos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "seminovos fotos delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'seminovos-fotos' AND auth.uid()::text = (storage.foldername(name))[1]);
