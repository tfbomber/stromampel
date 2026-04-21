$ErrorActionPreference = "Stop"
$apkPath = "D:\Stock Analysis\StromAmpelApp\strom-ampel-latest.apk"

Write-Host "Getting best GoFile server..."
$serverRes = Invoke-RestMethod "https://api.gofile.io/servers"
$server    = $serverRes.data.servers[0].name
Write-Host "Using server: $server"

Write-Host "Uploading APK ($([math]::Round((Get-Item $apkPath).Length/1MB,1)) MB)..."

$boundary  = [System.Guid]::NewGuid().ToString()
$fileBytes = [System.IO.File]::ReadAllBytes($apkPath)
$fileName  = [System.IO.Path]::GetFileName($apkPath)

$bodyLines = @(
    "--$boundary",
    "Content-Disposition: form-data; name=`"file`"; filename=`"$fileName`"",
    "Content-Type: application/vnd.android.package-archive",
    "",
    [System.Text.Encoding]::GetEncoding("iso-8859-1").GetString($fileBytes),
    "--$boundary--"
)
$body = $bodyLines -join "`r`n"
$bodyBytes = [System.Text.Encoding]::GetEncoding("iso-8859-1").GetBytes($body)

$res = Invoke-RestMethod `
    -Uri "https://$server.gofile.io/uploadFile" `
    -Method POST `
    -ContentType "multipart/form-data; boundary=$boundary" `
    -Body $bodyBytes

if ($res.status -eq "ok") {
    Write-Host ""
    Write-Host "=== UPLOAD DONE ==="
    Write-Host ("Download Page : " + $res.data.downloadPage)
} else {
    Write-Host "Upload failed:"
    $res | ConvertTo-Json
}
