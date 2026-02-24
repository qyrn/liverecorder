@echo off
title LiveRecorder
powershell -NoProfile -ExecutionPolicy Bypass -Command "Unblock-File -LiteralPath '%~dp0start.ps1' -ErrorAction SilentlyContinue"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
if %errorlevel% neq 0 (
    echo.
    echo  [ERREUR] Le script PowerShell a quitte avec le code : %errorlevel%
    echo  Verifie que start.ps1 est bien dans le meme dossier que start.bat
    echo.
    pause
)
