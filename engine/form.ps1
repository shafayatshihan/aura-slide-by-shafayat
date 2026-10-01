# Opens the Aura-Slide form in the browser. Starts the small local form server first if it is not running.
# The server only listens on this PC (127.0.0.1) and saves answers into .aura\brief.
# The server needs plain Python only (no extra packages), so if Aura's private Python (.aura\venv) was made by another
# Windows account and no longer works here, any working Python on this account is used instead.
$ErrorActionPreference = 'Stop'
$Aura = Split-Path -Parent $PSScriptRoot
$cfg  = Get-Content (Join-Path $Aura 'aura.config.json') -Raw | ConvertFrom-Json
$url  = "http://127.0.0.1:$($cfg.formPort)/"
function Alive { try { (Invoke-WebRequest ($url + 'api/ping') -TimeoutSec 2 -UseBasicParsing).StatusCode -eq 200 } catch { $false } }
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
if (-not (Alive)) {
  $pyw = Find-Pythonw
  if (-not $pyw) {
    Add-Type -AssemblyName PresentationFramework
    [void][Windows.MessageBox]::Show('Aura-Slide needs a quick repair on this Windows account. Please double-click "Update Aura-Slide", then open the form again.', 'Aura-Slide', 'OK', 'Warning'); exit 1
  }
  Start-Process -FilePath $pyw -ArgumentList ('"' + (Join-Path $PSScriptRoot 'form_server.py') + '"') -WindowStyle Hidden
  for ($i = 0; $i -lt 40 -and -not (Alive); $i++) { Start-Sleep -Milliseconds 250 }
}
Start-Process $url
