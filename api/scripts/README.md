# Utility Scripts

This directory contains utility scripts for the weave API.

## Project Context Generator

### `generate_project_context.py`

Generates a comprehensive JSON representation of a project's structure, git information, and statistics.

**What it does:**

1. **File Structure**: Generates a tree representation of the project, filtering out:
   - Standard ignored directories: `node_modules`, `venv`, `.venv`, `__pycache__`, `.git`, `dist`, `build`, `.next`, `.cache`
   - Build/deploy files: `package-lock.json`, `yarn.lock`, `*.min.js`, `*.min.css`
   - Keeps only relevant files: source code (`.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.go`, `.rs`, etc.), configs (`.json`, `.yaml`, `.toml`, `.env.example`), docs (`.md`)

2. **Git Information** (if the folder is a git repository):
   - Current branch
   - Last commit (short hash and message)
   - Remote repository URL
   - Status (whether there are pending changes)

3. **Basic Statistics**:
   - File count by type/extension
   - Main directories and their functions

**How to run:**

```bash
# Generate JSON output (default)
python3 api/scripts/generate_project_context.py /path/to/project

# Generate human-readable text output
python3 api/scripts/generate_project_context.py /path/to/project --output text

# Generate both formats
python3 api/scripts/generate_project_context.py /path/to/project --output both

# Specify git repository URL manually
python3 api/scripts/generate_project_context.py /path/to/project --repo-url https://github.com/user/repo

# Limit traversal depth
python3 api/scripts/generate_project_context.py /path/to/project --max-depth 5

# Analyze current project
python3 api/scripts/generate_project_context.py .
```

**Output Format:**

The script outputs a JSON object with the following structure:

```json
{
  "structure": {
    "type": "directory",
    "name": "project-name",
    "path": ".",
    "children": [
      {
        "type": "file",
        "name": "README.md",
        "path": "README.md",
        "extension": ".md"
      }
    ]
  },
  "git_info": {
    "is_git_repo": true,
    "branch": "main",
    "last_commit": {
      "hash": "abc1234",
      "message": "Commit message"
    },
    "remote_url": "https://github.com/user/repo",
    "has_changes": false
  },
  "stats": {
    "file_counts": {
      ".ts": 10,
      ".json": 5,
      ".md": 2
    },
    "total_files": 17,
    "total_dirs": 3,
    "directories": {
      "src": "Source code",
      "tests": "Test files"
    }
  }
}
```

**Requirements:**

- Python 3.6+
- Standard library only (optional: `gitpython` for improved git handling)

**Example Usage:**

```bash
# Analyze the current project and save to file
python3 api/scripts/generate_project_context.py . > project_context.json

# Analyze another project
python3 api/scripts/generate_project_context.py ~/projects/my-app --output text
```

## Additional Usage Examples

### Common Use Cases

#### 1. Generate Project Documentation

```bash
# Save project structure to file
python3 api/scripts/generate_project_context.py . > project_context.json

# Get human-readable overview
python3 api/scripts/generate_project_context.py . --output text > project_overview.txt
```

#### 2. Compare Project States

```bash
# Save current state
python3 api/scripts/generate_project_context.py . > before_changes.json

# ... make changes ...

# Save new state
python3 api/scripts/generate_project_context.py . > after_changes.json

# Compare (using jq or similar)
diff <(jq -S . before_changes.json) <(jq -S . after_changes.json)
```

#### 3. Analyze External Projects

```bash
# Analyze a dependency or library
python3 api/scripts/generate_project_context.py ~/projects/react-library --output text

# Analyze with specific repo URL
python3 api/scripts/generate_project_context.py ~/projects/my-app \
  --repo-url https://github.com/myuser/my-app
```

#### 4. CI/CD Integration

```bash
# In CI pipeline, generate project context for analysis
python3 api/scripts/generate_project_context.py . \
  --output json \
  --repo-url $CI_REPO_URL \
  > build_context.json
```

#### 5. Limit Depth for Large Projects

```bash
# Shallow analysis (top 3 levels only)
python3 api/scripts/generate_project_context.py . --max-depth 3

# Deep analysis
python3 api/scripts/generate_project_context.py . --max-depth 15
```

### Text Output Example

```
📊 Project Structure:
📁 my-project/
  ├── 📁 src/
  │   └── 📜 index.ts
  └── 📝 README.md

🔧 Git Information:
  Branch: main
  Last Commit: abc1234 - Add new feature
  Remote: https://github.com/user/repo
  Status: ✓ Clean

📈 Statistics:
  Total Files: 175
  Total Directories: 25
  Files by Extension:
    .ts: 150
    .json: 20
    .md: 5

  Key Directories:
    src: Source code
    tests: Test files
    docs: Documentation
```

### Filtering Behavior

The script automatically filters out:

**Ignored Directories:**
- `node_modules`, `venv`, `.venv`
- `__pycache__`, `.git`
- `dist`, `build`, `.next`, `.cache`
- `target`, `vendor`, `.npm`, `.yarn`
- `.idea`, `.vscode`, `coverage`

**Ignored Files:**
- `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`
- `*.min.js`, `*.min.css`, `*.map`
- `.DS_Store`, `Thumbs.db`

**Included Files:**
- Source code: `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.go`, `.rs`, etc.
- Configs: `.json`, `.yaml`, `.toml`, `.env.example`
- Docs: `.md`, `.txt`, `.rst`
- Special files: `README`, `LICENSE`, `Makefile`, `Dockerfile`

### Integration Examples

#### With jq for JSON Processing

```bash
# Get file statistics only
python3 api/scripts/generate_project_context.py . | jq '.stats.file_counts'

# Check if repository has changes
python3 api/scripts/generate_project_context.py . | jq '.git_info.has_changes'

# List all TypeScript files
python3 api/scripts/generate_project_context.py . | jq -r '
  .structure.children[] |
  select(.type == "directory") |
  .. |
  select(.type == "file" and .extension == ".ts") |
  .path
'
```

#### In Shell Scripts

```bash
#!/bin/bash
PROJECT_PATH="$1"

# Generate context
CONTEXT=$(python3 api/scripts/generate_project_context.py "$PROJECT_PATH")

# Extract branch name
BRANCH=$(echo "$CONTEXT" | jq -r '.git_info.branch')

# Check for changes
HAS_CHANGES=$(echo "$CONTEXT" | jq -r '.git_info.has_changes')

if [ "$HAS_CHANGES" = "true" ]; then
    echo "⚠️  Project has uncommitted changes"
else
    echo "✓ Working directory clean"
fi
```

#### In Python

```python
import json
import subprocess

def get_project_context(path: str) -> dict:
    result = subprocess.run(
        ['python3', 'api/scripts/generate_project_context.py', path],
        capture_output=True,
        text=True
    )
    return json.loads(result.stdout)

# Usage
context = get_project_context('.')
print(f"Branch: {context['git_info']['branch']}")
print(f"Files: {context['stats']['total_files']}")
```

### Tips

1. **Save output for later comparison**: Useful for tracking project growth
2. **Use `--output text` for quick overviews**: Easier to read than JSON
3. **Limit depth for large projects**: Use `--max-depth` to avoid overwhelming output
4. **Pipe to `jq` for JSON processing**: Powerful filtering and analysis
5. **Combine with git**: Use to understand project state before commits

### Troubleshooting

**Script not executable:**
```bash
chmod +x api/scripts/generate_project_context.py
```

**Git not found:**
The script will still work but won't include git information. Install git or ensure it's in your PATH.

**Python 3 not available:**
The script requires Python 3.6+. Install it or use `python` instead of `python3` if needed.

**Large projects:**
Use `--max-depth` to limit traversal depth and reduce output size.

---

## Database Migration Scripts

## Template Migration

### `migrate-templates.ts`

Migrates template records from the `kanban_tasks` table to the dedicated `kanban_templates` table.

**What it does:**

1. Reads all records from `kanban_tasks` where `is_template = 1`
2. For each record, creates a corresponding entry in `kanban_templates`:
   - Copies: `id`, `project_id`, `title`, `description`, `priority`, `recurrence`, `next_run_at`, `last_run_at`
   - Sets `is_public = 0` (project-specific by default to preserve current behavior)
   - Sets `created_at` and `updated_at` from original task
3. Sets `is_template = 0` for migrated tasks in `kanban_tasks` (preserves task history)

**How to run:**

```bash
npm run migrate:templates
```

**Safety features:**

- Runs within a database transaction (all-or-nothing)
- Checks if `kanban_templates` table exists before migrating
- Skips templates with duplicate IDs to avoid conflicts
- Sets `is_template = 0` instead of deleting to preserve task history
- Provides detailed logging of migration progress

**After migration:**

- Template records will be in the `kanban_templates` table
- Original records in `kanban_tasks` will have `is_template = 0`
- No data is deleted - all history is preserved
- The API endpoints at `/api/templates/*` can be used to manage templates going forward
