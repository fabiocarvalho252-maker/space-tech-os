-- Área do Cliente: lets an end customer log in (their own Supabase Auth
-- account, same mechanism as every other login in this app) and see their
-- own data — nothing like this existed before: `clientes.user_id` is the
-- *empresa* (owner) id, not the customer's own login, and every existing
-- RLS policy only grants access to staff via has_permission()/empresa_role().
--
-- This migration adds the missing link (clientes.auth_user_id) and a
-- parallel set of read-only policies for the customer role, additive to
-- (never replacing) the existing staff policies.

-- 1) The link between a clientes row and the customer's own login.
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2) handle_new_user() provisions a `profiles` row (i.e. turns the new
-- account into an "empresa") for every new auth.users row — correct for
-- the existing empresa signup at /cadastro, wrong for a customer signing
-- up for /minha-conta. The customer signup flow tags itself via
-- raw_user_meta_data.account_type = 'cliente'; skip profile provisioning
-- for those so a customer never becomes a phantom empresa (which would
-- otherwise show up in the site-admin company list and let them into the
-- empty staff shell at /dashboard).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'account_type' = 'cliente' THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.profiles (id, nome, loja)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'loja')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3) Helper: the clientes.id row belonging to the currently authenticated
-- customer, or NULL if this session isn't a linked customer. Mirrors the
-- existing has_permission()/empresa_role() helper style.
CREATE OR REPLACE FUNCTION public.meu_cliente_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.clientes WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- 4) Read-only customer policies — additive alongside the existing staff
-- "ver"/"gerenciar" policies (Postgres OR's permissive policies together),
-- so staff access is completely unchanged. A customer can only ever reach
-- rows that chain back to their own linked clientes.id; cliente_id sent by
-- a browser is never trusted for this — meu_cliente_id() is resolved
-- server-side from the verified session on every check.

CREATE POLICY "clientes cliente ve proprio registro" ON public.clientes FOR SELECT TO authenticated
  USING (id = public.meu_cliente_id());

CREATE POLICY "vendas cliente ve proprias" ON public.vendas FOR SELECT TO authenticated
  USING (cliente_id = public.meu_cliente_id());

CREATE POLICY "venda_itens cliente ve proprios" ON public.venda_itens FOR SELECT TO authenticated
  USING (venda_id IN (SELECT id FROM public.vendas WHERE cliente_id = public.meu_cliente_id()));

CREATE POLICY "ordens_servico cliente ve proprias" ON public.ordens_servico FOR SELECT TO authenticated
  USING (cliente_id = public.meu_cliente_id());

CREATE POLICY "os_itens cliente ve proprios" ON public.os_itens FOR SELECT TO authenticated
  USING (os_id IN (SELECT id FROM public.ordens_servico WHERE cliente_id = public.meu_cliente_id()));

CREATE POLICY "service_order_photos cliente ve proprias" ON public.service_order_photos FOR SELECT TO authenticated
  USING (service_order_id IN (SELECT id FROM public.ordens_servico WHERE cliente_id = public.meu_cliente_id()));

-- Store contact info (for the account area's footer/header) — scoped to
-- just the one empresa this customer actually belongs to, never every
-- company's profile.
CREATE POLICY "profiles cliente ve sua loja" ON public.profiles FOR SELECT TO authenticated
  USING (id IN (SELECT user_id FROM public.clientes WHERE auth_user_id = auth.uid()));
