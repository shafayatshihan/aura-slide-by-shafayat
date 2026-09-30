# Downloads the newest Aura-Slide release and runs its setup. Your files, your slides and your form answers stay.
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Aura = Split-Path -Parent $PSScriptRoot
$cfg  = Get-Content (Join-Path $Aura 'aura.config.json') -Raw | ConvertFrom-Json
$work = Join-Path $Aura 'temp\update'
Write-Host ''; Write-Host '  Getting the newest Aura-Slide...' -ForegroundColor Cyan
try {
  if (Test-Path $work) { Remove-Item $work -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $work | Out-Null
  $zip = Join-Path $work 'Aura-Slide-Setup.zip'
  Invoke-WebRequest $cfg.releaseZip -OutFile $zip -UseBasicParsing
  Expand-Archive $zip -DestinationPath $work -Force
  $setup = Get-ChildItem $work -Recurse -Filter 'setup.ps1' | Select-Object -First 1
  if (-not $setup) { throw 'The download did not contain the setup.' }
  & $setup.FullName
} catch {
  Write-Host ("  Update failed: " + $_.Exception.Message) -ForegroundColor Red
  Write-Host '  Check your internet and try again, or double-click "Send problem report".' -ForegroundColor Yellow
  Read-Host '  Press Enter to close'
}
