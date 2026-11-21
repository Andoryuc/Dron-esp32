@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se encontro Node.js en el sistema ^(PATH^).
  echo Instala Node.js LTS para ejecutar el servidor local offline.
  pause
  exit /b 1
)

echo Iniciando Visor 3D Offline del Prototipo en http://localhost:3030 ...
start "" cmd /c "timeout /t 1 /nobreak >nul & start http://localhost:3030"
node servir.js
