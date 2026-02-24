#Requires -Version 5.0
$ErrorActionPreference = "SilentlyContinue"
$Host.UI.RawUI.WindowTitle = "LiveRecorder"

$YTDLP_EXE  = "C:\yt-dlp\yt-dlp.exe"
$FFMPEG_EXE = "C:\ffmpeg\bin\ffmpeg.exe"
$ROOT       = Split-Path -Parent $MyInvocation.MyCommand.Path

# ----------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------
function Sep   { Write-Host "   ---------------------------------------------------" -ForegroundColor DarkGray }
function Blank { Write-Host "" }

function Section($text) {
    Blank; Sep
    Write-Host "   $text" -ForegroundColor Magenta
    Sep; Blank
}

function OK($label, $value = "") {
    Write-Host "   " -NoNewline
    Write-Host " OK " -ForegroundColor Black -BackgroundColor Green -NoNewline
    Write-Host "   $label " -ForegroundColor White -NoNewline
    if ($value) { Write-Host $value -ForegroundColor DarkGray } else { Write-Host "" }
}

function Fail($label) {
    Write-Host "   " -NoNewline
    Write-Host " !! " -ForegroundColor White -BackgroundColor Red -NoNewline
    Write-Host "   $label" -ForegroundColor White
}

function Warn($label) {
    Write-Host "   " -NoNewline
    Write-Host " >> " -ForegroundColor Black -BackgroundColor Yellow -NoNewline
    Write-Host "   $label" -ForegroundColor DarkGray
}

function Banner($subtitle, $color = "Cyan") {
    Clear-Host; Blank; Blank
    Write-Host "    ___________________________________________________" -ForegroundColor DarkGray
    Write-Host "   |                                                   |" -ForegroundColor DarkGray
    Write-Host "   |" -ForegroundColor DarkGray -NoNewline
    Write-Host "   L I V E  R E C O R D E R                       " -ForegroundColor $color -NoNewline
    Write-Host "|" -ForegroundColor DarkGray
    Write-Host "   |" -ForegroundColor DarkGray -NoNewline
    Write-Host "   $subtitle" -ForegroundColor DarkGray -NoNewline
    Write-Host "|" -ForegroundColor DarkGray
    Write-Host "   |___________________________________________________|" -ForegroundColor DarkGray
    Blank; Blank
}

function Ask($q) {
    Blank
    Write-Host "   $q" -ForegroundColor Yellow
    Blank
    $r = Read-Host "     [ O / Y ] oui/yes     [ N ] annuler/cancel"
    return ($r -ieq "O" -or $r -ieq "Y")
}

function Die($msg) {
    Blank; Fail $msg; Blank
    Read-Host "   Entree pour fermer / Enter to close" | Out-Null
    exit 1
}

# ================================================================
# PRESENTATION
# ================================================================
Banner "   VOD Downloader   /   Telechargeur de VODs          "

Write-Host "   Ce script va preparer et lancer LiveRecorder sur ta machine." -ForegroundColor White
Write-Host "   This script will set up and launch LiveRecorder on your machine." -ForegroundColor DarkGray
Blank; Blank
Write-Host "   Ce qui va se passer  /  What will happen :" -ForegroundColor Magenta
Blank
Write-Host "    1  " -ForegroundColor DarkGray -NoNewline; Write-Host "Verification de Node.js et pnpm" -ForegroundColor White
Write-Host "       Check Node.js and pnpm" -ForegroundColor DarkGray
Blank
Write-Host "    2  " -ForegroundColor DarkGray -NoNewline; Write-Host "Verification de yt-dlp et ffmpeg" -ForegroundColor White
Write-Host "       Check yt-dlp and ffmpeg  " -ForegroundColor DarkGray -NoNewline
Write-Host "(telechargement propose si absents / offered if missing)" -ForegroundColor DarkGray
Blank
Write-Host "    3  " -ForegroundColor DarkGray -NoNewline; Write-Host "Dependances Node.js" -ForegroundColor White -NoNewline
Write-Host "  (premiere fois uniquement / first time only)" -ForegroundColor DarkGray
Blank
Write-Host "    4  " -ForegroundColor DarkGray -NoNewline; Write-Host "Compilation de l'interface web  /  Build the web interface" -ForegroundColor White
Blank
Write-Host "    5  " -ForegroundColor DarkGray -NoNewline; Write-Host "Demarrage du serveur + ouverture du navigateur" -ForegroundColor White
Write-Host "       Start the server + open your browser" -ForegroundColor DarkGray
Blank; Blank
Write-Host "   Aucune donnee collectee ou envoyee. Tout reste sur ta machine." -ForegroundColor DarkGray
Write-Host "   No data collected or sent. Everything stays on your machine." -ForegroundColor DarkGray
Blank; Sep; Blank

if (-not (Ask "Continuer / Continue ?")) {
    Blank; Write-Host "   Annule.  /  Cancelled." -ForegroundColor Red; Blank
    Read-Host "   Entree pour fermer / Enter to close" | Out-Null
    exit 0
}

# ================================================================
# ETAPE 1 - PREREQUIS
# ================================================================
Clear-Host
Section "Etape 1 / 3   Prerequis systeme  /  System requirements"

$errors = 0

$nodeVer = & node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Fail "Node.js n'est pas installe / not installed"
    Write-Host "            Telecharge-le sur : https://nodejs.org" -ForegroundColor DarkGray
    $errors++
} else { OK "Node.js" $nodeVer }

Blank

$pnpmVer = & pnpm --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Warn "pnpm absent, installation automatique / auto-installing..."
    & npm install -g pnpm 2>$null | Out-Null
    $pnpmVer = & pnpm --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        Fail "Impossible d'installer pnpm. Lance : npm install -g pnpm"
        $errors++
    } else { OK "pnpm" "$pnpmVer  (installe / installed)" }
} else { OK "pnpm" $pnpmVer }

if ($errors -gt 0) { Die "$errors probleme(s) detecte(s). Corrige et relance. / Fix and retry." }

# ================================================================
# ETAPE 2 - OUTILS
# ================================================================
Blank
Section "Etape 2 / 3   Outils de telechargement  /  Download tools"

$missingYtdlp  = -not (Test-Path $YTDLP_EXE)
$missingFfmpeg = -not (Test-Path $FFMPEG_EXE)

if (-not $missingYtdlp)  { OK "yt-dlp"  $YTDLP_EXE  } else { Fail "yt-dlp   non trouve / not found" }
Blank
if (-not $missingFfmpeg) { OK "ffmpeg"  $FFMPEG_EXE } else { Fail "ffmpeg   non trouve / not found" }

if ($missingYtdlp -or $missingFfmpeg) {
    $count = ($missingYtdlp, $missingFfmpeg | Where-Object { $_ }).Count
    Blank
    Write-Host "   $count outil(s) manquant(s)  /  $count tool(s) missing :" -ForegroundColor Yellow
    Blank
    if ($missingYtdlp)  { Write-Host "     - yt-dlp   (~20 Mo)   github.com/yt-dlp/yt-dlp" -ForegroundColor DarkGray }
    if ($missingFfmpeg) { Write-Host "     - ffmpeg   (~80 Mo)   github.com/BtbN/FFmpeg-Builds" -ForegroundColor DarkGray }
    Blank
    Write-Host "   Ces outils sont indispensables. / These tools are required." -ForegroundColor DarkGray

    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Blank; Sep
        Write-Host "   Droits administrateur requis  /  Admin rights required" -ForegroundColor Yellow
        Blank
        Write-Host "   Clic droit sur start.bat > Executer en tant qu'administrateur" -ForegroundColor DarkGray
        Write-Host "   Right-click start.bat > Run as administrator" -ForegroundColor DarkGray
        Sep
        Read-Host "`n   Entree pour fermer / Enter to close" | Out-Null
        exit 1
    }

    if (Ask "Telecharger depuis GitHub ?  /  Download from GitHub?") {

        if ($missingYtdlp) {
            Blank; Warn "Telechargement de yt-dlp...  /  Downloading yt-dlp..."; Blank
            New-Item -ItemType Directory -Force -Path "C:\yt-dlp" | Out-Null
            & curl.exe -L --progress-bar -o $YTDLP_EXE "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
            if ($LASTEXITCODE -ne 0) { Fail "Echec. Verifie ta connexion. / Download failed."; $errors++ }
            else { OK "yt-dlp installe dans C:\yt-dlp\" }
        }

        if ($missingFfmpeg) {
            Blank; Warn "Telechargement de ffmpeg (1-2 min)...  /  Downloading ffmpeg..."; Blank
            $zip = [IO.Path]::GetTempPath() + "ffmpeg_lr.zip"
            & curl.exe -L --progress-bar -o $zip "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
            if ($LASTEXITCODE -ne 0) { Fail "Echec. Verifie ta connexion. / Download failed."; $errors++ }
            else {
                Warn "Extraction en cours...  /  Extracting..."
                $out = [IO.Path]::GetTempPath() + "ffmpeg_lr_ext"
                if (Test-Path $out) { Remove-Item $out -Recurse -Force }
                Expand-Archive -Path $zip -DestinationPath $out -Force
                $exe = Get-ChildItem $out -Filter "ffmpeg.exe" -Recurse | Select-Object -First 1
                New-Item -ItemType Directory -Force -Path "C:\ffmpeg\bin" | Out-Null
                Copy-Item $exe.FullName "C:\ffmpeg\bin\ffmpeg.exe" -Force
                Remove-Item $zip, $out -Recurse -Force
                OK "ffmpeg installe dans C:\ffmpeg\bin\"
            }
        }

        if ($errors -gt 0) { Die "$errors erreur(s). Relance le script. / Restart the script." }

    } else {
        Blank
        Write-Host "   Installation manuelle  /  Manual installation :" -ForegroundColor Yellow; Blank
        if ($missingYtdlp) {
            Write-Host "     yt-dlp  :  https://github.com/yt-dlp/yt-dlp/releases/latest" -ForegroundColor White
            Write-Host "                Placer yt-dlp.exe dans C:\yt-dlp\" -ForegroundColor DarkGray; Blank
        }
        if ($missingFfmpeg) {
            Write-Host "     ffmpeg  :  https://ffmpeg.org/download.html" -ForegroundColor White
            Write-Host "                Placer ffmpeg.exe dans C:\ffmpeg\bin\" -ForegroundColor DarkGray; Blank
        }
        Write-Host "   Chemins personnalisables dans l'onglet Parametres apres le lancement." -ForegroundColor DarkGray
        Read-Host "`n   Entree pour fermer / Enter to close" | Out-Null
        exit 1
    }
}

# ================================================================
# ETAPE 3 - DEPENDANCES
# ================================================================
Clear-Host
Section "Etape 3 / 3   Dependances Node.js  /  Node.js dependencies"

Push-Location $ROOT

if (-not (Test-Path "node_modules")) {
    Warn "Installation des paquets (premiere fois, patience...)  /  Installing..."; Blank
    & pnpm install
    if ($LASTEXITCODE -ne 0) { Pop-Location; Die "pnpm install a echoue. / pnpm install failed." }
    Blank; OK "Dependances installees  /  Dependencies installed"
} else {
    OK "Dependances presentes  /  Dependencies ready"
}

# ================================================================
# BUILD
# ================================================================
Blank; Sep
Write-Host "   Compilation de l'interface  /  Building the interface..." -ForegroundColor Magenta
Sep; Blank

& pnpm --filter frontend build
if ($LASTEXITCODE -ne 0) { Pop-Location; Die "La compilation a echoue. / Build failed." }

# ================================================================
# LANCEMENT
# ================================================================
Banner "   Tout est pret !   /   All set !                        " "Green"

Write-Host "   Le navigateur va s'ouvrir dans quelques secondes." -ForegroundColor DarkGray
Write-Host "   Your browser will open in a few seconds." -ForegroundColor DarkGray
Blank
Write-Host "   Ferme cette fenetre pour arreter le serveur." -ForegroundColor DarkGray
Write-Host "   Close this window to stop the server." -ForegroundColor DarkGray
Blank; Sep; Blank

# Tuer instance Node precedente sur port 3000
$conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
    $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
    if ($proc -and $proc.Name -eq "node") {
        Stop-Process -Id $conn.OwningProcess -Force
        Write-Host "   Instance precedente arretee. / Previous instance stopped." -ForegroundColor DarkGray
    } elseif ($proc) {
        Write-Host "   Port 3000 utilise par : $($proc.Name) - autre port sera utilise." -ForegroundColor DarkGray
    }
}

# Detection des outils
& node "apps\backend\scripts\detect-tools.js" 2>$null

# Watcher .port -> ouvre le navigateur
$portFile = Join-Path $ROOT ".port"
if (Test-Path $portFile) { Remove-Item $portFile -Force }

$watcher = Start-Job -ScriptBlock {
    param($pf)
    while (-not (Test-Path $pf)) { Start-Sleep -Milliseconds 500 }
    $p = (Get-Content $pf).Trim()
    Start-Process "http://localhost:$p"
} -ArgumentList $portFile

# Demarrage du serveur
& pnpm start

# Nettoyage
Stop-Job  $watcher -ErrorAction SilentlyContinue | Out-Null
Remove-Job $watcher -ErrorAction SilentlyContinue | Out-Null
if (Test-Path $portFile) { Remove-Item $portFile -Force }
Pop-Location

Blank; Sep
Write-Host "   Serveur arrete normalement.  /  Server stopped normally." -ForegroundColor Green
Sep; Blank
Read-Host "   Appuie sur Entree pour fermer  /  Press Enter to close" | Out-Null
