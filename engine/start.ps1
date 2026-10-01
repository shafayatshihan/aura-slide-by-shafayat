# "Start Aura-Slide": opens the Aura-Slide Studio web app, which collects the brief and runs Claude in the background.
# Normally the Desktop icon runs .aura\AuraSlide.exe directly; this script is the fallback for older shortcuts.
#   -Quiet   no message boxes.
param([switch]$Quiet)
$ErrorActionPreference = 'Stop'
$Aura = Split-Path -Parent $PSScriptRoot
$app  = Join-Path $Aura 'AuraSlide.exe'
if (Test-Path $app) { Start-Process -FilePath $app; exit 0 }
try { & (Join-Path $PSScriptRoot 'form.ps1') }
catch {
  if (-not $Quiet) {
    Add-Type -AssemblyName PresentationFramework
    [void][Windows.MessageBox]::Show('Aura-Slide could not open. Please download Aura-Slide again and run it - your files and slides are kept.', 'Aura-Slide', 'OK', 'Warning')
  }
  exit 1
}
exit 0
