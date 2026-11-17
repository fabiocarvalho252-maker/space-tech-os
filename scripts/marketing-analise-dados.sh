#!/usr/bin/env bash
# Dados para a análise diária de marketing. Só SELECT, consulta fixa.
# Não recebe parâmetros e não grava nada: o agente só pode rodar este script.
set -euo pipefail
docker exec -i supabase-db psql -U postgres -d postgres -A -F ' | ' -v ON_ERROR_STOP=1 <<'SQL'
\pset footer off
\pset tuples_only off
select '== conta (últimos 14 dias) ==';
select dia, seguidores, alcance, visitas_perfil, cliques_link
  from public.ig_conta_diaria
 where dia >= (current_date - 14)
 order by dia;
select '== posts do último dia coletado (top 15 por alcance) ==';
select tipo, to_char(publicado_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY') as data,
       left(replace(coalesce(legenda,''), E'\n', ' '), 80) as legenda,
       alcance, curtidas, comentarios, salvamentos, compartilhamentos, visualizacoes
  from public.ig_midia_metricas
 where dia_coleta = (select max(dia_coleta) from public.ig_midia_metricas)
 order by alcance desc nulls last
 limit 15;
select '== últimas coletas ==';
select executado_em, origem, ok, mensagem from public.ig_coleta_log
 where mensagem is distinct from 'em andamento'
 order by executado_em desc limit 5;
SQL
