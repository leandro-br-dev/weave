@echo off
title Agents Manager - Updater
powershell -NoProfile -ExecutionPolicy Bypass -Command "wsl.exe bash -c 'cd $(wslpath \"%~dp0\") && bash update.sh'"
pause
