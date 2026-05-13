$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms

$projectRoot = Split-Path -Parent $PSScriptRoot
$xamppRoot = Split-Path -Parent (Split-Path -Parent $projectRoot)
$xamppLaunchRoot = if (Test-Path -LiteralPath 'D:\xampp_quali') { 'D:\xampp_quali' } else { $xamppRoot }
$appUrl = 'http://localhost/QUALI/'
$healthUrl = 'http://localhost:3000/api/health'
$serverScript = Join-Path $projectRoot 'server.js'
$apacheExe = Join-Path $xamppLaunchRoot 'apache\bin\httpd.exe'
$apacheConf = Join-Path $xamppLaunchRoot 'apache\conf\httpd.conf'
$nodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source

function Test-Health {
  try {
    $resp = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 2
    return $resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Test-App {
  try {
    $resp = Invoke-WebRequest -Uri $appUrl -UseBasicParsing -TimeoutSec 2
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

if (-not $nodeExe -or -not (Test-Path -LiteralPath $nodeExe)) {
  [System.Windows.Forms.MessageBox]::Show(
    "Node.js est introuvable sur ce PC.`nVerifie l'installation de Node.js.",
    'Quali by ENNAJEH',
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Warning
  ) | Out-Null
  exit 1
}

if (-not (Test-Path -LiteralPath $apacheExe) -or -not (Test-Path -LiteralPath $apacheConf)) {
  [System.Windows.Forms.MessageBox]::Show(
    "Apache XAMPP est introuvable.`nVerifie le dossier XAMPP.",
    'Quali by ENNAJEH',
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Warning
  ) | Out-Null
  exit 1
}

if (-not (Test-App)) {
  Start-Process -FilePath $apacheExe -ArgumentList @('-f', $apacheConf) -WorkingDirectory $xamppLaunchRoot -WindowStyle Hidden | Out-Null

  $apacheReady = $false
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-App) {
      $apacheReady = $true
      break
    }
  }

  if (-not $apacheReady) {
    [System.Windows.Forms.MessageBox]::Show(
      "Apache XAMPP n'a pas repondu a temps.`nDemarre Apache depuis le panneau XAMPP puis relance.",
      'Quali by ENNAJEH',
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Warning
    ) | Out-Null
    exit 1
  }
}

if (-not (Test-Health)) {
  Start-Process -FilePath $nodeExe -ArgumentList @($serverScript) -WorkingDirectory $projectRoot -WindowStyle Hidden | Out-Null

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
