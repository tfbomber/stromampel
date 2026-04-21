# ============================================================
# StromAmpel — Build & Release Pipeline
# Usage:
#   .\build-and-release.ps1              <- full build + upload
#   .\build-and-release.ps1 -SkipBuild  <- skip build, just upload existing APK
#   .\build-and-release.ps1 -DryRun     <- build only, don't upload
# ============================================================

param(
    [switch]$SkipBuild,
    [switch]$DryRun,
    [switch]$NoBrowser
)

Set-StrictMode -Off
$ErrorActionPreference = "Stop"

# ── Configuration ─────────────────────────────────────────────
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ApkSrc      = "$ProjectRoot\android\app\build\outputs\apk\release\app-release.apk"
$ApkDest     = "$ProjectRoot\strom-ampel-latest.apk"    # friendly filename for release
$AppName     = "Strom Ampel"

# Android build env (D-drive installation)
$env:JAVA_HOME        = "D:\Dev\jdk-17"
$env:ANDROID_HOME     = "D:\Dev\android-sdk"
$env:GRADLE_USER_HOME = "D:\Dev\gradle-cache"
$env:Path             = "D:\Dev\jdk-17\bin;" + $env:Path

# ── Banner ────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Strom Ampel — Build & Release Pipeline     ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Auto-inject GH_TOKEN from Windows Credential Manager ────
# Reads the token git already has stored — NEVER hardcoded in this file.
if (-not $env:GH_TOKEN) {
    $gitCreds  = (Write-Output "protocol=https`nhost=github.com`n" | git credential fill 2>$null)
    $tokenLine = $gitCreds | Select-String "^password="
    if ($tokenLine) {
        $env:GH_TOKEN = ($tokenLine.Line -replace "^password=", "").Trim()
        Write-Host "  [Auth] GH_TOKEN loaded from git credential store" -ForegroundColor DarkGray
    }
}

# ── Pre-checks ───────────────────────────────────────────────
# Check gh CLI
$ghCmd = Get-Command gh -ErrorAction SilentlyContinue
if (-not $ghCmd) {
    $ghPath = "C:\Program Files\GitHub CLI\gh.exe"
    if (Test-Path $ghPath) { $env:Path = "C:\Program Files\GitHub CLI;" + $env:Path }
    else {
        Write-Host "❌ GitHub CLI not found. Run: winget install GitHub.cli" -ForegroundColor Red
        exit 1
    }
}

# Check gh auth (GH_TOKEN set above makes this pass automatically)
$authStatus = gh auth status 2>&1
if ($authStatus -match "not logged") {
    Write-Host "❌ Not logged into GitHub. Run: gh auth login" -ForegroundColor Red
    exit 1
}

# Check git remote
$remoteUrl = git -C $ProjectRoot remote get-url origin 2>$null
if (-not $remoteUrl) {
    Write-Host "❌ No GitHub remote. Create a repo and run:" -ForegroundColor Red
    Write-Host "   git remote add origin https://github.com/YOUR_USER/strom-ampel-app.git" -ForegroundColor Yellow
    exit 1
}

# Parse owner/repo
if ($remoteUrl -match "github\.com[/:](.+?/.+?)(?:\.git)?$") {
    $GHRepo = $Matches[1].Trim()
} else {
    Write-Host "❌ Cannot parse GitHub repo from: $remoteUrl" -ForegroundColor Red
    exit 1
}

Write-Host "  Repo  : https://github.com/$GHRepo" -ForegroundColor Gray
Write-Host "  APK   : $ApkSrc" -ForegroundColor Gray
Write-Host ""

# ── Step 1: Build ─────────────────────────────────────────────
if (-not $SkipBuild) {
    Write-Host "🔨 [1/3] Building APK..." -ForegroundColor Green
    $t0 = Get-Date

    Push-Location "$ProjectRoot\android"
    .\gradlew.bat assembleRelease --no-daemon 2>&1 | ForEach-Object {
        if ($_ -match "BUILD SUCCESSFUL|BUILD FAILED|> Task") { Write-Host "   $_" -ForegroundColor DarkGray }
    }
    $buildOk = $LASTEXITCODE -eq 0 -or (Test-Path $ApkSrc)
    Pop-Location

    if (-not $buildOk -and -not (Test-Path $ApkSrc)) {
        Write-Host "❌ Build failed. No APK found." -ForegroundColor Red
        exit 1
    }

    $elapsed = [math]::Round(((Get-Date) - $t0).TotalSeconds)
    Write-Host "   ✅ Build done in ${elapsed}s" -ForegroundColor DarkGreen
} else {
    Write-Host "⏭  [1/3] Build skipped (-SkipBuild flag)" -ForegroundColor Yellow
}

if (-not (Test-Path $ApkSrc)) {
    Write-Host "❌ APK not found at: $ApkSrc" -ForegroundColor Red
    exit 1
}

# Copy APK with both friendly filenames:
#   strom-ampel-latest.apk      — stable permanent URL (QR code / bookmarks)
#   strom-ampel-vYYYYMMDD.apk  — versioned, so the downloaded file is identifiable
Copy-Item $ApkSrc $ApkDest -Force
$apkSizeMB    = [math]::Round((Get-Item $ApkDest).Length / 1MB, 1)
# Versioned filename is determined after $tag is set — placeholder here, created below

if ($DryRun) {
    Write-Host ""
    Write-Host "⚠️  DryRun mode — skipping upload." -ForegroundColor Yellow
    Write-Host "   APK ready at: $ApkDest ($apkSizeMB MB)" -ForegroundColor Yellow
    exit 0
}

# ── Step 2: Upload to GitHub Releases ─────────────────────────
Write-Host ""
Write-Host "☁️  [2/3] Uploading to GitHub Releases..." -ForegroundColor Green

$tag      = "v$(Get-Date -Format 'yyyyMMdd-HHmm')"
$title    = "$AppName $tag"
$apkDate  = (Get-Date).ToString("yyyy-MM-dd HH:mm")
$relNotes = @"
### $AppName · Auto-release

| | |
|---|---|
| **Built** | $apkDate (local) |
| **Size** | ${apkSizeMB} MB |
| **Platform** | Android (APK) |

### How to install
1. Download ``strom-ampel-${tag}.apk`` below (versioned — easy to identify)
2. Open on your Android phone
3. Allow **"Install from unknown sources"** if prompted
4. Tap Install — done ✅

> **Stable link** (always latest): ``strom-ampel-latest.apk`` — bookmark this for quick re-installs.
> **Scan the QR code** to download directly on your phone.
"@

# Versioned APK copy: strom-ampel-v20260411-0839.apk
$ApkVersioned = "$ProjectRoot\strom-ampel-${tag}.apk"
Copy-Item $ApkDest $ApkVersioned -Force
Write-Host "  APK (latest)  : $ApkDest" -ForegroundColor Gray
Write-Host "  APK (versioned): $ApkVersioned" -ForegroundColor Gray

# Delete existing 'latest' tag to allow re-creating it
gh release delete latest --repo $GHRepo --yes 2>$null

# Upload BOTH: versioned (identifiable after download) + latest (stable URL)
gh release create $tag $ApkVersioned $ApkDest `
    --repo $GHRepo `
    --title $title `
    --notes $relNotes `
    --latest

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Upload failed." -ForegroundColor Red
    exit 1
}

Write-Host "   ✅ Released: $tag" -ForegroundColor DarkGreen

# ── Step 3: QR Code ───────────────────────────────────────────
Write-Host ""
Write-Host "🔲 [3/3] Generating QR code..." -ForegroundColor Green

# Permanent stable URL — always points to latest release, never changes
$downloadUrl = "https://github.com/$GHRepo/releases/latest/download/strom-ampel-latest.apk"
$releasePageUrl = "https://github.com/$GHRepo/releases/latest"

# Generate QR via free API (no install, no account)
$qrApiUrl = "https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=10&data=" `
          + [uri]::EscapeDataString($downloadUrl)

$qrPath = "$ProjectRoot\qr-latest.png"
try {
    Invoke-WebRequest -Uri $qrApiUrl -OutFile $qrPath -UseBasicParsing
    Write-Host "   ✅ QR saved: $qrPath" -ForegroundColor DarkGreen
} catch {
    Write-Host "   ⚠️  QR generation failed (no internet?): $_" -ForegroundColor Yellow
}

# ── Final Summary ─────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║              ✅  RELEASE DONE!               ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  Tag          : $tag" -ForegroundColor White
Write-Host "  APK Size     : $apkSizeMB MB" -ForegroundColor White
Write-Host ""
Write-Host "  📥  Direct Download (stable — bookmark this):" -ForegroundColor Cyan
Write-Host "      $downloadUrl" -ForegroundColor Yellow
Write-Host ""
Write-Host "  🌐  Release Page:" -ForegroundColor Cyan
Write-Host "      $releasePageUrl" -ForegroundColor Yellow
Write-Host ""
Write-Host "  🔲  QR Code: $qrPath" -ForegroundColor Cyan
Write-Host "      (Scan with phone to download instantly)" -ForegroundColor DarkGray
Write-Host ""

if (-not $NoBrowser) {
    Start-Process $releasePageUrl
    if (Test-Path $qrPath) { Start-Process $qrPath }
}

Write-Host "Done! 🎉 Build → Upload → QR all complete." -ForegroundColor Green
Write-Host ""

