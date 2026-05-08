$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms

$projectRoot = 'D:\stage prjet fin d''étude 2026\cahier de charge d''application'
$appUrl = 'http://localhost:3000/QualiLab_by_ENNAJEH_v2.html'
$healthUrl = 'http://localhost:3000/api/health'
$serverScript = Join-Path $projectRoot 'server.js'

function Test-Port3000 {
  try {
    $conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction Stop
    return $conn -ne $null
  } catch {
    return $false
  }
}

function Test-Health {
  try {
    $resp = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 2
    return $resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500
  } catch {
    return $false
  }
}

if (-not (Test-Port3000) -or -not (Test-Health)) {
  $serverCommand = "Set-Location -LiteralPath '$projectRoot'; node '$serverScript'"
  Start-Process -FilePath 'powershell.exe' -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-WindowStyle', 'Hidden',
    '-Command', $serverCommand
  ) -WindowStyle Hidden | Out-Null

  $ready = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-Health) {
      $ready = $true
      break
    }
  }

  if (-not $ready) {
    [System.Windows.Forms.MessageBox]::Show(
      "Le serveur local n'a pas repondu a temps.`nVerifie Node.js et le fichier server.js du projet.",
      'Quali by ENNAJEH',
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Warning
    ) | Out-Null
    exit 1
  }
}

Start-Process $appUrl
