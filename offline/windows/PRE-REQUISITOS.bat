@echo off
rem Instala, sem internet, o que o Docker Desktop precisa no Windows 10/11.
net session >nul 2>&1 || (powershell -Command "Start-Process -Verb RunAs -FilePath '%~f0'" & exit /b)
cd /d "%~dp0pre-requisitos"
echo [1/3] Ativando recursos do Windows (Plataforma de Maquina Virtual e WSL)...
dism /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
dism /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
echo [2/3] Instalando o WSL...
msiexec /i wsl.x64.msi /passive /norestart
echo [3/3] Instalando o Docker Desktop...
DockerDesktopInstaller.exe install --quiet --accept-license --backend=wsl-2
echo.
echo REINICIE O COMPUTADOR. Depois abra o Docker Desktop (pode pular o login),
echo espere "Engine running" e rode INSTALAR.bat.
pause
