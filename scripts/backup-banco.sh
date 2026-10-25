#!/usr/bin/env bash
# Backup diário do Supabase self-hosted: dump completo do Postgres (todos os
# bancos, roles e schemas, inclusive auth e storage) + arquivos do Storage
# (fotos de OS, logos etc.). Guarda os últimos 14 dias em /root/backups/banco.
# Roda pelo cron em /etc/cron.d/space-tech-backup-banco.
#   scripts/backup-banco.sh   executa um backup agora
#
# Restaurar (CUIDADO: sobrescreve dados):
#   gunzip -c banco-AAAA-MM-DD_HHMM.sql.gz | docker exec -i supabase-db psql -U supabase_admin -d postgres
#   tar -xzf storage-AAAA-MM-DD_HHMM.tar.gz -C infra/supabase/volumes
set -euo pipefail

cd "$(dirname "$0")/.."
destino=/root/backups/banco
dias=14
carimbo=$(date -u +%F_%H%M)
mkdir -p "$destino"
chmod 700 "$destino"

echo "== $(date -u +%FT%TZ) backup $carimbo"

sql="$destino/banco-$carimbo.sql.gz"
docker exec supabase-db pg_dumpall -U supabase_admin --clean --if-exists | gzip -9 > "$sql.tmp"
# Um dump válido termina com esta linha; sem ela o pg_dumpall foi interrompido.
gunzip -c "$sql.tmp" | tail -n 5 | grep -q "PostgreSQL database cluster dump complete"
mv "$sql.tmp" "$sql"

storage="$destino/storage-$carimbo.tar.gz"
tar -czf "$storage.tmp" -C infra/supabase/volumes storage
mv "$storage.tmp" "$storage"

chmod 600 "$sql" "$storage"
find "$destino" -maxdepth 1 -name '*.gz' -mtime +"$dias" -delete
rm -f "$destino"/*.tmp

echo "ok: $(du -h "$sql" | cut -f1) banco, $(du -h "$storage" | cut -f1) storage; $(ls "$destino"/banco-*.sql.gz | wc -l) backups guardados"
