param([switch]$SkipBuild)
$ErrorActionPreference = "Stop"
$ProjectRoot = "D:\Stock Analysis\StromAmpelApp"
$ApkSrc      = "$ProjectRoot\android\app\build\outputs\apk\release\app-release.apk"
$ApkDest     = "$ProjectRoot\strom-ampel-latest.apk"
$GHRepo      = "tfbomber/stromampel"

$env:JAVA_HOME        = "D:\Dev\jdk-17"
$env:ANDROID_HOME     = "D:\Dev\android-sdk"
$env:GRADLE_USER_HOME = "D:\Dev\gradle-cache"
$env:NODE_ENV         = "production"
$env:Path             = "D:\Dev\jdk-17\bin;" + $env:Path

# Load GH_TOKEN from git credential store
if (-not $env:GH_TOKEN) {
    $lines = (Write-Output "protocol=https`nhost=github.com`n" | git credential fill 2>$null)
    foreach ($line in $lines) {
        if ($line -match "^password=(.+)$") {
            $env:GH_TOKEN = $Matches[1].Trim()
            Write-Host "[Auth] GH_TOKEN loaded from credential store"
            break
        }
    }
}

# Step 1: Build
if (-not $SkipBuild) {
    Write-Host "[1/3] Building APK (Gradle)..."
    # Clear JS bundle cache so Metro always regenerates from latest TypeScript sources.
    # Without this, Gradle reports createBundleReleaseJsAndAssets as UP-TO-DATE and
    # ships the old JS bundle even when .ts files have changed.
    $bundleCache = "$ProjectRoot\android\app\build\generated\assets\createBundleReleaseJsAndAssets"
    $assetsCache = "$ProjectRoot\android\app\build\intermediates\assets\release"
    Remove-Item $bundleCache -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $assetsCache -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "[pre-build] JS bundle cache cleared — Metro will regenerate bundle"
    $t0 = Get-Date
    Push-Location "$ProjectRoot\android"
    & .\gradlew.bat assembleRelease --no-daemon 2>&1 | ForEach-Object {
        $line = "$_"
        if ($line -match "BUILD SUCCESSFUL|BUILD FAILED|> Task :app:") { Write-Host "   $line" }
    }
    $exitCode = $LASTEXITCODE
    Pop-Location
    if (($exitCode -ne 0) -and (-not (Test-Path $ApkSrc))) {
        Write-Host "ERROR: Build failed (exit $exitCode) and no APK found."
        exit 1
    }
    $elapsed = [math]::Round(((Get-Date) - $t0).TotalSeconds)
    Write-Host "[1/3] Build done in ${elapsed}s"
} else {
    Write-Host "[1/3] Build skipped (-SkipBuild)"
}

if (-not (Test-Path $ApkSrc)) {
    Write-Host "ERROR: APK not found at: $ApkSrc"
    exit 1
}

Copy-Item $ApkSrc $ApkDest -Force
$apkSizeMB = [math]::Round((Get-Item $ApkDest).Length / 1MB, 1)

# Step 2: GitHub Release
Write-Host "[2/3] Creating GitHub Release..."
$tag          = "v$(Get-Date -Format 'yyyyMMdd-HHmm')"
$ApkVersioned = "$ProjectRoot\strom-ampel-${tag}.apk"
Copy-Item $ApkDest $ApkVersioned -Force

$notes = "v1.1.4 - Notification timing fix + price bar height encoding`n`n" +
         "Bug 1 fixed: daily_smart notification now fires before the core 3h window (e.g. 13:00) shown in HeroCard, not the full window start.`n" +
         "Bug 2 fixed: price bar heights now proportional to actual price spread (spreadRatio dampening prevents false impression on flat-price days).`n" +
         "Also fixed: missing missedAlarmAt state (pre-existing TS error).`n`n" +
         "Size: ${apkSizeMB} MB"

try { & gh release delete latest --repo $GHRepo --yes 2>$null | Out-Null } catch { }
$ErrorActionPreference = "Stop"

& gh release create $tag $ApkVersioned $ApkDest `
    --repo $GHRepo `
    --title "Strom Ampel $tag" `
    --notes $notes `
    --latest

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: gh release create failed."
    exit 1
}
Write-Host "[2/3] Released: $tag"

# Step 3: QR Code
Write-Host "[3/3] Generating QR code..."
$downloadUrl = "https://github.com/$GHRepo/releases/latest/download/strom-ampel-latest.apk"
$releaseUrl  = "https://github.com/$GHRepo/releases/latest"
$qrApiUrl    = "https://api.qrserver.com/v1/create-qr-code/?size=400x400" + "&margin=10&data=" + [uri]::EscapeDataString($downloadUrl)
try {
    Invoke-WebRequest -Uri $qrApiUrl -OutFile "$ProjectRoot\qr-latest.png" -UseBasicParsing
    Write-Host "[3/3] QR saved."
} catch {
    Write-Host "[3/3] QR skipped: $_"
}

Write-Host ""
Write-Host "=== RELEASE COMPLETE ==="
Write-Host "Tag     : $tag"
Write-Host "Size    : ${apkSizeMB} MB"
Write-Host "Download: $downloadUrl"
Write-Host "Page    : $releaseUrl"
Write-Host ""
Start-Process $releaseUrl
$qrFile = "$ProjectRoot\qr-latest.png"
if (Test-Path $qrFile) { Start-Process $qrFile }
