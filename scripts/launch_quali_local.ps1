$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms

$projectRoot = Split-Path -Parent $PSScriptRoot
$appUrl = 'http://localhost:3000/QualiLab_by_ENNAJEH_v2.html'
$healthUrl = 'http://localhost:3000/api/health'
$serverScript = Join-Path $projectRoot 'server.js'

function Test-Health {
  try {
    $resp = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 2
    return $resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500
  } catch {
    return $false
  }
}

if (-not (Test-Path -LiteralPath $serverScript)) {
  [System.Windows.Forms.MessageBox]::Show(
    "Le fichier server.js est introuvable.`nVerifie le dossier du projet.",
    'Quali by ENNAJEH',
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Warning
  ) | Out-Null
  exit 1
}

if (-not (Test-Health)) {
  Start-Process -FilePath 'powershell.exe' -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-WindowStyle', 'Hidden',
    '-Command',
    "Set-Location -LiteralPath '$projectRoot'; node '$serverScript'"
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
