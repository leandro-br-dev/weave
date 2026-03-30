/**
 * Integration Test Setup
 *
 * @description Shared setup utilities for integration tests
 *
 * @usage
 *   import { setupIntegrationTest, teardownIntegrationTest } from './integration-setup'
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'

const TEST_DB_PATH = path.join(process.cwd(), 'api', 'data', 'test-database.db')
const PROD_DB_PATH = path.join(process.cwd(), 'api', 'data', 'database.db')

export interface IntegrationTestConfig {
  apiUrl: string
  authToken: string
  testDbPath: string
  cleanupAfterTest: boolean
}

/**
 * Setup integration test environment
 */
export function setupIntegrationTest(config: Partial<IntegrationTestConfig> = {}): IntegrationTestConfig {
  const defaultConfig: IntegrationTestConfig = {
    apiUrl: process.env.API_URL || 'http://localhost:3000',
    authToken: process.env.AUTH_TOKEN || 'dev-token-change-in-production',
    testDbPath: TEST_DB_PATH,
    cleanupAfterTest: true
  }

  const finalConfig = { ...defaultConfig, ...config }

  // Create test database if it doesn't exist
  if (!fs.existsSync(TEST_DB_PATH)) {
    console.log('Creating test database...')
    fs.copyFileSync(PROD_DB_PATH, TEST_DB_PATH)
  }

  // Run database migrations if needed
  runMigrations(TEST_DB_PATH)

  return finalConfig
}

/**
 * Teardown integration test environment
 */
export function teardownIntegrationTest(config: IntegrationTestConfig): void {
  if (config.cleanupAfterTest && fs.existsSync(TEST_DB_PATH)) {
    console.log('Cleaning up test database...')
    fs.unlinkSync(TEST_DB_PATH)
  }
}

/**
 * Seed database with test data
 */
export function seedTestData(dbPath: string = TEST_DB_PATH): void {
  const db = new Database(dbPath)

  // Seed test projects
  const insertProject = db.prepare(`
    INSERT OR IGNORE INTO projects (id, name, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `)

  const testProjects = [
    { id: 'test-project-1', name: 'Integration Test Project 1', description: 'Test project for integration tests' },
    { id: 'test-project-2', name: 'Integration Test Project 2', description: 'Another test project' }
  ]

  testProjects.forEach(project => {
    insertProject.run(
      project.id,
      project.name,
      project.description,
      new Date().toISOString(),
      new Date().toISOString()
    )
  })

  // Seed test workspaces
  const insertWorkspace = db.prepare(`
    INSERT OR IGNORE INTO workspaces (id, name, project_id, path, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const testWorkspaces = [
    { id: 'test-workspace-1', name: 'Test Workspace 1', projectId: 'test-project-1', path: '/tmp/test-workspace-1' },
    { id: 'test-workspace-2', name: 'Test Workspace 2', projectId: 'test-project-2', path: '/tmp/test-workspace-2' }
  ]

  testWorkspaces.forEach(workspace => {
    insertWorkspace.run(
      workspace.id,
      workspace.name,
      workspace.projectId,
      workspace.path,
      new Date().toISOString(),
      new Date().toISOString()
    )
  })

  db.close()
  console.log('Test data seeded successfully')
}

/**
 * Clean up test data from database
 */
export function cleanupTestData(dbPath: string = TEST_DB_PATH): void {
  const db = new Database(dbPath)

  // Delete test data
  db.prepare('DELETE FROM projects WHERE id LIKE "test-%"').run()
  db.prepare('DELETE FROM workspaces WHERE id LIKE "test-%"').run()
  db.prepare('DELETE FROM kanban_tasks WHERE project_id LIKE "test-%"').run()
  db.prepare('DELETE FROM project_agents WHERE project_id LIKE "test-%"').run()

  db.close()
  console.log('Test data cleaned up successfully')
}

/**
 * Run database migrations
 */
function runMigrations(dbPath: string): void {
  // Add migration logic here if needed
  console.log('Database migrations up to date')
}

/**
 * Check if API server is running
 */
export function isApiRunning(apiUrl: string = 'http://localhost:3000'): boolean {
  try {
    const response = execSync(`curl -s -o /dev/null -w "%{http_code}" ${apiUrl}/api/health`, {
      stdio: 'pipe'
    })
    return response.toString().includes('200')
  } catch {
    return false
  }
}

/**
 * Wait for API to be ready
 */
export async function waitForApi(apiUrl: string = 'http://localhost:3000', maxAttempts: number = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    if (isApiRunning(apiUrl)) {
      console.log('API is ready')
      return
    }
    console.log(`Waiting for API... (${i + 1}/${maxAttempts})`)
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  throw new Error('API did not become ready in time')
}

/**
 * Make authenticated API request
 */
export async function apiRequest(
  config: IntegrationTestConfig,
  method: string,
  path: string,
  body?: any
): Promise<{ status: number; data: any }> {
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${config.authToken}`,
      'Content-Type': 'application/json'
    }
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(`${config.apiUrl}${path}`, options)
  const data = await response.json()
  return { status: response.status, data }
}
