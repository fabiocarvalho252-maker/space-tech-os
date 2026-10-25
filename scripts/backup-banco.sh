#!/usr/bin/env bash
# Backup diário do Supabase self-hosted: dump completo do Postgres (todos os
# bancos, roles e schemas, inclusive auth e storage) + arquivos do Storage
# (fotos de OS, logos etc.). Guarda os últimos 14 dias em /root/backups/banco.
# Roda pelo cron em /etc/cron.d/space-tech-backup-banco. No fim chama a
# rotina de backup no Google Drive (src/lib/backup/): envia estes arquivos
# para o Drive conectado no /admin e faz o backup diário das empresas que
# conectaram o próprio Drive. Falha no Drive não desfaz o backup local.
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

set -a
# shellcheck disable=SC1091
. ./.env
set +a
if [[ -n "${GOOGLE_OAUTH_CLIENT_ID:-}" && -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  token=$(printf '%s' "backup-drive-cron" | openssl dgst -sha256 -hmac "$SUPABASE_SERVICE_ROLE_KEY" -r | cut -d' ' -f1)
  echo "google drive:"
  curl -sS --fail-with-body --max-time 3600 -X POST \
    -H "x-cron-token: $token" \
    http://127.0.0.1:8080/api/backup-drive/cron | jq -c . || echo "ERRO no envio para o Google Drive"
fi
