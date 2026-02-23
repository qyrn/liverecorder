@echo off
title LiveRecorder
chcp 65001 > nul
setlocal enabledelayedexpansion

echo.
echo  ██╗     ██╗██╗   ██╗███████╗██████╗ ███████╗ ██████╗
echo  ██║     ██║██║   ██║██╔════╝██╔══██╗██╔════╝██╔════╝
echo  ██║     ██║██║   ██║█████╗  ██████╔╝█████╗  ██║
echo  ██║     ██║╚██╗ ██╔╝██╔══╝  ██╔══██╗██╔══╝  ██║
echo  ███████╗██║ ╚████╔╝ ███████╗██║  ██║███████╗╚██████╗
echo  ╚══════╝╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝╚══════╝ ╚═════╝
echo   R E C O R D E R
echo.

set ERRORS=0

REM ─── Vérification Node.js ───────────────────────────────────────────────────
node --version > nul 2>&1
if errorlevel 1 (
    echo  [MANQUANT]  Node.js n'est pas installé
    echo              Télécharge-le ici : https://nodejs.org
    set /a ERRORS+=1
) else (
    for /f "tokens=*" %%v in ('node --version') do echo  [OK]  Node.js %%v
)

REM ─── Vérification pnpm ──────────────────────────────────────────────────────
pnpm --version > nul 2>&1
if errorlevel 1 (
    echo  [MANQUANT]  pnpm n'est pas installé
    echo              Lance : npm install -g pnpm
    set /a ERRORS+=1
) else (
    for /f "tokens=*" %%v in ('pnpm --version') do echo  [OK]  pnpm %%v
)

REM ─── Vérification yt-dlp ────────────────────────────────────────────────────
if not exist "C:\yt-dlp\yt-dlp.exe" (
    echo  [MANQUANT]  yt-dlp non trouvé à C:\yt-dlp\yt-dlp.exe
    echo              Télécharge-le ici : https://github.com/yt-dlp/yt-dlp/releases
    set /a ERRORS+=1
) else (
    for /f "tokens=*" %%v in ('C:\yt-dlp\yt-dlp.exe --version 2^>nul') do echo  [OK]  yt-dlp %%v
)

REM ─── Vérification ffmpeg ────────────────────────────────────────────────────
if not exist "C:\ffmpeg\bin\ffmpeg.exe" (
    echo  [MANQUANT]  ffmpeg non trouvé à C:\ffmpeg\bin\ffmpeg.exe
    echo              Télécharge-le ici : https://ffmpeg.org/download.html
    set /a ERRORS+=1
) else (
    echo  [OK]  ffmpeg trouvé
)

REM ─── Vérification .env ──────────────────────────────────────────────────────
if not exist ".env" (
    echo  [MANQUANT]  Fichier .env introuvable
    echo              Copie .env.example vers .env et renseigne tes clés API
    set /a ERRORS+=1
    goto :show_result
)
echo  [OK]  Fichier .env présent

REM ─── Vérification clés API Twitch ───────────────────────────────────────────
set TWITCH_ID_OK=0
set TWITCH_SECRET_OK=0
for /f "tokens=1,* delims==" %%a in (.env) do (
    if "%%a"=="TWITCH_CLIENT_ID" if not "%%b"=="" set TWITCH_ID_OK=1
    if "%%a"=="TWITCH_CLIENT_SECRET" if not "%%b"=="" set TWITCH_SECRET_OK=1
)
if !TWITCH_ID_OK!==0 (
    echo  [VIDE]  TWITCH_CLIENT_ID non renseigné dans .env
    echo          Obtiens tes clés ici : https://dev.twitch.tv/console/apps
) else if !TWITCH_SECRET_OK!==0 (
    echo  [VIDE]  TWITCH_CLIENT_SECRET non renseigné dans .env
    echo          Obtiens tes clés ici : https://dev.twitch.tv/console/apps
) else (
    echo  [OK]  Clés Twitch présentes
)

REM ─── Vérification clé API YouTube ───────────────────────────────────────────
set YOUTUBE_OK=0
for /f "tokens=1,* delims==" %%a in (.env) do (
    if "%%a"=="YOUTUBE_API_KEY" if not "%%b"=="" set YOUTUBE_OK=1
)
if !YOUTUBE_OK!==0 (
    echo  [VIDE]  YOUTUBE_API_KEY non renseigné dans .env
    echo          Obtiens ta clé ici : https://console.cloud.google.com/apis/credentials
) else (
    echo  [OK]  Clé YouTube présente
)

REM ─── Vérification node_modules ──────────────────────────────────────────────
if not exist "node_modules" (
    echo.
    echo  Installation des dépendances...
    pnpm install --force
    if errorlevel 1 (
        echo  [ERREUR]  pnpm install a échoué
        set /a ERRORS+=1
        goto :show_result
    )
)

:show_result
echo.
if !ERRORS! GTR 0 (
    echo  ─────────────────────────────────────────────────────────
    echo  !ERRORS! problème(s) détecté(s). Règle-les avant de continuer.
    echo  ─────────────────────────────────────────────────────────
    echo.
    pause
    exit /b 1
)

echo  ─────────────────────────────────────────────────────────
echo  Tout est en ordre. Lancement de LiveRecorder...
echo  Ouvre http://localhost:3001 dans ton navigateur.
echo  ─────────────────────────────────────────────────────────
echo.

pnpm start
