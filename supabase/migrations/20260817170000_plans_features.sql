-- Plan tiers (Básico/Profissional) as a second axis alongside
-- profiles.plano, which is only the billing cycle ("mensal"/"anual"/...) —
-- access on/off, not which modules are visible. Prices start NULL on
-- purpose: NULL means "not configured yet", distinct from 0 (which would
-- mean a free plan) — the site admin fills these in later from /admin,
-- never invented here.
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  monthly_price numeric(12,2),
  annual_price numeric(12,2),
  annual_discount_pct numeric(5,2),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plan_features (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  feature text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (plan_id, feature)
);

alter table public.profiles
  add column plan_id uuid references public.plans(id);

-- Plans/plan_features are platform-wide catalog data (not per-empresa),
-- read by every authenticated account to check its own features and to
-- render the public /planos comparison page. Writes only ever happen
-- through site-admin.functions.ts's supabaseAdmin client (service role,
-- gated by checarSiteAdmin()) — same pattern as every other site-admin-only
-- table — so there's no insert/update/delete policy here; RLS defaults deny.
alter table public.plans enable row level security;
alter table public.plan_features enable row level security;

create policy "plans: leitura para autenticados"
  on public.plans for select
  to authenticated
  using (true);

create policy "plan_features: leitura para autenticados"
  on public.plan_features for select
  to authenticated
  using (true);

create trigger plans_updated
  before update on public.plans
  for each row execute function public.update_updated_at_column();

insert into public.plans (slug, name, description, sort_order) values
  ('basico', 'Básico', 'Gestão completa da assistência técnica: clientes, produtos, vendas, PDV, ordens de serviço e financeiro.', 1),
  ('profissional', 'Profissional', 'Tudo do Básico, mais Nota Fiscal, IA avançada e relatórios avançados.', 2);

insert into public.plan_features (plan_id, feature)
select p.id, f.feature
from public.plans p
cross join (values
  ('CLIENTES'), ('FORNECEDORES'), ('PRODUTOS'), ('SERVICOS'), ('ESTOQUE'),
  ('VENDAS'), ('PDV'), ('ORDENS_SERVICO'), ('FINANCEIRO'), ('CONTAS_RECEBER'),
  ('CONTAS_PAGAR'), ('CAIXA'), ('DRE'), ('RELATORIOS_BASICOS'), ('WHATSAPP'),
  ('IA_BASICA')
) as f(feature)
where p.slug = 'basico';

insert into public.plan_features (plan_id, feature)
select p.id, f.feature
from public.plans p
cross join (values
  ('CLIENTES'), ('FORNECEDORES'), ('PRODUTOS'), ('SERVICOS'), ('ESTOQUE'),
  ('VENDAS'), ('PDV'), ('ORDENS_SERVICO'), ('FINANCEIRO'), ('CONTAS_RECEBER'),
  ('CONTAS_PAGAR'), ('CAIXA'), ('DRE'), ('RELATORIOS_BASICOS'), ('WHATSAPP'),
  ('IA_BASICA'), ('NOTA_FISCAL'), ('IA_PROFISSIONAL'), ('IA_OS'),
  ('IA_FINANCEIRA'), ('IA_VENDAS'), ('IA_ESTOQUE'), ('RELATORIOS_AVANCADOS')
) as f(feature)
where p.slug = 'profissional';

-- Toda empresa existente começa no Básico até o admin decidir mudar.
update public.profiles
set plan_id = (select id from public.plans where slug = 'basico')
where plan_id is null;
