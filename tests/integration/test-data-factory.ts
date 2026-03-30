/**
 * Test Data Factory for Integration Tests
 *
 * Provides factory functions to create test data with unique identifiers
 * to ensure test isolation.
 */

export interface TestProject {
  id: string
  name: string
  description: string
  created_at: string
  updated_at: string
}

export interface TestWorkspace {
  id: string
  name: string
  project_id: string
  path: string
  created_at: string
  updated_at: string
}

export interface TestKanbanTask {
  id: string
  project_id: string
  title: string
  description: string
  column: 'backlog' | 'todo' | 'in_progress' | 'done'
  priority: number
  pipeline_status: 'idle' | 'running' | 'completed' | 'failed'
  created_at: string
  updated_at: string
}

export interface TestProjectAgent {
  id: string
  project_id: string
  agent_id: string
  agent_name: string
  agent_type: string
  status: string
  created_at: string
  updated_at: string
}

/**
 * Generate unique test ID
 */
export function generateTestId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Get current ISO timestamp
 */
export function getTimestamp(): string {
  return new Date().toISOString()
}

/**
 * Factory for creating test projects
 */
export function createTestProject(overrides: Partial<TestProject> = {}): TestProject {
  const timestamp = getTimestamp()
  return {
    id: generateTestId('test-project'),
    name: 'Test Project',
    description: 'A test project for integration testing',
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides
  }
}

/**
 * Factory for creating test workspaces
 */
export function createTestWorkspace(projectId: string, overrides: Partial<TestWorkspace> = {}): TestWorkspace {
  const timestamp = getTimestamp()
  return {
    id: generateTestId('test-workspace'),
    name: 'Test Workspace',
    project_id: projectId,
    path: `/tmp/test-workspace-${Date.now()}`,
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides
  }
}

/**
 * Factory for creating test kanban tasks
 */
export function createTestKanbanTask(projectId: string, overrides: Partial<TestKanbanTask> = {}): TestKanbanTask {
  const timestamp = getTimestamp()
  return {
    id: generateTestId('test-task'),
    project_id: projectId,
    title: 'Test Task',
    description: 'A test task for integration testing',
    column: 'backlog',
    priority: 3,
    pipeline_status: 'idle',
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides
  }
}

/**
 * Factory for creating test project agents
 */
export function createTestProjectAgent(projectId: string, overrides: Partial<TestProjectAgent> = {}): TestProjectAgent {
  const timestamp = getTimestamp()
  return {
    id: generateTestId('test-project-agent'),
    project_id: projectId,
    agent_id: generateTestId('test-agent'),
    agent_name: 'Test Agent',
    agent_type: 'claude',
    status: 'idle',
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides
  }
}

/**
 * Factory for creating multiple test projects
 */
export function createTestProjects(count: number): TestProject[] {
  return Array.from({ length: count }, (_, i) =>
    createTestProject({
      name: `Test Project ${i + 1}`,
      description: `Test project ${i + 1} for integration testing`
    })
  )
}

/**
 * Factory for creating multiple test kanban tasks
 */
export function createTestKanbanTasks(projectId: string, count: number): TestKanbanTask[] {
  return Array.from({ length: count }, (_, i) =>
    createTestKanbanTask(projectId, {
      title: `Test Task ${i + 1}`,
      description: `Test task ${i + 1} for integration testing`,
      column: ['backlog', 'todo', 'in_progress', 'done'][i % 4] as any,
      priority: (i % 5) + 1
    })
  )
}

/**
 * Create a complete test project with related entities
 */
export function createCompleteTestProject(): {
  project: TestProject
  workspaces: TestWorkspace[]
  tasks: TestKanbanTask[]
  agents: TestProjectAgent[]
} {
  const project = createTestProject()
  const workspaces = [
    createTestWorkspace(project.id, { name: 'Main Workspace' }),
    createTestWorkspace(project.id, { name: 'Secondary Workspace' })
  ]
  const tasks = createTestKanbanTasks(project.id, 5)
  const agents = [
    createTestProjectAgent(project.id, { agent_name: 'Primary Agent' }),
    createTestProjectAgent(project.id, { agent_name: 'Secondary Agent', agent_type: 'gpt-4' })
  ]

  return { project, workspaces, tasks, agents }
}

/**
 * Test scenario builders
 */
export const testScenarios = {
  /**
   * Create a scenario with a project ready for kanban testing
   */
  kanbanProject: () => {
    const project = createTestProject({ name: 'Kanban Test Project' })
    const tasks = [
      createTestKanbanTask(project.id, { title: 'Backlog Task', column: 'backlog' }),
      createTestKanbanTask(project.id, { title: 'Todo Task', column: 'todo' }),
      createTestKanbanTask(project.id, { title: 'In Progress Task', column: 'in_progress' }),
      createTestKanbanTask(project.id, { title: 'Done Task', column: 'done' })
    ]
    return { project, tasks }
  },

  /**
   * Create a scenario with a project ready for workspace testing
   */
  workspaceProject: () => {
    const project = createTestProject({ name: 'Workspace Test Project' })
    const workspaces = [
      createTestWorkspace(project.id, { name: 'Dev Workspace', path: '/tmp/test-dev' }),
      createTestWorkspace(project.id, { name: 'Build Workspace', path: '/tmp/test-build' })
    ]
    return { project, workspaces }
  },

  /**
   * Create a scenario with a project ready for agent testing
   */
  agentProject: () => {
    const project = createTestProject({ name: 'Agent Test Project' })
    const agents = [
      createTestProjectAgent(project.id, { agent_name: 'Code Agent', agent_type: 'claude-3-5-sonnet' }),
      createTestProjectAgent(project.id, { agent_name: 'Review Agent', agent_type: 'gpt-4' })
    ]
    return { project, agents }
  },

  /**
   * Create a complex scenario with all entity types
   */
  complexProject: () => {
    const project = createTestProject({ name: 'Complex Test Project' })
    const workspaces = createTestWorkspace(project.id)
    const tasks = createTestKanbanTasks(project.id, 10)
    const agents = createTestProjectAgent(project.id)
    return { project, workspaces, tasks, agents }
  }
}
