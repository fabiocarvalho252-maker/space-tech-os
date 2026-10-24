# SPACE TECH OS - instalação offline no Windows (gerado por offline/gerar-pacote.sh)
# Pode rodar de novo quando quiser: não recarrega o que já existe e serve
# para trocar o IP da máquina (ex.: mudou de rede).
param([string]$Ip = "")

$ErrorActionPreference = "Stop"
$Raiz = $PSScriptRoot
$Supa = Join-Path $Raiz "space-tech-os\supabase"
$AppEnv = Join-Path $Raiz "space-tech-os\app.env"
$PgImage = "supabase/postgres:17.6.1.136"
$Compose = @("compose", "-f", "docker-compose.yml", "-f", "docker-compose.offline.yml")

function Passo($t) { Write-Host ""; Write-Host "==> $t" -ForegroundColor Cyan }
function Falha($t) { Write-Host ""; Write-Host "ERRO: $t" -ForegroundColor Red; exit 1 }

# Escreve com LF e sem BOM: o docker compose lê o \r como parte do valor.
function Salvar-Linhas($arquivo, $linhas) {
    [IO.File]::WriteAllText($arquivo, (($linhas -join "`n") + "`n"), (New-Object Text.UTF8Encoding $false))
}

function Definir-Env($arquivo, $valores) {
    $linhas = [IO.File]::ReadAllLines($arquivo) | ForEach-Object { $_.TrimEnd("`r") }
    foreach ($k in $valores.Keys) {
        $achou = $false
        $linhas = $linhas | ForEach-Object {
            if ($_ -match "^$k=") { $achou = $true; "$k=$($valores[$k])" } else { $_ }
        }
        if (-not $achou) { $linhas += "$k=$($valores[$k])" }
    }
    Salvar-Linhas $arquivo $linhas
}

# ---------------------------------------------------------------- Docker
Passo "Verificando o Docker"
docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Falha "O Docker não está rodando. Instale com PRE-REQUISITOS.bat, abra o Docker Desktop, espere aparecer 'Engine running' e rode este instalador de novo."
}

# -------------------------------------------------------------------- IP
if (-not $Ip) {
    $ips = @(Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' -and $_.InterfaceAlias -notmatch 'vEthernet|WSL|Docker|Loopback' } |
        Select-Object -ExpandProperty IPAddress)
    if ($ips.Count -eq 0) { Falha "Nenhum IP de rede encontrado. Conecte o cabo/Wi-Fi da rede local e tente de novo." }
    Passo "IP desta máquina na rede"
    for ($i = 0; $i -lt $ips.Count; $i++) { Write-Host "  [$($i + 1)] $($ips[$i])" }
    $esc = Read-Host "Qual IP os outros computadores vão usar? (Enter = 1)"
    if (-not $esc) { $esc = 1 }
    $Ip = $ips[[int]$esc - 1]
}
Write-Host "Usando IP $Ip"

# --------------------------------------------------------------- imagens
Passo "Carregando as imagens Docker (na primeira vez demora bastante)"
$existentes = docker images --format "{{.Repository}}:{{.Tag}}"
foreach ($f in Get-ChildItem (Join-Path $Raiz "imagens") -Filter *.tar.gz) {
    # nome do arquivo = imagem com "/" e ":" trocados por "_"; o docker load
    # não diz a imagem antes de carregar, então conferimos pelo nome
    $carregada = $existentes | Where-Object { ($_ -replace '[/:]', '_') + ".tar.gz" -eq $f.Name }
    if ($carregada) { Write-Host "  já carregada: $carregada"; continue }
    Write-Host "  $($f.Name)"
    docker load -i $f.FullName
    if ($LASTEXITCODE -ne 0) { Falha "Não consegui carregar $($f.Name)." }
}

# ----------------------------------------------------------------- dados
Passo "Restaurando banco e arquivos"
$dados = Join-Path $Raiz "dados"
foreach ($vol in "db-data", "storage-data", "db-config", "deno-cache") {
    $nome = "supabase_$vol"
    docker volume inspect $nome *> $null
    if ($LASTEXITCODE -eq 0) { Write-Host "  já existe: $nome (mantido, não sobrescrevo)"; continue }
    docker volume create $nome | Out-Null
    docker run --rm -u 0 --entrypoint tar -v "${nome}:/v" -v "${dados}:/b:ro" $PgImage `
        --numeric-owner -C /v -xzf "/b/$vol.tar.gz"
    if ($LASTEXITCODE -ne 0) {
        docker volume rm $nome | Out-Null
        Falha "Não consegui restaurar $vol."
    }
    Write-Host "  restaurado: $nome"
}

# ---------------------------------------------------------- configuração
Passo "Configurando para http://${Ip}:8080"
Definir-Env (Join-Path $Supa ".env") @{
    "SUPABASE_PUBLIC_URL"      = "http://${Ip}:8000"
    "API_EXTERNAL_URL"         = "http://${Ip}:8000/auth/v1"
    "SITE_URL"                 = "http://${Ip}:8080"
    "ADDITIONAL_REDIRECT_URLS" = "http://localhost:8080,http://${Ip}:8080"
    "COMPOSE_FILE"             = "docker-compose.yml,docker-compose.offline.yml"
    "COMPOSE_PATH_SEPARATOR"   = ","
}
Definir-Env $AppEnv @{
    "VITE_SUPABASE_URL" = "http://${Ip}:8000"
    "VITE_SITE_URL"     = "http://${Ip}:8080"
}

# -------------------------------------------------------------- firewall
Passo "Liberando as portas 8080 e 8000 no Firewall do Windows"
if (-not (Get-NetFirewallRule -DisplayName "SPACE TECH OS" -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName "SPACE TECH OS" -Direction Inbound -Protocol TCP `
        -LocalPort 8080, 8000 -Action Allow -Profile Any | Out-Null
}

# ------------------------------------------------------------------ subir
Passo "Subindo o sistema"
Push-Location $Supa
try {
    docker @Compose up -d --force-recreate
    if ($LASTEXITCODE -ne 0) { Falha "O docker compose falhou. Veja as mensagens acima." }
} finally { Pop-Location }

Passo "Aguardando o app responder"
$ok = $false
for ($i = 0; $i -lt 60; $i++) {
    try { Invoke-WebRequest "http://localhost:8080" -UseBasicParsing -TimeoutSec 5 | Out-Null; $ok = $true; break }
    catch { Start-Sleep 5 }
}

Write-Host ""
if ($ok) {
    Write-Host "PRONTO!" -ForegroundColor Green
} else {
    Write-Host "O app ainda não respondeu (a primeira abertura pode demorar). Tente o endereço abaixo em alguns minutos." -ForegroundColor Yellow
}
Write-Host "  Sistema (qualquer computador da rede):  http://${Ip}:8080"
Write-Host "  Painel do Supabase (Studio):            http://${Ip}:8000  (usuário/senha: DASHBOARD_USERNAME/PASSWORD em space-tech-os\supabase\.env)"
