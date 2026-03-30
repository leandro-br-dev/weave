/**
 * Test Data Factory for TypeScript Tests
 *
 * Provides factory functions to create test data with unique identifiers
 * to ensure test isolation and consistency.
 */

/**
 * Generate unique test ID with timestamp and random string
 */
export function generateTestId(prefix: string = 'test'): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 10)
  return `${prefix}-${timestamp}-${random}`
}

/**
 * Get current ISO timestamp
 */
export function getTimestamp(): string {
  return new Date().toISOString()
}

/**
 * Test data interfaces
 */
export interface TestProject {
  id: string
  name: string
  description: string
  created_at: string
  updated_at: string
}

export interface TestPlan {
  id: string
  project_id: string
  name: string
  tasks: string
  status: 'pending' | 'running' | 'success' | 'failed'
  result?: string | null
  client_id?: string | null
  created_at: string
  updated_at: string
}

export interface TestKanbanTask {
  id: string
  project_id: string
  title: string
  description: string
  column: 'backlog' | 'todo' | 'planning' | 'in_progress' | 'done'
  priority: number
  pipeline_status: 'idle' | 'running' | 'done' | 'failed'
  workflow_id: string | null
  error_message: string | null
  result_status: string | null
  result_notes: string | null
  created_at: string
  updated_at: string
}

export interface TestWorkspace {
  id: string
  project_id: string
  name: string
  path: string
  created_at: string
  updated_at: string
}

export interface TestAgent {
  id: string
  name: string
  role: string
  status: string
  workspace_path: string
}

/**
 * Factory functions for creating test data
 */

export function createTestProject(overrides: Partial<TestProject> = {}): TestProject {
  const timestamp = getTimestamp()
  return {
    id: generateTestId('project'),
    name: 'Test Project',
    description: 'A test project for automated testing',
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides
  }
}

export function createTestPlan(projectId: string, overrides: Partial<TestPlan> = {}): TestPlan {
  const timestamp = getTimestamp()
  return {
    id: generateTestId('plan'),
    project_id: projectId,
    name: 'Test Plan',
    tasks: 'Task 1\nTask 2\nTask 3',
    status: 'pending',
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides
  }
}

export function createTestKanbanTask(projectId: string, overrides: Partial<TestKanbanTask> = {}): TestKanbanTask {
  const timestamp = getTimestamp()
  return {
    id: generateTestId('task'),
    project_id: projectId,
    title: 'Test Task',
    description: 'A test task for automated testing',
    column: 'backlog',
    priority: 3,
    pipeline_status: 'idle',
    workflow_id: null,
    error_message: null,
    result_status: null,
    result_notes: null,
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides
  }
}

export function createTestWorkspace(projectId: string, overrides: Partial<TestWorkspace> = {}): TestWorkspace {
  const timestamp = getTimestamp()
  return {
    id: generateTestId('workspace'),
    project_id: projectId,
    name: 'Test Workspace',
    path: `/tmp/test-workspace-${Date.now()}`,
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides
  }
}

export function createTestAgent(overrides: Partial<TestAgent> = {}): TestAgent {
  return {
    id: generateTestId('agent'),
    name: 'Test Agent',
    role: 'developer',
    status: 'idle',
    workspace_path: '/tmp/test-workspace',
    ...overrides
  }
}

/**
 * Batch creation functions
 */

export function createTestProjects(count: number): TestProject[] {
  return Array.from({ length: count }, (_, i) =>
    createTestProject({
      name: `Test Project ${i + 1}`,
      description: `Test project ${i + 1} for automated testing`
    })
  )
}

export function createTestKanbanTasks(projectId: string, count: number): TestKanbanTask[] {
  const columns: Array<'backlog' | 'todo' | 'planning' | 'in_progress' | 'done'> =
    ['backlog', 'todo', 'planning', 'in_progress', 'done']

  return Array.from({ length: count }, (_, i) =>
    createTestKanbanTask(projectId, {
      title: `Test Task ${i + 1}`,
      description: `Test task ${i + 1} for automated testing`,
      column: columns[i % columns.length],
      priority: (i % 5) + 1
    })
  )
}

export function createTestPlans(projectId: string, count: number): TestPlan[] {
  return Array.from({ length: count }, (_, i) =>
    createTestPlan(projectId, {
      name: `Test Plan ${i + 1}`,
      tasks: `Task ${i + 1}\nTask ${i + 2}`
    })
  )
}

/**
 * Test scenario builders
 */

export const testScenarios = {
  /**
   * Create a kanban workflow scenario
   */
  kanbanWorkflow: () => {
    const project = createTestProject({ name: 'Kanban Test Project' })
    const tasks = createTestKanbanTasks(project.id, 5)
    return { project, tasks }
  },

  /**
   * Create a planning workflow scenario
   */
  planningWorkflow: () => {
    const project = createTestProject({ name: 'Planning Test Project' })
    const plans = createTestPlans(project.id, 3)
    return { project, plans }
  },

  /**
   * Create a multi-agent scenario
   */
  multiAgent: () => {
    const project = createTestProject({ name: 'Multi-Agent Test Project' })
    const agents = [
      createTestAgent({ name: 'Code Agent', role: 'developer' }),
      createTestAgent({ name: 'Review Agent', role: 'reviewer' }),
      createTestAgent({ name: 'Build Agent', role: 'builder' })
    ]
    return { project, agents }
  },

  /**
   * Create a complete project scenario
   */
  completeProject: () => {
    const project = createTestProject({ name: 'Complete Test Project' })
    const tasks = createTestKanbanTasks(project.id, 5)
    const plans = createTestPlans(project.id, 2)
    const workspaces = [
      createTestWorkspace(project.id, { name: 'Dev Workspace' }),
      createTestWorkspace(project.id, { name: 'Build Workspace' })
    ]
    return { project, tasks, plans, workspaces }
  }
}

/**
 * API response helpers
 */

export interface ApiResponse<T = any> {
  data?: T
  error: string | null
}

export function apiResponse<T = any>(data?: T, error: string | null = null): ApiResponse<T> {
  const response: ApiResponse<T> = { error }
  if (data !== undefined) {
    response.data = data
  }
  return response
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number
    per_page: number
    total: number
    total_pages: number
  }
}

export function paginatedResponse<T = any>(
  items: T[],
  page: number = 1,
  perPage: number = 10
): PaginatedResponse<T> {
  const total = items.length
  const start = (page - 1) * perPage
  const end = start + perPage
  const pageItems = items.slice(start, end)

  return {
    data: pageItems,
    pagination: {
      page,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage)
    },
    error: null
  }
}

/**
 * Test constants
 */

export const TEST_CONSTANTS = {
  API_URL: process.env.TEST_API_URL || 'http://localhost:3000',
  API_TOKEN: process.env.TEST_API_TOKEN || 'test-token-for-testing-only',
  TIMEOUT: parseInt(process.env.TEST_TIMEOUT || '30000')
} as const
