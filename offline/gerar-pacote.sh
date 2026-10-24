#!/usr/bin/env bash
# Gera um pacote para rodar o SPACE TECH OS completo (app + Supabase + dados)
# num Windows sem internet, acessado pela rede local. Ver offline/README.md.
#
# Uso:  bash offline/gerar-pacote.sh [pasta-de-saida]
#   BAIXAR_PREREQ=0  pula o download do Docker Desktop e do WSL (~700 MB)
#
# ATENÇÃO: para a stack do Supabase por ~1-2 minutos enquanto copia o banco
# (copiar o Postgres rodando pode gerar uma cópia corrompida).
set -euo pipefail

PROJ="$(cd "$(dirname "$0")/.." && pwd)"
SUPA="$PROJ/infra/supabase"
OUT="${1:-/root/space-tech-os-offline}"
BAIXAR_PREREQ="${BAIXAR_PREREQ:-1}"
NODE_IMAGE="node:26-bookworm-slim"
APP_IMAGE="space-tech-os-app:offline"
PG_IMAGE="supabase/postgres:17.6.1.136"

log() { printf '\n==> %s\n' "$*"; }

if [ -e "$OUT" ] && [ -n "$(ls -A "$OUT" 2>/dev/null)" ]; then
  echo "A pasta $OUT já existe e não está vazia. Apague ou passe outra pasta." >&2
  exit 1
fi
mkdir -p "$OUT"/{imagens,dados,pre-requisitos,space-tech-os}
BUILD="$(mktemp -d)"
trap 'rm -rf "$BUILD"' EXIT

# ---------------------------------------------------------------- app image
log "Copiando o projeto para montar a imagem do app"
mkdir -p "$BUILD/app"
# Excludes com "/" na frente: só a raiz do projeto (sem isso, "infra" também
# apaga node_modules/@oozcitak/infra e o vite não sobe).
rsync -a "$PROJ/" "$BUILD/app/" \
  --exclude /.git --exclude "/.output*" --exclude /.wrangler --exclude /.tanstack \
  --exclude /desktop --exclude /infra --exclude /archive --exclude /offline \
  --exclude /.env --exclude '/*.log'

# O vite.config.ts de produção só aceita srmpretech.online e força o HMR em
# wss://:443 (proxy do OpenLiteSpeed). Na rede local o acesso é por IP:8080.
cat > "$BUILD/app/vite.config.ts" <<'EOF'
// Versão offline (gerada por offline/gerar-pacote.sh): acesso direto por
// http://<ip-da-maquina>:8080, sem proxy HTTPS na frente.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      host: "0.0.0.0",
      port: 8080,
      allowedHosts: true,
    },
  },

  tanstackStart: {
    server: {
      entry: "server",
    },
  },
});
EOF

cat > "$BUILD/Dockerfile" <<EOF
FROM $NODE_IMAGE
WORKDIR /app
COPY app/ /app/
EXPOSE 8080
CMD ["npm", "run", "dev"]
EOF

log "Baixando $NODE_IMAGE e montando $APP_IMAGE"
docker pull "$NODE_IMAGE"
docker build -t "$APP_IMAGE" "$BUILD"

# ---------------------------------------------------------- app.env (modelo)
# Integrações que dependem de internet ficam vazias: o app mostra
# "não configurado" em vez de ficar esperando timeout de rede.
log "Gerando app.env"
grep -vE '^(SUPABASE_URL|VITE_SUPABASE_URL|VITE_SITE_URL|SMTP_PASSWORD|AI_API_KEY|AI_BASE_URL|EVOLUTION_API_URL|EVOLUTION_API_KEY|EVOLUTION_WEBHOOK_BASE_URL|MERCADOPAGO_ACCESS_TOKEN|MERCADOPAGO_PUBLIC_KEY|MERCADOPAGO_WEBHOOK_SECRET)=' \
  "$PROJ/.env" > "$OUT/space-tech-os/app.env"
cat >> "$OUT/space-tech-os/app.env" <<'EOF'

# --- Offline (preenchido por instalar.ps1) ---
SUPABASE_URL=http://kong:8000
VITE_SUPABASE_URL=http://__IP__:8000
VITE_SITE_URL=http://__IP__:8080
SMTP_PASSWORD=
AI_API_KEY=
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_PUBLIC_KEY=
MERCADOPAGO_WEBHOOK_SECRET=
EOF

# ------------------------------------------------------- config do Supabase
log "Copiando a configuração do Supabase"
mkdir -p "$OUT/space-tech-os/supabase"
rsync -a "$SUPA/" "$OUT/space-tech-os/supabase/" \
  --exclude volumes/db/data --exclude volumes/storage --exclude .env.old --exclude dev
mkdir -p "$OUT/space-tech-os/supabase/volumes/storage"
cp "$PROJ/offline/windows/docker-compose.offline.yml" "$OUT/space-tech-os/supabase/"

# ------------------------------------------------------------------- dados
log "Parando o Supabase para copiar o banco (o site fica fora do ar agora)"
( cd "$SUPA" && docker compose stop )
restart_supa() { log "Subindo o Supabase de novo"; ( cd "$SUPA" && docker compose start ); }
trap 'restart_supa; rm -rf "$BUILD"' EXIT

tar --numeric-owner -C "$SUPA/volumes/db/data" -cf - . | pigz -1 > "$OUT/dados/db-data.tar.gz"
tar --numeric-owner -C "$SUPA/volumes/storage" -cf - . | pigz -1 > "$OUT/dados/storage-data.tar.gz"
for vol in db-config deno-cache; do
  docker run --rm -u 0 --entrypoint tar -v "supabase_$vol:/v:ro" "$PG_IMAGE" \
    --numeric-owner -C /v -cf - . | pigz -1 > "$OUT/dados/$vol.tar.gz"
done

restart_supa
trap 'rm -rf "$BUILD"' EXIT

# ----------------------------------------------------------------- imagens
# Um arquivo por imagem: cada um fica < 4 GB, mas mesmo assim use um pendrive
# ou HD em NTFS/exFAT (FAT32 não aceita arquivos > 4 GB).
log "Exportando as imagens Docker (demora)"
images=$( (cd "$SUPA" && docker compose config --images); echo "$APP_IMAGE" )
for img in $(echo "$images" | sort -u); do
  f="$OUT/imagens/$(echo "$img" | tr '/:' '__').tar.gz"
  echo "  $img"
  docker save "$img" | pigz -1 > "$f"
done

# --------------------------------------------------------- scripts Windows
log "Copiando os scripts de instalação"
for f in INSTALAR.bat INICIAR.bat PARAR.bat PRE-REQUISITOS.bat; do
  sed 's/\r*$/\r/' "$PROJ/offline/windows/$f" > "$OUT/$f"   # .bat precisa de CRLF
done
# BOM UTF-8: o PowerShell 5.1 do Windows lê .ps1 sem BOM como ANSI e
# estraga os acentos.
for f in instalar.ps1; do
  { printf '\xEF\xBB\xBF'; sed 's/\r*$/\r/' "$PROJ/offline/windows/$f"; } > "$OUT/$f"
done
sed 's/\r*$/\r/' "$PROJ/offline/README.md" > "$OUT/LEIA-ME.txt"

# ----------------------------------------------------------- pré-requisitos
if [ "$BAIXAR_PREREQ" = 1 ]; then
  log "Baixando Docker Desktop e WSL para instalar sem internet"
  curl -fL -o "$OUT/pre-requisitos/DockerDesktopInstaller.exe" \
    "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe"
  wsl_url=$(curl -fsS https://api.github.com/repos/microsoft/WSL/releases/latest \
    | grep -o 'https://[^"]*x64\.msi' | head -1)
  curl -fL -o "$OUT/pre-requisitos/wsl.x64.msi" "$wsl_url"
fi

log "Pronto: $OUT ($(du -sh "$OUT" | cut -f1))"
echo "Copie a pasta inteira para o Windows e rode PRE-REQUISITOS.bat e depois INSTALAR.bat."
