@echo off
title LiveRecorder
chcp 65001 > nul
setlocal enabledelayedexpansion

echo.
echo  ================================================
echo   LiveRecorder  -  D O W N L O A D E R
echo  ================================================
echo.

set ERRORS=0
set MISSING_YTDLP=0
set MISSING_FFMPEG=0
set NEED_DL=0

set YTDLP_EXE=C:\yt-dlp\yt-dlp.exe
set FFMPEG_EXE=C:\ffmpeg\bin\ffmpeg.exe

:: =====================================================
echo  =====================================================
echo   Etape 1/3  -  Prerequis systeme
echo  =====================================================
echo.

node --version > nul 2>&1
if errorlevel 1 (
    echo  [MANQUANT]   Node.js n'est pas installe.
    echo               Il est indispensable pour faire tourner LiveRecorder.
    echo               Telecharge-le ici : https://nodejs.org
    echo               Puis relance ce fichier.
    set /a ERRORS+=1
) else (
    for /f "tokens=*" %%v in ('node --version') do echo  [OK]         Node.js %%v
)

call pnpm --version > nul 2>&1
if errorlevel 1 (
    echo  [AUTO]       pnpm absent - installation en cours...
    call npm install -g pnpm > nul 2>&1
    if errorlevel 1 (
        echo  [ERREUR]     Impossible d'installer pnpm automatiquement.
        echo               Lance manuellement : npm install -g pnpm
        set /a ERRORS+=1
    ) else (
        for /f "tokens=*" %%v in ('pnpm --version') do echo  [OK]         pnpm %%v ^(installe^)
    )
) else (
    for /f "tokens=*" %%v in ('pnpm --version') do echo  [OK]         pnpm %%v
)

echo.
if !ERRORS! GTR 0 goto :fatal

:: =====================================================
echo  =====================================================
echo   Etape 2/3  -  Outils de telechargement
echo  =====================================================
echo.

if exist "!YTDLP_EXE!" (
    echo  [OK]         yt-dlp  ^(!YTDLP_EXE!^)
) else (
    echo  [MANQUANT]   yt-dlp  ^(C:\yt-dlp\yt-dlp.exe^)
    set MISSING_YTDLP=1
    set /a NEED_DL+=1
)

if exist "!FFMPEG_EXE!" (
    echo  [OK]         ffmpeg  ^(!FFMPEG_EXE!^)
) else (
    echo  [MANQUANT]   ffmpeg  ^(C:\ffmpeg\bin\ffmpeg.exe^)
    set MISSING_FFMPEG=1
    set /a NEED_DL+=1
)

echo.
if !NEED_DL! EQU 0 goto :node_deps

:: Verifier les droits administrateur avant toute installation
net session > nul 2>&1
if errorlevel 1 (
    echo  =====================================================
    echo   ATTENTION : droits administrateur requis
    echo.
    echo   Pour installer yt-dlp et ffmpeg dans C:\, ce script
    echo   doit etre execute en tant qu'administrateur.
    echo.
    echo   Ferme cette fenetre, puis :
    echo     1. Clic droit sur start.bat
    echo     2. Selectionner "Executer en tant qu'administrateur"
    echo  =====================================================
    echo.
    pause
    exit /b 1
)

echo  =====================================================
echo   !NEED_DL! outil(s) manquant(s) - installation disponible
echo.
if !MISSING_YTDLP!==1 echo     yt-dlp  (~20 Mo)   github.com/yt-dlp/yt-dlp
if !MISSING_FFMPEG!==1 echo     ffmpeg  (~80 Mo)   github.com/BtbN/FFmpeg-Builds
echo.
echo   Ces outils sont necessaires pour telecharger des videos.
echo   Ils seront recuperes depuis leurs depots officiels GitHub.
echo  =====================================================
echo.
set /p CONSENT=  Telecharger automatiquement ? [O/N]  :
echo.

if /i "!CONSENT!" NEQ "O" goto :manual_install

if !MISSING_YTDLP!==1 (
    echo  Telechargement de yt-dlp depuis GitHub...
    if not exist "C:\yt-dlp" mkdir "C:\yt-dlp"
    curl.exe -L --progress-bar -o "!YTDLP_EXE!" "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
    if errorlevel 1 (
        echo  [ERREUR]     Echec du telechargement. Verifie ta connexion internet.
        set /a ERRORS+=1
    ) else (
        echo  [OK]         yt-dlp installe dans C:\yt-dlp\
    )
    echo.
)

if !MISSING_FFMPEG!==1 (
    echo  Telechargement de ffmpeg depuis GitHub ^(1-2 minutes^)...
    curl.exe -L --progress-bar -o "%TEMP%\ffmpeg_lr.zip" "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
    if errorlevel 1 (
        echo  [ERREUR]     Echec du telechargement. Verifie ta connexion internet.
        set /a ERRORS+=1
    ) else (
        echo  Extraction en cours...
        powershell -NoProfile -Command "& { $zip = [System.IO.Path]::GetTempPath() + 'ffmpeg_lr.zip'; $out = [System.IO.Path]::GetTempPath() + 'ffmpeg_lr_ext'; if (Test-Path $out) { Remove-Item $out -Recurse -Force }; Expand-Archive -Path $zip -DestinationPath $out -Force; $exe = Get-ChildItem $out -Filter 'ffmpeg.exe' -Recurse | Select-Object -First 1; New-Item -ItemType Directory -Force -Path 'C:\ffmpeg\bin' | Out-Null; Copy-Item $exe.FullName 'C:\ffmpeg\bin\ffmpeg.exe' -Force; Remove-Item $zip -Force; Remove-Item $out -Recurse -Force }"
        if errorlevel 1 (
            echo  [ERREUR]     Extraction echouee.
            set /a ERRORS+=1
        ) else (
            echo  [OK]         ffmpeg installe dans C:\ffmpeg\bin\
        )
    )
    echo.
)

if !ERRORS! GTR 0 goto :fatal
goto :node_deps

:manual_install
echo  Pour installer les outils manuellement :
echo.
if !MISSING_YTDLP!==1 (
    echo    yt-dlp  :  https://github.com/yt-dlp/yt-dlp/releases/latest
    echo               Telecharge yt-dlp.exe et place-le dans C:\yt-dlp\
    echo.
)
if !MISSING_FFMPEG!==1 (
    echo    ffmpeg  :  https://ffmpeg.org/download.html
    echo               Dezippe l'archive et place ffmpeg.exe dans C:\ffmpeg\bin\
    echo.
)
echo  Tu peux aussi definir des chemins personnalises dans
echo  l'application apres le premier lancement ^(onglet Parametres^).
echo.
pause
exit /b 1

:: =====================================================
:node_deps
echo  =====================================================
echo   Etape 3/3  -  Dependances Node.js
echo  =====================================================
echo.

if not exist "node_modules" (
    echo  Installation des paquets ^(premiere fois uniquement^)...
    call pnpm install
    if errorlevel 1 (
        echo.
        echo  [ERREUR]     pnpm install a echoue.
        set /a ERRORS+=1
        goto :fatal
    )
    echo  [OK]         Dependances installees
) else (
    echo  [OK]         Dependances Node.js presentes
)
echo.

:: =====================================================
echo  =====================================================
echo   Tout est en ordre  -  LiveRecorder demarre...
echo.
echo   Le navigateur s'ouvrira automatiquement.
echo   Ferme cette fenetre pour arreter le serveur.
echo  =====================================================
echo.

:: Tuer une eventuelle instance Node precedente sur le port 3000 (fermeture sans Ctrl+C)
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { $p = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue; if ($p -and $p.Name -eq 'node') { Stop-Process -Id $_.OwningProcess -Force; Write-Host '  [nettoyage] Instance precedente arretee.' } }"

:: Detecter automatiquement les chemins des outils (streamlink, etc.)
node apps\backend\scripts\detect-tools.js 2>nul

if exist ".port" del ".port"

start /B powershell -NoProfile -Command "while (-not (Test-Path '.port')) { Start-Sleep -Milliseconds 500 }; $p = (Get-Content '.port').Trim(); Start-Process ('http://localhost:' + $p)"

call pnpm start
set SERVER_EXIT=!errorlevel!
echo.
echo  =====================================================
if !SERVER_EXIT! NEQ 0 (
    echo   ERREUR : le serveur s'est arrete ^(code !SERVER_EXIT!^).
    echo   Fais defiler vers le haut pour voir le message d'erreur.
) else (
    echo   Le serveur s'est arrete normalement.
)
echo  =====================================================
echo.
echo  Appuie sur une touche pour fermer cette fenetre...
pause
goto :eof

:fatal
echo.
echo  =====================================================
echo   !ERRORS! probleme(s) detecte(s). Corrige-les et reessaie.
echo  =====================================================
echo.
pause
exit /b 1
