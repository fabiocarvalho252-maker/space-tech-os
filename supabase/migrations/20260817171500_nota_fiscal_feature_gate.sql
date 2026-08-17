-- Backend enforcement for the NOTA_FISCAL feature gate — the frontend hides
-- the "Nova Nota" button (see notas.tsx), but per Fase 26 that alone isn't
-- enough: a Básico empresa could still call the insert directly. Since this
-- app talks straight to Postgres via PostgREST (no separate API layer),
-- "backend" enforcement here means RLS, same as has_permission() already
-- does for role-based access.
create function public.has_plan_feature(p_empresa_id uuid, p_feature text)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select coalesce((
    select bool_or(pf.enabled)
    from public.profiles p
    join public.plans pl
      on pl.id = coalesce(p.plan_id, (select id from public.plans where slug = 'basico'))
    join public.plan_features pf
      on pf.plan_id = pl.id and pf.feature = p_feature
    where p.id = p_empresa_id
  ), false)
$$;

-- A restrictive policy ANDs with the existing permissive "notas_fiscais
-- gerenciar" policy instead of replacing it, and only applies to INSERT —
-- editing/cancelling a nota already created (before a downgrade, say) still
-- works, only creating a new one requires the feature.
create policy "notas_fiscais: criar exige recurso NOTA_FISCAL no plano"
  on public.notas_fiscais
  as restrictive
  for insert
  to authenticated
  with check (has_plan_feature(user_id, 'NOTA_FISCAL'));
