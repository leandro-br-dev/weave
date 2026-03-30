#!/usr/bin/env tsx

/**
 * Kanban Auto-Move Integration Test
 *
 * @description Tests the kanban auto-move endpoint with various scenarios
 *              for automated task movement between columns
 *
 * @testType Integration
 * @category Kanban
 *
 * @prerequisites
 * - API server must be running on http://localhost:3000
 * - Database must be initialized
 * - Valid authentication token
 *
 * @usage
 *   tsx tests/integration/kanban/auto-move.test.ts
 *   OR from project root: tsx tests/integration/kanban/auto-move.test.ts
 *
 * @coverage
 * - Scenario 1: Backlog → Planning (planning column empty)
 * - Scenario 2: Planning → In Progress (in_progress empty, planning has workflow_id)
 * - Scenario 3: No moves when conditions not met
 * - Scenario 4: Planning → In Progress (no task with workflow_id)
 * - Scenario 5: Edge cases (empty project, non-existent project)
 *
 * @testScenarios
 * - Priority-based task selection
 * - Workflow ID requirements
 * - Column state validation
 * - Error handling
 *
 * @author Test Suite
 * @version 1.0.0
 */

const API_URL = 'http://localhost:3000'
const TOKEN = 'dev-token-change-in-production'

interface Task {
  id: string
  project_id: string
  title: string
  description: string
  column: string
  priority: number
  workflow_id: string | null
  created_at: string
  updated_at: string
}

interface AutoMoveResponse {
  moved_tasks: Array<{
    task: Task
    oldColumn: string
    newColumn: string
  }>
  reasons: string[]
  error: string | null
}

async function request(method: string, path: string, body?: any) {
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    }
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(`${API_URL}${path}`, options)
  const data = await response.json()
  return { status: response.status, data }
}

async function createProject(name: string) {
  const result = await request('POST', '/api/projects', { name, description: `Test project for ${name}` })
  return result
}

async function createTask(projectId: string, title: string, column: string, priority: number, workflowId?: string) {
  const result = await request('POST', `/api/kanban/${projectId}`, {
    title,
    description: `Test task for ${title}`,
    column,
    priority,
    workflow_id: workflowId || null
  })
  return result
}

async function getTasks(projectId: string) {
  const result = await request('GET', `/api/kanban/${projectId}`)
  return result
}

async function updateTask(projectId: string, taskId: string, updates: any) {
  const result = await request('PUT', `/api/kanban/${projectId}/${taskId}`, updates)
  return result
}

async function autoMove(projectId: string): Promise<{ status: number; data: AutoMoveResponse }> {
  const result = await request('POST', `/api/kanban/${projectId}/auto-move`)
  return result as { status: number; data: AutoMoveResponse }
}

async function deleteTask(projectId: string, taskId: string) {
  const result = await request('DELETE', `/api/kanban/${projectId}/${taskId}`)
  return result
}

function log(message: string, ...args: any[]) {
  console.log(`\x1b[36m[TEST]\x1b[0m ${message}`, ...args)
}

function success(message: string, ...args: any[]) {
  console.log(`\x1b[32m✓ ${message}\x1b[0m`, ...args)
}

function error(message: string, ...args: any[]) {
  console.log(`\x1b[31m✗ ${message}\x1b[0m`, ...args)
}

function info(message: string, ...args: any[]) {
  console.log(`\x1b[33mℹ ${message}\x1b[0m`, ...args)
}

// Test scenarios
async function testScenario1_BacklogToPlanning() {
  log('\n=== Scenario 1: Backlog → Planning (planning column empty) ===')

  // Create a test project
  const projectResult = await createProject('Auto-Move Test 1')
  if (projectResult.status !== 201) {
    error('Failed to create project:', projectResult.data)
    return false
  }
  const projectId = projectResult.data.data.id
  success('Created project:', projectId)

  // Create tasks in backlog with different priorities
  await createTask(projectId, 'Low priority task', 'backlog', 5)
  await createTask(projectId, 'Critical task', 'backlog', 1)
  await createTask(projectId, 'Medium priority task', 'backlog', 3)
  success('Created 3 backlog tasks with priorities 5, 1, 3')

  // Verify initial state
  let tasksResult = await getTasks(projectId)
  const backlogTasks = tasksResult.data.data.filter((t: Task) => t.column === 'backlog')
  const planningTasks = tasksResult.data.data.filter((t: Task) => t.column === 'planning')
  info(`Initial state: ${backlogTasks.length} backlog tasks, ${planningTasks.length} planning tasks`)

  // Call auto-move
  const moveResult = await autoMove(projectId)
  if (moveResult.status !== 200) {
    error('Auto-move failed:', moveResult.data)
    return false
  }
  success('Auto-move successful')

  // Verify results
  tasksResult = await getTasks(projectId)
  const newBacklogTasks = tasksResult.data.data.filter((t: Task) => t.column === 'backlog')
  const newPlanningTasks = tasksResult.data.data.filter((t: Task) => t.column === 'planning')

  info(`After auto-move: ${newBacklogTasks.length} backlog tasks, ${newPlanningTasks.length} planning tasks`)

  // Check that the critical task (priority 1) was moved
  if (newPlanningTasks.length !== 1) {
    error('Expected 1 task in planning, got:', newPlanningTasks.length)
    return false
  }

  if (newPlanningTasks[0].priority !== 1) {
    error('Expected priority 1 task to be moved, got priority:', newPlanningTasks[0].priority)
    return false
  }

  if (newPlanningTasks[0].title !== 'Critical task') {
    error('Expected "Critical task" to be moved, got:', newPlanningTasks[0].title)
    return false
  }

  success('Correctly moved highest priority task (priority 1) from backlog to planning')

  // Check response
  if (moveResult.data.moved_tasks.length !== 1) {
    error('Expected 1 moved task in response, got:', moveResult.data.moved_tasks.length)
    return false
  }

  if (moveResult.data.reasons.length !== 1) {
    error('Expected 1 reason in response, got:', moveResult.data.reasons.length)
    return false
  }

  info('Move reason:', moveResult.data.reasons[0])

  return true
}

async function testScenario2_PlanningToInProgress() {
  log('\n=== Scenario 2: Planning → In Progress (in_progress empty, planning has workflow_id) ===')

  // Create a test project
  const projectResult = await createProject('Auto-Move Test 2')
  if (projectResult.status !== 201) {
    error('Failed to create project:', projectResult.data)
    return false
  }
  const projectId = projectResult.data.data.id
  success('Created project:', projectId)

  // First, create a plan to use as workflow_id
  const planResult = await request('POST', '/api/plans', {
    name: 'Test Plan',
    project_id: projectId,
    tasks: JSON.stringify([{ task: 'Test task' }])
  })
  if (planResult.status !== 201) {
    error('Failed to create plan:', planResult.data)
    return false
  }
  const workflowId = planResult.data.data.id
  success('Created workflow plan:', workflowId)

  // Create a task in planning with workflow_id
  const taskResult = await createTask(projectId, 'Task with workflow', 'planning', 2)
  if (taskResult.status !== 201) {
    error('Failed to create task:', taskResult.data)
    return false
  }
  const taskId = taskResult.data.data.id

  // Update the task to have workflow_id
  await updateTask(projectId, taskId, { workflow_id: workflowId })
  success('Created planning task with workflow_id')

  // Verify initial state
  let tasksResult = await getTasks(projectId)
  const planningTasks = tasksResult.data.data.filter((t: Task) => t.column === 'planning')
  const inProgressTasks = tasksResult.data.data.filter((t: Task) => t.column === 'in_progress')
  info(`Initial state: ${planningTasks.length} planning tasks, ${inProgressTasks.length} in_progress tasks`)

  // Call auto-move
  const moveResult = await autoMove(projectId)
  if (moveResult.status !== 200) {
    error('Auto-move failed:', moveResult.data)
    return false
  }
  success('Auto-move successful')

  // Verify results
  tasksResult = await getTasks(projectId)
  const newPlanningTasks = tasksResult.data.data.filter((t: Task) => t.column === 'planning')
  const newInProgressTasks = tasksResult.data.data.filter((t: Task) => t.column === 'in_progress')

  info(`After auto-move: ${newPlanningTasks.length} planning tasks, ${newInProgressTasks.length} in_progress tasks`)

  // Check that the task was moved
  if (newInProgressTasks.length !== 1) {
    error('Expected 1 task in in_progress, got:', newInProgressTasks.length)
    return false
  }

  if (newInProgressTasks[0].workflow_id !== workflowId) {
    error('Expected task with workflow_id to be moved')
    return false
  }

  success('Correctly moved task with workflow_id from planning to in_progress')

  return true
}

async function testScenario3_NoMoves() {
  log('\n=== Scenario 3: No moves (planning not empty, in_progress not empty) ===')

  // Create a test project
  const projectResult = await createProject('Auto-Move Test 3')
  if (projectResult.status !== 201) {
    error('Failed to create project:', projectResult.data)
    return false
  }
  const projectId = projectResult.data.data.id
  success('Created project:', projectId)

  // Create tasks in both planning and in_progress
  await createTask(projectId, 'Planning task', 'planning', 2)
  await createTask(projectId, 'In progress task', 'in_progress', 2)
  await createTask(projectId, 'Backlog task', 'backlog', 1)
  success('Created tasks in all columns')

  // Verify initial state
  let tasksResult = await getTasks(projectId)
  const backlogTasks = tasksResult.data.data.filter((t: Task) => t.column === 'backlog')
  const planningTasks = tasksResult.data.data.filter((t: Task) => t.column === 'planning')
  const inProgressTasks = tasksResult.data.data.filter((t: Task) => t.column === 'in_progress')
  info(`Initial state: ${backlogTasks.length} backlog, ${planningTasks.length} planning, ${inProgressTasks.length} in_progress`)

  // Call auto-move
  const moveResult = await autoMove(projectId)
  if (moveResult.status !== 200) {
    error('Auto-move failed:', moveResult.data)
    return false
  }
  success('Auto-move successful')

  // Verify no tasks were moved
  if (moveResult.data.moved_tasks.length !== 0) {
    error('Expected 0 moved tasks, got:', moveResult.data.moved_tasks.length)
    return false
  }

  if (moveResult.data.reasons.length !== 0) {
    error('Expected 0 reasons, got:', moveResult.data.reasons.length)
    return false
  }

  // Verify state unchanged
  tasksResult = await getTasks(projectId)
  const newBacklogTasks = tasksResult.data.data.filter((t: Task) => t.column === 'backlog')
  const newPlanningTasks = tasksResult.data.data.filter((t: Task) => t.column === 'planning')
  const newInProgressTasks = tasksResult.data.data.filter((t: Task) => t.column === 'in_progress')
  info(`After auto-move: ${newBacklogTasks.length} backlog, ${newPlanningTasks.length} planning, ${newInProgressTasks.length} in_progress`)

  success('Correctly did not move any tasks when conditions not met')

  return true
}

async function testScenario4_NoWorkflowId() {
  log('\n=== Scenario 4: Planning → In Progress (no task with workflow_id) ===')

  // Create a test project
  const projectResult = await createProject('Auto-Move Test 4')
  if (projectResult.status !== 201) {
    error('Failed to create project:', projectResult.data)
    return false
  }
  const projectId = projectResult.data.data.id
  success('Created project:', projectId)

  // Create a task in planning WITHOUT workflow_id
  await createTask(projectId, 'Planning task without workflow', 'planning', 2)
  success('Created planning task without workflow_id')

  // Verify initial state
  let tasksResult = await getTasks(projectId)
  const planningTasks = tasksResult.data.data.filter((t: Task) => t.column === 'planning')
  const inProgressTasks = tasksResult.data.data.filter((t: Task) => t.column === 'in_progress')
  info(`Initial state: ${planningTasks.length} planning tasks, ${inProgressTasks.length} in_progress tasks`)

  // Call auto-move
  const moveResult = await autoMove(projectId)
  if (moveResult.status !== 200) {
    error('Auto-move failed:', moveResult.data)
    return false
  }
  success('Auto-move successful')

  // Verify no tasks were moved to in_progress
  if (moveResult.data.moved_tasks.length !== 0) {
    error('Expected 0 moved tasks (no workflow_id), got:', moveResult.data.moved_tasks.length)
    return false
  }

  success('Correctly did not move task without workflow_id')

  return true
}

async function testScenario5_EdgeCases() {
  log('\n=== Scenario 5: Edge Cases (empty project, non-existent project) ===')

  // Test with empty project
  const projectResult = await createProject('Auto-Move Test 5 - Empty')
  if (projectResult.status !== 201) {
    error('Failed to create project:', projectResult.data)
    return false
  }
  const projectId = projectResult.data.data.id
  success('Created empty project:', projectId)

  // Call auto-move on empty project
  const moveResult1 = await autoMove(projectId)
  if (moveResult1.status !== 200) {
    error('Auto-move failed on empty project:', moveResult1.data)
    return false
  }
  if (moveResult1.data.moved_tasks.length !== 0) {
    error('Expected 0 moved tasks for empty project, got:', moveResult1.data.moved_tasks.length)
    return false
  }
  success('Correctly handled empty project (no moves)')

  // Test with non-existent project
  const fakeProjectId = '00000000-0000-0000-0000-000000000000'
  const moveResult2 = await autoMove(fakeProjectId)
  if (moveResult2.status !== 404) {
    error('Expected 404 for non-existent project, got:', moveResult2.status)
    return false
  }
  success('Correctly returned 404 for non-existent project')

  return true
}

async function runAllTests() {
  log('Starting Kanban Auto-Move Endpoint Tests')
  log('==========================================')

  const tests = [
    { name: 'Scenario 1: Backlog → Planning', fn: testScenario1_BacklogToPlanning },
    { name: 'Scenario 2: Planning → In Progress', fn: testScenario2_PlanningToInProgress },
    { name: 'Scenario 3: No moves when conditions not met', fn: testScenario3_NoMoves },
    { name: 'Scenario 4: No workflow_id in planning', fn: testScenario4_NoWorkflowId },
    { name: 'Scenario 5: Edge cases', fn: testScenario5_EdgeCases }
  ]

  const results = []
  for (const test of tests) {
    try {
      const passed = await test.fn()
      results.push({ name: test.name, passed })
    } catch (err) {
      error(`Test "${test.name}" threw error:`, err)
      results.push({ name: test.name, passed: false, error: err })
    }
  }

  // Summary
  log('\n==========================================')
  log('Test Summary')
  log('==========================================')

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length

  results.forEach(result => {
    if (result.passed) {
      success(`✓ ${result.name}`)
    } else {
      error(`✗ ${result.name}`)
    }
  })

  log(`\nTotal: ${results.length} tests, ${passed} passed, ${failed} failed`)

  if (failed === 0) {
    success('\n🎉 All tests passed!')
    return 0
  } else {
    error('\n❌ Some tests failed')
    return 1
  }
}

// Run tests
runAllTests()
  .then(exitCode => process.exit(exitCode))
  .catch(err => {
    error('Fatal error:', err)
    process.exit(1)
  })
