#!/usr/bin/env tsx

/**
 * Seed Test Data Script
 *
 * @description Seeds the database with test data for integration tests
 *
 * @usage
 *   tsx tests/integration/seed-test-data.ts
 *   OR from project root: tsx tests/integration/seed-test-data.ts
 */

import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'api', 'data', 'database.db')

if (!fs.existsSync(DB_PATH)) {
  console.error('Database not found at:', DB_PATH)
  process.exit(1)
}

const db = new Database(DB_PATH)

console.log('Seeding test data...')

// Seed projects
const insertProject = db.prepare(`
  INSERT OR REPLACE INTO projects (id, name, description, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?)
`)

const projects = [
  {
    id: 'test-project-kanban',
    name: 'Test Kanban Project',
    description: 'Project for testing kanban auto-move functionality'
  },
  {
    id: 'test-project-agents',
    name: 'Test Agents Project',
    description: 'Project for testing agent linking functionality'
  },
  {
    id: 'test-project-workflow',
    name: 'Test Workflow Project',
    description: 'Project for testing workflow functionality'
  }
]

projects.forEach(project => {
  insertProject.run(
    project.id,
    project.name,
    project.description,
    new Date().toISOString(),
    new Date().toISOString()
  )
  console.log(`✓ Created project: ${project.name}`)
})

// Seed kanban tasks for testing
const insertTask = db.prepare(`
  INSERT OR REPLACE INTO kanban_tasks (id, project_id, title, description, column, priority, workflow_id, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const tasks = [
  {
    id: 'test-task-1',
    projectId: 'test-project-kanban',
    title: 'High priority bug fix',
    description: 'Critical bug that needs immediate attention',
    column: 'backlog',
    priority: 1,
    workflowId: null
  },
  {
    id: 'test-task-2',
    projectId: 'test-project-kanban',
    title: 'Medium priority feature',
    description: 'Feature request with medium priority',
    column: 'backlog',
    priority: 3,
    workflowId: null
  },
  {
    id: 'test-task-3',
    projectId: 'test-project-kanban',
    title: 'Low priority documentation',
    description: 'Documentation update',
    column: 'backlog',
    priority: 5,
    workflowId: null
  },
  {
    id: 'test-task-4',
    projectId: 'test-project-kanban',
    title: 'Planning task with workflow',
    description: 'Task in planning with workflow assigned',
    column: 'planning',
    priority: 2,
    workflowId: 'test-workflow-1'
  }
]

tasks.forEach(task => {
  insertTask.run(
    task.id,
    task.projectId,
    task.title,
    task.description,
    task.column,
    task.priority,
    task.workflowId,
    new Date().toISOString(),
    new Date().toISOString()
  )
  console.log(`✓ Created task: ${task.title}`)
})

// Seed workflow plans
const insertPlan = db.prepare(`
  INSERT OR REPLACE INTO plans (id, name, project_id, tasks, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?)
`)

const plans = [
  {
    id: 'test-workflow-1',
    name: 'Test Workflow Plan',
    projectId: 'test-project-kanban',
    tasks: JSON.stringify([
      { task: 'Implement feature X' },
      { task: 'Write tests for feature X' },
      { task: 'Deploy feature X' }
    ])
  },
  {
    id: 'test-workflow-2',
    name: 'Another Test Workflow',
    projectId: 'test-project-workflow',
    tasks: JSON.stringify([
      { task: 'Research requirement' },
      { task: 'Design solution' }
    ])
  }
]

plans.forEach(plan => {
  insertPlan.run(
    plan.id,
    plan.name,
    plan.projectId,
    plan.tasks,
    new Date().toISOString(),
    new Date().toISOString()
  )
  console.log(`✓ Created workflow plan: ${plan.name}`)
)

// Seed test workspaces
const insertWorkspace = db.prepare(`
  INSERT OR REPLACE INTO workspaces (id, name, project_id, path, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?)
`)

const workspaces = [
  {
    id: 'test-workspace-1',
    name: 'Test Workspace 1',
    projectId: 'test-project-agents',
    path: '/tmp/test-workspace-1'
  },
  {
    id: 'test-workspace-2',
    name: 'Test Workspace 2',
    projectId: 'test-project-agents',
    path: '/tmp/test-workspace-2'
  }
]

workspaces.forEach(workspace => {
  insertWorkspace.run(
    workspace.id,
    workspace.name,
    workspace.projectId,
    workspace.path,
    new Date().toISOString(),
    new Date().toISOString()
  )
  console.log(`✓ Created workspace: ${workspace.name}`)
})

db.close()

console.log('\n✅ Test data seeded successfully!')
console.log(`   - ${projects.length} projects`)
console.log(`   - ${tasks.length} kanban tasks`)
console.log(`   - ${plans.length} workflow plans`)
console.log(`   - ${workspaces.length} workspaces`)
