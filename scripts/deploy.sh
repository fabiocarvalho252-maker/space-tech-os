#!/usr/bin/env bash
# Publishes the current code to the live site (space-tech-os.service).
#
#   npm run deploy            build + swap + restart
#   npm run deploy -- --rollback   go back to the previous build
#
# The build goes to .output-next; only if it succeeds is the live .output
# moved to .output-prev and replaced, then the service restarted. A failed
# build leaves the site untouched.
set -euo pipefail
cd "$(dirname "$0")/.."

SERVICE=space-tech-os
PORT=8080

check() {
  for _ in $(seq 1 30); do
    if [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/login")" = 200 ]; then
      echo "OK: site respondendo em :$PORT"
      return 0
    fi
    sleep 1
  done
  echo "ERRO: site não respondeu em :$PORT — veja: journalctl -u $SERVICE -n 50" >&2
  return 1
}

if [ "${1:-}" = "--rollback" ]; then
  [ -d .output-prev ] || { echo "Não há build anterior (.output-prev)" >&2; exit 1; }
  rm -rf .output-failed
  mv .output .output-failed
  mv .output-prev .output
  systemctl restart "$SERVICE"
  check
  exit
fi

echo "==> Build de produção"
rm -rf .output-next
# Same cap the service has, so a build can't starve the VPS of RAM.
NODE_OPTIONS=--max-old-space-size=2048 \
  systemd-run --scope --quiet -p MemoryMax=2500M \
  npx vite build --config vite.prod.config.ts

[ -f .output-next/server/index.mjs ] || { echo "Build sem .output-next/server/index.mjs" >&2; exit 1; }

echo "==> Trocando build e reiniciando $SERVICE"
rm -rf .output-prev
[ -d .output ] && mv .output .output-prev
mv .output-next .output
systemctl restart "$SERVICE"
check
