# Gets the newest Lumi. Your files, your slides and your form answers stay.
# With the Lumi app installed (.aura\Lumi.exe) the app does it (download, setup, reopen); otherwise the
# newest release is downloaded here and its setup runs in this console window.
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Aura = Split-Path -Parent $PSScriptRoot
$app  = Join-Path $Aura 'Lumi.exe'
if (Test-Path $app) { Start-Process -FilePath $app -ArgumentList '--update'; exit 0 }
$cfg  = Get-Content (Join-Path $Aura 'aura.config.json') -Raw | ConvertFrom-Json
$work = Join-Path $Aura 'temp\update'
Write-Host ''; Write-Host '  Getting the newest Lumi...' -ForegroundColor Cyan
try {
  if (Test-Path $work) { Remove-Item $work -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $work | Out-Null
  $zip = Join-Path $work 'Lumi-Setup.zip'
  Invoke-WebRequest $cfg.releaseZip -OutFile $zip -UseBasicParsing
  Expand-Archive $zip -DestinationPath $work -Force
  $setup = Get-ChildItem $work -Recurse -Filter 'setup.ps1' | Select-Object -First 1
  if (-not $setup) { throw 'The download did not contain the setup.' }
  $env:AURA_ROOT = Split-Path -Parent $Aura                # update this install, wherever it is
  & $setup.FullName
} catch {
  Write-Host ("  Update failed: " + $_.Exception.Message) -ForegroundColor Red
  Write-Host '  Check your internet and try again, or double-click "Send problem report".' -ForegroundColor Yellow
  Read-Host '  Press Enter to close'
}
