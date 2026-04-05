/**
 * Kanban API Route Tests
 *
 * Tests the kanban routes including:
 * - Task CRUD operations
 * - Pipeline status updates
 * - Column transitions
 * - Error handling
 *
 * @testType Integration
 * @category Kanban
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import express, { Express } from 'express'
import { db } from '../../src/db/index.js'
import kanbanRouter from '../../src/routes/kanban.js'
import { clearTables } from '../helpers/test-db.js'
import {
  createTestProject,
  createTestKanbanTask,
  createTestPlan,
  generateTestId,
  apiResponse
} from '../helpers/test-data-factory.js'

// Mock authentication middleware
vi.mock('../../src/middleware/auth.js', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { userId: 'system', username: 'daemon' }
    next()
  },
}))

describe('Kanban API', () => {
  let app: Express
  let projectId: string

  beforeAll(() => {
    // Create a test Express app
    app = express()
    app.use(express.json())
    app.use('/api/kanban', kanbanRouter)

    // Create system user for foreign key constraints
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get('system')
    if (!existing) {
      db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(
        'system', 'daemon', 'system-hash'
      )
    }

    // Create a test project (use a random ID to avoid conflicts)
    const project = createTestProject()
    projectId = project.id
    db.prepare('INSERT INTO projects (id, name, description, user_id) VALUES (?, ?, ?, ?)').run(
      project.id,
      project.name,
      project.description,
      'system'
    )
  })

  beforeEach(() => {
    // Clear kanban_tasks table before each test
    db.prepare('DELETE FROM kanban_tasks WHERE project_id = ?').run(projectId)
  })

  afterEach(() => {
    // Clean up after each test
    db.prepare('DELETE FROM kanban_tasks WHERE project_id = ?').run(projectId)
  })

  afterAll(() => {
    // Clean up test project and related plans
    db.prepare("DELETE FROM plans WHERE id LIKE 'test-workflow-%'").run()
    db.prepare('DELETE FROM projects WHERE id = ?').run(projectId)
  })

  describe('PATCH /api/kanban/:projectId/:taskId/pipeline', () => {
    it('should update pipeline_status, workflow_id, and error_message', async () => {
      // Create a test task
      const task = createTestKanbanTask(projectId, {
        column: 'backlog'
      })
      const createResponse = await request(app)
        .post(`/api/kanban/${projectId}`)
        .send({
          title: task.title,
          description: task.description,
          column: task.column
        })

      const taskId = createResponse.body.data.id

      // Create a workflow plan first to satisfy foreign key constraint
      const plan = createTestPlan(projectId, {
        name: 'Test Workflow'
      })
      db.prepare('INSERT INTO plans (id, name, tasks, status, user_id) VALUES (?, ?, ?, ?, ?)').run(
        plan.id,
        plan.name,
        plan.tasks,
        plan.status,
        'system'
      )

      // Update pipeline status
      const response = await request(app)
        .patch(`/api/kanban/${projectId}/${taskId}/pipeline`)
        .send({
          pipeline_status: 'running',
          workflow_id: plan.id,
          error_message: 'Test error'
        })
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.pipeline_status).toBe('running')
      expect(response.body.data.workflow_id).toBe(plan.id)
      expect(response.body.data.error_message).toBe('Test error')

      // Clean up plan
      db.prepare('DELETE FROM plans WHERE id = ?').run(plan.id)
    })

    it('should update column field', async () => {
      // Create a test task
      const task = createTestKanbanTask(projectId, {
        column: 'backlog'
      })
      const createResponse = await request(app)
        .post(`/api/kanban/${projectId}`)
        .send({
          title: task.title,
          description: task.description,
          column: task.column
        })

      const taskId = createResponse.body.data.id

      // Update column to done
      const response = await request(app)
        .patch(`/api/kanban/${projectId}/${taskId}/pipeline`)
        .send({
          column: 'done'
        })
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.column).toBe('done')
    })

    it('should update result_status and result_notes fields', async () => {
      // Create a test task
      const task = createTestKanbanTask(projectId, {
        column: 'in_dev'
      })
      const createResponse = await request(app)
        .post(`/api/kanban/${projectId}`)
        .send({
          title: task.title,
          description: task.description,
          column: task.column
        })

      const taskId = createResponse.body.data.id

      // Update result fields
      const response = await request(app)
        .patch(`/api/kanban/${projectId}/${taskId}/pipeline`)
        .send({
          result_status: 'success',
          result_notes: 'Task completed successfully'
        })
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.result_status).toBe('success')
      expect(response.body.data.result_notes).toBe('Task completed successfully')
    })

    it('should update all fields simultaneously', async () => {
      // Create a test task
      const task = createTestKanbanTask(projectId, {
        column: 'in_dev'
      })
      const createResponse = await request(app)
        .post(`/api/kanban/${projectId}`)
        .send({
          title: task.title,
          description: task.description,
          column: task.column
        })

      const taskId = createResponse.body.data.id

      // Create a workflow plan first to satisfy foreign key constraint
      const plan = createTestPlan(projectId, {
        name: 'Test Workflow 2'
      })
      db.prepare('INSERT INTO plans (id, name, tasks, status, user_id) VALUES (?, ?, ?, ?, ?)').run(
        plan.id,
        plan.name,
        plan.tasks,
        plan.status,
        'system'
      )

      // Update all fields
      const response = await request(app)
        .patch(`/api/kanban/${projectId}/${taskId}/pipeline`)
        .send({
          pipeline_status: 'done',
          workflow_id: plan.id,
          error_message: null,
          column: 'done',
          result_status: 'success',
          result_notes: 'All tests passed'
        })
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.pipeline_status).toBe('done')
      expect(response.body.data.workflow_id).toBe(plan.id)
      expect(response.body.data.error_message).toBe('') // COALESCE converts null to empty string
      expect(response.body.data.column).toBe('done')
      expect(response.body.data.result_status).toBe('success')
      expect(response.body.data.result_notes).toBe('All tests passed')

      // Clean up plan
      db.prepare('DELETE FROM plans WHERE id = ?').run(plan.id)
    })

    it('should handle partial updates without errors', async () => {
      // Create a test task
      const task = createTestKanbanTask(projectId, {
        column: 'backlog'
      })
      const createResponse = await request(app)
        .post(`/api/kanban/${projectId}`)
        .send({
          title: task.title,
          description: task.description,
          column: task.column
        })

      const taskId = createResponse.body.data.id

      // Create a workflow plan first to satisfy foreign key constraint
      const plan = createTestPlan(projectId, {
        name: 'Test Workflow 3'
      })
      db.prepare('INSERT INTO plans (id, name, tasks, status, user_id) VALUES (?, ?, ?, ?, ?)').run(
        plan.id,
        plan.name,
        plan.tasks,
        plan.status,
        'system'
      )

      // Set initial values
      await request(app)
        .patch(`/api/kanban/${projectId}/${taskId}/pipeline`)
        .send({
          pipeline_status: 'running',
          workflow_id: plan.id,
          column: 'planning'
        })

      // Update only pipeline_status
      const response = await request(app)
        .patch(`/api/kanban/${projectId}/${taskId}/pipeline`)
        .send({
          pipeline_status: 'done'
        })
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.pipeline_status).toBe('done')
      expect(response.body.data.workflow_id).toBe(plan.id) // Should remain unchanged
      expect(response.body.data.column).toBe('planning') // Should remain unchanged

      // Clean up plan
      db.prepare('DELETE FROM plans WHERE id = ?').run(plan.id)
    })
  })
})
