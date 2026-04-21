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

# GH_TOKEN from git credential store
if (-not $env:GH_TOKEN) {
    $lines = (Write-Output "protocol=https`nhost=github.com`n" | git credential fill 2>$null)
    foreach ($line in $lines) {
        if ($line -match "^password=(.+)$") {
            $env:GH_TOKEN = $Matches[1].Trim()
            Write-Host "[Auth] GH_TOKEN loaded"
            break
        }
    }
}

Write-Host "[1/3] Building APK..."
$t0 = Get-Date
Push-Location "$ProjectRoot\android"
& .\gradlew.bat assembleRelease --no-daemon 2>&1 | ForEach-Object {
    $line = "$_"
    if ($line -match "BUILD SUCCESSFUL|BUILD FAILED|> Task :app:") { Write-Host "   $line" }
}
$exitCode = $LASTEXITCODE
Pop-Location

$apkExists = Test-Path $ApkSrc
if (($exitCode -ne 0) -and (-not $apkExists)) {
    Write-Host "ERROR: Gradle build failed (exit $exitCode) and no APK found."
    exit 1
}
$elapsed = [math]::Round(((Get-Date) - $t0).TotalSeconds)
Write-Host "[1/3] Build done in ${elapsed}s"

Copy-Item $ApkSrc $ApkDest -Force
$apkSizeMB = [math]::Round((Get-Item $ApkDest).Length / 1MB, 1)

Write-Host "[2/3] Creating GitHub Release..."
$tag          = "v$(Get-Date -Format 'yyyyMMdd-HHmm')"
$ApkVersioned = "$ProjectRoot\strom-ampel-${tag}.apk"
Copy-Item $ApkDest $ApkVersioned -Force

$notes = "v1.1.3 — Notification settings UI fixes:`n`n- Price bar in notification settings now matches home screen height/colors (previously used raw spot prices, now uses effective price = spot + grid fee)`n- 'Once' reminder no longer defaults to a past hour when the cheapest window has already passed`n- 'Daily Smart' preview text now shows an upcoming window, not a passed one`n- Reminder time label now shows 'Heute/Morgen' prefix when timing offset crosses midnight`n`nSize: ${apkSizeMB} MB"

try { & gh release delete latest --repo $GHRepo --yes 2>$null | Out-Null } catch { }
$ErrorActionPreference = "Stop"   # re-enable strict error after the optional delete

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

Write-Host "[3/3] Generating QR code..."
$downloadUrl = "https://github.com/$GHRepo/releases/latest/download/strom-ampel-latest.apk"
$releaseUrl  = "https://github.com/$GHRepo/releases/latest"
$qrApiUrl    = "https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=10&data=" + [uri]::EscapeDataString($downloadUrl)
try {
    Invoke-WebRequest -Uri $qrApiUrl -OutFile "$ProjectRoot\qr-latest.png" -UseBasicParsing
    Write-Host "[3/3] QR saved."
} catch {
    Write-Host "[3/3] QR skipped."
}

Write-Host ""
Write-Host "=== DONE ==="
Write-Host "Tag     : $tag"
Write-Host "Download: $downloadUrl"
Write-Host "Page    : $releaseUrl"
Write-Host ""

Start-Process $releaseUrl
$qrFile = "$ProjectRoot\qr-latest.png"
if (Test-Path $qrFile) { Start-Process $qrFile }
