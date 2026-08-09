create type public.tipo_aparelho_compra as enum ('seminovo', 'com_defeito');

create table public.compras_aparelhos (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    cliente_id uuid references public.clientes(id) on delete set null,
    modelo text not null,
    marca text,
    imei_serial text,
    tipo tipo_aparelho_compra not null default 'seminovo',
    condicao_detalhada text,
    valor_pago numeric(12,2) not null default 0,
    data_compra timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.compras_aparelhos to authenticated;
grant all on public.compras_aparelhos to service_role;

alter table public.compras_aparelhos enable row level security;

create policy "Users can manage their own device purchases"
on public.compras_aparelhos
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);