# Opens the Aura-Slide Studio web app. Starts the small local server first if it is not running.
# Fallback launcher: the Desktop icon runs .aura\AuraSlide.exe, which does the same.
# The server only listens on this PC (127.0.0.1), saves answers into .aura\brief and runs Claude in the background.
# The server needs plain Python only (no extra packages), so if Aura's private Python (.aura\venv) was made by another
# Windows account and no longer works here, any working Python on this account is used instead.
$ErrorActionPreference = 'Stop'
$Aura = Split-Path -Parent $PSScriptRoot
$cfg  = Get-Content (Join-Path $Aura 'aura.config.json') -Raw | ConvertFrom-Json
$port = [int]$cfg.formPort
$url  = "http://127.0.0.1:$port/"
function Ping { try { Invoke-RestMethod ($url + 'api/ping') -TimeoutSec 2 } catch { $null } }
function Alive { $null -ne (Ping) }
function Venv-Ok {   # a venv only works while the Python it was made from still exists for this account
  $cfgFile = Join-Path $Aura 'venv\pyvenv.cfg'
  if (-not (Test-Path (Join-Path $Aura 'venv\Scripts\pythonw.exe')) -or -not (Test-Path $cfgFile)) { return $false }
  $pyHome = (Get-Content $cfgFile | Where-Object { $_ -match '^\s*home\s*=' } | Select-Object -First 1) -replace '^\s*home\s*=\s*', ''
  return ($pyHome -and (Test-Path (Join-Path $pyHome.Trim() 'python.exe')))
}
function Find-Pythonw {
  if (Venv-Ok) { return (Join-Path $Aura 'venv\Scripts\pythonw.exe') }
  $c = @(Get-ChildItem "$env:LOCALAPPDATA\Programs\Python\Python3*\pythonw.exe", "$env:ProgramFiles\Python3*\pythonw.exe" -ErrorAction SilentlyContinue |
         Sort-Object FullName -Descending | ForEach-Object { $_.FullName })
  foreach ($n in 'pythonw.exe', 'pyw.exe') { $g = Get-Command $n -ErrorAction SilentlyContinue; if ($g) { $c += $g.Source } }
  foreach ($p in $c) {
    if ($p -match 'WindowsApps') { continue }                       # the Microsoft Store placeholder, not a real Python
    $exe = $p -replace 'pythonw\.exe$', 'python.exe' -replace 'pyw\.exe$', 'py.exe'
    if (Test-Path $exe) { & $env:ComSpec /d /c ('"' + $exe + '" -c "import http.server" >nul 2>nul'); if ($LASTEXITCODE -eq 0) { return $p } }
  }
  return $null
}
function Stop-OldServer {
  # An older Aura-Slide form server (from before the web app) answers ping without an api version: replace it.
  $owner = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess
  if (-not $owner) { return }
  $proc = Get-Process -Id $owner -ErrorAction SilentlyContinue
  if ($proc -and $proc.ProcessName -match '^(python|pythonw|py|pyw)$') {
    Stop-Process -Id $owner -Force -ErrorAction SilentlyContinue
    for ($i = 0; $i -lt 20 -and (Alive); $i++) { Start-Sleep -Milliseconds 250 }
  }
}

$ping = Ping
if ($ping -and -not $ping.api) { Stop-OldServer; $ping = Ping }
if (-not $ping) {
  $pyw = Find-Pythonw
  if (-not $pyw) {
    $app = Join-Path $Aura 'AuraSlide.exe'
    if (Test-Path $app) { Start-Process -FilePath $app -ArgumentList '--repair'; exit 1 }   # the app explains and repairs
    Add-Type -AssemblyName PresentationFramework
    [void][Windows.MessageBox]::Show('Aura-Slide needs a quick repair on this Windows account. Please download Aura-Slide again and run it - your files and slides are kept.', 'Aura-Slide', 'OK', 'Warning'); exit 1
  }
  Start-Process -FilePath $pyw -ArgumentList ('"' + (Join-Path $PSScriptRoot 'form_server.py') + '"') -WindowStyle Hidden
  for ($i = 0; $i -lt 40 -and -not (Alive); $i++) { Start-Sleep -Milliseconds 250 }
}

# Open as an app window in Edge (no tabs or address bar) when available, otherwise in the default browser.
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
          "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe") | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if ($edge) { Start-Process -FilePath $edge -ArgumentList @("--app=$url", '--start-maximized') }
else { Start-Process $url }
