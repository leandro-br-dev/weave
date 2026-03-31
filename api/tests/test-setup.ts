/**
 * API Test Setup
 *
 * This file runs before all API tests to configure the test environment.
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'

// Load test environment variables
const TEST_DB_PATH = path.join(process.cwd(), 'data', 'test-database.db')
const PROD_DB_PATH = path.join(process.cwd(), 'data', 'database.db')

// Set test environment
process.env.NODE_ENV = 'test'
process.env.TEST_DB_PATH = TEST_DB_PATH
process.env.WEAVE_TOKEN = 'test-token-for-testing-only'

/**
 * Setup test database before all tests
 */
beforeAll(async () => {
  console.log('Setting up API test environment...')

  // Ensure data directory exists
  const dataDir = path.dirname(TEST_DB_PATH)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  // Create test database if it doesn't exist
  if (!fs.existsSync(TEST_DB_PATH) && fs.existsSync(PROD_DB_PATH)) {
    console.log('Creating test database from production schema...')
    fs.copyFileSync(PROD_DB_PATH, TEST_DB_PATH)
  } else if (!fs.existsSync(TEST_DB_PATH)) {
    console.log('Creating new test database...')
    // Create empty database
    const db = new Database(TEST_DB_PATH)
    initializeTestDatabase(db)
    db.close()
  }

  console.log('API test environment ready')
})

/**
 * Clean up test database after all tests
 */
afterAll(async () => {
  console.log('Cleaning up API test environment...')

  const cleanupEnabled = process.env.TEST_CLEANUP_ENABLED !== 'false'

  if (cleanupEnabled && fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH)
    console.log('Test database cleaned up')
  }

  console.log('API test environment cleanup complete')
})

/**
 * Clean up test data before each test
 */
beforeEach(async () => {
  // Optionally clean up test data between tests
  if (process.env.CLEANUP_TEST_DATA === 'true') {
    const db = new Database(TEST_DB_PATH)
    try {
      // Clean up test data
      db.prepare('DELETE FROM projects WHERE id LIKE "test-%"').run()
      db.prepare('DELETE FROM workspaces WHERE id LIKE "test-%"').run()
      db.prepare('DELETE FROM kanban_tasks WHERE project_id LIKE "test-%"').run()
      db.prepare('DELETE FROM project_agents WHERE project_id LIKE "test-%"').run()
    } finally {
      db.close()
    }
  }
})

/**
 * Verify test database state after each test
 */
afterEach(async () => {
  // Optional: Verify database state or log test artifacts
})

/**
 * Initialize test database with schema
 */
function initializeTestDatabase(db: Database.Database): void {
  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      project_id TEXT NOT NULL,
      path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS kanban_tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      column TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 3,
      pipeline_status TEXT NOT NULL DEFAULT 'idle',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_agents (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      agent_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idle',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `)
}

export { TEST_DB_PATH }
