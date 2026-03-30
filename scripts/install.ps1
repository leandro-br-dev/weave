# Weave — Windows Installer
$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'Weave - Installer'

Write-Host ''
Write-Host '########################################' -ForegroundColor Cyan
Write-Host '  Weave — Windows Installer' -ForegroundColor Cyan
Write-Host '########################################' -ForegroundColor Cyan
Write-Host ''

function Check-Command {
  param($cmd, $name, $installHint)
  if (Get-Command $cmd -ErrorAction SilentlyContinue) {
    $ver = & $cmd --version 2>&1 | Select-Object -First 1
    Write-Host "  [OK] $name found: $ver" -ForegroundColor Green
    return $true
  } else {
    Write-Host "  [MISSING] $name not found" -ForegroundColor Red
    Write-Host "    Install: $installHint" -ForegroundColor Yellow
    return $false
  }
}

# ─── Check dependencies ──────────────────────────────────────
Write-Host '-> Checking dependencies...'
$missing = 0

if (-not (Check-Command 'git' 'Git' 'https://git-scm.com/download/win')) { $missing++ }
if (-not (Check-Command 'node' 'Node.js' 'https://nodejs.org/ or: winget install OpenJS.NodeJS')) { $missing++ }
if (-not (Check-Command 'python' 'Python' 'https://python.org or: winget install Python.Python.3.12')) { $missing++ }

# WSL check (required for running the app)
$wslAvailable = $false
try {
  $wslList = wsl --list --quiet 2>&1
  if ($LASTEXITCODE -eq 0) {
    Write-Host '  [OK] WSL available' -ForegroundColor Green
    $wslAvailable = $true
  }
} catch {}

if (-not $wslAvailable) {
  Write-Host '  [MISSING] WSL not found' -ForegroundColor Red
  Write-Host '    Install: wsl --install' -ForegroundColor Yellow
  Write-Host '    Then restart and run this installer again.' -ForegroundColor Yellow
  $missing++
}

if ($missing -gt 0) {
  Write-Host ''
  Write-Host "$missing dependency(ies) missing. Install them and re-run." -ForegroundColor Red
  Read-Host 'Press Enter to exit'
  exit 1
}
Write-Host ''

# ─── Install location ─────────────────────────────────────────
$defaultInstall = "$env:USERPROFILE\weave"
Write-Host "Install location [$defaultInstall]: " -NoNewline
$installDir = Read-Host
if ([string]::IsNullOrWhiteSpace($installDir)) { $installDir = $defaultInstall }
Write-Host ''

# ─── Clone or update ──────────────────────────────────────────
$repoUrl = 'https://github.com/leandro-br-dev/weave.git'

if (Test-Path "$installDir\.git") {
  Write-Host "-> Updating existing installation at $installDir" -ForegroundColor Cyan
  Set-Location $installDir
  git pull --quiet
  Write-Host '  [OK] Updated to latest version' -ForegroundColor Green
} else {
  Write-Host "-> Installing to $installDir" -ForegroundColor Cyan
  git clone $repoUrl $installDir --quiet
  Set-Location $installDir
  Write-Host "  [OK] Cloned to $installDir" -ForegroundColor Green
}

# ─── Desktop shortcut ─────────────────────────────────────────
Write-Host ''
$createShortcut = Read-Host 'Create desktop shortcut? [Y/n]'
if ($createShortcut -ne 'n' -and $createShortcut -ne 'N') {
  $desktopPath = [Environment]::GetFolderPath('Desktop')

  # Detecta a distro WSL padrão
  $wslDistro = (wsl --list --quiet 2>&1 | Where-Object { $_ -match '\S' } | Select-Object -First 1).Trim()
  if ([string]::IsNullOrEmpty($wslDistro)) { $wslDistro = 'Ubuntu' }

  # Converte o path Windows para WSL
  $wslPath = wsl wslpath -u "$($installDir -replace '\\', '/')"

  $wshell = New-Object -ComObject WScript.Shell

  # Shortcut principal: Start
  $shortcutPath = "$desktopPath\Start Weave.lnk"
  $shortcut = $wshell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = 'C:\Windows\System32\wsl.exe'
  $shortcut.Arguments = "-d `"$wslDistro`" bash -c `"cd '$wslPath' && bash start.sh; exec bash`""
  $shortcut.WorkingDirectory = $installDir
  $shortcut.Description = 'Weave'
  $shortcut.IconLocation = 'C:\Windows\System32\wsl.exe,0'
  $shortcut.Save()
  Write-Host "  [OK] Start shortcut created: $shortcutPath" -ForegroundColor Green

  # Shortcut secundário: Update
  $updateShortcutPath = "$desktopPath\Update Weave.lnk"
  $shortcutU = $wshell.CreateShortcut($updateShortcutPath)
  $shortcutU.TargetPath = 'C:\Windows\System32\wsl.exe'
  $shortcutU.Arguments = "-d `"$wslDistro`" bash -c `"cd '$wslPath' && bash update.sh; read -p 'Press Enter to continue'`""
  $shortcutU.WorkingDirectory = $installDir
  $shortcutU.Description = 'Update Weave'
  $shortcutU.IconLocation = 'C:\Windows\System32\wsl.exe,0'
  $shortcutU.Save()
  Write-Host "  [OK] Update shortcut created: $updateShortcutPath" -ForegroundColor Green
}

# ─── Create start.bat for quick launch ────────────────────────
$wslPath2 = wsl wslpath -u "$($installDir -replace '\\', '/')"
$startBatContent = @"
@echo off
title Weave
wsl.exe bash -c "cd '$wslPath2' && bash start.sh"
"@
$startBatPath = "$installDir\Start Weave.bat"
$startBatContent | Out-File -FilePath $startBatPath -Encoding ASCII
Write-Host "  [OK] Quick start created: $startBatPath" -ForegroundColor Green

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
