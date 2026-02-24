@echo off
title LiveRecorder
chcp 65001 > nul
setlocal enabledelayedexpansion

:: ----------------------------------------------------------------
:: Activer les couleurs ANSI (Windows 10+)
:: ----------------------------------------------------------------
reg add HKCU\Console /v VirtualTerminalLevel /t REG_DWORD /d 1 /f > nul 2>&1
for /F %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"

set "R=!ESC![0m"
set "BOLD=!ESC![1m"
set "CYAN=!ESC![1;96m"
set "WHITE=!ESC![0;97m"
set "GREY=!ESC![0;90m"
set "LGREY=!ESC![0;37m"
set "GREEN=!ESC![1;92m"
set "RED=!ESC![1;91m"
set "YELLOW=!ESC![1;93m"
set "MAG=!ESC![1;95m"
set "BLUE=!ESC![0;94m"
set "DIM=!ESC![2;37m"

set ERRORS=0
set MISSING_YTDLP=0
set MISSING_FFMPEG=0
set NEED_DL=0
set YTDLP_EXE=C:\yt-dlp\yt-dlp.exe
set FFMPEG_EXE=C:\ffmpeg\bin\ffmpeg.exe

:: ================================================================
::  BANNIERE
:: ================================================================
cls
echo.
echo.
echo  !GREY!     ___________________________________________________!R!
echo  !GREY!    ^|                                                   ^|!R!
echo  !GREY!    ^|!R!  !CYAN!  L I V E  R E C O R D E R!R!  !GREY!                    ^|!R!
echo  !GREY!    ^|!R!  !DIM!  VOD Downloader   /   Telechargeur de VODs!R!  !GREY!    ^|!R!
echo  !GREY!    ^|___________________________________________________|!R!
echo.
echo.

:: ================================================================
::  PRESENTATION
:: ================================================================
echo  !WHITE!  Ce script va preparer et lancer LiveRecorder sur ta machine.!R!
echo  !GREY!  This script will set up and launch LiveRecorder on your machine.!R!
echo.
echo.
echo  !MAG!  Ce qui va se passer   /   What will happen :!R!
echo.
echo  !GREY!   !R! !LGREY! 1 !R!!GREY!  !R!  !WHITE!Verification de Node.js et pnpm!R!
echo  !GREY!         Check Node.js and pnpm!R!
echo.
echo  !GREY!   !R! !LGREY! 2 !R!!GREY!  !R!  !WHITE!Verification de yt-dlp et ffmpeg!R!
echo  !GREY!         Check yt-dlp and ffmpeg!R!
echo  !GREY!         ^(telechargement propose si absents / offered if missing^)!R!
echo.
echo  !GREY!   !R! !LGREY! 3 !R!!GREY!  !R!  !WHITE!Installation des dependances!R!  !GREY!^(premiere fois uniquement / first time only^)!R!
echo.
echo  !GREY!   !R! !LGREY! 4 !R!!GREY!  !R!  !WHITE!Compilation de l'interface web!R!
echo  !GREY!         Build the web interface!R!
echo.
echo  !GREY!   !R! !LGREY! 5 !R!!GREY!  !R!  !WHITE!Demarrage du serveur local + ouverture du navigateur!R!
echo  !GREY!         Start the local server + open your browser!R!
echo.
echo.
echo  !DIM!  Aucune donnee collectee ou envoyee. Tout reste sur ta machine.!R!
echo  !DIM!  No data collected or sent. Everything stays on your machine.!R!
echo.
echo  !GREY!  ---------------------------------------------------!R!
echo.
echo  !YELLOW!  Continuer   [O]ui  /  [Y]es!R!          !GREY!Annuler   [N]on!R!
echo.
set /p CONSENT_START=     ^>
echo.

if /i "!CONSENT_START!" NEQ "O" if /i "!CONSENT_START!" NEQ "Y" (
    echo  !RED!  Annule.  /  Cancelled.!R!
    echo.
    pause
    exit /b 0
)

:: ================================================================
cls
echo.
echo  !GREY!  ---------------------------------------------------!R!
echo  !MAG!   Etape 1 / 3   Prerequis systeme / System requirements!R!
echo  !GREY!  ---------------------------------------------------!R!
echo.

node --version > nul 2>&1
if errorlevel 1 (
    echo  !RED!  [ !! ]  Node.js n'est pas installe / not installed!R!
    echo  !GREY!         Telecharge-le sur : https://nodejs.org!R!
    echo  !GREY!         Then re-run this file.!R!
    set /a ERRORS+=1
) else (
    for /f "tokens=*" %%v in ('node --version') do (
        echo  !GREEN!  [  OK  ]!R!  !WHITE!Node.js!R!  !GREY!%%v!R!
    )
)

echo.
call pnpm --version > nul 2>&1
if errorlevel 1 (
    echo  !YELLOW!  [  ..  ]  pnpm absent, installation automatique / auto-installing...!R!
    call npm install -g pnpm > nul 2>&1
    if errorlevel 1 (
        echo  !RED!  [ !! ]  Impossible d'installer pnpm / Could not install pnpm!R!
        echo  !GREY!         Lance manuellement : npm install -g pnpm!R!
        set /a ERRORS+=1
    ) else (
        for /f "tokens=*" %%v in ('pnpm --version') do (
            echo  !GREEN!  [  OK  ]!R!  !WHITE!pnpm!R!  !GREY!%%v  ^(installe / installed^)!R!
        )
    )
) else (
    for /f "tokens=*" %%v in ('pnpm --version') do (
        echo  !GREEN!  [  OK  ]!R!  !WHITE!pnpm!R!  !GREY!%%v!R!
    )
)

echo.
if !ERRORS! GTR 0 goto :fatal

:: ================================================================
echo.
echo  !GREY!  ---------------------------------------------------!R!
echo  !MAG!   Etape 2 / 3   Outils de telechargement / Download tools!R!
echo  !GREY!  ---------------------------------------------------!R!
echo.

if exist "!YTDLP_EXE!" (
    echo  !GREEN!  [  OK  ]!R!  !WHITE!yt-dlp!R!   !GREY!!YTDLP_EXE!!R!
) else (
    echo  !RED!  [ !! ]!R!  !WHITE!yt-dlp!R!   !GREY!non trouve / not found!R!
    set MISSING_YTDLP=1
    set /a NEED_DL+=1
)

echo.
if exist "!FFMPEG_EXE!" (
    echo  !GREEN!  [  OK  ]!R!  !WHITE!ffmpeg!R!   !GREY!!FFMPEG_EXE!!R!
) else (
    echo  !RED!  [ !! ]!R!  !WHITE!ffmpeg!R!   !GREY!non trouve / not found!R!
    set MISSING_FFMPEG=1
    set /a NEED_DL+=1
)

echo.
if !NEED_DL! EQU 0 goto :node_deps

net session > nul 2>&1
if errorlevel 1 (
    echo.
    echo  !RED!  ---------------------------------------------------!R!
    echo  !YELLOW!  Droits administrateur requis  /  Admin rights required!R!
    echo.
    echo  !GREY!  Clic droit sur start.bat ^> "Executer en tant qu'administrateur"!R!
    echo  !GREY!  Right-click start.bat ^> "Run as administrator"!R!
    echo  !RED!  ---------------------------------------------------!R!
    echo.
    pause
    exit /b 1
)

echo.
echo  !YELLOW!  !NEED_DL! outil^(s^) manquant^(s^)  /  !NEED_DL! tool^(s^) missing :!R!
echo.
if !MISSING_YTDLP!==1  echo  !GREY!    - yt-dlp   ^(~20 Mo^)   github.com/yt-dlp/yt-dlp!R!
if !MISSING_FFMPEG!==1 echo  !GREY!    - ffmpeg   ^(~80 Mo^)   github.com/BtbN/FFmpeg-Builds!R!
echo.
echo  !DIM!  Ces outils sont indispensables pour telecharger des videos.!R!
echo  !DIM!  These tools are required to download videos.!R!
echo.
echo  !GREY!  ---------------------------------------------------!R!
echo.
echo  !YELLOW!  Telecharger depuis GitHub ?   [O]ui  /  [Y]es!R!     !GREY!Non = instructions manuelles!R!
echo.
set /p CONSENT_DL=     ^>
echo.

if /i "!CONSENT_DL!" NEQ "O" if /i "!CONSENT_DL!" NEQ "Y" goto :manual_install

if !MISSING_YTDLP!==1 (
    echo  !YELLOW!  Telechargement de yt-dlp...  /  Downloading yt-dlp...!R!
    echo.
    if not exist "C:\yt-dlp" mkdir "C:\yt-dlp"
    curl.exe -L --progress-bar -o "!YTDLP_EXE!" "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
    if errorlevel 1 (
        echo  !RED!  [ !! ]  Echec du telechargement / Download failed!R!
        echo  !GREY!         Verifie ta connexion internet / Check your internet connection!R!
        set /a ERRORS+=1
    ) else (
        echo  !GREEN!  [  OK  ]  yt-dlp installe dans C:\yt-dlp\!R!
    )
    echo.
)

if !MISSING_FFMPEG!==1 (
    echo  !YELLOW!  Telechargement de ffmpeg  ^(1-2 minutes^)...  /  Downloading ffmpeg...!R!
    echo.
    curl.exe -L --progress-bar -o "%TEMP%\ffmpeg_lr.zip" "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
    if errorlevel 1 (
        echo  !RED!  [ !! ]  Echec du telechargement / Download failed!R!
        echo  !GREY!         Verifie ta connexion internet / Check your internet connection!R!
        set /a ERRORS+=1
    ) else (
        echo  !YELLOW!  Extraction en cours...  /  Extracting...!R!
        powershell -NoProfile -Command "& { $zip = [System.IO.Path]::GetTempPath() + 'ffmpeg_lr.zip'; $out = [System.IO.Path]::GetTempPath() + 'ffmpeg_lr_ext'; if (Test-Path $out) { Remove-Item $out -Recurse -Force }; Expand-Archive -Path $zip -DestinationPath $out -Force; $exe = Get-ChildItem $out -Filter 'ffmpeg.exe' -Recurse | Select-Object -First 1; New-Item -ItemType Directory -Force -Path 'C:\ffmpeg\bin' | Out-Null; Copy-Item $exe.FullName 'C:\ffmpeg\bin\ffmpeg.exe' -Force; Remove-Item $zip -Force; Remove-Item $out -Recurse -Force }"
        if errorlevel 1 (
            echo  !RED!  [ !! ]  Extraction echouee / Extraction failed!R!
            set /a ERRORS+=1
        ) else (
            echo  !GREEN!  [  OK  ]  ffmpeg installe dans C:\ffmpeg\bin\!R!
        )
    )
    echo.
)

if !ERRORS! GTR 0 goto :fatal
goto :node_deps

:manual_install
echo.
echo  !YELLOW!  Installation manuelle  /  Manual installation :!R!
echo.
if !MISSING_YTDLP!==1 (
    echo  !GREY!    yt-dlp  :  !WHITE!https://github.com/yt-dlp/yt-dlp/releases/latest!R!
    echo  !GREY!               Placer yt-dlp.exe dans C:\yt-dlp\!R!
    echo  !GREY!               Place yt-dlp.exe in C:\yt-dlp\!R!
    echo.
)
if !MISSING_FFMPEG!==1 (
    echo  !GREY!    ffmpeg  :  !WHITE!https://ffmpeg.org/download.html!R!
    echo  !GREY!               Placer ffmpeg.exe dans C:\ffmpeg\bin\!R!
    echo  !GREY!               Place ffmpeg.exe in C:\ffmpeg\bin\!R!
    echo.
)
echo  !DIM!  Tu peux aussi definir des chemins personnalises dans l'onglet Parametres.!R!
echo  !DIM!  You can also set custom paths in the Settings tab after first launch.!R!
echo.
pause
exit /b 1

:: ================================================================
:node_deps
cls
echo.
echo  !GREY!  ---------------------------------------------------!R!
echo  !MAG!   Etape 3 / 3   Dependances Node.js / Node.js dependencies!R!
echo  !GREY!  ---------------------------------------------------!R!
echo.

if not exist "node_modules" (
    echo  !YELLOW!  Installation des paquets  ^(premiere fois, patience...^)!R!
    echo  !GREY!  Installing packages  ^(first time, please wait...^)!R!
    echo.
    call pnpm install
    if errorlevel 1 (
        echo.
        echo  !RED!  [ !! ]  pnpm install a echoue / pnpm install failed!R!
        set /a ERRORS+=1
        goto :fatal
    )
    echo.
    echo  !GREEN!  [  OK  ]  Dependances installees / Dependencies installed!R!
) else (
    echo  !GREEN!  [  OK  ]  Dependances presentes / Dependencies ready!R!
)
echo.

:: ================================================================
echo.
echo  !GREY!  ---------------------------------------------------!R!
echo  !MAG!   Compilation de l'interface  /  Building the interface!R!
echo  !GREY!  ---------------------------------------------------!R!
echo.

call pnpm --filter frontend build
if errorlevel 1 (
    echo.
    echo  !RED!  [ !! ]  La compilation a echoue / Build failed!R!
    goto :fatal
)
echo.

:: ================================================================
cls
echo.
echo.
echo  !GREY!     ___________________________________________________!R!
echo  !GREY!    ^|                                                   ^|!R!
echo  !GREY!    ^|!R!  !GREEN!  Tout est pret  /  All set !R!!GREY!                        ^|!R!
echo  !GREY!    ^|___________________________________________________|!R!
echo.
echo.
echo  !GREY!  Le navigateur va s'ouvrir dans quelques secondes.!R!
echo  !GREY!  Your browser will open in a few seconds.!R!
echo.
echo  !DIM!  Ferme cette fenetre pour arreter le serveur.!R!
echo  !DIM!  Close this window to stop the server.!R!
echo.
echo  !GREY!  ---------------------------------------------------!R!
echo.

powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue; if ($proc) { if ($proc.Name -eq 'node') { Stop-Process -Id $_.OwningProcess -Force } else { Write-Host ('  port 3000 occupe par : ' + $proc.Name + ' - le serveur utilisera un autre port.') } } }"

node apps\backend\scripts\detect-tools.js 2>nul

if exist ".port" del ".port"

start /B powershell -NoProfile -Command "while (-not (Test-Path '.port')) { Start-Sleep -Milliseconds 500 }; $p = (Get-Content '.port').Trim(); Start-Process ('http://localhost:' + $p)"

call pnpm start
set SERVER_EXIT=!errorlevel!
echo.
echo  !GREY!  ---------------------------------------------------!R!
if !SERVER_EXIT! NEQ 0 (
    echo  !RED!  Erreur : le serveur s'est arrete  ^(code !SERVER_EXIT!^)!R!
    echo  !GREY!  Fais defiler vers le haut pour voir le message d'erreur.!R!
    echo  !GREY!  Scroll up to see the error message.!R!
) else (
    echo  !GREEN!  Serveur arrete normalement.  /  Server stopped normally.!R!
)
echo  !GREY!  ---------------------------------------------------!R!
echo.
echo  !DIM!  Appuie sur une touche pour fermer.  /  Press any key to close.!R!
pause
goto :eof

:fatal
echo.
echo  !RED!  ---------------------------------------------------!R!
echo  !RED!  !ERRORS! probleme^(s^) detecte^(s^)  /  !ERRORS! issue^(s^) found!R!
echo  !YELLOW!  Corrige les erreurs ci-dessus et relance.!R!
echo  !GREY!  Fix the errors above and run this script again.!R!
echo  !RED!  ---------------------------------------------------!R!
echo.
pause
exit /b 1
