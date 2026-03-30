#!/bin/bash
# Migration: Move database to new canonical location
# Args: $1 = DATA_DIR, $2 = APP_ENV
# Idempotent: safe to run multiple times
set -e

DATA_DIR="$1"
APP_ENV="$2"

[ -z "$DATA_DIR" ] && echo '[migration-001] Skipping — no DATA_DIR provided' && exit 0

TARGET_DB="$DATA_DIR/database.db"

# Se o destino já existe e tem dados, pula
if [ -f "$TARGET_DB" ] && [ -s "$TARGET_DB" ]; then
  echo "[migration-001] Target database already exists at $TARGET_DB — skipping"
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/../.."

# Fontes possíveis (em ordem de prioridade)
SOURCES=()

# 1. DATABASE_URL em api/.env
API_ENV_FILE="$PROJECT_ROOT/api/.env"
if [ -f "$API_ENV_FILE" ]; then
  EXISTING_DB_URL=$(grep '^DATABASE_URL=' "$API_ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '[:space:]' || echo '')
  [ -n "$EXISTING_DB_URL" ] && [ -f "$EXISTING_DB_URL" ] && [ -s "$EXISTING_DB_URL" ] && SOURCES+=("$EXISTING_DB_URL")
fi

# 2. Locais legados conhecidos
SOURCES+=(
  "$HOME/.local/share/weave/data/weave.db"
  "$PROJECT_ROOT/api/data/database.db"
)

for src in "${SOURCES[@]}"; do
  if [ -f "$src" ] && [ -s "$src" ]; then
    mkdir -p "$DATA_DIR"
    echo "[migration-001] Migrating database: $src → $TARGET_DB"
    cp "$src" "$TARGET_DB"
    echo '[migration-001] Database migration complete'
    exit 0
  fi
done

echo '[migration-001] No existing database found — new one will be created on startup'
