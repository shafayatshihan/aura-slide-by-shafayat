# Opens the Aura-Slide folder in VS Code and shows what to do next.
param([switch]$Quiet)
$ErrorActionPreference = 'Stop'
$Aura = Split-Path -Parent $PSScriptRoot
$Root = Split-Path -Parent $Aura
# Launch Code.exe itself: starting code.cmd with a hidden window passes SW_HIDE on to VS Code on a fresh start.
$code = @("$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe", "$env:ProgramFiles\Microsoft VS Code\Code.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
Add-Type -AssemblyName PresentationFramework
if (-not $code) { [void][Windows.MessageBox]::Show('VS Code was not found. Please run "Setup Aura-Slide" again.', 'Aura-Slide', 'OK', 'Warning'); exit 1 }
if (-not (Test-Path (Join-Path $Aura 'brief\brief.json'))) { & (Join-Path $PSScriptRoot 'form.ps1') }
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue   # set inside VS Code terminals; makes Code.exe act as Node
Start-Process -FilePath $code -ArgumentList ('"' + $Root + '"')
if (-not $Quiet) {
  $msg = "VS Code is opening.`n`n" +
         "1.  If VS Code asks ""Do you trust the authors?"", click ""Yes, I trust the authors"".`n" +
         "2.  Click the Claude icon (the orange spark).`n" +
         "3.  The first time only: click ""Sign in"", then ""Authorize"" in your browser.`n" +
         "     If Claude asks whether to trust this folder, click ""Yes"".`n" +
         "4.  Type   show your aura   and press Enter."
  [void][Windows.MessageBox]::Show($msg, 'Aura-Slide by Shafayat', 'OK', 'Information')
}
