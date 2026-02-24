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
echo   D O W N L O A D E R
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

if not exist ".env" (
    echo  [MANQUANT]  Fichier .env introuvable
    echo              Copie .env.example vers .env et configure tes chemins
    set /a ERRORS+=1
    goto :check_deps
)
echo  [OK]  Fichier .env present

:: Lire YTDLP_PATH et FFMPEG_PATH depuis .env avec fallback
set YTDLP_PATH_CHECK=C:\yt-dlp\yt-dlp.exe
set FFMPEG_PATH_CHECK=C:\ffmpeg\bin\ffmpeg.exe

for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    if "%%a"=="YTDLP_PATH" if not "%%b"=="" set YTDLP_PATH_CHECK=%%b
    if "%%a"=="FFMPEG_PATH" if not "%%b"=="" set FFMPEG_PATH_CHECK=%%b
)

if not exist "!YTDLP_PATH_CHECK!" (
    echo  [MANQUANT]  yt-dlp non trouve a !YTDLP_PATH_CHECK!
    echo              Telecharge-le ici : https://github.com/yt-dlp/yt-dlp/releases
    set /a ERRORS+=1
) else (
    for /f "tokens=*" %%v in ('"!YTDLP_PATH_CHECK!" --version 2^>nul') do echo  [OK]  yt-dlp %%v
)

if not exist "!FFMPEG_PATH_CHECK!" (
    echo  [MANQUANT]  ffmpeg non trouve a !FFMPEG_PATH_CHECK!
    echo              Telecharge-le ici : https://ffmpeg.org/download.html
    set /a ERRORS+=1
) else (
    echo  [OK]  ffmpeg trouve
)

:check_deps
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
echo  Le navigateur va s'ouvrir sur http://localhost:3001
echo  Ferme cette fenetre pour arreter le serveur.
echo  ─────────────────────────────────────────────────────
echo.

start "" "http://localhost:3001"
pnpm start
if errorlevel 1 (
    echo.
    echo  [ERREUR]  Le serveur s'est arrete de facon inattendue.
    echo.
    pause
)
