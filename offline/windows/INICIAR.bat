@echo off
rem Sobe o SPACE TECH OS (o Docker Desktop precisa estar aberto).
cd /d "%~dp0space-tech-os\supabase"
docker compose -f docker-compose.yml -f docker-compose.offline.yml up -d
echo.
echo Sistema subindo. Acesse http://IP-DESTA-MAQUINA:8080
pause
