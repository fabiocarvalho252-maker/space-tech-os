#!/usr/bin/env bash
# Instala o serviço office-runner no servidor (uso único; é idempotente).
# Não grava segredos: copia apenas o modelo office-runner.env.example.
# Uso: sudo ./install.sh [--dry-run]
set -euo pipefail

readonly USUARIO_SERVICO="office"
readonly GRUPO_SERVICO="office"
readonly RAIZ_SERVICO="/srv/office"
readonly PASTA_PROJETOS="${RAIZ_SERVICO}/projects"
readonly PASTA_HOME="${RAIZ_SERVICO}/home"
readonly PASTA_RUNNER="${RAIZ_SERVICO}/runner"
readonly ARQUIVO_AMBIENTE="/etc/office-runner.env"
readonly PORTA_HEALTH="4317"

DIRETORIO_DEPLOY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly DIRETORIO_DEPLOY
readonly ORIGEM_RUNNER="${DIRETORIO_DEPLOY}/../../services/office-runner"
readonly MODELO_AMBIENTE="${DIRETORIO_DEPLOY}/office-runner.env.example"

DRY_RUN=0

log_info() { printf '[info] %s\n' "$*"; }
log_erro() { printf '[erro] %s\n' "$*" >&2; }

# Executa o comando, ou apenas o imprime quando em --dry-run.
executar() {
  if (( DRY_RUN )); then
    printf '[dry-run] %s\n' "$*"
    return 0
  fi
  "$@"
}

# Executa o comando dentro de um diretório, ou apenas o imprime em --dry-run.
executar_em() {
  local diretorio="$1"
  shift
  if (( DRY_RUN )); then
    printf '[dry-run] (em %s) %s\n' "$diretorio" "$*"
    return 0
  fi
  (cd "$diretorio" && "$@")
}

exigir_root() {
  if (( DRY_RUN )); then
    log_info "Modo --dry-run: verificação de root ignorada (nada é alterado)."
    return 0
  fi
  if [[ "$(id -u)" -ne 0 ]]; then
    log_erro "Este script precisa ser executado como root (ex.: sudo ./install.sh)."
    exit 1
  fi
}

exigir_origem() {
  if [[ ! -f "${ORIGEM_RUNNER}/package.json" || ! -f "$MODELO_AMBIENTE" ]]; then
    log_erro "Arquivos de origem não encontrados em ${ORIGEM_RUNNER} ou ${MODELO_AMBIENTE}."
    exit 1
  fi
}

criar_usuario() {
  if id -u "$USUARIO_SERVICO" >/dev/null 2>&1; then
    log_info "Usuário ${USUARIO_SERVICO} já existe."
    return 0
  fi
  log_info "Criando usuário de sistema ${USUARIO_SERVICO} (sem shell de login, sem senha, sem sudo)."
  executar useradd --system --home-dir "$PASTA_HOME" --no-create-home \
    --shell /usr/sbin/nologin "$USUARIO_SERVICO"
}

criar_pastas() {
  log_info "Criando pastas do serviço."
  executar mkdir -p "$PASTA_PROJETOS" "$PASTA_HOME"
}

copiar_runner() {
  log_info "Copiando services/office-runner para ${PASTA_RUNNER} (sem node_modules)."
  executar mkdir -p "$PASTA_RUNNER"
  if (( DRY_RUN )); then
    printf '[dry-run] tar (sem node_modules) de %s para %s\n' "$ORIGEM_RUNNER" "$PASTA_RUNNER"
    return 0
  fi
  tar -C "$ORIGEM_RUNNER" --exclude=node_modules -cf - . | tar -C "$PASTA_RUNNER" -xf -
}

ajustar_permissoes() {
  log_info "Ajustando donos (${USUARIO_SERVICO}:${GRUPO_SERVICO}) e permissões (750)."
  executar chown -R "${USUARIO_SERVICO}:${GRUPO_SERVICO}" "$RAIZ_SERVICO"
  executar chmod 750 "$RAIZ_SERVICO"
}

instalar_dependencias() {
  log_info "Instalando dependências de produção (npm ci --omit=dev) como ${USUARIO_SERVICO}."
  executar_em "$PASTA_RUNNER" runuser -u "$USUARIO_SERVICO" -- \
    env HOME="$PASTA_HOME" npm ci --omit=dev
}

instalar_ambiente() {
  if [[ -e "$ARQUIVO_AMBIENTE" ]]; then
    log_info "${ARQUIVO_AMBIENTE} já existe: conteúdo preservado."
    log_info "Garantindo permissão 600 e dono root em ${ARQUIVO_AMBIENTE}."
    executar chown root:root "$ARQUIVO_AMBIENTE"
    executar chmod 600 "$ARQUIVO_AMBIENTE"
    return 0
  fi
  log_info "Copiando o modelo para ${ARQUIVO_AMBIENTE}. Preencha os valores antes de subir o serviço."
  executar install -m 600 -o root -g root "$MODELO_AMBIENTE" "$ARQUIVO_AMBIENTE"
}

imprimir_proximos_passos() {
  cat <<AVISO

Instalação concluída (ou simulada, se --dry-run).

Próximos passos:
  1. Edite ${ARQUIVO_AMBIENTE} e preencha SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY.
  2. Suba o serviço:
       systemctl enable --now office-runner
  3. Verifique o health (deve responder {"ok":true,...}):
       curl -s http://127.0.0.1:${PORTA_HEALTH}/office-api/health
  4. Se algo falhar, veja os logs:
       journalctl -u office-runner -n 100 --no-pager

Depois, inclua o trecho deploy/office/nginx-office.conf no site srmpretech.online (veja deploy/office/README.md).
AVISO
}

mostrar_ajuda() {
  cat <<AJUDA
Uso: sudo ./install.sh [--dry-run]

  --dry-run   Apenas imprime os comandos que seriam executados.
  -h, --help  Mostra esta ajuda.
AJUDA
}

processar_argumentos() {
  for argumento in "$@"; do
    case "$argumento" in
      --dry-run) DRY_RUN=1 ;;
      -h|--help) mostrar_ajuda; exit 0 ;;
      *) log_erro "Argumento desconhecido: ${argumento}"; mostrar_ajuda; exit 1 ;;
    esac
  done
}

main() {
  processar_argumentos "$@"
  exigir_root
  exigir_origem
  criar_usuario
  criar_pastas
  copiar_runner
  ajustar_permissoes
  instalar_dependencias
  instalar_ambiente
  imprimir_proximos_passos
}

main "$@"
