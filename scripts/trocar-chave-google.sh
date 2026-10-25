#!/usr/bin/env bash
# Troca a chave secreta do app OAuth do Google (backup no Google Drive) sem
# que ela apareça na tela: pede a chave escondida, grava no .env, reinicia o
# sistema e confere com o Google se o par ID + chave é aceito.
#   scripts/trocar-chave-google.sh
set -euo pipefail
cd "$(dirname "$0")/.."

read -rsp "Cole a chave secreta nova do Google (não aparece na tela) e tecle Enter: " chave
echo
if [[ ! "$chave" =~ ^GOCSPX-[A-Za-z0-9_-]{20,}$ ]]; then
  echo "ERRO: isso não parece uma chave do Google (começa com GOCSPX-). Nada foi alterado." >&2
  exit 1
fi

id=$(grep '^GOOGLE_OAUTH_CLIENT_ID=' .env | cut -d= -f2-)
# Código falso: o Google responde invalid_grant se ID + chave estiverem certos,
# invalid_client se a chave estiver errada.
resposta=$(curl -s https://oauth2.googleapis.com/token \
  --data-urlencode "client_id=$id" --data-urlencode "client_secret=$chave" \
  -d code=teste -d grant_type=authorization_code \
  -d redirect_uri=https://srmpretech.online/api/google-drive/callback)
if ! grep -q '"invalid_grant"' <<<"$resposta"; then
  echo "ERRO: o Google não aceitou essa chave. Nada foi alterado." >&2
  exit 1
fi

cp .env ".env.bak-$(date +%Y%m%d%H%M%S)"
chmod 600 .env.bak-*
grep -v '^GOOGLE_OAUTH_CLIENT_SECRET=' .env > .env.novo
printf 'GOOGLE_OAUTH_CLIENT_SECRET=%s\n' "$chave" >> .env.novo
chmod 600 .env.novo
mv .env.novo .env
systemctl restart space-tech-os
echo "OK: chave nova gravada e sistema reiniciado (termina em ${chave: -4})."
