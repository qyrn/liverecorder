#Requires -Version 5.0
[Console]::OutputEncoding      = [System.Text.Encoding]::UTF8
$OutputEncoding                = [System.Text.Encoding]::UTF8
$ErrorActionPreference         = "SilentlyContinue"
$Host.UI.RawUI.WindowTitle     = "LiveRecorder"

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
    Write-Host ("   L I V E  R E C O R D E R").PadRight(51) -ForegroundColor $color -NoNewline
    Write-Host "|" -ForegroundColor DarkGray
    Write-Host "   |" -ForegroundColor DarkGray -NoNewline
    Write-Host ("   $subtitle").PadRight(51) -ForegroundColor DarkGray -NoNewline
    Write-Host "|" -ForegroundColor DarkGray
    Write-Host "   |___________________________________________________|" -ForegroundColor DarkGray
    Blank; Blank
}

function Ask($q) {
    Blank
    Write-Host "   $q" -ForegroundColor Yellow
    Blank
    Write-Host "     [ Y ] yes / oui     [ N ] cancel / annuler  " -NoNewline -ForegroundColor DarkGray
    do {
        $key  = [Console]::ReadKey($true)
        $char = $key.KeyChar.ToString().ToUpper()
    } while ($char -ne 'Y' -and $char -ne 'O' -and $char -ne 'N')
    if ($char -eq 'N') {
        Write-Host "  N" -ForegroundColor Red
    } else {
        Write-Host "  Y" -ForegroundColor Green
    }
    Blank
    return ($char -eq 'Y' -or $char -eq 'O')
}

function PickLang {
    Blank
    Write-Host "   Interface language  /  Langue de l'interface :" -ForegroundColor Yellow
    Blank
    Write-Host "     [ F ] Français     [ E ] English  " -NoNewline -ForegroundColor DarkGray
    do {
        $key  = [Console]::ReadKey($true)
        $char = $key.KeyChar.ToString().ToUpper()
    } while ($char -ne 'F' -and $char -ne 'E')
    if ($char -eq 'F') {
        Write-Host "  FR" -ForegroundColor Cyan
        Blank
        return "fr"
    } else {
        Write-Host "  EN" -ForegroundColor Cyan
        Blank
        return "en"
    }
}

function PressAnyKey {
    Blank
    Write-Host "   Press any key to close  /  Appuyez sur une touche pour fermer" -ForegroundColor DarkGray
    [Console]::ReadKey($true) | Out-Null
}

function Die($msg) {
    Blank; Fail $msg; Blank
    PressAnyKey
    exit 1
}

# ================================================================
# PRESENTATION
# ================================================================
Banner "VOD Downloader   /   Téléchargeur de VODs"

Write-Host "   This script will set up and launch LiveRecorder on your machine." -ForegroundColor White
Write-Host "   Ce script va préparer et lancer LiveRecorder sur ta machine." -ForegroundColor DarkGray
Blank; Blank
Write-Host "   What will happen  /  Ce qui va se passer :" -ForegroundColor Magenta
Blank
Write-Host "    1  " -ForegroundColor DarkGray -NoNewline
Write-Host "Check Node.js and pnpm" -ForegroundColor White
Write-Host "       Vérification de Node.js et pnpm" -ForegroundColor DarkGray
Blank
Write-Host "    2  " -ForegroundColor DarkGray -NoNewline
Write-Host "Check yt-dlp and ffmpeg" -ForegroundColor White
Write-Host "       Vérification de yt-dlp et ffmpeg" -ForegroundColor DarkGray
Write-Host "       (offered if missing  /  téléchargement proposé si absents)" -ForegroundColor DarkGray
Blank
Write-Host "    3  " -ForegroundColor DarkGray -NoNewline
Write-Host "Node.js dependencies" -ForegroundColor White -NoNewline
Write-Host "  (first time only  /  première fois uniquement)" -ForegroundColor DarkGray
Blank
Write-Host "    4  " -ForegroundColor DarkGray -NoNewline
Write-Host "Build the web interface  /  Compilation de l'interface web" -ForegroundColor White
Blank
Write-Host "    5  " -ForegroundColor DarkGray -NoNewline
Write-Host "Start the server and open your browser" -ForegroundColor White
Write-Host "       Démarrage du serveur + ouverture du navigateur" -ForegroundColor DarkGray
Blank; Blank
Write-Host "   No data collected or sent. Everything stays on your machine." -ForegroundColor DarkGray
Write-Host "   Aucune donnée collectée ou envoyée. Tout reste sur ta machine." -ForegroundColor DarkGray
Blank; Sep; Blank

if (-not (Ask "Continue?  /  Continuer ?")) {
    Blank
    Write-Host "   Cancelled.  /  Annulé." -ForegroundColor Red
    Blank
    PressAnyKey
    exit 0
}

$LANG = PickLang

# ================================================================
# STEP 1 - PREREQUISITES
# ================================================================
Clear-Host
Section "Step 1/3   System requirements  /  Prérequis système"

$errors = 0

$nodeVer = & node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Fail "Node.js is not installed  /  n'est pas installé"
    Write-Host "            Download at  /  Télécharge sur : https://nodejs.org" -ForegroundColor DarkGray
    $errors++
} else { OK "Node.js" $nodeVer }

Blank

$pnpmVer = & pnpm --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Warn "pnpm not found, installing...  /  absent, installation automatique..."
    & npm install -g pnpm 2>$null | Out-Null
    $pnpmVer = & pnpm --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        Fail "Cannot install pnpm. Run: npm install -g pnpm"
        $errors++
    } else { OK "pnpm" "$pnpmVer  (installed  /  installé)" }
} else { OK "pnpm" $pnpmVer }

if ($errors -gt 0) { Die "$errors issue(s) detected — fix and retry.  /  problème(s) détecté(s) — corrige et relance." }

# ================================================================
# STEP 2 - TOOLS
# ================================================================
Blank
Section "Step 2/3   Download tools  /  Outils de téléchargement"

$missingYtdlp  = -not (Test-Path $YTDLP_EXE)
$missingFfmpeg = -not (Test-Path $FFMPEG_EXE)

if (-not $missingYtdlp)  { OK "yt-dlp"  $YTDLP_EXE  } else { Fail "yt-dlp   not found  /  non trouvé" }
Blank
if (-not $missingFfmpeg) { OK "ffmpeg"  $FFMPEG_EXE } else { Fail "ffmpeg   not found  /  non trouvé" }

if ($missingYtdlp -or $missingFfmpeg) {
    $count = ($missingYtdlp, $missingFfmpeg | Where-Object { $_ }).Count
    Blank
    Write-Host "   $count tool(s) missing  /  $count outil(s) manquant(s) :" -ForegroundColor Yellow
    Blank
    if ($missingYtdlp)  { Write-Host "     - yt-dlp   (~20 MB)   github.com/yt-dlp/yt-dlp" -ForegroundColor DarkGray }
    if ($missingFfmpeg) { Write-Host "     - ffmpeg   (~80 MB)   github.com/BtbN/FFmpeg-Builds" -ForegroundColor DarkGray }
    Blank
    Write-Host "   These tools are required.  /  Ces outils sont indispensables." -ForegroundColor DarkGray

    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Blank; Sep
        Write-Host "   Admin rights required  /  Droits administrateur requis" -ForegroundColor Yellow
        Blank
        Write-Host "   Right-click start.bat > Run as administrator" -ForegroundColor DarkGray
        Write-Host "   Clic droit sur start.bat > Exécuter en tant qu'administrateur" -ForegroundColor DarkGray
        Sep
        PressAnyKey
        exit 1
    }

    if (Ask "Download from GitHub?  /  Télécharger depuis GitHub ?") {

        if ($missingYtdlp) {
            Blank; Warn "Downloading yt-dlp...  /  Téléchargement de yt-dlp..."; Blank
            New-Item -ItemType Directory -Force -Path "C:\yt-dlp" | Out-Null
            & curl.exe -L --progress-bar -o $YTDLP_EXE "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
            if ($LASTEXITCODE -ne 0) { Fail "Download failed — check your connection.  /  Échec — vérifie ta connexion."; $errors++ }
            else { OK "yt-dlp installed in C:\yt-dlp\" }
        }

        if ($missingFfmpeg) {
            Blank; Warn "Downloading ffmpeg (~1-2 min)...  /  Téléchargement de ffmpeg..."; Blank
            $zip = [IO.Path]::GetTempPath() + "ffmpeg_lr.zip"
            & curl.exe -L --progress-bar -o $zip "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
            if ($LASTEXITCODE -ne 0) { Fail "Download failed — check your connection.  /  Échec — vérifie ta connexion."; $errors++ }
            else {
                Warn "Extracting...  /  Extraction en cours..."
                $out = [IO.Path]::GetTempPath() + "ffmpeg_lr_ext"
                if (Test-Path $out) { Remove-Item $out -Recurse -Force }
                Expand-Archive -Path $zip -DestinationPath $out -Force
                $exe = Get-ChildItem $out -Filter "ffmpeg.exe" -Recurse | Select-Object -First 1
                New-Item -ItemType Directory -Force -Path "C:\ffmpeg\bin" | Out-Null
                Copy-Item $exe.FullName "C:\ffmpeg\bin\ffmpeg.exe" -Force
                Remove-Item $zip, $out -Recurse -Force
                OK "ffmpeg installed in C:\ffmpeg\bin\"
            }
        }

        if ($errors -gt 0) { Die "$errors error(s) — restart the script.  /  erreur(s) — relance le script." }

    } else {
        Blank
        Write-Host "   Manual installation  /  Installation manuelle :" -ForegroundColor Yellow; Blank
        if ($missingYtdlp) {
            Write-Host "     yt-dlp  :  https://github.com/yt-dlp/yt-dlp/releases/latest" -ForegroundColor White
            Write-Host "                Place yt-dlp.exe in C:\yt-dlp\" -ForegroundColor DarkGray
            Write-Host "                Placer yt-dlp.exe dans C:\yt-dlp\" -ForegroundColor DarkGray; Blank
        }
        if ($missingFfmpeg) {
            Write-Host "     ffmpeg  :  https://ffmpeg.org/download.html" -ForegroundColor White
            Write-Host "                Place ffmpeg.exe in C:\ffmpeg\bin\" -ForegroundColor DarkGray
            Write-Host "                Placer ffmpeg.exe dans C:\ffmpeg\bin\" -ForegroundColor DarkGray; Blank
        }
        Write-Host "   Paths can be changed in the Settings tab after launch." -ForegroundColor DarkGray
        Write-Host "   Chemins personnalisables dans l'onglet Paramètres après le lancement." -ForegroundColor DarkGray
        PressAnyKey
        exit 1
    }
}

# ================================================================
# STEP 3 - DEPENDENCIES
# ================================================================
Clear-Host
Section "Step 3/3   Node.js dependencies  /  Dépendances Node.js"

Push-Location $ROOT

if (-not (Test-Path "node_modules")) {
    Warn "Installing packages (first time, please wait...)  /  Installation des paquets (première fois, patience...)"; Blank
    & pnpm install
    if ($LASTEXITCODE -ne 0) { Pop-Location; Die "pnpm install failed.  /  a échoué." }
    Blank; OK "Dependencies installed  /  Dépendances installées"
} else {
    OK "Dependencies ready  /  Dépendances présentes"
}

# ================================================================
# BUILD
# ================================================================
Blank; Sep
Write-Host "   Building the interface...  /  Compilation de l'interface..." -ForegroundColor Magenta
Sep; Blank

& pnpm --filter frontend build
if ($LASTEXITCODE -ne 0) { Pop-Location; Die "Build failed.  /  La compilation a échoué." }

# ================================================================
# LAUNCH
# ================================================================
Banner "All set!   /   Tout est prêt !" "Green"

Write-Host "   Your browser will open in a few seconds." -ForegroundColor White
Write-Host "   Le navigateur va s'ouvrir dans quelques secondes." -ForegroundColor DarkGray
Blank
Write-Host "   Close this window to stop the server." -ForegroundColor White
Write-Host "   Ferme cette fenêtre pour arrêter le serveur." -ForegroundColor DarkGray
Blank; Sep; Blank

# Kill any previous Node instance on port 3000
$conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
    $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
    if ($proc -and $proc.Name -eq "node") {
        Stop-Process -Id $conn.OwningProcess -Force
        Write-Host "   Previous instance stopped.  /  Instance précédente arrêtée." -ForegroundColor DarkGray
    } elseif ($proc) {
        Write-Host "   Port 3000 in use by: $($proc.Name) — another port will be used." -ForegroundColor DarkGray
    }
}

# Tool detection
& node "apps\backend\scripts\detect-tools.js" 2>$null

# Watch .port file -> open browser
$portFile = Join-Path $ROOT ".port"
if (Test-Path $portFile) { Remove-Item $portFile -Force }

$watcher = Start-Job -ScriptBlock {
    param($pf, $lang)
    while (-not (Test-Path $pf)) { Start-Sleep -Milliseconds 500 }
    $p = (Get-Content $pf).Trim()
    Start-Process "http://localhost:$p/?lang=$lang"
} -ArgumentList $portFile, $LANG

# Start the server
& pnpm start

# Cleanup
Stop-Job  $watcher -ErrorAction SilentlyContinue | Out-Null
Remove-Job $watcher -ErrorAction SilentlyContinue | Out-Null
if (Test-Path $portFile) { Remove-Item $portFile -Force }
Pop-Location

Blank; Sep
Write-Host "   Server stopped normally.  /  Serveur arrêté normalement." -ForegroundColor Green
Sep; Blank
PressAnyKey
