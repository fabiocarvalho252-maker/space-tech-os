-- Programa de Indicações (referrals) — Fase A: fundação.
--
-- "empresa" aqui é sempre profiles.id, o mesmo padrão já usado por
-- subscriptions/lancamentos/vendas/etc — não existe uma tabela
-- organizations separada neste projeto (ver empresa_role() em
-- 20260809110000_rbac_membership.sql), então "indicador"/"indicado" são
-- sempre uma linha de profiles, nunca um par usuário+organização
-- desacoplado.
--
-- Convenção de dinheiro idêntica a plans.monthly_price/annual_price: NULL
-- significa "ainda não configurado" — nunca 0. O programa nasce OFF e sem
-- nenhum valor preenchido; o admin (checarSiteAdmin, painel /admin) é quem
-- ativa e configura depois, sem precisar de deploy.

create table public.referral_program_config (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Programa de Indicações',
  active boolean not null default false,
  description text,
  commission_type text check (commission_type in ('FIXED', 'PERCENTAGE', 'PER_PLAN')),
  commission_value numeric(12,2),
  minimum_withdrawal numeric(12,2),
  pending_days int,
  recurring_commission boolean not null default false,
  first_payment_only boolean not null default true,
  whatsapp_share_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Linha única de configuração (mesmo padrão de fiscal_config/estoque_config/
-- whatsapp_config): a UI sempre faz update nesta única linha, nunca insert.
insert into public.referral_program_config (name, active, whatsapp_share_message)
values (
  'Programa de Indicações',
  false,
  'Conheça o SPACE TECH e teste a plataforma para sua empresa. Cadastre-se pelo meu link:' || E'\n' || '{LINK}'
);

create table public.referral_plan_rules (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  commission_type text not null check (commission_type in ('FIXED', 'PERCENTAGE')),
  commission_value numeric(12,2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id)
);

create table public.referral_profiles (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.profiles(id) on delete cascade,
  referral_code text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id),
  unique (referral_code)
);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_empresa_id uuid not null references public.profiles(id) on delete cascade,
  referred_empresa_id uuid references public.profiles(id) on delete set null,
  referral_code text not null,
  status text not null default 'registered'
    check (status in ('clicked', 'registered', 'pending', 'converted', 'rejected', 'canceled')),
  clicked_at timestamptz,
  registered_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (referrer_empresa_id is distinct from referred_empresa_id)
);

-- Uma empresa só pode ter sido indicada uma única vez na vida — a
-- indicação fica travada nesse valor assim que a conta é criada (Fase 10:
-- "não permitir alteração arbitrária depois da conversão").
create unique index referrals_referred_empresa_id_unique
  on public.referrals (referred_empresa_id)
  where referred_empresa_id is not null;

create index referrals_referrer_empresa_id_idx on public.referrals (referrer_empresa_id);
create index referrals_status_idx on public.referrals (status);

create table public.referral_commissions (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.referrals(id) on delete cascade,
  referrer_empresa_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  subscription_payment_id uuid references public.subscription_payments(id) on delete set null,
  plan_id uuid references public.plans(id) on delete set null,
  commission_type text not null check (commission_type in ('FIXED', 'PERCENTAGE')),
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'pending'
    check (status in ('pending', 'available', 'requested', 'approved', 'paid', 'rejected', 'canceled')),
  available_at timestamptz,
  paid_at timestamptz,
  canceled_at timestamptz,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotência estrutural (Fase 47/60): a mesma assinatura nunca pode gerar
-- duas comissões, mesmo se o webhook do Mercado Pago chegar duplicado —
-- reconciliarAssinatura/reconciliarPagamentoAssinatura só chamam
-- ativarAssinatura() na PRIMEIRA transição para "active" (ver
-- subscription-service.ts), e este índice é o cinto de segurança contra
-- uma corrida de dois webhooks concorrentes tentando o mesmo insert.
create unique index referral_commissions_subscription_id_unique
  on public.referral_commissions (subscription_id)
  where subscription_id is not null;

create index referral_commissions_referrer_empresa_id_idx
  on public.referral_commissions (referrer_empresa_id);
create index referral_commissions_status_idx on public.referral_commissions (status);

create table public.referral_withdrawals (
  id uuid primary key default gen_random_uuid(),
  referrer_empresa_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'requested'
    check (status in ('requested', 'under_review', 'approved', 'paid', 'rejected', 'canceled')),
  payment_method text not null default 'pix' check (payment_method in ('pix')),
  pix_key text,
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  paid_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  transaction_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index referral_withdrawals_referrer_empresa_id_idx
  on public.referral_withdrawals (referrer_empresa_id);
create index referral_withdrawals_status_idx on public.referral_withdrawals (status);

create table public.referral_withdrawal_items (
  id uuid primary key default gen_random_uuid(),
  withdrawal_id uuid not null references public.referral_withdrawals(id) on delete cascade,
  commission_id uuid not null references public.referral_commissions(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (withdrawal_id, commission_id)
);

create index referral_withdrawal_items_withdrawal_id_idx
  on public.referral_withdrawal_items (withdrawal_id);
create index referral_withdrawal_items_commission_id_idx
  on public.referral_withdrawal_items (commission_id);

-- Trilha de auditoria (Fase 38). Somente leitura via supabaseAdmin
-- (painel admin) — nunca exposta a RLS de usuário comum.
create table public.referral_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  referral_id uuid references public.referrals(id) on delete set null,
  commission_id uuid references public.referral_commissions(id) on delete set null,
  withdrawal_id uuid references public.referral_withdrawals(id) on delete set null,
  actor_empresa_id uuid references public.profiles(id) on delete set null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index referral_events_referral_id_idx on public.referral_events (referral_id);

-- ============================================================
-- Geração de código de indicação
-- ============================================================

-- Alfabeto sem caracteres ambíguos (sem 0/O, 1/I/L) — Fase 7.
create or replace function public.generate_referral_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  codigo text;
  tentativa int := 0;
begin
  loop
    tentativa := tentativa + 1;
    codigo := '';
    for i in 1..6 loop
      codigo := codigo || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.referral_profiles where referral_code = codigo);
    if tentativa > 50 then
      raise exception 'Não foi possível gerar um código de indicação único.';
    end if;
  end loop;
  return codigo;
end;
$$;

-- Toda empresa nova ganha um perfil de indicação automaticamente — o
-- código já existe desde o primeiro acesso, sem precisar de um passo
-- "gerar código" na Fase B.
create or replace function public.handle_new_referral_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.referral_profiles (empresa_id, referral_code)
  values (new.id, public.generate_referral_code())
  on conflict (empresa_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_new_referral_profile on public.profiles;
create trigger trg_new_referral_profile
  after insert on public.profiles
  for each row
  execute function public.handle_new_referral_profile();

-- Backfill: toda empresa que já existia antes desta migration também
-- precisa de um código.
insert into public.referral_profiles (empresa_id, referral_code)
select p.id, public.generate_referral_code()
from public.profiles p
left join public.referral_profiles rp on rp.empresa_id = p.id
where rp.id is null;

-- ============================================================
-- Triggers de updated_at (mesma função usada em todo o projeto)
-- ============================================================

create trigger referral_program_config_updated
  before update on public.referral_program_config
  for each row execute function public.update_updated_at_column();

create trigger referral_plan_rules_updated
  before update on public.referral_plan_rules
  for each row execute function public.update_updated_at_column();

create trigger referral_profiles_updated
  before update on public.referral_profiles
  for each row execute function public.update_updated_at_column();

create trigger referrals_updated
  before update on public.referrals
  for each row execute function public.update_updated_at_column();

create trigger referral_commissions_updated
  before update on public.referral_commissions
  for each row execute function public.update_updated_at_column();

create trigger referral_withdrawals_updated
  before update on public.referral_withdrawals
  for each row execute function public.update_updated_at_column();

-- ============================================================
-- RLS
-- ============================================================

alter table public.referral_program_config enable row level security;
alter table public.referral_plan_rules enable row level security;
alter table public.referral_profiles enable row level security;
alter table public.referrals enable row level security;
alter table public.referral_commissions enable row level security;
alter table public.referral_withdrawals enable row level security;
alter table public.referral_withdrawal_items enable row level security;
alter table public.referral_events enable row level security;

-- Config e regras por plano: leitura para todo autenticado (precisa saber
-- se o programa está ativo e o texto de compartilhamento), sem nenhuma
-- policy de escrita — todo write passa por supabaseAdmin em
-- admin-referral.functions.ts, atrás de checarSiteAdmin(), igual a
-- plans/plan_features.
create policy "referral_program_config: leitura para autenticados"
  on public.referral_program_config for select
  to authenticated
  using (true);

create policy "referral_plan_rules: leitura para autenticados"
  on public.referral_plan_rules for select
  to authenticated
  using (true);

-- Demais tabelas: cada empresa só enxerga o que é dela (mesmo padrão de
-- subscriptions). Sem policy de insert/update/delete — todo write
-- financeiro passa por supabaseAdmin em commission-service.ts/
-- referral.functions.ts, nunca pela sessão do usuário.
create policy "referral_profiles: leitura da própria empresa"
  on public.referral_profiles for select
  to authenticated
  using (empresa_id = auth.uid() or public.empresa_role(empresa_id) is not null);

create policy "referrals: leitura da própria empresa (indicador)"
  on public.referrals for select
  to authenticated
  using (
    referrer_empresa_id = auth.uid() or public.empresa_role(referrer_empresa_id) is not null
  );

create policy "referral_commissions: leitura da própria empresa"
  on public.referral_commissions for select
  to authenticated
  using (
    referrer_empresa_id = auth.uid() or public.empresa_role(referrer_empresa_id) is not null
  );

create policy "referral_withdrawals: leitura da própria empresa"
  on public.referral_withdrawals for select
  to authenticated
  using (
    referrer_empresa_id = auth.uid() or public.empresa_role(referrer_empresa_id) is not null
  );

create policy "referral_withdrawal_items: leitura da própria empresa"
  on public.referral_withdrawal_items for select
  to authenticated
  using (
    withdrawal_id in (
      select id from public.referral_withdrawals
      where referrer_empresa_id = auth.uid() or public.empresa_role(referrer_empresa_id) is not null
    )
  );

-- referral_events fica sem nenhuma policy de select para "authenticated":
-- é log interno de auditoria, lido só pelo painel admin via supabaseAdmin
-- (que ignora RLS). RLS habilitado apenas para negar por padrão.
