@echo off
:: ============================================================
::  KIOSQUE TOURISTIQUE FIANARANTSOA — Lanceur Windows
::  Ce script :
::   1. Build le frontend React en production
::   2. Démarre backend + frontend via PM2
::   3. Ouvre Chromium en mode kiosque plein écran
:: ============================================================

title Kiosque Fianarantsoa — Démarrage

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║   KIOSQUE TOURISTIQUE — FIANARANTSOA             ║
echo  ║   École Nationale d'Informatique (ENI) — 2024   ║
echo  ╚══════════════════════════════════════════════════╝
echo.

:: Répertoire racine du projet
set PROJECT_ROOT=%~dp0..
set CLIENT_DIR=%PROJECT_ROOT%\client
set SERVER_DIR=%PROJECT_ROOT%\server
set DEPLOY_DIR=%PROJECT_ROOT%\deploy

:: Créer le dossier de logs s'il n'existe pas
if not exist "%PROJECT_ROOT%\logs" mkdir "%PROJECT_ROOT%\logs"

echo [1/5] Verification des dependances...
where node >nul 2>&1
if errorlevel 1 (
  echo ERREUR : Node.js n'est pas installe. Rendez-vous sur https://nodejs.org
  pause
  exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
  echo ERREUR : npm n'est pas disponible.
  pause
  exit /b 1
)

echo [2/5] Build du frontend React (production)...
cd /d "%CLIENT_DIR%"
call npm run build
if errorlevel 1 (
  echo ERREUR : Le build du frontend a echoue. Verifiez les logs ci-dessus.
  pause
  exit /b 1
)
echo      Build termine avec succes.

echo [3/5] Installation de PM2 si necessaire...
where pm2 >nul 2>&1
if errorlevel 1 (
  echo      PM2 non trouve, installation globale...
  call npm install -g pm2
)

echo [4/5] Demarrage des serveurs via PM2...
cd /d "%DEPLOY_DIR%"
call pm2 start ecosystem.config.js --env production
call pm2 save

echo [5/5] En attente du demarrage des serveurs (5 secondes)...
timeout /t 5 /nobreak > nul

echo.
echo  Ouverture du kiosque en mode plein ecran...
echo  URL: http://localhost:3000
echo.

:: Tentative avec Chromium (Raspberry Pi / Linux via WSL)
set CHROMIUM_PATHS=^
  "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" ^
  "C:\Program Files\Chromium\Application\chromium.exe" ^
  "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

set KIOSK_FLAGS=--kiosk --noerrdialogs --disable-infobars --no-first-run --disable-features=TranslateUI --app=http://localhost:3000 --window-size=1920,1080 --start-fullscreen --disable-session-crashed-bubble --disable-restore-session-state --no-default-browser-check

:: Chercher Chrome/Chromium installé
for %%C in (
  "C:\Program Files\Google\Chrome\Application\chrome.exe"
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
  "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
  "C:\Program Files\Chromium\Application\chromium.exe"
  "C:\Program Files (x86)\Chromium\Application\chromium.exe"
) do (
  if exist %%C (
    echo      Lancement avec : %%C
    start "" %%C %KIOSK_FLAGS%
    goto :started
  )
)

:: Fallback : Microsoft Edge (pré-installé sur Windows 10/11)
echo      Chrome non trouve, essai avec Microsoft Edge...
set EDGE="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if exist %EDGE% (
  start "" %EDGE% --kiosk http://localhost:3000 --edge-kiosk-type=fullscreen --no-first-run
  goto :started
)

echo AVERTISSEMENT : Aucun navigateur compatible trouve.
echo Ouvrez manuellement : http://localhost:3000
pause
goto :end

:started
echo.
echo  ✓ Kiosque demarre !
echo  ✓ Back-Office admin : http://localhost:3000 (clic long 5s en bas a droite)
echo  ✓ API Backend       : http://localhost:5000/api/health
echo.
echo  Pour arreter : pm2 stop all  (dans un terminal)
echo  Pour les logs : pm2 logs
echo.

:end

