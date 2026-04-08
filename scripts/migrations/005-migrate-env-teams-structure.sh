#!/bin/bash
# ─── Migrate to env/ + teams/ directory structure ─────────────────────
#
# Restructures project directories from:
#
#   OLD (flat):
#     {project}/dev/team-coder/
#     {project}/plan/team-planner/
#     {project}/staging/team-reviewer/
#     {project}/agents/custom-team/
#
#   NEW (separated):
#     {project}/env/dev/           ← source code only (git clone)
#     {project}/env/plan/
#     {project}/env/staging/
#     {project}/teams/team-coder/  ← team workspaces (project-level)
#     {project}/teams/team-planner/
#     {project}/teams/team-reviewer/
#     {project}/teams/custom-team/
#
# This migration:
# 1. Moves environment source-code dirs into env/
# 2. Moves team workspace dirs into teams/
# 3. Updates the SQLite database with new paths
# 4. Handles edge cases (already migrated, conflicts, etc.)
#
# Idempotent — safe to run multiple times.
# ────────────────────────────────────────────────────────────────────────

set -e

DATA_DIR="${DATA_DIR:-$HOME/.local/share/weave}"
if [ "${APP_ENV}" = "dev" ]; then
  DATA_DIR="$HOME/.local/share/weave-dev"
fi

PROJECTS_DIR="$DATA_DIR/projects"
DB_PATH="$DATA_DIR/database.db"

if [ ! -d "$PROJECTS_DIR" ]; then
  echo "  → No projects directory found at $PROJECTS_DIR — nothing to migrate."
  exit 0
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "  ✗ sqlite3 is required but not found. Aborting."
  exit 1
fi

# Known environment names
KNOWN_ENVS="plan dev staging"

# Known team prefixes
KNOWN_TEAM_PREFIXES="team- agent-"

MOVED_ENVS=0
MOVED_TEAMS=0
SKIPPED=0
CONFLICTS=0
DB_UPDATES=0

echo "  📁 Migrating project directories to env/ + teams/ structure..."
echo ""

# ─── Helper: update database paths ────────────────────────────────────
update_db_path() {
  local old_path="$1"
  local new_path="$2"

  if [ ! -f "$DB_PATH" ]; then
    return 0
  fi

  # Update project_agents table
  local count
  count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM project_agents WHERE workspace_path = '$old_path';" 2>/dev/null || echo "0")
  if [ "$count" -gt 0 ]; then
    sqlite3 "$DB_PATH" "UPDATE project_agents SET workspace_path = '$new_path' WHERE workspace_path = '$old_path';" 2>/dev/null
    DB_UPDATES=$((DB_UPDATES + count))
  fi

  # Update team_roles table
  count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM team_roles WHERE workspace_path = '$old_path';" 2>/dev/null || echo "0")
  if [ "$count" -gt 0 ]; then
    sqlite3 "$DB_PATH" "UPDATE team_roles SET workspace_path = '$new_path' WHERE workspace_path = '$old_path';" 2>/dev/null
  fi

  # Update agent_environments table
  count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM agent_environments WHERE workspace_path = '$old_path';" 2>/dev/null || echo "0")
  if [ "$count" -gt 0 ]; then
    sqlite3 "$DB_PATH" "UPDATE agent_environments SET workspace_path = '$new_path' WHERE workspace_path = '$old_path';" 2>/dev/null
  fi

  # Update environments table (team_workspace and default_team fields)
  count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM environments WHERE team_workspace = '$old_path';" 2>/dev/null || echo "0")
  if [ "$count" -gt 0 ]; then
    sqlite3 "$DB_PATH" "UPDATE environments SET team_workspace = '$new_path' WHERE team_workspace = '$old_path';" 2>/dev/null
  fi

  count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM environments WHERE default_team = '$old_path';" 2>/dev/null || echo "0")
  if [ "$count" -gt 0 ]; then
    sqlite3 "$DB_PATH" "UPDATE environments SET default_team = '$new_path' WHERE default_team = '$old_path';" 2>/dev/null
  fi

  # Update plans table (team_id field — stores workspace_path)
  count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM plans WHERE team_id = '$old_path';" 2>/dev/null || echo "0")
  if [ "$count" -gt 0 ]; then
    sqlite3 "$DB_PATH" "UPDATE plans SET team_id = '$new_path' WHERE team_id = '$old_path';" 2>/dev/null
  fi

  # Update JSON in tasks field of plans table
  sqlite3 "$DB_PATH" "UPDATE plans SET tasks = REPLACE(tasks, '\"$old_path', '\"$new_path') WHERE tasks LIKE '%$old_path%';" 2>/dev/null || true
}

# ─── Process each project directory ───────────────────────────────────
for project_dir in "$PROJECTS_DIR"/*/; do
  [ -d "$project_dir" ] || continue

  project_name="$(basename "$project_dir")"
  project_name="${project_name%/}"  # Remove trailing slash

  echo "  📂 Project: $project_name"

  env_dir_created=false
  teams_dir_created=false

  # ── Step 1: Identify and move team-* subdirectories into teams/ ──
  for subdir in "$project_dir"*/; do
    [ -d "$subdir" ] || continue
    sub_name="$(basename "$subdir")"
    sub_name="${sub_name%/}"

    # Skip meta directories
    case "$sub_name" in
      agents|teams|env|workflows|uploads|logs|*.tmp) continue ;;
    esac

    # Check if this subdirectory contains team-* or agent-* directories
    for team_dir in "$subdir"*/; do
      [ -d "$team_dir" ] || continue
      team_name="$(basename "$team_dir")"
      team_name="${team_name%/}"

      # Check if it's a team directory
      is_team=false
      for prefix in $KNOWN_TEAM_PREFIXES; do
        if [[ "$team_name" == "$prefix"* ]]; then
          is_team=true
          break
        fi
      done

      if [ "$is_team" = true ]; then
        # Create teams/ directory if needed
        if [ "$teams_dir_created" = false ]; then
          mkdir -p "${project_dir}teams"
          teams_dir_created=true
        fi

        old_path="${project_dir}${sub_name}/${team_name}"
        new_path="${project_dir}teams/${team_name}"

        if [ -d "$new_path" ]; then
          echo "    ⚠ Conflict: teams/$team_name already exists — skipping $sub_name/$team_name"
          CONFLICTS=$((CONFLICTS + 1))
        elif [ -d "$old_path" ]; then
          echo "    → Moving team: $sub_name/$team_name → teams/$team_name"
          mv "$old_path" "$new_path"
          update_db_path "$old_path" "$new_path"
          MOVED_TEAMS=$((MOVED_TEAMS + 1))

          # Remove empty parent env dir if it has no other content
          # (but NOT if it's a known env with source code)
          remaining=$(find "${project_dir}${sub_name}" -mindepth 1 -maxdepth 1 2>/dev/null | wc -l)
          if [ "$remaining" -eq 0 ]; then
            rmdir "${project_dir}${sub_name}" 2>/dev/null || true
          fi
        fi
      fi
    done

    # Also handle the case where the subdir itself IS a team-* (legacy direct child)
    is_team_dir=false
    for prefix in $KNOWN_TEAM_PREFIXES; do
      if [[ "$sub_name" == "$prefix"* ]]; then
        is_team_dir=true
        break
      fi
    done

    if [ "$is_team_dir" = true ]; then
      if [ "$teams_dir_created" = false ]; then
        mkdir -p "${project_dir}teams"
        teams_dir_created=true
      fi

      old_path="${project_dir}${sub_name}"
      new_path="${project_dir}teams/${sub_name}"

      if [ -d "$new_path" ]; then
        echo "    ⚠ Conflict: teams/$sub_name already exists — skipping"
        CONFLICTS=$((CONFLICTS + 1))
      elif [ -d "$old_path" ]; then
        echo "    → Moving team (legacy): $sub_name → teams/$sub_name"
        mv "$old_path" "$new_path"
        update_db_path "$old_path" "$new_path"
        MOVED_TEAMS=$((MOVED_TEAMS + 1))
      fi
    fi
  done

  # ── Step 2: Move known env source-code dirs into env/ ──
  for env_name in $KNOWN_ENVS; do
    old_env_path="${project_dir}${env_name}"

    # Skip if doesn't exist or is already inside env/
    if [ ! -d "$old_env_path" ]; then
      continue
    fi

    # Check if this dir has been fully migrated (only meta files remain)
    # A source-code env will have .git, src/, or other project files
    has_source=false
    for item in "$old_env_path"*/ "$old_env_path".git "$old_env_path".gitignore 2>/dev/null; do
      item_name="$(basename "$item")"
      case "$item_name" in
        .git|.gitignore|src|lib|api|client|dashboard|docs|public|assets|components|pages|config|test|tests|spec|specs|*.json|*.md|*.yml|*.yaml|*.toml|*.lock|node_modules|venv|.env|*.py|*.ts|*.js)
          has_source=true
          break
          ;;
      esac
    done

    if [ "$has_source" = true ]; then
      # This is a source-code directory — move to env/
      if [ "$env_dir_created" = false ]; then
        mkdir -p "${project_dir}env"
        env_dir_created=true
      fi

      new_env_path="${project_dir}env/${env_name}"

      if [ -d "$new_env_path" ]; then
        echo "    ⚠ Conflict: env/$env_name already exists — skipping"
        CONFLICTS=$((CONFLICTS + 1))
      else
        echo "    → Moving env: $env_name → env/$env_name"
        mv "$old_env_path" "$new_env_path"
        MOVED_ENVS=$((MOVED_ENVS + 1))

        # Update environments table project_path
        if [ -f "$DB_PATH" ]; then
          sqlite3 "$DB_PATH" "UPDATE environments SET project_path = REPLACE(project_path, '${old_env_path}', '${new_env_path}') WHERE project_path LIKE '${old_env_path}%';" 2>/dev/null || true
        fi
      fi
    elif [ -d "$old_env_path" ]; then
      # Directory exists but has no source code (teams were already moved)
      remaining=$(find "$old_env_path" -mindepth 1 -maxdepth 1 2>/dev/null | wc -l)
      if [ "$remaining" -eq 0 ]; then
        echo "    🗑 Removing empty env directory: $env_name"
        rmdir "$old_env_path" 2>/dev/null || true
      fi
    fi
  done

  # ── Step 3: Move any remaining non-meta subdirectories into env/ ──
  for subdir in "$project_dir"*/; do
    [ -d "$subdir" ] || continue
    sub_name="$(basename "$subdir")"
    sub_name="${sub_name%/}"

    # Skip meta directories
    case "$sub_name" in
      agents|teams|env|workflows|uploads|logs|*.tmp) continue ;;
    esac

    # Skip if already handled by known envs
    for env_name in $KNOWN_ENVS; do
      if [ "$sub_name" = "$env_name" ]; then
        continue 2
      fi
    done

    # Check if this has source code (not empty, not a team dir)
    remaining=$(find "$subdir" -mindepth 1 -maxdepth 1 2>/dev/null | wc -l)
    if [ "$remaining" -eq 0 ]; then
      # Empty directory — clean up
      echo "    🗑 Removing empty directory: $sub_name"
      rmdir "$subdir" 2>/dev/null || true
      continue
    fi

    # Check for team subdirs
    has_team=false
    for item in "$subdir"*/; do
      item_name="$(basename "$item")"
      for prefix in $KNOWN_TEAM_PREFIXES; do
        if [[ "$item_name" == "$prefix"* ]]; then
          has_team=true
          break
        fi
      done
      [ "$has_team" = true ] && break
    done

    if [ "$has_team" = false ]; then
      # This looks like an environment/source-code directory — move to env/
      if [ "$env_dir_created" = false ]; then
        mkdir -p "${project_dir}env"
        env_dir_created=true
      fi

      new_path="${project_dir}env/${sub_name}"
      if [ -d "$new_path" ]; then
        echo "    ⚠ Conflict: env/$sub_name already exists — skipping"
        CONFLICTS=$((CONFLICTS + 1))
      else
        echo "    → Moving env (other): $sub_name → env/$sub_name"
        mv "$subdir" "$new_path"
        MOVED_ENVS=$((MOVED_ENVS + 1))

        if [ -f "$DB_PATH" ]; then
          sqlite3 "$DB_PATH" "UPDATE environments SET project_path = REPLACE(project_path, '${project_dir}${sub_name}', '${new_path}') WHERE project_path LIKE '${project_dir}${sub_name}%';" 2>/dev/null || true
        fi
      fi
    fi
  done

  # ── Step 4: Migrate agents/ → teams/ (old custom agents) ──
  old_agents_dir="${project_dir}agents"
  if [ -d "$old_agents_dir" ]; then
    if [ "$teams_dir_created" = false ]; then
      mkdir -p "${project_dir}teams"
      teams_dir_created=true
    fi

    for agent_dir in "$old_agents_dir"*/; do
      [ -d "$agent_dir" ] || continue
      agent_name="$(basename "$agent_dir")"
      agent_name="${agent_name%/}"

      old_path="${old_agents_dir}/${agent_name}"
      new_path="${project_dir}teams/${agent_name}"

      if [ -d "$new_path" ]; then
        echo "    ⚠ Conflict: teams/$agent_name already exists — skipping agents/$agent_name"
        CONFLICTS=$((CONFLICTS + 1))
      else
        echo "    → Moving custom team: agents/$agent_name → teams/$agent_name"
        mv "$old_path" "$new_path"
        update_db_path "$old_path" "$new_path"
        MOVED_TEAMS=$((MOVED_TEAMS + 1))
      fi
    done

    # Remove empty agents/ directory
    remaining=$(find "$old_agents_dir" -mindepth 1 -maxdepth 1 2>/dev/null | wc -l)
    if [ "$remaining" -eq 0 ]; then
      echo "    🗑 Removing empty agents/ directory"
      rmdir "$old_agents_dir" 2>/dev/null || true
    fi
  fi

  echo ""
done

echo "  ✓ Migration complete:"
echo "    Environments moved:  $MOVED_ENVS"
echo "    Teams moved:         $MOVED_TEAMS"
echo "    Database updates:    $DB_UPDATES"
echo "    Conflicts:           $CONFLICTS"
echo ""
