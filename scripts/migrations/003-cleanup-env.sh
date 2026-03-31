#!/bin/bash
# Migration: Remove deprecated env vars
# Args: $1 = DATA_DIR, $2 = APP_ENV
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_ENV="$SCRIPT_DIR/../../.env"
API_ENV="$SCRIPT_DIR/../../api/.env"

for FILE in "$API_ENV" "$ROOT_ENV"; do
  [ ! -f "$FILE" ] && continue
  for VAR in DATABASE_URL AGENTS_BASE_PATH; do
    if grep -q "^${VAR}=" "$FILE" 2>/dev/null; then
      echo "[migration-003] Removing $VAR from $FILE"
      sed -i "/^${VAR}=/d" "$FILE"
    fi
  done
done

echo '[migration-003] Environment cleanup complete'
