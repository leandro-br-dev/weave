#!/bin/bash
# Migration: Ensure projects directory at new canonical location
# Args: $1 = DATA_DIR, $2 = APP_ENV
set -e

DATA_DIR="$1"
APP_ENV="$2"

[ -z "$DATA_DIR" ] && echo '[migration-002] Skipping — no DATA_DIR provided' && exit 0

TARGET_PROJECTS="$DATA_DIR/projects"

if [ "$APP_ENV" != "dev" ]; then
  OLD_PROJECTS="$HOME/.local/share/weave/projects"
  if [ -d "$OLD_PROJECTS" ] && [ ! -d "$TARGET_PROJECTS" ] && [ "$OLD_PROJECTS" != "$TARGET_PROJECTS" ]; then
    echo "[migration-002] Copying projects: $OLD_PROJECTS → $TARGET_PROJECTS"
    cp -a "$OLD_PROJECTS" "$TARGET_PROJECTS"
  fi
fi

mkdir -p "$TARGET_PROJECTS"
echo "[migration-002] Projects directory ready: $TARGET_PROJECTS"
