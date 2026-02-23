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

node --version > nul 2>&1
if errorlevel 1 (
    echo  [MANQUANT]  Node.js n'est pas installe
    echo              Telecharge-le ici : https://nodejs.org
    set /a ERRORS+=1
) else (
    for /f "tokens=*" %%v in ('node --version') do echo  [OK]  Node.js %%v
)

pnpm --version > nul 2>&1
if errorlevel 1 (
    echo  [MANQUANT]  pnpm n'est pas installe
    echo              Lance dans un terminal : npm install -g pnpm
    set /a ERRORS+=1
) else (
    for /f "tokens=*" %%v in ('pnpm --version') do echo  [OK]  pnpm %%v
)

if not exist "C:\yt-dlp\yt-dlp.exe" (
    echo  [MANQUANT]  yt-dlp non trouve a C:\yt-dlp\yt-dlp.exe
    echo              Telecharge-le ici : https://github.com/yt-dlp/yt-dlp/releases
    set /a ERRORS+=1
) else (
    for /f "tokens=*" %%v in ('C:\yt-dlp\yt-dlp.exe --version 2^>nul') do echo  [OK]  yt-dlp %%v
)

if not exist "C:\ffmpeg\bin\ffmpeg.exe" (
    echo  [MANQUANT]  ffmpeg non trouve a C:\ffmpeg\bin\ffmpeg.exe
    echo              Telecharge-le ici : https://ffmpeg.org/download.html
    set /a ERRORS+=1
) else (
    echo  [OK]  ffmpeg trouve
)

if not exist ".env" (
    echo  [MANQUANT]  Fichier .env introuvable
    echo              Copie .env.example vers .env et renseigne tes cles API
    set /a ERRORS+=1
    goto :show_result
)
echo  [OK]  Fichier .env present

set TWITCH_ID_OK=0
set TWITCH_SECRET_OK=0
set YOUTUBE_OK=0
for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    if "%%a"=="TWITCH_CLIENT_ID" if not "%%b"=="" set TWITCH_ID_OK=1
    if "%%a"=="TWITCH_CLIENT_SECRET" if not "%%b"=="" set TWITCH_SECRET_OK=1
    if "%%a"=="YOUTUBE_API_KEY" if not "%%b"=="" set YOUTUBE_OK=1
)

if !TWITCH_ID_OK!==1 if !TWITCH_SECRET_OK!==1 (
    echo  [OK]  Cles Twitch presentes
) else (
    echo  [VIDE]  Cles Twitch manquantes dans .env
    echo          Obtiens-les ici : https://dev.twitch.tv/console/apps
)

if !YOUTUBE_OK!==1 (
    echo  [OK]  Cle YouTube presente
) else (
    echo  [VIDE]  YOUTUBE_API_KEY manquante dans .env
    echo          Obtiens-la ici : https://console.cloud.google.com/apis/credentials
)

if not exist "node_modules" (
    echo.
    echo  Installation des dependances...
    pnpm install --force
    if errorlevel 1 (
        echo.
        echo  [ERREUR]  pnpm install a echoue
        set /a ERRORS+=1
        goto :show_result
    )
    echo  [OK]  Dependances installees
)

:show_result
echo.
if !ERRORS! GTR 0 (
    echo  ─────────────────────────────────────────────────────
    echo  !ERRORS! probleme^(s^) detecte^(s^). Regle-les avant de continuer.
    echo  ─────────────────────────────────────────────────────
    echo.
    pause
    exit /b 1
)

echo  ─────────────────────────────────────────────────────
echo  Tout est en ordre. Lancement de LiveRecorder...
echo  Ouvre http://localhost:3001 dans ton navigateur.
echo  Ferme cette fenetre pour arreter le serveur.
echo  ─────────────────────────────────────────────────────
echo.

pnpm start
if errorlevel 1 (
    echo.
    echo  [ERREUR]  Le serveur s'est arrete de facon inattendue.
    echo.
    pause
)
