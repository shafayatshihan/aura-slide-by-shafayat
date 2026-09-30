# Publish Aura-Slide to GitHub in one go: save (commit) every change, upload (push) it, then wait while GitHub
# builds Aura-Slide-Setup.zip onto the release (.github/workflows/release.yml).
# First run only: installs GitHub CLI if missing, signs in through the browser, creates the public repo.
# Started by "Publish to GitHub.bat". ASCII-only on purpose (Windows PowerShell 5.1).
# Continue, not Stop: in PowerShell 5.1 any text a program writes to stderr (gh, git progress) becomes an error record,
# and with Stop that kills the script. Success is judged by exit codes instead (see Quiet / Show).
$ErrorActionPreference = 'Continue'
$Repo  = Split-Path -Parent $PSScriptRoot
$Owner = 'shafayatshihan'; $Name = 'aura-slide-by-shafayat'; $Slug = "$Owner/$Name"
Set-Location $Repo

function Say([string]$t, [string]$c = 'Gray') { Write-Host $t -ForegroundColor $c }
function Stop-Here([string]$t) { Say ''; Say "  $t" 'Red'; Say ''; Read-Host '  Press Enter to close'; exit 1 }
function Refresh-Path {
  $env:Path = (@($env:Path, [Environment]::GetEnvironmentVariable('Path', 'Machine'), [Environment]::GetEnvironmentVariable('Path', 'User'),
                 "$env:ProgramFiles\GitHub CLI", "$env:ProgramFiles\Git\cmd") | Where-Object { $_ }) -join ';'
}
function Has([string]$c) { [bool](Get-Command $c -ErrorAction SilentlyContinue) }
function Quiet([string]$line) { & $env:ComSpec /d /c "$line >nul 2>&1"; return ($LASTEXITCODE -eq 0) }   # run silently, true if it worked
function Show([string]$line)  { & $env:ComSpec /d /c "$line 2>&1"; return ($LASTEXITCODE -eq 0) }        # run with output shown
function Git { & $env:ComSpec /d /c ('git ' + ($args -join ' ') + ' 2>&1'); if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') failed" } }

trap { Say ''; Say ('  Something went wrong: ' + $_.Exception.Message) 'Red'; Say ''; Read-Host '  Press Enter to close'; exit 1 }
Clear-Host
Say ''; Say '  Aura-Slide  >>  publish to GitHub' 'Cyan'; Say "  $Slug" 'DarkGray'; Say ''

# ---- tools
Refresh-Path
if (-not (Has 'git')) { Say '  Installing Git...' 'Yellow'; winget install --id Git.Git -e --silent --accept-package-agreements --accept-source-agreements | Out-Null; Refresh-Path }
if (-not (Has 'gh'))  { Say '  Installing GitHub CLI (one time)...' 'Yellow'; winget install --id GitHub.cli -e --silent --accept-package-agreements --accept-source-agreements | Out-Null; Refresh-Path }
if (-not (Has 'git') -or -not (Has 'gh')) { Stop-Here 'Git or GitHub CLI could not be installed. Run this again, or install them from git-scm.com and cli.github.com.' }

# ---- sign in (one time)
if (-not (Quiet 'gh auth status --hostname github.com')) {
  Say '  First time: sign in to GitHub.' 'Yellow'
  Say '  Press Enter when asked, copy the 8-letter code, paste it in the browser page and click Authorize.' 'Yellow'; Say ''
  & gh auth login --hostname github.com --git-protocol https --web
  if ($LASTEXITCODE -ne 0) { Stop-Here 'GitHub sign-in did not finish. Run this again.' }
}
[void](Quiet 'gh auth setup-git')
$login = (& gh api user --jq .login).Trim()
if ($login -ne $Owner) { Say "  Signed in as $login, not $Owner. The repo will be $Owner/$Name only if $login can write to it." 'Yellow' }

# ---- local repo
$first = -not (Test-Path (Join-Path $Repo '.git'))
if ($first) { Git init -b main | Out-Null }
$hasCommit = Quiet 'git rev-parse --verify HEAD'
if (-not (Quiet 'git config user.name')) { $id = (& gh api user --jq .id).Trim(); Git config user.name $login; Git config user.email "$id+$login@users.noreply.github.com" }

# ---- optional: rebuild the guide PDF, bump the version
$py = 'X:\CLPHP_Project\.venv\Scripts\python.exe'; if (-not (Test-Path $py)) { $py = 'python' }
if ((Read-Host '  Rebuild the guide PDF first? (y / Enter = no)') -match '^[yY]') {
  & $py (Join-Path $Repo 'tools\build_guide.py'); if ($LASTEXITCODE -ne 0) { Stop-Here 'The guide could not be rebuilt.' }
}
$cfgPath = Join-Path $Repo 'setup\aura.config.json'
$cfgText = [IO.File]::ReadAllText($cfgPath); $ver = ([regex]'"version"\s*:\s*"([^"]+)"').Match($cfgText).Groups[1].Value
$new = Read-Host "  Version for users is $ver. New version? (e.g. 0.2.0 / Enter = keep $ver)"
if ($new -match '^\d+\.\d+\.\d+$' -and $new -ne $ver) {
  $cfgText = $cfgText -replace ('"version"\s*:\s*"' + [regex]::Escape($ver) + '"'), ('"version": "' + $new + '"')
  [IO.File]::WriteAllText($cfgPath, $cfgText, (New-Object Text.UTF8Encoding $false)); $ver = $new
  Say "  Version set to $ver (a new release will be made)." 'Green'
}

# ---- commit
Git add -A
$changes = & git status --porcelain
if (-not $changes) { Say '  Nothing changed since the last publish.' 'Green' }
else {
  if (-not $hasCommit -or -not (& git remote)) {
    Say ''; Say '  These files will be PUBLIC on GitHub:' 'Yellow'; & git diff --cached --name-only | ForEach-Object { Say "    $_" }
    Say ''; if ((Read-Host '  Upload them? (y / n)') -notmatch '^[yY]') { Git reset -q; Stop-Here 'Cancelled. Nothing was uploaded.' }
  }
  $msg = Read-Host '  What did you change? (one line, Enter = "Update")'; if (-not $msg) { $msg = 'Update' }
  Git commit -q -m ('"' + ($msg -replace '"', "'") + '"')
  Say '  Saved.' 'Green'
}

# ---- push (creates the repo the first time)
if (-not (Quiet "gh repo view $Slug")) {
  Say '  Creating the public repo on GitHub...' 'Cyan'
  if (-not (Show "gh repo create $Slug --public --source . --remote origin --push --description `"One-click slide maker for non-technical users: Windows setup + Claude skill`"")) { Stop-Here 'Could not create the repo.' }
} else {
  if (-not (& git remote)) { Git remote add origin "https://github.com/$Slug.git" }
  Say '  Uploading...' 'Cyan'
  if (-not (Show 'git push -u origin main')) { Stop-Here 'Upload failed. Check your internet and run this again.' }
}

# ---- wait for GitHub to build the download
Say ''; Say '  GitHub is building Aura-Slide-Setup.zip (about 1 minute)...' 'Cyan'
Start-Sleep -Seconds 6
$run = (& gh run list --repo $Slug --workflow release.yml --limit 1 --json databaseId --jq '.[0].databaseId' 2>$null)
if ($run) { $ok = Quiet "gh run watch $run --repo $Slug --exit-status" } else { $ok = $false }
Say ''
if ($ok) {
  Say "  Done! Version $ver is live." 'Green'
  Say "  Download link: https://github.com/$Slug/releases/latest/download/Aura-Slide-Setup.zip" 'White'
} else {
  Say '  Uploaded, but the zip build did not report success yet. Opening the Actions page so you can check.' 'Yellow'
  Start-Process "https://github.com/$Slug/actions"
}
Say ''; Read-Host '  Press Enter to close'
