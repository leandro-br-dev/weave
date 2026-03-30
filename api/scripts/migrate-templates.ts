import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Path to database
const dbPath = path.join(__dirname, '../data', 'database.db')

console.log('🔄 Starting template migration...')
console.log(`📁 Database path: ${dbPath}`)

// Open database
const db = new Database(dbPath)

try {
  // Start transaction for safe migration
  const migrate = db.transaction(() => {
    // 1. Check if kanban_templates table exists
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='kanban_templates'").get()
    if (!tables) {
      throw new Error('kanban_templates table does not exist. Please ensure the database schema is up to date.')
    }
    console.log('✅ kanban_templates table exists')

    // 2. Find all template tasks in kanban_tasks
    const templateTasks = db.prepare(`
      SELECT id, project_id, title, description, priority, recurrence, next_run_at, last_run_at, created_at, updated_at
      FROM kanban_tasks
      WHERE is_template = 1
    `).all()

    console.log(`📋 Found ${templateTasks.length} template records in kanban_tasks`)

    if (templateTasks.length === 0) {
      console.log('ℹ️  No templates to migrate')
      return
    }

    // 3. Check for existing templates to avoid duplicate IDs
    const existingTemplateIds = new Set(
      db.prepare('SELECT id FROM kanban_templates').raw().all().map((row: any) => row[0])
    )
    console.log(`📋 Found ${existingTemplateIds.size} existing templates in kanban_templates`)

    // 4. Insert each template task into kanban_templates
    let insertedCount = 0
    let skippedCount = 0
    const insertTemplate = db.prepare(`
      INSERT INTO kanban_templates (
        id, project_id, title, description, priority, recurrence, next_run_at, last_run_at, is_public, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `)

    for (const task of templateTasks) {
      // Skip if template with this ID already exists
      if (existingTemplateIds.has(task.id)) {
        console.log(`⚠️  Skipping template with duplicate ID: ${task.id}`)
        skippedCount++
        continue
      }

      insertTemplate.run(
        task.id,
        task.project_id,
        task.title,
        task.description || '',
        task.priority,
        task.recurrence || '',
        task.next_run_at,
        task.last_run_at,
        task.created_at,
        task.updated_at
      )
      insertedCount++
      console.log(`✅ Migrated template: ${task.title} (${task.id})`)
    }

    console.log(`\n📊 Migration summary:`)
    console.log(`   - Inserted: ${insertedCount} templates`)
    console.log(`   - Skipped: ${skippedCount} templates (duplicate IDs)`)

    // 5. Remove is_template flag from migrated tasks in kanban_tasks
    // We set is_template = 0 instead of deleting to preserve task history
    const updateResult = db.prepare(`
      UPDATE kanban_tasks
      SET is_template = 0
      WHERE is_template = 1
    `).run()

    console.log(`🔄 Updated ${updateResult.changes} tasks in kanban_tasks (set is_template = 0)`)
    console.log('\n✨ Template migration completed successfully!')
  })

  // Execute migration
  migrate()

} catch (error: any) {
  console.error('\n❌ Migration failed:', error.message)
  process.exit(1)
} finally {
  db.close()
}
