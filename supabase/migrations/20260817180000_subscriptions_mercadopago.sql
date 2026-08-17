-- Assinatura SaaS da própria SPACE TECH (empresa paga a plataforma) — não
-- confundir com pagamento_config/cobrancas, que é o Mercado Pago de CADA
-- EMPRESA CLIENTE para cobrar os clientes dela. Domínios financeiros
-- separados de propósito: nada aqui grava em lancamentos/cobrancas/vendas.
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  billing_cycle text not null check (billing_cycle in ('monthly', 'yearly')),
  status text not null default 'pending'
    check (status in ('trial', 'pending', 'active', 'past_due', 'canceled', 'expired', 'suspended')),
  mercado_pago_preapproval_id text unique,
  start_date timestamptz,
  next_billing_date timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  amount numeric(12,2) not null,
  payment_method text not null check (payment_method in ('pix', 'credit_card')),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'paid', 'failed', 'canceled', 'expired', 'refunded')),
  mercado_pago_payment_id text unique,
  external_reference text not null unique,
  paid_at timestamptz,
  expires_at timestamptz,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions(id) on delete set null,
  type text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index subscription_payments_subscription_id_idx on public.subscription_payments (subscription_id);
create index subscription_events_subscription_id_idx on public.subscription_events (subscription_id);

alter table public.subscriptions enable row level security;
alter table public.subscription_payments enable row level security;
alter table public.subscription_events enable row level security;

-- Leitura para a própria empresa (dono ou membro), mesmo critério de
-- "profiles ver". Nenhuma policy de insert/update/delete — todo write
-- passa por supabaseAdmin em subscription-service.ts/webhook-handler, nunca
-- pela sessão do usuário (o app não pode decidir seu próprio status de
-- pagamento).
create policy "subscriptions: leitura da própria empresa"
  on public.subscriptions for select
  to authenticated
  using (empresa_id = auth.uid() or empresa_role(empresa_id) is not null);

create policy "subscription_payments: leitura da própria empresa"
  on public.subscription_payments for select
  to authenticated
  using (
    subscription_id in (
      select id from public.subscriptions
      where empresa_id = auth.uid() or empresa_role(empresa_id) is not null
    )
  );

create policy "subscription_events: leitura da própria empresa"
  on public.subscription_events for select
  to authenticated
  using (
    subscription_id in (
      select id from public.subscriptions
      where empresa_id = auth.uid() or empresa_role(empresa_id) is not null
    )
  );

create trigger subscriptions_updated
  before update on public.subscriptions
  for each row execute function public.update_updated_at_column();

create trigger subscription_payments_updated
  before update on public.subscription_payments
  for each row execute function public.update_updated_at_column();
