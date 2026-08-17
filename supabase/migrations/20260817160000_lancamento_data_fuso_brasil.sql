-- lancamentos.data tinha DEFAULT CURRENT_DATE, avaliado no fuso do servidor
-- Postgres (UTC), não no fuso do lojista (Brasil). Entre ~21h e meia-noite
-- (horário de Brasília) já é o dia seguinte em UTC, então toda venda/
-- lançamento feito nessa janela era gravado com a data de amanhã. O
-- Dashboard/DRE filtra por data local do navegador ("hoje"/"este mês" em
-- horário de Brasília), então esses lançamentos ficavam de fora do
-- período — a receita podia até cair depois de uma venda nova, em vez de
-- subir. Troca o default para calcular a data já no fuso de Brasília, e
-- corrige os lançamentos já gravados com a data errada.
ALTER TABLE public.lancamentos
  ALTER COLUMN data SET DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date);

UPDATE public.lancamentos
SET data = (created_at AT TIME ZONE 'America/Sao_Paulo')::date
WHERE data <> (created_at AT TIME ZONE 'America/Sao_Paulo')::date;
