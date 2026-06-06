param(
  [int]$ApiPort = 8080,
  [int]$MetroPort = 8082,
  [switch]$SkipLaunch
)

$ErrorActionPreference = "Stop"

$appRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$mockApi = Join-Path $appRoot "dev\mock-api.js"
$artifacts = Join-Path $appRoot "artifacts"
New-Item -ItemType Directory -Force -Path $artifacts | Out-Null

$apiOut = Join-Path $artifacts "local_mock_api.out.txt"
$apiErr = Join-Path $artifacts "local_mock_api.err.txt"
$metroOut = Join-Path $artifacts "local_metro.out.txt"
$metroErr = Join-Path $artifacts "local_metro.err.txt"

$apiProcess = $null
$metroProcess = $null

function Wait-HttpOk {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 30
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    try {
      Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 3 | Out-Null
      return
    } catch {
      Start-Sleep -Seconds 1
    }
  } while ((Get-Date) -lt $deadline)

  throw "Timed out waiting for $Url"
}

try {
  Write-Host "Starting mock API on http://127.0.0.1:$ApiPort"
  $apiProcess = Start-Process -FilePath "node.exe" `
    -ArgumentList @($mockApi) `
    -WorkingDirectory $appRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $apiOut `
    -RedirectStandardError $apiErr `
    -PassThru

  Wait-HttpOk -Url "http://127.0.0.1:$ApiPort/health"

  Write-Host "Configuring ADB reverse ports"
  adb reverse "tcp:$ApiPort" "tcp:$ApiPort" | Out-Host
  adb reverse "tcp:$MetroPort" "tcp:$MetroPort" | Out-Host

  $env:EXPO_OFFLINE = "1"
  $env:EXPO_NO_DOCTOR = "1"
  $env:EXPO_PUBLIC_API_BASE = "http://127.0.0.1:$ApiPort"

  Write-Host "Starting Metro on http://localhost:$MetroPort"
  $metroProcess = Start-Process -FilePath "node.exe" `
    -ArgumentList @("node_modules\expo\bin\cli", "start", "--localhost", "--port", "$MetroPort", "--clear") `
    -WorkingDirectory $appRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $metroOut `
    -RedirectStandardError $metroErr `
    -PassThru

  Wait-HttpOk -Url "http://127.0.0.1:$MetroPort/status" -TimeoutSeconds 45

  if (-not $SkipLaunch) {
    Write-Host "Launching com.yourcompany.tpymusic"
    adb shell am force-stop com.yourcompany.tpymusic | Out-Host
    adb shell monkey -p com.yourcompany.tpymusic -c android.intent.category.LAUNCHER 1 | Out-Host
  }

  Write-Host ""
  Write-Host "Local Android test stack is running."
  Write-Host "API:   http://127.0.0.1:$ApiPort"
  Write-Host "Metro: http://127.0.0.1:$MetroPort"
  Write-Host "Demo login: account demo / password demo"
  Write-Host "Keep this terminal open. Press Ctrl+C to stop."

  while ($true) {
    if ($apiProcess.HasExited) { throw "Mock API exited. See $apiErr" }
    if ($metroProcess.HasExited) { throw "Metro exited. See $metroErr" }
    Start-Sleep -Seconds 2
  }
} finally {
  if ($metroProcess -and -not $metroProcess.HasExited) {
    Stop-Process -Id $metroProcess.Id -Force -ErrorAction SilentlyContinue
  }
  if ($apiProcess -and -not $apiProcess.HasExited) {
    Stop-Process -Id $apiProcess.Id -Force -ErrorAction SilentlyContinue
  }
}
