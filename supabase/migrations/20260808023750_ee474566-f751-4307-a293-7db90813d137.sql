-- Tabela para armazenar as configurações de API do Mercado Pago por usuário
create table public.pagamento_config (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    mercado_pago_access_token text,
    mercado_pago_public_key text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(user_id)
);

-- Tabela de cobranças
create type public.status_cobranca as enum ('pendente', 'paga', 'cancelada', 'expirada');

create table public.cobrancas (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    cliente_id uuid references public.clientes(id) on delete set null,
    os_id uuid references public.ordens_servico(id) on delete set null,
    venda_id uuid references public.vendas(id) on delete set null,
    valor numeric(12,2) not null,
    status status_cobranca not null default 'pendente',
    mp_id text, -- ID da preferência ou do pagamento no Mercado Pago
    qr_code text, -- QR Code Base64 ou URL
    qr_code_copy_paste text, -- Linha digitável/pix copia e cola
    expires_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- RLS e Permissões
grant select, insert, update, delete on public.pagamento_config to authenticated;
grant all on public.pagamento_config to service_role;

grant select, insert, update, delete on public.cobrancas to authenticated;
grant all on public.cobrancas to service_role;

alter table public.pagamento_config enable row level security;
alter table public.cobrancas enable row level security;

create policy "Users can manage their own payment configs"
on public.pagamento_config
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage their own charges"
on public.cobrancas
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);