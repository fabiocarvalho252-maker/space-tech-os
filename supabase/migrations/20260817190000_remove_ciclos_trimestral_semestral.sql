-- Simplifica os ciclos de cobrança pra só mensal/anual — nenhuma empresa
-- usa trimestral/semestral hoje (confirmado antes de rodar: 0 linhas em
-- profiles.plano/plano_solicitado com esses valores), então não precisa de
-- backfill.
alter table public.profiles drop constraint profiles_plano_check;
alter table public.profiles add constraint profiles_plano_check
  check (plano = any (array['trial', 'mensal', 'anual', 'vitalicio', 'suspenso']));

alter table public.profiles drop constraint profiles_plano_solicitado_check;
alter table public.profiles add constraint profiles_plano_solicitado_check
  check (plano_solicitado = any (array['mensal', 'anual', 'vitalicio']));
