@echo off
title LiveRecorder
chcp 65001 > nul
setlocal enabledelayedexpansion

set ERRORS=0
set MISSING_YTDLP=0
set MISSING_FFMPEG=0
set NEED_DL=0
set YTDLP_EXE=C:\yt-dlp\yt-dlp.exe
set FFMPEG_EXE=C:\ffmpeg\bin\ffmpeg.exe

:: ================================================================
echo.
echo  ================================================================
echo.
echo        L I V E R E C O R D E R
echo        Telechargeur de VODs  /  VOD Downloader
echo.
echo  ================================================================
echo.
echo.

:: ================================================================
::  PRESENTATION
:: ================================================================
echo  Bienvenue !  /  Welcome!
echo.
echo  Ce script va preparer et lancer LiveRecorder sur ta machine.
echo  This script will set up and launch LiveRecorder on your machine.
echo.
echo  ----------------------------------------------------------------
echo.
echo  Ce qui va se passer  /  What will happen :
echo.
echo    1.  Verification de Node.js et pnpm
echo        Check Node.js and pnpm
echo.
echo    2.  Verification de yt-dlp et ffmpeg
echo        Check yt-dlp and ffmpeg
echo        (telechargement propose si absents / offered if missing)
echo.
echo    3.  Installation des dependances  (premiere fois uniquement)
echo        Install dependencies  (first time only)
echo.
echo    4.  Compilation de l'interface web
echo        Build the web interface
echo.
echo    5.  Demarrage du serveur local  +  ouverture du navigateur
echo        Start the local server  +  open your browser
echo.
echo  ----------------------------------------------------------------
echo.
echo  Aucune donnee n'est collectee ou envoyee.
echo  No data is collected or sent. Everything stays on your machine.
echo.
echo  ================================================================
echo.
set /p CONSENT_START=   Continuer / Continue ?   [O]ui  [Y]es     [N]on pour annuler  :
echo.

if /i "!CONSENT_START!" NEQ "O" if /i "!CONSENT_START!" NEQ "Y" (
    echo.
    echo   Operation annulee.  /  Cancelled.
    echo.
    pause
    exit /b 0
)

echo.
echo.
:: ================================================================
echo  ================================================================
echo   Etape 1 / Step 1  -  Prerequis systeme / System requirements
echo  ================================================================
echo.

node --version > nul 2>&1
if errorlevel 1 (
    echo   [MANQUANT]   Node.js n'est pas installe  /  not installed.
    echo                Telecharge-le sur  /  Download at : https://nodejs.org
    echo                Puis relance ce fichier.  /  Then re-run this file.
    set /a ERRORS+=1
) else (
    for /f "tokens=*" %%v in ('node --version') do echo   [OK]         Node.js %%v
)

call pnpm --version > nul 2>&1
if errorlevel 1 (
    echo   [AUTO]       pnpm absent, installation en cours...
    echo   [AUTO]       pnpm missing, installing...
    call npm install -g pnpm > nul 2>&1
    if errorlevel 1 (
        echo   [ERREUR]     Impossible d'installer pnpm.
        echo   [ERROR]      Could not install pnpm. Run : npm install -g pnpm
        set /a ERRORS+=1
    ) else (
        for /f "tokens=*" %%v in ('pnpm --version') do echo   [OK]         pnpm %%v  (installe / installed)
    )
) else (
    for /f "tokens=*" %%v in ('pnpm --version') do echo   [OK]         pnpm %%v
)

echo.
if !ERRORS! GTR 0 goto :fatal

:: ================================================================
echo  ================================================================
echo   Etape 2 / Step 2  -  Outils / Download tools
echo  ================================================================
echo.

if exist "!YTDLP_EXE!" (
    echo   [OK]         yt-dlp   (!YTDLP_EXE!)
) else (
    echo   [MANQUANT]   yt-dlp   (C:\yt-dlp\yt-dlp.exe)
    set MISSING_YTDLP=1
    set /a NEED_DL+=1
)

if exist "!FFMPEG_EXE!" (
    echo   [OK]         ffmpeg   (!FFMPEG_EXE!)
) else (
    echo   [MANQUANT]   ffmpeg   (C:\ffmpeg\bin\ffmpeg.exe)
    set MISSING_FFMPEG=1
    set /a NEED_DL+=1
)

echo.
if !NEED_DL! EQU 0 goto :node_deps

:: Verification droits administrateur
net session > nul 2>&1
if errorlevel 1 (
    echo  ================================================================
    echo   Droits administrateur requis  /  Admin rights required
    echo.
    echo   Pour installer les outils dans C:\, relance ce fichier en
    echo   faisant : Clic droit  >  Executer en tant qu'administrateur.
    echo.
    echo   To install tools in C:\, right-click this file and select
    echo   "Run as administrator".
    echo  ================================================================
    echo.
    pause
    exit /b 1
)

echo   !NEED_DL! outil(s) manquant(s)  /  !NEED_DL! missing tool(s) :
echo.
if !MISSING_YTDLP!==1 echo     - yt-dlp   (~20 Mo)   github.com/yt-dlp/yt-dlp
if !MISSING_FFMPEG!==1 echo     - ffmpeg   (~80 Mo)   github.com/BtbN/FFmpeg-Builds
echo.
echo   Ces outils sont indispensables pour telecharger des videos.
echo   These tools are required to download videos.
echo   Ils seront recuperes depuis leurs depots officiels GitHub.
echo   They will be fetched from their official GitHub repositories.
echo.
echo  ----------------------------------------------------------------
echo.
set /p CONSENT_DL=   Telecharger / Download ?   [O]ui  [Y]es     [N]on = installer manuellement  :
echo.

if /i "!CONSENT_DL!" NEQ "O" if /i "!CONSENT_DL!" NEQ "Y" goto :manual_install

if !MISSING_YTDLP!==1 (
    echo.
    echo   Telechargement de yt-dlp...  /  Downloading yt-dlp...
    if not exist "C:\yt-dlp" mkdir "C:\yt-dlp"
    curl.exe -L --progress-bar -o "!YTDLP_EXE!" "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
    if errorlevel 1 (
        echo   [ERREUR / ERROR]   Echec du telechargement. Verifie ta connexion.
        echo                      Download failed. Check your internet connection.
        set /a ERRORS+=1
    ) else (
        echo   [OK]   yt-dlp installe dans C:\yt-dlp\
    )
    echo.
)

if !MISSING_FFMPEG!==1 (
    echo   Telechargement de ffmpeg  (1-2 minutes)...  /  Downloading ffmpeg...
    curl.exe -L --progress-bar -o "%TEMP%\ffmpeg_lr.zip" "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
    if errorlevel 1 (
        echo   [ERREUR / ERROR]   Echec du telechargement. Verifie ta connexion.
        echo                      Download failed. Check your internet connection.
        set /a ERRORS+=1
    ) else (
        echo   Extraction en cours...  /  Extracting...
        powershell -NoProfile -Command "& { $zip = [System.IO.Path]::GetTempPath() + 'ffmpeg_lr.zip'; $out = [System.IO.Path]::GetTempPath() + 'ffmpeg_lr_ext'; if (Test-Path $out) { Remove-Item $out -Recurse -Force }; Expand-Archive -Path $zip -DestinationPath $out -Force; $exe = Get-ChildItem $out -Filter 'ffmpeg.exe' -Recurse | Select-Object -First 1; New-Item -ItemType Directory -Force -Path 'C:\ffmpeg\bin' | Out-Null; Copy-Item $exe.FullName 'C:\ffmpeg\bin\ffmpeg.exe' -Force; Remove-Item $zip -Force; Remove-Item $out -Recurse -Force }"
        if errorlevel 1 (
            echo   [ERREUR / ERROR]   Extraction echouee.  /  Extraction failed.
            set /a ERRORS+=1
        ) else (
            echo   [OK]   ffmpeg installe dans C:\ffmpeg\bin\
        )
    )
    echo.
)

if !ERRORS! GTR 0 goto :fatal
goto :node_deps

:manual_install
echo.
echo   Installation manuelle  /  Manual installation :
echo.
if !MISSING_YTDLP!==1 (
    echo     yt-dlp  :  https://github.com/yt-dlp/yt-dlp/releases/latest
    echo                Placer yt-dlp.exe dans C:\yt-dlp\
    echo                Place yt-dlp.exe in C:\yt-dlp\
    echo.
)
if !MISSING_FFMPEG!==1 (
    echo     ffmpeg  :  https://ffmpeg.org/download.html
    echo                Placer ffmpeg.exe dans C:\ffmpeg\bin\
    echo                Place ffmpeg.exe in C:\ffmpeg\bin\
    echo.
)
echo   Tu peux aussi definir des chemins personnalises dans les Parametres.
echo   You can also set custom paths in the Settings tab after first launch.
echo.
pause
exit /b 1

:: ================================================================
:node_deps
echo  ================================================================
echo   Etape 3 / Step 3  -  Dependances Node.js / Node.js dependencies
echo  ================================================================
echo.

if not exist "node_modules" (
    echo   Installation des paquets  (premiere fois, patience...)
    echo   Installing packages  (first time, please wait...)
    echo.
    call pnpm install
    if errorlevel 1 (
        echo.
        echo   [ERREUR / ERROR]   pnpm install a echoue.  /  pnpm install failed.
        set /a ERRORS+=1
        goto :fatal
    )
    echo.
    echo   [OK]   Dependances installees.  /  Dependencies installed.
) else (
    echo   [OK]   Dependances presentes.  /  Dependencies ready.
)
echo.

:: ================================================================
echo  ================================================================
echo   Compilation de l'interface  /  Building the interface
echo  ================================================================
echo.

call pnpm --filter frontend build
if errorlevel 1 (
    echo.
    echo   [ERREUR / ERROR]   La compilation a echoue.  /  Build failed.
    goto :fatal
)
echo.

:: ================================================================
echo  ================================================================
echo.
echo     Tout est pret !  /  All set!
echo.
echo     Le navigateur va s'ouvrir dans quelques secondes.
echo     Your browser will open in a few seconds.
echo.
echo     Ferme cette fenetre pour arreter le serveur.
echo     Close this window to stop the server.
echo.
echo  ================================================================
echo.

powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue; if ($proc) { if ($proc.Name -eq 'node') { Stop-Process -Id $_.OwningProcess -Force; Write-Host '  [nettoyage] Instance precedente arretee / Previous instance stopped.' } else { Write-Host ('  [info] Port 3000 occupe par / occupied by : ' + $proc.Name + ' - le serveur utilisera un autre port / server will use another port.') } } }"

node apps\backend\scripts\detect-tools.js 2>nul

if exist ".port" del ".port"

start /B powershell -NoProfile -Command "while (-not (Test-Path '.port')) { Start-Sleep -Milliseconds 500 }; $p = (Get-Content '.port').Trim(); Start-Process ('http://localhost:' + $p)"

call pnpm start
set SERVER_EXIT=!errorlevel!
echo.
echo  ================================================================
if !SERVER_EXIT! NEQ 0 (
    echo   Erreur / Error : le serveur s'est arrete  ^(code !SERVER_EXIT!^).
    echo   Fais defiler vers le haut pour voir le message d'erreur.
    echo   Scroll up to see the error message.
) else (
    echo   Serveur arrete normalement.  /  Server stopped normally.
)
echo  ================================================================
echo.
echo   Appuie sur une touche pour fermer.  /  Press any key to close.
pause
goto :eof

:fatal
echo.
echo  ================================================================
echo   !ERRORS! probleme(s) detecte(s).  /  !ERRORS! issue(s) found.
echo   Corrige les erreurs ci-dessus et relance le script.
echo   Fix the errors above and run the script again.
echo  ================================================================
echo.
pause
exit /b 1
