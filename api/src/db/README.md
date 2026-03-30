# Database Migrations

Migrations run automatically on API startup. No manual steps needed after `git pull`.

## Overview

The database uses a versioned migration system that tracks applied migrations in the `schema_migrations` table. Each time the API starts, it checks which migrations haven't been applied yet and runs them in order.

## Adding a new migration

1. Open `api/src/db/migrations.ts`
2. Add a new entry at the END of the `migrations` array with the next version number:

```typescript
{
  version: 27,  // next sequential number after the last migration
  description: 'Short description of what changed',
  up: [
    `ALTER TABLE some_table ADD COLUMN new_field TEXT DEFAULT ''`,
    `CREATE TABLE IF NOT EXISTS new_table (...)`,
  ],
},
```

3. Commit and push. On next restart, the API applies it automatically.

## Rules

- **Never edit existing migrations** — they may already be applied in production
- **Always add new migrations at the END** of the array
- **Use the next sequential version number** — don't skip or reuse version numbers
- Each migration is wrapped in a transaction — if one statement fails, the whole migration rolls back
- `ALTER TABLE ADD COLUMN` errors for existing columns are silently skipped (safe for re-runs)

## Viewing applied migrations

```bash
# Check which migrations have been applied
python3 -c "
import sqlite3
conn = sqlite3.connect('api/data/database.db')
rows = conn.execute('SELECT version, description, applied_at FROM schema_migrations ORDER BY version').fetchall()
print('Applied migrations:')
for r in rows: print(f'  v{r[0]} — {r[1]} ({r[2]})')
"
```

## Database locations

- **Production**: `api/data/database.db`
- **Test**: `api/data/database.test.db` (used when `NODE_ENV=test`)

## Common migration patterns

### Adding a new column
```typescript
{
  version: 28,
  description: 'Users table — add avatar_url column',
  up: [
    `ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT ''`,
  ],
}
```

### Creating a new table
```typescript
{
  version: 29,
  description: 'Create audit_logs table',
  up: [
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      user_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
  ],
}
```

### Multiple related changes
```typescript
{
  version: 30,
  description: 'Notifications system — tables and indexes',
  up: [
    `CREATE TABLE IF NOT EXISTS notifications (...)`,
    `ALTER TABLE users ADD COLUMN notification_preferences TEXT DEFAULT '{}'`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`,
  ],
}
```

## Troubleshooting

### Migration failed to apply
If a migration fails during startup:
1. Check the error message in the logs
2. Fix the issue in the migration code
3. If the migration was partially applied, you may need to manually roll back changes
4. Restart the API

### Column already exists error
This is expected and safely ignored. The migration system automatically handles this case.

### "database is locked" error
Make sure no other processes are accessing the database file. Close all database connections and retry.
