# Weave — Windows Installer
# Usage (PowerShell):
#   irm https://raw.githubusercontent.com/leandro-br-dev/weave/main/install.ps1 | iex
# Or download and run:
#   powershell -ExecutionPolicy Bypass -File install.ps1

$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'Weave - Installer'

$REPO_URL = 'https://github.com/leandro-br-dev/weave.git'

Write-Host ''
Write-Host '########################################' -ForegroundColor Cyan
Write-Host '  Weave - Windows Installer' -ForegroundColor Cyan
Write-Host '########################################' -ForegroundColor Cyan
Write-Host ''

# ─── Check dependencies ───────────────────────────────────────
Write-Host '-> Checking dependencies...'
$missing = 0

function Check-Command {
  param($cmd, $name, $installHint)
  if (Get-Command $cmd -ErrorAction SilentlyContinue) {
    $ver = (& $cmd --version 2>&1 | Select-Object -First 1) -replace "`r`n",""
    Write-Host "  [OK] $name found: $ver" -ForegroundColor Green
    return $true
  } else {
    Write-Host "  [MISSING] $name not found" -ForegroundColor Red
    Write-Host "    Install: $installHint" -ForegroundColor Yellow
    return $false
  }
}

if (-not (Check-Command 'git' 'Git' 'winget install --id Git.Git  OR  https://git-scm.com')) { $missing++ }
if (-not (Check-Command 'node' 'Node.js' 'winget install OpenJS.NodeJS  OR  https://nodejs.org')) { $missing++ }
if (-not (Check-Command 'python' 'Python' 'winget install Python.Python.3.12  OR  https://python.org')) { $missing++ }

# WSL check
$wslOk = $false
try {
  $wslOut = wsl --list --quiet 2>&1
  if ($LASTEXITCODE -eq 0 -and $wslOut) {
    Write-Host "  [OK] WSL available" -ForegroundColor Green
    $wslOk = $true
  }
} catch {}
if (-not $wslOk) {
  Write-Host "  [MISSING] WSL not installed" -ForegroundColor Red
  Write-Host "    Install: wsl --install  (then reboot and re-run)" -ForegroundColor Yellow
  $missing++
}

# Claude CLI (optional)
if (Get-Command 'claude' -ErrorAction SilentlyContinue) {
  $cver = (claude --version 2>&1 | Select-Object -First 1) -replace "`r`n",""
  Write-Host "  [OK] Claude CLI found: $cver" -ForegroundColor Green
} else {
  Write-Host "  [WARN] Claude CLI not found (recommended)" -ForegroundColor Yellow
  Write-Host "    Install: npm install -g @anthropic-ai/claude-code" -ForegroundColor Yellow
}

if ($missing -gt 0) {
  Write-Host ''
  Write-Host "  $missing required dependency(ies) missing. Install them and re-run." -ForegroundColor Red
  Read-Host 'Press Enter to exit'
  exit 1
}
Write-Host ''

# ─── Detect if running from inside a clone ────────────────────
# When downloaded as a file, $PSScriptRoot is set
# When run via irm | iex, $PSScriptRoot is empty
$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { $PWD.Path }
$inRepo = (Test-Path (Join-Path $scriptDir 'api\package.json')) -and (Test-Path (Join-Path $scriptDir 'client\main.py'))

$defaultInstall = Join-Path $env:USERPROFILE 'weave'

if ($inRepo) {
  Write-Host "Install location [$scriptDir — current repo]: " -NoNewline
  $installDir = Read-Host
  if ([string]::IsNullOrWhiteSpace($installDir)) { $installDir = $scriptDir }
} else {
  Write-Host "Install location [$defaultInstall]: " -NoNewline
  $installDir = Read-Host
  if ([string]::IsNullOrWhiteSpace($installDir)) { $installDir = $defaultInstall }
}
$installDir = $installDir.Trim()
Write-Host ''

# ─── Clone or reuse ───────────────────────────────────────────
if ($inRepo -and ((Resolve-Path $scriptDir).Path -eq (Resolve-Path $installDir -ErrorAction SilentlyContinue)?.Path)) {
  Write-Host "  -> Using existing repository at $installDir" -ForegroundColor Cyan
  Set-Location $installDir
  try { git pull --quiet 2>&1 | Out-Null; Write-Host "  [OK] Repository up to date" -ForegroundColor Green }
  catch { Write-Host "  [OK] Repository ready" -ForegroundColor Green }
} elseif (Test-Path (Join-Path $installDir '.git')) {
  Write-Host "  -> Updating existing installation at $installDir" -ForegroundColor Cyan
  Set-Location $installDir
  git pull --quiet 2>&1 | Out-Null
  Write-Host "  [OK] Updated to latest version" -ForegroundColor Green
} else {
  Write-Host "  -> Cloning repository to $installDir..." -ForegroundColor Cyan
  git clone $REPO_URL $installDir --quiet 2>&1 | Out-Null
  Write-Host "  [OK] Cloned to $installDir" -ForegroundColor Green
  Set-Location $installDir
}

# ─── The actual work runs via WSL ────────────────────────────
# Node/Python setup is better handled inside WSL where the app runs
# We just need to set up the Windows-side shortcut

# Detect WSL path for install dir
$wslPath = ''
try {
  $wslPath = (wsl wslpath -u "$installDir" 2>&1).Trim()
} catch {}

if ([string]::IsNullOrEmpty($wslPath)) {
  # Fallback: convert C:\Users\... to /mnt/c/Users/...
  $wslPath = '/' + ($installDir -replace '\\', '/' -replace '^([A-Za-z]):', { '/mnt/' + $args[0].Groups[1].Value.ToLower() })
}

# Run install.sh inside WSL for deps + .env setup
Write-Host ''
Write-Host '-> Running WSL setup (dependencies, .env, Python venv)...' -ForegroundColor Cyan
$wslDistro = (wsl --list --quiet 2>&1 | Where-Object { $_ -match '\S' } | Select-Object -First 1).Trim() -replace "`0",""
if ([string]::IsNullOrEmpty($wslDistro)) { $wslDistro = '' }

$wslArgs = if ($wslDistro) { @('-d', $wslDistro) } else { @() }
& wsl @wslArgs bash -c "cd '$wslPath' && bash install.sh"

# ─── Desktop shortcut ─────────────────────────────────────────
Write-Host ''
$ans = Read-Host 'Create desktop shortcut? [Y/n]'
if ($ans -ne 'n' -and $ans -ne 'N') {
  $desktopPath = [Environment]::GetFolderPath('Desktop')
  $shortcutPath = Join-Path $desktopPath 'Weave (WSL).lnk'

  try {
    $wshell = New-Object -ComObject WScript.Shell
    $shortcut = $wshell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = 'C:\Windows\System32\wsl.exe'
    if ($wslDistro) {
      $shortcut.Arguments = "-d `"$wslDistro`" bash -c `"cd '$wslPath' && bash start.sh; exec bash`""
    } else {
      $shortcut.Arguments = "bash -c `"cd '$wslPath' && bash start.sh; exec bash`""
    }
    $shortcut.Description = 'Weave'
    $shortcut.WorkingDirectory = $installDir
    $shortcut.Save()
    Write-Host "  [OK] Shortcut created: $shortcutPath" -ForegroundColor Green
  } catch {
    Write-Host "  [WARN] Could not create shortcut: $_" -ForegroundColor Yellow
    Write-Host "  Create manually: target=wsl.exe, args=bash -c `"cd '$wslPath' && bash start.sh`"" -ForegroundColor Yellow
  }

  # Also create a simple .bat in the install dir
  $batPath = Join-Path $installDir 'Start Weave.bat'
  $batContent = "@echo off`r`ntitle Weave`r`nwsl.exe $(if ($wslDistro) { "-d `"$wslDistro`" " })bash -c `"cd '$wslPath' && bash start.sh; exec bash`"`r`n"
  [System.IO.File]::WriteAllText($batPath, $batContent, [System.Text.Encoding]::ASCII)
  Write-Host "  [OK] Start script created: $batPath" -ForegroundColor Green
}

# ─── Done ─────────────────────────────────────────────────────
Write-Host ''
Write-Host '########################################' -ForegroundColor Cyan
Write-Host '  Installation complete!' -ForegroundColor Green
Write-Host ''
Write-Host "  Start: double-click 'Start Weave.bat'" -ForegroundColor Cyan
Write-Host '  Or use the desktop shortcut' -ForegroundColor Cyan
Write-Host '########################################' -ForegroundColor Cyan
Write-Host ''
Read-Host 'Press Enter to exit'