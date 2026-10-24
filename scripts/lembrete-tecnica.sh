#!/usr/bin/env bash
# Lembrete no WhatsApp para a técnica abrir o sistema (hábito de uso).
# Roda pelo cron em /etc/cron.d/space-tech-lembrete-tecnica (seg–sáb, 9h/13h/17h
# de Brasília). Sai pelo WhatsApp da loja via Evolution API.
# O texto é escrito pelo Gemini (plano gratuito) conforme o horário; se a IA
# falhar, vai o texto fixo — o lembrete nunca deixa de sair.
# Configuração no .env: LEMBRETE_TECNICA_NUMERO, LEMBRETE_TECNICA_INSTANCIA,
# LEMBRETE_TECNICA_NOME e GEMINI_API_KEY.
set -euo pipefail

cd "$(dirname "$0")/.."
set -a
# shellcheck disable=SC1091
. ./.env
set +a

: "${LEMBRETE_TECNICA_NUMERO:?defina LEMBRETE_TECNICA_NUMERO no .env}"
: "${LEMBRETE_TECNICA_INSTANCIA:?defina LEMBRETE_TECNICA_INSTANCIA no .env}"
NOME="${LEMBRETE_TECNICA_NOME:-}"
LINK="https://srmpretech.online"
TEXTO_FIXO="Oi${NOME:+, $NOME}! 👋 Lembrete do SPACE TECH: abra o sistema agora e registre o que estiver fazendo (OS, peças, status). Quanto mais usar, mais fácil fica! 👉 $LINK"

hora=$(TZ=America/Bahia date +%H)
DIAS=(domingo segunda-feira terça-feira quarta-feira quinta-feira sexta-feira sábado)
dia=${DIAS[$(TZ=America/Bahia date +%w)]}
if ((10#$hora < 12)); then
  momento="manhã: dê bom dia e lembre de registrar no sistema as OS e aparelhos que chegarem hoje"
elif ((10#$hora < 16)); then
  momento="começo da tarde: lembre de atualizar no sistema o status das OS em andamento (em reparo, aguardando peça, pronta)"
else
  momento="fim do expediente: lembre de conferir no sistema se ficou alguma OS sem atualizar ou alguma peça sem lançar"
fi

texto_ia() {
  [[ -n "${GEMINI_API_KEY:-}" ]] || return 1
  local prompt corpo resposta
  prompt="Escreva UMA mensagem de WhatsApp em português do Brasil para ${NOME:-a técnica}, técnica de uma assistência de celulares chamada SPACE TECH, incentivando-a a usar o sistema da loja para pegar o hábito. Momento: $momento. Hoje é $dia. Tom amigável e leve, no máximo 2 frases curtas, no máximo 1 ou 2 emojis, sem aspas, sem hashtags, sem assinatura. Varie a abertura: não comece com \"Oi, tudo bem?\" — use saudações e jeitos de falar diferentes a cada vez (às vezes nem precisa de saudação). Não inclua link — ele é adicionado depois."
  corpo=$(jq -n --arg p "$prompt" '{contents: [{role: "user", parts: [{text: $p}]}], generationConfig: {temperature: 1.0, maxOutputTokens: 200}}')
  resposta=$(curl -sS --max-time 25 -X POST \
    "https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL:-gemini-flash-lite-latest}:generateContent" \
    -H "x-goog-api-key: $GEMINI_API_KEY" -H "Content-Type: application/json" -d "$corpo") || return 1
  jq -er '.candidates[0].content.parts[0].text // empty' <<<"$resposta" | tr -s '\n' ' ' | sed 's/^ *//; s/ *$//'
}

origem="fixo"
TEXTO="$TEXTO_FIXO"
if gerado=$(texto_ia) && [[ -n "$gerado" && ${#gerado} -le 400 ]]; then
  TEXTO="$gerado 👉 $LINK"
  origem="IA"
fi

# LEMBRETE_SIMULAR=1 só mostra o texto, sem enviar (para testar a IA).
if [[ -n "${LEMBRETE_SIMULAR:-}" ]]; then
  echo "[simulação, $origem] $TEXTO"
  exit 0
fi

corpo=$(jq -n --arg n "$LEMBRETE_TECNICA_NUMERO" --arg t "$TEXTO" '{number: $n, text: $t}')
resposta=$(curl -sS --max-time 30 -w '\n%{http_code}' -X POST \
  "$EVOLUTION_API_URL/message/sendText/$LEMBRETE_TECNICA_INSTANCIA" \
  -H "apikey: $EVOLUTION_API_KEY" -H "Content-Type: application/json" -d "$corpo")
status=$(tail -n1 <<<"$resposta")

if [[ "$status" == 2* ]]; then
  echo "$(date -Is) enviado ($origem, HTTP $status): $TEXTO"
else
  echo "$(date -Is) FALHOU (HTTP $status): $(head -n -1 <<<"$resposta" | head -c 300)"
  exit 1
fi
