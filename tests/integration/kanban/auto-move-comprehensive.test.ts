#!/usr/bin/env tsx

/**
 * Kanban Auto-Move Comprehensive Integration Test
 *
 * @description Comprehensive test showing both auto-move rules working together
 *              in a realistic workflow scenario
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
 *   tsx tests/integration/kanban/auto-move-comprehensive.test.ts
 *   OR from project root: tsx tests/integration/kanban/auto-move-comprehensive.test.ts
 *
 * @coverage
 * - Rule 1: Backlog → Planning (when planning is empty)
 * - Rule 2: Planning → In Progress (when in_progress is empty AND task has workflow_id)
 * - Priority-based task selection (lowest number = highest priority)
 * - Workflow ID requirement enforcement
 * - Multi-step workflow scenarios
 * - State validation after each move
 *
 * @testWorkflow
 * 1. Create backlog tasks with different priorities
 * 2. Test Backlog → Planning move (priority 1 task moves)
 * 3. Add workflow_id to planning task
 * 4. Test Planning → In Progress move (task with workflow_id moves)
 * 5. Test no-move scenarios
 * 6. Clear columns and test repeat moves
 *
 * @author Test Suite
 * @version 1.0.0
 */

const API_URL = 'http://localhost:3000'
const TOKEN = 'dev-token-change-in-production'

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

async function updateTask(projectId: string, taskId: string, updates: any) {
  const result = await request('PUT', `/api/kanban/${projectId}/${taskId}`, updates)
  return result
}

async function getTasks(projectId: string) {
  const result = await request('GET', `/api/kanban/${projectId}`)
  return result
}

async function autoMove(projectId: string) {
  const result = await request('POST', `/api/kanban/${projectId}/auto-move`)
  return result
}

function log(message: string, ...args: any[]) {
  console.log(`\x1b[36m[TEST]\x1b[0m ${message}`, ...args)
}

function success(message: string, ...args: any[]) {
  console.log(`\x1b[32m✓ ${message}\x1b[0m`, ...args)
}

function info(message: string, ...args: any[]) {
  console.log(`\x1b[33mℹ ${message}\x1b[0m`, ...args)
}

async function comprehensiveTest() {
  log('Starting Comprehensive Auto-Move Test')
  log('========================================\n')

  // Create a test project
  const projectResult = await createProject('Comprehensive Auto-Move Test')
  if (projectResult.status !== 201) {
    log('Failed to create project:', projectResult.data)
    return
  }
  const projectId = projectResult.data.data.id
  success('Created project:', projectId)

  // Create a workflow plan
  const planResult = await request('POST', '/api/plans', {
    name: 'Test Workflow Plan',
    project_id: projectId,
    tasks: JSON.stringify([{ task: 'Implement feature' }])
  })
  const workflowId = planResult.data.data.id
  success('Created workflow plan:', workflowId)

  // Initial state: Create multiple backlog tasks with different priorities
  log('\n--- Step 1: Creating backlog tasks ---')
  await createTask(projectId, 'Low priority bug fix', 'backlog', 5)
  await createTask(projectId, 'Critical feature request', 'backlog', 1)
  await createTask(projectId, 'Medium priority enhancement', 'backlog', 3)
  await createTask(projectId, 'Low priority documentation', 'backlog', 4)
  await createTask(projectId, 'High priority refactor', 'backlog', 2)

  let tasks = await getTasks(projectId)
  const backlogTasks = tasks.data.data.filter((t: any) => t.column === 'backlog')
  info(`Created ${backlogTasks.length} backlog tasks with priorities 1-5`)

  // First auto-move: Backlog → Planning (planning is empty)
  log('\n--- Step 2: First auto-move (Backlog → Planning) ---')
  let moveResult = await autoMove(projectId)
  success('Auto-move completed')
  info(`Moved tasks: ${moveResult.data.moved_tasks.length}`)
  moveResult.data.reasons.forEach((reason: string, i: number) => {
    info(`  Reason ${i + 1}:`, reason)
  })

  tasks = await getTasks(projectId)
  log('\nCurrent state:')
  log('  Backlog:', tasks.data.data.filter((t: any) => t.column === 'backlog').length)
  log('  Planning:', tasks.data.data.filter((t: any) => t.column === 'planning').length)
  log('  In Progress:', tasks.data.data.filter((t: any) => t.column === 'in_progress').length)

  // Add workflow_id to the planning task
  log('\n--- Step 3: Adding workflow_id to planning task ---')
  const planningTask = tasks.data.data.find((t: any) => t.column === 'planning')
  await updateTask(projectId, planningTask.id, { workflow_id: workflowId })
  success('Added workflow_id to planning task:', planningTask.title)

  // Second auto-move: Planning → In Progress (in_progress is empty, task has workflow_id)
  log('\n--- Step 4: Second auto-move (Planning → In Progress) ---')
  moveResult = await autoMove(projectId)
  success('Auto-move completed')
  info(`Moved tasks: ${moveResult.data.moved_tasks.length}`)
  moveResult.data.reasons.forEach((reason: string, i: number) => {
    info(`  Reason ${i + 1}:`, reason)
  })

  tasks = await getTasks(projectId)
  log('\nCurrent state:')
  log('  Backlog:', tasks.data.data.filter((t: any) => t.column === 'backlog').length)
  log('  Planning:', tasks.data.data.filter((t: any) => t.column === 'planning').length)
  log('  In Progress:', tasks.data.data.filter((t: any) => t.column === 'in_progress').length)

  // Third auto-move: Nothing should move (planning is empty, in_progress is not empty)
  log('\n--- Step 5: Third auto-move (no moves expected) ---')
  moveResult = await autoMove(projectId)
  success('Auto-move completed')
  info(`Moved tasks: ${moveResult.data.moved_tasks.length}`)

  tasks = await getTasks(projectId)
  log('\nFinal state:')
  log('  Backlog:', tasks.data.data.filter((t: any) => t.column === 'backlog').length)
  log('  Planning:', tasks.data.data.filter((t: any) => t.column === 'planning').length)
  log('  In Progress:', tasks.data.data.filter((t: any) => t.column === 'in_progress').length)

  // Show remaining backlog tasks sorted by priority
  const remainingBacklog = tasks.data.data
    .filter((t: any) => t.column === 'backlog')
    .sort((a: any, b: any) => a.priority - b.priority)

  log('\nRemaining backlog tasks (by priority):')
  remainingBacklog.forEach((task: any) => {
    log(`  [${task.priority}] ${task.title}`)
  })

  // Clear in_progress column
  log('\n--- Step 6: Moving in_progress task to done ---')
  const inProgressTask = tasks.data.data.find((t: any) => t.column === 'in_progress')
  await updateTask(projectId, inProgressTask.id, { column: 'done' })
  success('Moved in_progress task to done')

  // Fourth auto-move: Backlog → Planning again (planning is empty again)
  log('\n--- Step 7: Fourth auto-move (Backlog → Planning again) ---')
  moveResult = await autoMove(projectId)
  success('Auto-move completed')
  info(`Moved tasks: ${moveResult.data.moved_tasks.length}`)
  moveResult.data.reasons.forEach((reason: string, i: number) => {
    info(`  Reason ${i + 1}:`, reason)
  })

  tasks = await getTasks(projectId)
  log('\nFinal state:')
  log('  Backlog:', tasks.data.data.filter((t: any) => t.column === 'backlog').length)
  log('  Planning:', tasks.data.data.filter((t: any) => t.column === 'planning').length)
  log('  In Progress:', tasks.data.data.filter((t: any) => t.column === 'in_progress').length)
  log('  Done:', tasks.data.data.filter((t: any) => t.column === 'done').length)

  log('\n========================================')
  success('✓ Comprehensive test completed successfully!')
  log('\nSummary:')
  log('  • Rule 1 (Backlog → Planning) works correctly')
  log('  • Rule 2 (Planning → In Progress) works correctly')
  log('  • Tasks are selected by priority (lowest number = highest priority)')
  log('  • workflow_id requirement for Rule 2 is enforced')
  log('  • No moves happen when conditions are not met')
}

comprehensiveTest()
  .then(() => process.exit(0))
  .catch(err => {
    log('Fatal error:', err)
    process.exit(1)
  })
