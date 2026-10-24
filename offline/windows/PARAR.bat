@echo off
rem Para o SPACE TECH OS sem apagar nenhum dado.
cd /d "%~dp0space-tech-os\supabase"
docker compose -f docker-compose.yml -f docker-compose.offline.yml stop
pause
