-- Same class of bug just fixed for ordens_servico.numero (20260810080000):
-- a SERIAL-backed display number with no UNIQUE constraint, so any future
-- sequence drift (bulk import, manual data fix, etc.) can silently produce
-- two records sharing the same printed number. None of these three have a
-- collision today (checked before writing this), but nothing stops one from
-- happening exactly like it did for ordens_servico.
ALTER TABLE public.vendas ADD CONSTRAINT vendas_numero_key UNIQUE (numero);
ALTER TABLE public.notas_fiscais ADD CONSTRAINT notas_fiscais_numero_key UNIQUE (numero);
ALTER TABLE public.os_faturamentos ADD CONSTRAINT os_faturamentos_numero_key UNIQUE (numero);
