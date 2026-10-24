#!/usr/bin/env bash
# Lembrete no WhatsApp para a técnica abrir o sistema (hábito de uso).
# Roda pelo cron em /etc/cron.d/space-tech-lembrete-tecnica (seg–sáb, 9h/13h/17h
# de Brasília). Sai pelo WhatsApp da loja via Evolution API.
# Configuração no .env: LEMBRETE_TECNICA_NUMERO e LEMBRETE_TECNICA_INSTANCIA.
set -euo pipefail

cd "$(dirname "$0")/.."
set -a
# shellcheck disable=SC1091
. ./.env
set +a

: "${LEMBRETE_TECNICA_NUMERO:?defina LEMBRETE_TECNICA_NUMERO no .env}"
: "${LEMBRETE_TECNICA_INSTANCIA:?defina LEMBRETE_TECNICA_INSTANCIA no .env}"

TEXTO="Oi! 👋 Lembrete do SPACE TECH: abra o sistema agora e registre o que estiver fazendo (OS, peças, status). Quanto mais usar, mais fácil fica! 👉 https://srmpretech.online"

corpo=$(jq -n --arg n "$LEMBRETE_TECNICA_NUMERO" --arg t "$TEXTO" '{number: $n, text: $t}')
resposta=$(curl -sS --max-time 30 -w '\n%{http_code}' -X POST \
  "$EVOLUTION_API_URL/message/sendText/$LEMBRETE_TECNICA_INSTANCIA" \
  -H "apikey: $EVOLUTION_API_KEY" -H "Content-Type: application/json" -d "$corpo")
status=$(tail -n1 <<<"$resposta")

if [[ "$status" == 2* ]]; then
  echo "$(date -Is) enviado (HTTP $status)"
else
  echo "$(date -Is) FALHOU (HTTP $status): $(head -n -1 <<<"$resposta" | head -c 300)"
  exit 1
fi
