# Aura-Slide by Shafayat - one-click setup for Windows 10/11.
# Makes C:\Aura-Slide by Shafayat, installs whatever is missing (VS Code, Git, Node.js, Python, Claude Code and its
# VS Code extension, the slide engine), adds the icon and shortcuts, then opens the form and VS Code.
# Safe to run again: anything already installed is skipped and the user's own files are never touched.
# Keep this file ASCII-only: Windows PowerShell 5.1 reads BOM-less scripts in the ANSI code page.
param([switch]$NoLaunch)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$Repo  = Split-Path -Parent $PSScriptRoot
$Root  = 'C:\Aura-Slide by Shafayat'
$Aura  = Join-Path $Root '.aura'
$Logs  = Join-Path $Aura 'logs'
$Stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$Log   = $null
$Config = Get-Content (Join-Path $PSScriptRoot 'aura.config.json') -Raw | ConvertFrom-Json

# ---------------------------------------------------------------- look & feel
$FULL = [string][char]0x2588; $EMPTY = [string][char]0x2591
function Line([string]$t = '', [string]$c = 'Gray') { Write-Host $t -ForegroundColor $c }
$GLYPH = @{
  'A' = @(' ### ', '#   #', '#####', '#   #', '#   #'); 'U' = @('#   #', '#   #', '#   #', '#   #', ' ### ')
  'R' = @('#### ', '#   #', '#### ', '#  # ', '#   #'); '-' = @('    ', '    ', '### ', '    ', '    ')
  'S' = @(' ####', '#    ', ' ### ', '    #', '#### '); 'L' = @('#    ', '#    ', '#    ', '#    ', '#####')
  'I' = @('###', ' # ', ' # ', ' # ', '###');           'D' = @('#### ', '#   #', '#   #', '#   #', '#### ')
  'E' = @('#####', '#    ', '#### ', '#    ', '#####')
}
function Banner {
  Clear-Host
  Line ''
  $word = 'AURA-SLIDE'; $cols = @('Cyan', 'Cyan', 'Cyan', 'Cyan', 'DarkGray', 'Magenta', 'Magenta', 'Magenta', 'Magenta', 'Magenta')
  for ($r = 0; $r -lt 5; $r++) {
    Write-Host '   ' -NoNewline
    for ($c = 0; $c -lt $word.Length; $c++) { Write-Host (($GLYPH[[string]$word[$c]][$r]) -replace '#', $FULL) -ForegroundColor $cols[$c] -NoNewline; Write-Host ' ' -NoNewline }
    if ($r -eq 4) { Write-Host '  by Shafayat' -ForegroundColor Blue } else { Write-Host '' }
  }
  Line ''
  Line '  This sets up everything you need. It takes 10 to 20 minutes.' 'White'
  Line '  If Windows asks "Do you want to allow this app to make changes?", click Yes.' 'Yellow'
  Line ''
}
function Bar([int]$done, [int]$total, [int]$w = 34) {
  $n = [int][math]::Round($w * $done / [math]::Max(1, $total)); ($FULL * $n) + ($EMPTY * ($w - $n))
}
function Overall([int]$done, [int]$total) {
  $pct = [int](100 * $done / [math]::Max(1, $total))
  Write-Host ('  Overall  ' + (Bar $done $total) + ('  {0,3}%  ({1} of {2} steps)' -f $pct, $done, $total)) -ForegroundColor Cyan
  Line ''
}
function Tag([string]$t, [string]$bg, [string]$msg) {
  Write-Host ('  ' + $t.PadRight(6)) -ForegroundColor Black -BackgroundColor $bg -NoNewline; Write-Host (' ' + $msg)
}
function Ok([string]$m)   { Tag ' OK' 'Green' $m }
function Skip([string]$m) { Tag 'FOUND' 'DarkCyan' $m }
function Bad([string]$m)  { Tag ' FAIL' 'Red' $m }
function Log([string]$m)  { if ($Log) { Add-Content -Path $Log -Value ('[{0}] {1}' -f (Get-Date -Format 'HH:mm:ss'), $m) } }

# Run a program hidden, with a live spinner + elapsed time, output appended to the log. Returns the exit code.
function Run([string]$what, [string]$exe, [string]$argsLine) {
  $found = Get-Command $exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($found) { $exe = $found.Source }                      # full path: cmd mis-resolves %~dp0 in a bare "npm"
  Log ">> $exe $argsLine"
  $tmp = [IO.Path]::GetTempFileName()
  $psi = New-Object Diagnostics.ProcessStartInfo
  $psi.FileName = $env:ComSpec
  $psi.Arguments = '/d /s /c ""' + $exe + '" ' + $argsLine + ' > "' + $tmp + '" 2>&1"'
  $psi.UseShellExecute = $false; $psi.CreateNoWindow = $true
  $psi.WorkingDirectory = (Get-Location).ProviderPath      # Push-Location does not move the process directory
  $p = [Diagnostics.Process]::Start($psi)
  $spin = '|/-\'; $i = 0; $t0 = Get-Date
  while (-not $p.HasExited) {
    $s = [int]((Get-Date) - $t0).TotalSeconds
    $wait = if ($s -ge 15) { '  - this can take a few minutes, please do not close this window' } else { '' }
    Write-Host ("`r         {0} {1}   {2}:{3:D2}{4} " -f $spin[$i % 4], $what, [int]($s / 60), ($s % 60), $wait) -NoNewline -ForegroundColor DarkGray
    Start-Sleep -Milliseconds 180; $i++
  }
  Write-Host ("`r" + (' ' * 118) + "`r") -NoNewline
  if ($Log) { Get-Content $tmp -ErrorAction SilentlyContinue | Add-Content -Path $Log }
  Remove-Item $tmp -ErrorAction SilentlyContinue
  Log "<< exit $($p.ExitCode)"
  return $p.ExitCode
}

function Refresh-Path {
  $m = [Environment]::GetEnvironmentVariable('Path', 'Machine'); $u = [Environment]::GetEnvironmentVariable('Path', 'User')
  $extra = @("$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin", "$env:ProgramFiles\Microsoft VS Code\bin",
             "$env:USERPROFILE\.local\bin", "$env:ProgramFiles\Git\cmd", "$env:ProgramFiles\nodejs",
             "$env:LOCALAPPDATA\Programs\Python\Python312", "$env:LOCALAPPDATA\Programs\Python\Python312\Scripts", "$env:APPDATA\npm")
  $env:Path = (@($env:Path, $m, $u) + $extra | Where-Object { $_ }) -join ';'
}
function Has([string]$cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function Winget([string]$id, [string]$scope) {
  $a = "install --id $id -e --silent --accept-package-agreements --accept-source-agreements --disable-interactivity"
  if ($scope) { $a += " --scope $scope" }
  $c = Run 'downloading and installing' 'winget' $a
  Refresh-Path
  return ($c -eq 0 -or $c -eq -1978335189 -or $c -eq -1978335135)   # 0x8A15002B / 0x8A150061: already installed
}
function Code-Cli {
  foreach ($c in @("$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd", "$env:ProgramFiles\Microsoft VS Code\bin\code.cmd")) { if (Test-Path $c) { return $c } }
  $g = Get-Command code -ErrorAction SilentlyContinue; if ($g) { return $g.Source }; return $null
}
function Base-Python {   # a real (non-venv) Python 3.10+; prints its path or $null
  foreach ($try in @(@('py', '-3.12'), @('py', '-3'), @('python', ''))) {
    if (-not (Has $try[0])) { continue }
    try {
      $out = & $try[0] $(if ($try[1]) { $try[1] }) -c "import sys;v=sys.version_info;print(getattr(sys,'_base_executable',sys.executable) if v>=(3,10) else '')" 2>$null
      if ($out -and (Test-Path $out.Trim())) { return $out.Trim() }
    } catch {}
  }
  return $null
}
function Node-Ok { if (-not (Has 'node')) { return $false }; try { $v = (& node --version) -replace '^v', ''; $p = $v.Split('.'); return ([int]$p[0] -ge 22 -or ([int]$p[0] -eq 20 -and [int]$p[1] -ge 19)) } catch { return $false } }

# ---------------------------------------------------------------- steps
$Steps = @(
  @{ n = 'Your Aura-Slide folder on C:';          f = 'Step-Folder' },
  @{ n = 'VS Code (the app you will work in)';    f = 'Step-VSCode' },
  @{ n = 'Git (needed by Claude on Windows)';     f = 'Step-Git' },
  @{ n = 'Node.js (runs the 3D slide engine)';    f = 'Step-Node' },
  @{ n = 'Python (makes PDF and PowerPoint)';     f = 'Step-Python' },
  @{ n = 'Claude Code (the AI)';                  f = 'Step-Claude' },
  @{ n = 'Claude inside VS Code';                 f = 'Step-Extension' },
  @{ n = 'Slide engine: 3D and video tools';      f = 'Step-Npm' },
  @{ n = 'Slide engine: PDF and PowerPoint tools'; f = 'Step-Pip' },
  @{ n = 'Icon and shortcuts';                    f = 'Step-Shortcuts' }
)

function Step-Folder {
  $made = -not (Test-Path $Root)
  $dirs = @('3 - Put your files here\Report', '3 - Put your files here\Images and photos', '3 - Put your files here\Data (csv, excel, graphs)',
            '3 - Put your files here\Logo and university template', '3 - Put your files here\Previous year reports',
            '3 - Put your files here\Journal papers', '3 - Put your files here\Anything else',
            '4 - Your slides\Older versions', '.aura\engine', '.aura\temp', '.aura\logs', '.aura\brief', '.aura\icon')
  foreach ($d in $dirs) { New-Item -ItemType Directory -Force -Path (Join-Path $Root $d) | Out-Null }
  # engine + Claude project files (user folders are never overwritten)
  Get-ChildItem (Join-Path $Repo 'engine') -Force | Where-Object { $_.Name -ne 'node_modules' } | Copy-Item -Destination (Join-Path $Aura 'engine') -Recurse -Force
  Copy-Item (Join-Path $Repo 'workspace\.claude') $Root -Recurse -Force
  Copy-Item (Join-Path $Repo 'workspace\.vscode') $Root -Recurse -Force
  Copy-Item (Join-Path $PSScriptRoot 'icon\aura-slide.ico') (Join-Path $Aura 'icon') -Force
  Copy-Item (Join-Path $PSScriptRoot 'aura.config.json') $Aura -Force
  $guide = Join-Path $Repo 'docs\1 - Read me first.pdf'; if (Test-Path $guide) { Copy-Item $guide $Root -Force }
  foreach ($h in @('.aura', '.claude', '.vscode')) { (Get-Item (Join-Path $Root $h) -Force).Attributes = 'Directory, Hidden, System' }
  if ($made) { return 'created ' + $Root } else { return 'already there, your files are untouched' }
}
function Step-VSCode {
  if (Code-Cli) { return 'HAVE' }
  if (-not (Winget 'Microsoft.VisualStudioCode' 'user')) { throw 'VS Code could not be installed.' }
  if (-not (Code-Cli)) { throw 'VS Code installed but not found.' }; 'installed'
}
function Step-Git {
  if (Has 'git') { return 'HAVE' }
  if (-not (Winget 'Git.Git' '')) { throw 'Git could not be installed.' }
  if (-not (Has 'git')) { throw 'Git installed but not found.' }; 'installed'
}
function Step-Node {
  if (Node-Ok) { return 'HAVE' }
  if (-not (Winget 'OpenJS.NodeJS.LTS' '')) { throw 'Node.js could not be installed.' }
  if (-not (Node-Ok)) { throw 'Node.js installed but not found.' }; 'installed'
}
function Step-Python {
  if (Base-Python) { return 'HAVE' }
  if (-not (Winget 'Python.Python.3.12' 'user')) { throw 'Python could not be installed.' }
  if (-not (Base-Python)) { throw 'Python installed but not found.' }; 'installed'
}
function Step-Claude {
  if (Has 'claude') { return 'HAVE' }
  $c = Run 'downloading Claude Code' 'powershell' '-NoProfile -ExecutionPolicy Bypass -Command "irm https://claude.ai/install.ps1 | iex"'
  Refresh-Path
  if (-not (Has 'claude')) { throw "Claude Code could not be installed (code $c)." }; 'installed'
}
function Step-Extension {
  $code = Code-Cli; if (-not $code) { throw 'VS Code is missing.' }
  $list = & $env:ComSpec /d /c ('"' + $code + '" --list-extensions 2>nul')
  if ($list -contains $Config.claudeExtension) { return 'HAVE' }
  $c = Run 'adding Claude to VS Code' $code ('--install-extension ' + $Config.claudeExtension)
  $list = & $env:ComSpec /d /c ('"' + $code + '" --list-extensions 2>nul')
  if ($list -notcontains $Config.claudeExtension) { throw "The Claude extension could not be added (code $c)." }; 'installed'
}
function Step-Npm {
  $eng = Join-Path $Aura 'engine'
  Push-Location $eng
  try { $c = Run 'downloading three.js, Vite and Playwright' 'npm' 'install --no-audit --no-fund --loglevel=error' } finally { Pop-Location }
  if ($c -ne 0 -or -not (Test-Path (Join-Path $eng 'node_modules\three'))) { throw "The 3D tools could not be installed (code $c)." }
  'ready'
}
function Step-Pip {
  $venv = Join-Path $Aura 'venv'; $py = Join-Path $venv 'Scripts\python.exe'
  if (-not (Test-Path $py)) {
    $base = Base-Python; if (-not $base) { throw 'Python is missing.' }
    $c = Run 'making a private Python' $base ('-m venv "' + $venv + '"'); if (-not (Test-Path $py)) { throw "Could not make the Python environment (code $c)." }
  }
  $c = Run 'downloading Pillow, python-pptx and ffmpeg' $py ('-m pip install --disable-pip-version-check --upgrade ' + ($Config.pythonPackages -join ' '))
  if ($c -ne 0) { throw "The PDF and PowerPoint tools could not be installed (code $c)." }
  'ready'
}
function Step-Shortcuts {
  $ico = Join-Path $Aura 'icon\aura-slide.ico'
  # folder icon
  $ini = Join-Path $Root 'desktop.ini'
  if (Test-Path $ini) { (Get-Item $ini -Force).Attributes = 'Normal' }
  Set-Content -Path $ini -Encoding Unicode -Value "[.ShellClassInfo]`r`nIconResource=$ico,0`r`nInfoTip=Aura-Slide by Shafayat`r`n"
  (Get-Item $ini -Force).Attributes = 'Hidden, System'
  (Get-Item $Root -Force).Attributes = 'Directory, ReadOnly'
  $sh = New-Object -ComObject WScript.Shell
  $ps = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
  function Lnk([string]$path, [string]$target, [string]$argz, [string]$tip, [int]$style = 1) {
    $l = $sh.CreateShortcut($path); $l.TargetPath = $target; $l.Arguments = $argz; $l.IconLocation = "$ico,0"
    $l.WorkingDirectory = $Root; $l.Description = $tip; $l.WindowStyle = $style; $l.Save()
  }
  $run = { param($script) '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + (Join-Path $Aura "engine\$script") + '"' }
  Lnk (Join-Path $Root '2 - Fill in the form.lnk') $ps (& $run 'form.ps1') 'Tell Aura-Slide about your presentation' 7
  Lnk (Join-Path $Root 'Start Aura-Slide.lnk') $ps (& $run 'start.ps1') 'Open Aura-Slide in VS Code' 7
  Lnk (Join-Path $Root 'Update Aura-Slide.lnk') $ps ('-NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $Aura 'engine\update.ps1') + '"') 'Get the newest Aura-Slide' 1
  Lnk (Join-Path $Root 'Send problem report.lnk') $ps (& $run 'report.ps1') 'Make a zip you can send to Shafayat' 7
  $desk = [Environment]::GetFolderPath('Desktop')
  Lnk (Join-Path $desk 'Aura-Slide.lnk') "$env:SystemRoot\explorer.exe" ('"' + $Root + '"') 'Open your Aura-Slide folder'
  $menu = Join-Path ([Environment]::GetFolderPath('Programs')) 'Aura-Slide.lnk'
  Lnk $menu $ps (& $run 'start.ps1') 'Open Aura-Slide in VS Code' 7
  'Desktop icon + Start menu'
}

# ---------------------------------------------------------------- run
Banner
Line '  Checking this PC first...' 'White'
$os = [Environment]::OSVersion.Version
if ($os.Major -lt 10) { Bad 'Aura-Slide needs Windows 10 or 11.'; Read-Host '  Press Enter to close'; exit 1 }
$free = [math]::Round((Get-PSDrive C).Free / 1GB, 1)
if ($free -lt 3) { Bad "Only $free GB free on drive C. Please free up at least 3 GB and run this again."; Read-Host '  Press Enter to close'; exit 1 }
try { Invoke-WebRequest 'https://github.com' -Method Head -TimeoutSec 15 -UseBasicParsing | Out-Null }
catch { Bad 'No internet connection. Connect to Wi-Fi and run this again.'; Read-Host '  Press Enter to close'; exit 1 }
if (-not (Has 'winget')) {
  Bad 'Windows is missing "App Installer". The Microsoft Store will open: click Get or Update, then run this again.'
  Start-Process 'ms-windows-store://pdp/?ProductId=9NBLGGH4NNS1'; Read-Host '  Press Enter to close'; exit 1
}
$gpu = (Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name) -join ', '
Refresh-Path

$done = 0; $failed = @(); $total = $Steps.Count
for ($k = 0; $k -lt $total; $k++) {
  $s = $Steps[$k]
  Banner; Overall $done $total
  for ($j = 0; $j -lt $k; $j++) { $r = $Steps[$j].r; if ($r -eq 'HAVE') { Skip $Steps[$j].n } elseif ($r -like 'FAIL*') { Bad ($Steps[$j].n + ' - ' + $r.Substring(5)) } else { Ok ($Steps[$j].n + ' - ' + $r) } }
  Write-Host ('  ' + '>>'.PadRight(6)) -ForegroundColor Black -BackgroundColor Yellow -NoNewline; Write-Host (' ' + $s.n + ' ...')
  try {
    $r = & $s.f
    if ($k -eq 0) { $Log = Join-Path $Logs "setup_$Stamp.log"; Log "Aura-Slide setup $($Config.version)  Windows $os  free C: $free GB  GPU: $gpu" }
    $s.r = [string]$r; Log ("OK  " + $s.n + ' : ' + $r)
  } catch {
    $s.r = 'FAIL ' + $_.Exception.Message; $failed += $s.n; Log ('ERR ' + $s.n + ' : ' + $_.Exception.Message)
    if ($k -eq 0) { Banner; Bad ('Could not make ' + $Root + ': ' + $_.Exception.Message); Read-Host '  Press Enter to close'; exit 1 }
  }
  $done++
}

Banner; Overall $done $total
foreach ($s in $Steps) { if ($s.r -eq 'HAVE') { Skip $s.n } elseif ($s.r -like 'FAIL*') { Bad ($s.n + ' - ' + $s.r.Substring(5)) } else { Ok ($s.n + ' - ' + $s.r) } }
Line ''
if ($failed.Count) {
  Line '  Some parts did not install. Run "Setup Aura-Slide" again - it continues where it stopped.' 'Yellow'
  Line '  Still stuck? Open your Aura-Slide folder and double-click "Send problem report".' 'Yellow'
  Line ''; Read-Host '  Press Enter to close'; exit 1
}
Line '  All done!  Your folder:  C:\Aura-Slide by Shafayat   (also on your Desktop as "Aura-Slide")' 'Green'
Line ''
Line '  What happens now:' 'White'
Line '    1. The form opens in your browser. Fill it in and click Save.'
Line '    2. VS Code opens. Click the Claude icon, then "Sign in", and click Authorize in the browser.'
Line '    3. In the Claude box, type:   show your aura' 'Cyan'
Line ''
if (-not $NoLaunch) {
  Start-Process 'explorer.exe' ('"' + $Root + '"')
  & (Join-Path $Aura 'engine\form.ps1')
  & (Join-Path $Aura 'engine\start.ps1') -Quiet
}
Read-Host '  Press Enter to close this window'
