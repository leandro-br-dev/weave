#!/usr/bin/env tsx

/**
 * Cleanup Test Data Script
 *
 * @description Cleans up test data from the database after integration tests
 *
 * @usage
 *   tsx tests/integration/cleanup-test-data.ts
 *   OR from project root: tsx tests/integration/cleanup-test-data.ts
 *
 * @options
 *   --dry-run  Show what would be deleted without actually deleting
 *   --all      Delete all test data (not just from this session)
 */

import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'api', 'data', 'database.db')
const DRY_RUN = process.argv.includes('--dry-run')
const DELETE_ALL = process.argv.includes('--all')

if (!fs.existsSync(DB_PATH)) {
  console.error('Database not found at:', DB_PATH)
  process.exit(1)
}

const db = new Database(DB_PATH)

console.log('Cleaning up test data...')
if (DRY_RUN) {
  console.log('⚠️  DRY RUN MODE - No data will be deleted')
}

// Helper to count and delete records
function cleanupTable(tableName: string, idPattern: string = 'test-%'): number {
  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM ${tableName} WHERE id LIKE ?`)
  const deleteStmt = db.prepare(`DELETE FROM ${tableName} WHERE id LIKE ?`)

  const { count } = countStmt.get(idPattern) as { count: number }

  if (count > 0) {
    console.log(`\n📋 ${tableName}: Found ${count} test record(s)`)

    if (DRY_RUN) {
      console.log(`   Would delete ${count} record(s) matching pattern "${idPattern}"`)
    } else {
      const result = deleteStmt.run(idPattern)
      console.log(`   ✓ Deleted ${result.changes} record(s)`)
    }
  }

  return count
}

// Helper to count and delete by project_id
function cleanupByProjectId(tableName: string, projectIdPattern: string = 'test-%'): number {
  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM ${tableName} WHERE project_id LIKE ?`)
  const deleteStmt = db.prepare(`DELETE FROM ${tableName} WHERE project_id LIKE ?`)

  const { count } = countStmt.get(projectIdPattern) as { count: number }

  if (count > 0) {
    console.log(`\n📋 ${tableName}: Found ${count} record(s) by project_id`)

    if (DRY_RUN) {
      console.log(`   Would delete ${count} record(s) with project_id matching "${projectIdPattern}"`)
    } else {
      const result = deleteStmt.run(projectIdPattern)
      console.log(`   ✓ Deleted ${result.changes} record(s)`)
    }
  }

  return count
}

let totalDeleted = 0

// Clean up kanban tasks
totalDeleted += cleanupTable('kanban_tasks')
totalDeleted += cleanupByProjectId('kanban_tasks')

// Clean up workflow plans
totalDeleted += cleanupTable('plans')
totalDeleted += cleanupByProjectId('plans')

// Clean up workspaces
totalDeleted += cleanupTable('workspaces')
totalDeleted += cleanupByProjectId('workspaces')

// Clean up project_agents
totalDeleted += cleanupByProjectId('project_agents')

// Clean up projects
totalDeleted += cleanupTable('projects')

if (DELETE_ALL) {
  console.log('\n🔄 Deleting ALL test data (including old sessions)...')

  // Delete any test-related workspaces by path
  const workspaceStmt = db.prepare('SELECT * FROM workspaces WHERE path LIKE ?')
  const testWorkspaces = workspaceStmt.all('/tmp/test-%') as any[]

  if (testWorkspaces.length > 0) {
    console.log(`\n📋 workspaces: Found ${testWorkspaces.length} test workspace(s) by path`)

    if (!DRY_RUN) {
      const deleteStmt = db.prepare('DELETE FROM workspaces WHERE path LIKE ?')
      const result = deleteStmt.run('/tmp/test-%')
      console.log(`   ✓ Deleted ${result.changes} workspace(s)`)
      totalDeleted += result.changes
    }
  }
}

db.close()

console.log('\n' + '='.repeat(50))
if (DRY_RUN) {
  console.log('📊 Summary: Would delete approximately', totalDeleted, 'test records')
  console.log('💡 Run without --dry-run to actually delete the data')
} else {
  console.log(`✅ Summary: Deleted ${totalDeleted} test record(s)`)
  console.log('💡 Database is now clean and ready for the next test run')
}
console.log('='.repeat(50))
