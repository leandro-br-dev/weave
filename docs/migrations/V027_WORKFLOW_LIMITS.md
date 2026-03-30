# Migration v027: Workflow Limits for Projects

## Summary
Adds workflow concurrency and task limit controls to the projects table, allowing per-project configuration of workflow execution limits.

## Version
- **Version**: 27
- **File**: `api/src/db/migrations.ts`

## Changes

### New Columns on `projects` table:

1. **max_concurrent_workflows** (`INTEGER DEFAULT 0`)
   - Controls the maximum number of workflows that can run concurrently for a project
   - Value of `0` means unlimited (indeterminado)
   - Default: 0 (unlimited)

2. **max_planning_tasks** (`INTEGER DEFAULT 1`)
   - Controls the maximum number of planning tasks that can run concurrently
   - Default: 1

3. **max_in_progress_tasks** (`INTEGER DEFAULT 1`)
   - Controls the maximum number of in-progress tasks that can run concurrently
   - Default: 1

### New Index:

- **idx_projects_settings** on `projects(settings)`
  - Improves query performance for settings-based queries

## SQL Migration

```sql
ALTER TABLE projects ADD COLUMN max_concurrent_workflows INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN max_planning_tasks INTEGER DEFAULT 1;
ALTER TABLE projects ADD COLUMN max_in_progress_tasks INTEGER DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_projects_settings ON projects(settings);
```

## Usage Examples

### Setting limits for a project:

```sql
-- Unlimited concurrent workflows (default)
UPDATE projects SET max_concurrent_workflows = 0 WHERE id = 'project-1';

-- Limit to 3 concurrent workflows
UPDATE projects SET max_concurrent_workflows = 3 WHERE id = 'project-1';

-- Allow 2 planning tasks concurrently
UPDATE projects SET max_planning_tasks = 2 WHERE id = 'project-1';

-- Allow 5 in-progress tasks concurrently
UPDATE projects SET max_in_progress_tasks = 5 WHERE id = 'project-1';
```

### Querying project limits:

```sql
SELECT
  id,
  name,
  max_concurrent_workflows,
  max_planning_tasks,
  max_in_progress_tasks
FROM projects
WHERE id = 'project-1';
```

## Behavior

- **max_concurrent_workflows = 0**: No limit on concurrent workflows (unlimited/indeterminado)
- **max_concurrent_workflows > 0**: Maximum number of workflows that can run simultaneously
- **max_planning_tasks**: Controls planning phase concurrency (default: 1)
- **max_in_progress_tasks**: Controls execution phase concurrency (default: 1)

## Testing

The migration has been tested and verified:
- ✅ All three columns added successfully
- ✅ Correct data types (INTEGER)
- ✅ Correct default values applied
- ✅ Index created successfully
- ✅ New projects inherit default values correctly

## Rollback

If needed, to rollback this migration:

```sql
-- Note: SQLite doesn't support DROP COLUMN in older versions
-- You would need to recreate the projects table without these columns
-- This is why the migration system never edits existing migrations
```

## Related Documentation

- [Database Migrations README](../../api/src/db/README.md)
- [Projects Table Schema](../../api/src/db/migrations.ts)

## Date
- Created: 2026-03-26
