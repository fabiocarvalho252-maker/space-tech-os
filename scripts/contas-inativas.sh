#!/usr/bin/env bash
# Rotina diária de contas inativas (ver src/lib/contas-inativas.server.ts):
# avisa no WhatsApp quem está há 2 meses sem plano e apaga quem foi avisado
# há 30 dias e não assinou. Roda pelo cron em
# /etc/cron.d/space-tech-contas-inativas.
#   scripts/contas-inativas.sh            executa de verdade
#   scripts/contas-inativas.sh --simular  só lista o que faria
set -euo pipefail

cd "$(dirname "$0")/.."
set -a
# shellcheck disable=SC1091
. ./.env
set +a

: "${SUPABASE_SERVICE_ROLE_KEY:?defina SUPABASE_SERVICE_ROLE_KEY no .env}"
token=$(printf '%s' "contas-inativas-cron" | openssl dgst -sha256 -hmac "$SUPABASE_SERVICE_ROLE_KEY" -r | cut -d' ' -f1)
query=""
[[ "${1:-}" == "--simular" ]] && query="?simular=1"

echo "== $(date -u +%FT%TZ) ${query:+(simulação)}"
curl -sS --fail-with-body --max-time 300 -X POST \
  -H "x-cron-token: $token" \
  "http://127.0.0.1:8080/api/contas-inativas/cron$query" | jq .
