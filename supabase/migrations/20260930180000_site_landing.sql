-- Conteúdo editável da landing page pública (/), editado pelo administrador
-- do site em /admin/landing. Uma linha só (id = 1) com o conteúdo em JSON —
-- o formato e os padrões ficam em src/lib/landing/conteudo.ts.
--
-- RLS ligado e SEM políticas: nem anon nem authenticated leem ou gravam
-- direto. A leitura pública e a gravação (checada contra o e-mail do admin
-- do site) passam pelas server functions em src/lib/landing/landing.functions.ts,
-- que usam a service role.
create table if not exists public.site_landing (
  id smallint primary key default 1 check (id = 1),
  conteudo jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_landing enable row level security;

insert into public.site_landing (id) values (1) on conflict (id) do nothing;

-- Fotos da landing: bucket público (a página é pública). Upload só via
-- URL assinada gerada pela server function do admin — não há política de
-- INSERT/UPDATE/DELETE para usuários.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'landing',
  'landing',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;
