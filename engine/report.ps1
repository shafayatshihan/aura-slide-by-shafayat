# Makes "Aura-Slide problem report <date>.zip" on the Desktop: setup logs, the form answers and tool versions.
# No personal files from "3 - Put your files here" are included.
$ErrorActionPreference = 'SilentlyContinue'
$Aura = Split-Path -Parent $PSScriptRoot
$tmp  = Join-Path $env:TEMP ('aura-report-' + (Get-Date -Format 'yyyyMMddHHmmss'))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
Copy-Item (Join-Path $Aura 'logs') $tmp -Recurse -Force
Copy-Item (Join-Path $Aura 'brief\brief.json') $tmp -Force
$info = @("Aura-Slide report  $(Get-Date)", "Windows  $([Environment]::OSVersion.VersionString)",
  "Free C:  $([math]::Round((Get-PSDrive C).Free / 1GB, 1)) GB",
  "GPU      $((Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name) -join ', ')")
foreach ($t in @('code', 'git', 'node', 'npm', 'python', 'py', 'claude', 'winget')) {
  $c = Get-Command $t -ErrorAction SilentlyContinue
  $v = if ($c) { try { (& $t --version 2>&1 | Select-Object -First 1) } catch { '?' } } else { 'missing' }
  $info += ('{0,-8} {1}' -f $t, $v)
}
$info | Set-Content (Join-Path $tmp 'versions.txt')
$zip = Join-Path ([Environment]::GetFolderPath('Desktop')) ('Aura-Slide problem report ' + (Get-Date -Format 'yyyy-MM-dd HH-mm') + '.zip')
Compress-Archive -Path (Join-Path $tmp '*') -DestinationPath $zip -Force
Remove-Item $tmp -Recurse -Force
Start-Process explorer.exe ('/select,"' + $zip + '"')
Add-Type -AssemblyName PresentationFramework
[void][Windows.MessageBox]::Show("A problem report was saved on your Desktop:`n`n$(Split-Path -Leaf $zip)`n`nSend this file to Shafayat.", 'Aura-Slide', 'OK', 'Information')
