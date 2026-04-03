/**
 * API Test Utilities
 *
 * Helper functions and test data factories for API tests.
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const TEST_DB_PATH = path.join(process.cwd(), 'data', 'test-database.db')

/**
 * Test data factories
 */
export const testDataFactories = {
  /**
   * Create a test project object
   */
  project: (overrides: Partial<any> = {}) => ({
    id: `test-project-${Date.now()}`,
    name: 'Test Project',
    description: 'A test project for API testing',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  }),

  /**
   * Create a test workspace object
   */
  workspace: (projectId: string, overrides: Partial<any> = {}) => ({
    id: `test-workspace-${Date.now()}`,
    name: 'Test Workspace',
    project_id: projectId,
    path: `/tmp/test-workspace-${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  }),

  /**
   * Create a test kanban task object
   */
  kanbanTask: (projectId: string, overrides: Partial<any> = {}) => ({
    id: `test-task-${Date.now()}`,
    project_id: projectId,
    title: 'Test Task',
    description: 'A test task for API testing',
    column: 'backlog',
    priority: 3,
    pipeline_status: 'idle',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  }),

  /**
   * Create a test project agent object
   */
  projectAgent: (projectId: string, overrides: Partial<any> = {}) => ({
    id: `test-project-agent-${Date.now()}`,
    project_id: projectId,
    agent_id: `test-agent-${Date.now()}`,
    agent_name: 'Test Agent',
    agent_type: 'claude',
    status: 'idle',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  })
}

/**
 * Database test helpers
 */
export class DatabaseTestHelper {
  private db: Database.Database

  constructor(dbPath: string = TEST_DB_PATH) {
    this.db = new Database(dbPath)
  }

  /**
   * Insert test project into database
   */
  insertProject(project: any): void {
    const stmt = this.db.prepare(`
      INSERT INTO projects (id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `)
    stmt.run(project.id, project.name, project.description, project.created_at, project.updated_at)
  }

  /**
   * Insert test workspace into database
   */
  insertWorkspace(workspace: any): void {
    const stmt = this.db.prepare(`
      INSERT INTO workspaces (id, name, project_id, path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      workspace.id,
      workspace.name,
      workspace.project_id,
      workspace.path,
      workspace.created_at,
      workspace.updated_at
    )
  }

  /**
   * Insert test kanban task into database
   */
  insertKanbanTask(task: any): void {
    const stmt = this.db.prepare(`
      INSERT INTO kanban_tasks (id, project_id, title, description, column, priority, pipeline_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      task.id,
      task.project_id,
      task.title,
      task.description,
      task.column,
      task.priority,
      task.pipeline_status,
      task.created_at,
      task.updated_at
    )
  }

  /**
   * Insert test project agent into database
   */
  insertProjectAgent(agent: any): void {
    const stmt = this.db.prepare(`
      INSERT INTO project_agents (id, project_id, agent_id, agent_name, agent_type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      agent.id,
      agent.project_id,
      agent.agent_id,
      agent.agent_name,
      agent.agent_type,
      agent.status,
      agent.created_at,
      agent.updated_at
    )
  }

  /**
   * Clean up all test data from database
   */
  cleanupTestData(): void {
    this.db.prepare('DELETE FROM project_agents WHERE project_id LIKE "test-%"').run()
    this.db.prepare('DELETE FROM kanban_tasks WHERE project_id LIKE "test-%"').run()
    this.db.prepare('DELETE FROM projects WHERE id LIKE "test-%"').run()
  }

  /**
   * Get all test projects
   */
  getTestProjects(): any[] {
    return this.db.prepare('SELECT * FROM projects WHERE id LIKE "test-%"').all()
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close()
  }
}

/**
 * API test helpers
 */
export const apiTestHelpers = {
  /**
   * Create authenticated request headers
   */
  createAuthHeaders(token: string = 'test-token-for-testing-only'): HeadersInit {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  },

  /**
   * Make API request and return response
   */
  async makeRequest(
    url: string,
    options: RequestInit = {}
  ): Promise<{ status: number; data: any }> {
    const defaultOptions: RequestInit = {
      headers: this.createAuthHeaders(),
      ...options
    }

    const response = await fetch(url, defaultOptions)
    const data = await response.json().catch(() => null)

    return {
      status: response.status,
      data
    }
  },

  /**
   * Wait for API server to be ready
   */
  async waitForApi(
    url: string = 'http://localhost:3001',
    maxAttempts: number = 30,
    interval: number = 1000
  ): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(url, { method: 'HEAD' })
        if (response.ok) {
          return
        }
      } catch {
        // Server not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, interval))
    }
    throw new Error('API server did not become ready in time')
  }
}

/**
 * Test assertions helpers
 */
export const testAssertions = {
  /**
   * Assert successful API response
   */
  assertSuccess(response: { status: number; data: any }): void {
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Expected successful response, got ${response.status}: ${JSON.stringify(response.data)}`)
    }
  },

  /**
   * Assert API error response
   */
  assertError(response: { status: number; data: any }, expectedStatus: number): void {
    if (response.status !== expectedStatus) {
      throw new Error(`Expected status ${expectedStatus}, got ${response.status}: ${JSON.stringify(response.data)}`)
    }
  }
}

export { TEST_DB_PATH }
