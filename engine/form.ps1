# Opens the Aura-Slide form in the browser. Starts the small local form server first if it is not running.
# The server only listens on this PC (127.0.0.1) and saves answers into .aura\brief.
$ErrorActionPreference = 'Stop'
$Aura = Split-Path -Parent $PSScriptRoot
$cfg  = Get-Content (Join-Path $Aura 'aura.config.json') -Raw | ConvertFrom-Json
$url  = "http://127.0.0.1:$($cfg.formPort)/"
function Alive { try { (Invoke-WebRequest ($url + 'api/ping') -TimeoutSec 2 -UseBasicParsing).StatusCode -eq 200 } catch { $false } }
if (-not (Alive)) {
  $pyw = Join-Path $Aura 'venv\Scripts\pythonw.exe'
  if (-not (Test-Path $pyw)) {
    Add-Type -AssemblyName PresentationFramework
    [void][Windows.MessageBox]::Show('Aura-Slide is not fully set up yet. Please run "Setup Aura-Slide" again.', 'Aura-Slide', 'OK', 'Warning'); exit 1
  }
  Start-Process -FilePath $pyw -ArgumentList ('"' + (Join-Path $PSScriptRoot 'form_server.py') + '"') -WindowStyle Hidden
  for ($i = 0; $i -lt 40 -and -not (Alive); $i++) { Start-Sleep -Milliseconds 250 }
}
Start-Process $url
