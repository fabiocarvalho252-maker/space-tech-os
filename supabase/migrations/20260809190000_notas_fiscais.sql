-- Notas Fiscais: internal control records (número/série/status/valores) for
-- sales and service orders. NOT a real NF-e/NFS-e emission — no SEFAZ or
-- certificate integration exists yet (see AGENTS.md §22: prepare the data
-- model/architecture only, never fake fiscal integration). "Emitida" here
-- just means the store finalized the internal record.
CREATE TABLE public.notas_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero SERIAL,
  serie TEXT NOT NULL DEFAULT '1',
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  venda_id UUID REFERENCES public.vendas(id) ON DELETE SET NULL,
  os_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'emitida', 'cancelada')),
  valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  chave_acesso TEXT,
  observacoes TEXT,
  emitida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.nota_fiscal_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nota_id UUID NOT NULL REFERENCES public.notas_fiscais(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  quantidade NUMERIC(12,3) NOT NULL DEFAULT 1,
  valor_unitario NUMERIC(12,2) NOT NULL DEFAULT 0
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notas_fiscais TO authenticated;
GRANT ALL ON public.notas_fiscais TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nota_fiscal_itens TO authenticated;
GRANT ALL ON public.nota_fiscal_itens TO service_role;

ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notas_fiscais ver" ON public.notas_fiscais FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'notas', 'ver'));
CREATE POLICY "notas_fiscais gerenciar" ON public.notas_fiscais FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'notas', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'notas', 'gerenciar'));

ALTER TABLE public.nota_fiscal_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nota_fiscal_itens ver" ON public.nota_fiscal_itens FOR SELECT TO authenticated
  USING (public.has_permission(user_id, 'notas', 'ver'));
CREATE POLICY "nota_fiscal_itens gerenciar" ON public.nota_fiscal_itens FOR ALL TO authenticated
  USING (public.has_permission(user_id, 'notas', 'gerenciar'))
  WITH CHECK (public.has_permission(user_id, 'notas', 'gerenciar'));

CREATE TRIGGER notas_fiscais_updated BEFORE UPDATE ON public.notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Register "notas" as a permission module, same shape as the relatorios
-- rollout in 20260809150000_relatorios_modulo.sql.
ALTER TABLE public.role_permissions DROP CONSTRAINT role_permissions_modulo_check;
ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_modulo_check
  CHECK (modulo IN (
    'clientes', 'fornecedores', 'produtos', 'ordens', 'vendas', 'compras',
    'financeiro', 'cobrancas', 'garantia', 'configuracoes', 'agenda',
    'seminovos', 'relatorios', 'notas'
  ));

-- Seed default notas permissions for every existing company + role. Notes
-- are issued by whoever closes a sale/OS, so admin/gerente/atendente manage
-- them; financeiro can view for accounting; tecnico has no need for it.
INSERT INTO public.role_permissions (empresa_id, role, modulo, pode_ver, pode_gerenciar)
SELECT DISTINCT empresa_id, role, 'notas',
  role IN ('admin', 'gerente', 'atendente', 'financeiro'),
  role IN ('admin', 'gerente', 'atendente')
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
      WHEN r.role = 'atendente' THEN m.modulo IN ('ordens', 'clientes', 'produtos', 'vendas', 'garantia', 'cobrancas', 'agenda', 'seminovos', 'notas')
      WHEN r.role = 'financeiro' THEN m.modulo IN ('financeiro', 'cobrancas', 'vendas', 'compras', 'clientes', 'seminovos', 'relatorios', 'notas')
    END,
    CASE
      WHEN r.role = 'admin' THEN true
      WHEN r.role = 'gerente' THEN m.modulo <> 'configuracoes'
      WHEN r.role = 'tecnico' THEN m.modulo IN ('ordens', 'agenda')
      WHEN r.role = 'atendente' THEN m.modulo IN ('ordens', 'clientes', 'vendas', 'agenda', 'seminovos', 'notas')
      WHEN r.role = 'financeiro' THEN m.modulo IN ('financeiro', 'cobrancas', 'seminovos', 'relatorios')
    END
  FROM (VALUES ('admin'), ('gerente'), ('tecnico'), ('atendente'), ('financeiro')) AS r(role)
  CROSS JOIN (VALUES
    ('clientes'), ('fornecedores'), ('produtos'), ('ordens'), ('vendas'),
    ('compras'), ('financeiro'), ('cobrancas'), ('garantia'), ('configuracoes'),
    ('agenda'), ('seminovos'), ('relatorios'), ('notas')
  ) AS m(modulo)
  ON CONFLICT (empresa_id, role, modulo) DO NOTHING;
  RETURN NEW;
END;
$$;
