#!/bin/bash
# ─── Migrate agent-* directories to team-* ─────────────────────────
# This script renames workspace directories from the old "agent-" prefix
# to the new "team-" prefix to disambiguate teams from individual agents.
#
# Old:  {project}/{env}/agent-coder/   → team workspace (confusing name)
# New:  {project}/{env}/team-coder/   → team workspace (clear)
#
# Individual agents live INSIDE a team's .claude/agents/ directory,
# so they are not affected by this rename.
#
# This is idempotent — safe to run multiple times.
# ────────────────────────────────────────────────────────────────────

set -e

DATA_DIR="${DATA_DIR:-$HOME/.local/share/weave}"
if [ "${APP_ENV}" = "dev" ]; then
  DATA_DIR="$HOME/.local/share/weave-dev"
fi

PROJECTS_DIR="$DATA_DIR/projects"

if [ ! -d "$PROJECTS_DIR" ]; then
  echo "  → No projects directory found at $PROJECTS_DIR — nothing to migrate."
  exit 0
fi

RENAMED=0
SKIPPED=0

# Map of old agent-* names to new team-* names
declare -A RENAME_MAP=(
  ["agent-coder"]="team-coder"
  ["agent-planner"]="team-planner"
  ["agent-reviewer"]="team-reviewer"
  ["agent-tester"]="team-tester"
  ["agent-debugger"]="team-debugger"
  ["agent-devops"]="team-devops"
)

# Process each project directory
for project_dir in "$PROJECTS_DIR"/*/; do
  [ -d "$project_dir" ] || continue

  # Scan environment subdirectories (skip 'agents', 'workflows', 'uploads', 'logs')
  for env_dir in "$project_dir"*/; do
    env_name="$(basename "$env_dir")"

    # Skip known non-environment directories
    case "$env_name" in
      agents|workflows|uploads|logs|*.tmp) continue ;;
    esac

    [ -d "$env_dir" ] || continue

    # Check for agent-* directories that need renaming
    for old_name in "${!RENAME_MAP[@]}"; do
      new_name="${RENAME_MAP[$old_name]}"
      old_path="$env_dir$old_name"
      new_path="$env_dir$new_name"

      if [ -d "$old_path" ] && [ ! -d "$new_path" ]; then
        echo "  → Renaming: $old_path → $new_path"
        mv "$old_path" "$new_path"
        RENAMED=$((RENAMED + 1))
      elif [ -d "$old_path" ] && [ -d "$new_path" ]; then
        echo "  ⚠ Both $old_name and $new_name exist — skipping (manual merge needed)"
        SKIPPED=$((SKIPPED + 1))
      fi
    done
  done

  # Also handle legacy {project}/agent-coder/ (no env subdirectory)
  for old_name in "${!RENAME_MAP[@]}"; do
    new_name="${RENAME_MAP[$old_name]}"
    old_path="$project_dir$old_name"
    new_path="$project_dir$new_name"

    if [ -d "$old_path" ] && [ ! -d "$new_path" ]; then
      echo "  → Renaming (legacy): $old_path → $new_path"
      mv "$old_path" "$new_path"
      RENAMED=$((RENAMED + 1))
    elif [ -d "$old_path" ] && [ -d "$new_path" ]; then
      echo "  ⚠ Both $old_name and $new_name exist — skipping (manual merge needed)"
      SKIPPED=$((SKIPPED + 1))
    fi
  done
done

echo ""
echo "  ✓ Directory migration complete: $RENAMED renamed, $SKIPPED skipped"
