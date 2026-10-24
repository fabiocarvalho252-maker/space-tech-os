@echo off
rem Instala (ou reconfigura o IP) o SPACE TECH OS offline. Pede administrador.
net session >nul 2>&1 || (powershell -Command "Start-Process -Verb RunAs -FilePath '%~f0'" & exit /b)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar.ps1"
pause
