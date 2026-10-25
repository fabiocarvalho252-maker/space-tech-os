#!/usr/bin/env bash
# Worker da Fila WhatsApp (ver src/lib/whatsapp/fila-cron.server.ts): envia
# as mensagens agendadas de todas as empresas, respeitando intervalo, horário
# e limite de cada uma, e a cada 10 minutos gera as mensagens automáticas.
# Roda a cada minuto pelo cron em /etc/cron.d/space-tech-whatsapp-fila.
#   scripts/whatsapp-fila.sh
set -euo pipefail

cd "$(dirname "$0")/.."
set -a
# shellcheck disable=SC1091
. ./.env
set +a

: "${SUPABASE_SERVICE_ROLE_KEY:?defina SUPABASE_SERVICE_ROLE_KEY no .env}"
token=$(printf '%s' "whatsapp-fila-cron" | openssl dgst -sha256 -hmac "$SUPABASE_SERVICE_ROLE_KEY" -r | cut -d' ' -f1)

resposta=$(curl -sS --fail-with-body --max-time 110 -X POST \
  -H "x-cron-token: $token" \
  http://127.0.0.1:8080/api/whatsapp/fila/cron)
# Log só quando algo aconteceu (envio, automação ou erro), para não encher o arquivo.
if jq -e '.automacoes or any(.empresas[]?; (.enviadas // 0) > 0 or .erro)' <<<"$resposta" >/dev/null 2>&1; then
  echo "== $(date -u +%FT%TZ) $(jq -c . <<<"$resposta")"
fi
