/**
 * Database test utilities
 * Provides helper functions for database setup, teardown, and test data management
 */

import { db } from '../../src/db/index.js'
import path from 'path'

// Proteção crítica: nunca limpar banco de produção
const dbPath = (db as any).name || ''
const isProdDb = dbPath.endsWith('database.db') && !dbPath.endsWith('database.test.db') && !dbPath.endsWith('test-database.db')

if (isProdDb && process.env.NODE_ENV !== 'test') {
  throw new Error(
    'SAFETY: Refusing to use production database in test helper. ' +
    'Set NODE_ENV=test before running tests.'
  )
}

/**
 * Clear all data from specific tables
 */
export function clearTables(...tables: string[]) {
  // Verificação de segurança antes de limpar tabelas
  if (process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true') {
    throw new Error('clearTables() called outside test environment!')
  }

  for (const table of tables) {
    db.exec(`DELETE FROM ${table}`)
  }
}

/**
 * Clear all test data from common tables
 */
export function clearTestData() {
  // Verificação dupla de segurança
  if (process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true') {
    throw new Error(
      'SAFETY: clearTestData() called outside test environment! ' +
      'This will delete production data!'
    )
  }

  // Verificação adicional do caminho do banco
  if (isProdDb) {
    throw new Error(
      'SAFETY: Refusing to clear production database! ' +
      'Database path appears to be production database.'
    )
  }

  clearTables(
    'plan_logs',
    'approvals',
    'plans',
    'chat_messages',
    'chat_sessions',
    'kanban_tasks',
    'agent_environments',
    'project_agents',
    'team_roles',
    'team_models',
    'environment_variables',
    'environments',
    'executions',
    'workflows',
    'agents',
    'projects',
    'users'
  )
}

/**
 * Create a test user in the users table.
 * Returns the user id.
 */
export function createTestUser(data?: {
  id?: string
  username?: string
}) {
  const id = data?.id || `test-user-${Math.random().toString(36).substr(2, 9)}`
  const username = data?.username || 'testuser'

  db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(
    id,
    username,
    'test-hash'
  )

  return id
}

/**
 * Create a test project
 */
export function createTestProject(data?: {
  id?: string
  name?: string
  description?: string
  user_id?: string
}) {
  const id = data?.id || `test-project-${Math.random().toString(36).substr(2, 9)}`
  const name = data?.name || 'Test Project'
  const description = data?.description || 'A test project'
  const user_id = data?.user_id || null

  db.prepare('INSERT INTO projects (id, name, description, user_id) VALUES (?, ?, ?, ?)').run(
    id,
    name,
    description,
    user_id
  )

  return id
}

/**
 * Create a test plan
 */
export function createTestPlan(data?: {
  id?: string
  name?: string
  tasks?: string
  status?: string
  project_id?: string
  user_id?: string
}) {
  const id = data?.id || `test-plan-${Math.random().toString(36).substr(2, 9)}`
  const name = data?.name || 'Test Plan'
  const tasks = data?.tasks || 'Task 1\nTask 2\nTask 3'
  const status = data?.status || 'pending'
  const project_id = data?.project_id || null
  const user_id = data?.user_id || null

  db.prepare(
    'INSERT INTO plans (id, name, tasks, status, project_id, user_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, name, tasks, status, project_id, user_id)

  return id
}

/**
 * Create a test kanban task
 */
export function createTestKanbanTask(data?: {
  id?: string
  project_id?: string
  title?: string
  description?: string
  column?: string
  priority?: number
  user_id?: string
}) {
  const id = data?.id || `test-task-${Math.random().toString(36).substr(2, 9)}`
  const project_id = data?.project_id || createTestProject()
  const title = data?.title || 'Test Task'
  const description = data?.description || 'A test task'
  const column = data?.column || 'backlog'
  const priority = data?.priority || 3
  const user_id = data?.user_id || null

  db.prepare(
    'INSERT INTO kanban_tasks (id, project_id, title, description, column, priority, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, project_id, title, description, column, priority, user_id)

  return { id, project_id }
}

/**
 * Get a plan by ID
 */
export function getPlan(id: string) {
  return db.prepare('SELECT * FROM plans WHERE id = ?').get(id)
}

/**
 * Get a kanban task by ID
 */
export function getKanbanTask(id: string) {
  return db.prepare('SELECT * FROM kanban_tasks WHERE id = ?').get(id)
}

/**
 * Get logs for a plan
 */
export function getPlanLogs(planId: string) {
  return db.prepare('SELECT * FROM plan_logs WHERE plan_id = ? ORDER BY created_at ASC').all(planId)
}

/**
 * Count records in a table
 */
export function countTable(tableName: string): number {
  const result = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count: number }
  return result.count
}

/**
 * Clean up test data with specific prefix
 */
export function cleanupTestData(prefix: string, table: string) {
  db.prepare(`DELETE FROM ${table} WHERE id LIKE ?`).run(`${prefix}%`)
}

/**
 * Transaction wrapper for tests
 */
export function withTestTransaction<T>(fn: () => T): T {
  const transaction = db.transaction(fn)
  return transaction()
}
