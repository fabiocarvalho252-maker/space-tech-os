#!/usr/bin/env bash
# Análise diária de marketing com o plano Pro (Claude Code, modelo Haiku).
# Uma execução por dia, com limite de turnos. Saída: marketing/analises/AAAA-MM-DD.md
#
# Crontab (instalado depois da aprovação): 0 7 * * * (04:00 em Brasília, depois da coleta)
set -uo pipefail
cd "$(dirname "$0")/.."

DIA=$(TZ=America/Sao_Paulo date +%F)
SAIDA="marketing/analises/$DIA.md"
LOG="marketing/analises/.analise.log"
mkdir -p marketing/analises

echo "$(date -u +%FT%TZ) início análise $DIA" >> "$LOG"
claude -p "$(cat scripts/marketing-analise-prompt.md)" \
  --model haiku \
  --max-turns 4 \
  --allowedTools "Bash(scripts/marketing-analise-dados.sh)" "Bash(bash scripts/marketing-analise-dados.sh)" \
  < /dev/null > "$SAIDA.tmp" 2>> "$LOG"
STATUS=$?

if [ "$STATUS" -eq 0 ] && [ -s "$SAIDA.tmp" ]; then
  mv "$SAIDA.tmp" "$SAIDA"
  echo "$(date -u +%FT%TZ) ok $SAIDA" >> "$LOG"
else
  rm -f "$SAIDA.tmp"
  echo "$(date -u +%FT%TZ) falhou (status $STATUS)" >> "$LOG"
  exit 1
fi
