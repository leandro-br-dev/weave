import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { getDatabasePath } from '../utils/paths.js'
import { fileURLToPath } from 'url'
import { migrations } from './migrations'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Usa banco de teste quando NODE_ENV=test ou VITEST está definido
const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'

// Define o caminho do banco de dados baseado no ambiente
let dbPath = process.env.TEST_DB_PATH

if (!dbPath) {
  if (isTest) {
    dbPath = path.join(os.tmpdir(), 'weave-test-database.db')
  } else if (process.env.DATABASE_URL) {
    // Legacy support: DATABASE_URL still works for backward compatibility
    dbPath = process.env.DATABASE_URL
  } else {
    dbPath = getDatabasePath()
  }
}

// Garante que o diretório existe
fs.mkdirSync(path.dirname(dbPath), { recursive: true })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db: any = new Database(dbPath)

function runMigrations(database: Database.Database): void {
  // Garante que a tabela de controle existe
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      description TEXT,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Clean up leftover plans_new table if it exists (from a previous incomplete migration)
  try {
    const plansNewExists = database.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='plans_new'
    `).get() as any
    if (plansNewExists) {
      console.log('[DB] Cleaning up leftover plans_new table from previous migration')
      database.exec('DROP TABLE plans_new')
    }
  } catch (err) {
    // Ignore errors during cleanup
  }

  // Versão atual aplicada
  const applied = new Set(
    (database.prepare('SELECT version FROM schema_migrations').all() as any[])
      .map((r: any) => r.version)
  )

  let count = 0
  for (const migration of migrations) {
    if (applied.has(migration.version)) continue

    console.log(`[DB] Applying migration ${migration.version}: ${migration.description}`)

    // For migration 32, disable foreign keys temporarily outside the transaction
    // to allow table recreation (plan_logs references plans).
    if (migration.version === 32) {
      database.pragma('foreign_keys = OFF')
    }

    // Roda cada statement da migration numa transação
    const apply = database.transaction(() => {
      for (const sql of migration.up) {
        try {
          database.exec(sql)
        } catch (err: any) {
          // ALTER TABLE ... ADD COLUMN falha se a coluna já existe — seguro ignorar
          if (err.message?.includes('duplicate column name') ||
              err.message?.includes('already exists')) {
            console.log(`[DB]   Column already exists — skipping: ${sql.slice(0, 60)}...`)
          } else {
            throw err // outros erros interrompem
          }
        }
      }
      database.prepare(
        'INSERT INTO schema_migrations (version, description) VALUES (?, ?)'
      ).run(migration.version, migration.description)
    })

    apply()
    count++
    console.log(`[DB] Migration ${migration.version} applied OK`)

    // Re-enable foreign keys after migration 32
    if (migration.version === 32) {
      database.pragma('foreign_keys = ON')
    }
  }

  if (count === 0) {
    console.log('[DB] Schema up to date — no migrations needed')
  } else {
    console.log(`[DB] ${count} migration(s) applied successfully`)
  }
}

// Run migrations on startup
runMigrations(db)
