#!/bin/bash
# Agents Manager — Updater
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GREEN='\033[0;32m' RED='\033[0;31m' YELLOW='\033[1;33m' CYAN='\033[0;36m' NC='\033[0m'
ok() { echo -e "${GREEN}  ✓ $*${NC}"; }
err() { echo -e "${RED}  ✗ $*${NC}"; }
warn() { echo -e "${YELLOW}  ⚠ $*${NC}"; }
info() { echo -e "${CYAN}  → $*${NC}"; }

echo ''
echo '████████████████████████████████████████'
echo '  Agents Manager — Updater'
echo '████████████████████████████████████████'
echo ''

info 'Checking for updates...'

if [ ! -d "$ROOT/.git" ]; then
  err 'Not a git repository. Cannot auto-update.'
  exit 1
fi

cd "$ROOT"
git fetch origin --quiet 2>/dev/null

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main 2>/dev/null || git rev-parse origin/master 2>/dev/null)

if [ "$LOCAL" = "$REMOTE" ]; then
  ok 'Already up to date.'
  echo ''
  exit 0
fi

CHANGES=$(git log HEAD..origin/main --oneline 2>/dev/null || git log HEAD..origin/master --oneline 2>/dev/null)
COUNT=$(echo "$CHANGES" | wc -l)

echo ''
echo -e "${CYAN}  Updates available ($COUNT commits):${NC}"
echo "$CHANGES" | head -10 | sed 's/^/    /'
if [ $COUNT -gt 10 ]; then
  echo "    ... and $((COUNT - 10)) more"
fi
echo ''
printf '  Apply updates? [y/N] '
read -r ANSWER

if [ "${ANSWER,,}" != 'y' ]; then
  echo '  Skipped.'
  exit 0
fi

echo ''
info 'Pulling latest code...'
git pull --quiet
ok 'Code updated'

# Reinstala dependências se package.json mudou
if git diff HEAD@{1} --name-only | grep -q 'api/package.json'; then
  info 'Updating API dependencies...'
  cd api && npm install --silent && cd ..
  ok 'API dependencies updated'
fi

if git diff HEAD@{1} --name-only | grep -q 'dashboard/package.json'; then
  info 'Updating Dashboard dependencies...'
  cd dashboard && npm install --silent && cd ..
  ok 'Dashboard dependencies updated'
fi

if git diff HEAD@{1} --name-only | grep -q 'client/requirements.txt'; then
  info 'Updating Python dependencies...'
  cd client && venv/bin/pip install -r requirements.txt -q && cd ..
  ok 'Python dependencies updated'
fi

# Rebuild dashboard if it changed
if git diff HEAD@{1} --name-only | grep -q '^dashboard/'; then
  info 'Rebuilding dashboard...'
  cd dashboard && npm run build --silent 2>/dev/null && ok 'Dashboard rebuilt' || warn 'Dashboard build skipped'
  cd ..
fi

echo ''
echo '████████████████████████████████████████'
ok 'Update complete!'
info 'Restart start.sh to apply changes.'
echo '████████████████████████████████████████'
echo ''
