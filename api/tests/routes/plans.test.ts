/**
 * Plans API Route Tests
 *
 * Tests the plans routes including:
 * - Plan CRUD operations
 * - Plan lifecycle management (pending → running → completed)
 * - Plan log operations
 * - Error handling and validation
 *
 * @testType Integration
 * @category Plans
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import express, { Express } from 'express'
import { db } from '../../src/db/index.js'
import plansRouter from '../../src/routes/plans.js'
import { clearTables } from '../helpers/test-db.js'

/**
 * Mock authentication middleware.
 *
 * This mock bypasses actual authentication and allows all requests to proceed.
 * In a real scenario, this would verify JWT tokens and set user context.
 */
vi.mock('../../src/middleware/auth.js', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { userId: 'system', username: 'daemon' }
    next()
  },
}))

describe('Plans API', () => {
  /** Test Express application with plans router mounted */
  let app: Express

  /**
   * Set up test Express application before all tests.
   *
   * Creates a fresh Express app with:
   * - JSON body parser middleware
   * - Plans router mounted at /api/plans
   */
  beforeAll(() => {
    app = express()
    app.use(express.json())
    app.use('/api/plans', plansRouter)

    // Create system user for foreign key constraints
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get('system')
    if (!existing) {
      db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(
        'system', 'daemon', 'system-hash'
      )
    }
  })

  /**
   * Clear database tables before each test.
   *
   * Ensures each test starts with a clean slate:
   * - No existing plans
   * - No existing plan logs
   *
   * This prevents test pollution and ensures deterministic results.
   */
  beforeEach(() => {
    db.exec('DELETE FROM plan_logs')
    db.exec('DELETE FROM plans')
  })

  /**
   * Clean up database tables after each test.
   *
   * Double-checks that no test data is left behind.
   * Important for test isolation and debugging.
   */
  afterEach(() => {
    db.exec('DELETE FROM plan_logs')
    db.exec('DELETE FROM plans')
  })

  describe('POST /api/plans', () => {
    it('should create a new plan', async () => {
      const response = await request(app)
        .post('/api/plans')
        .send({
          name: 'Test Plan',
          tasks: [
            { id: 'task-1', name: 'Task 1' },
            { id: 'task-2', name: 'Task 2' },
            { id: 'task-3', name: 'Task 3' },
          ],
        })
        .expect(201)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toHaveProperty('id')
      expect(response.body.data.name).toBe('Test Plan')
      expect(response.body.data.tasks).toEqual([
        { id: 'task-1', name: 'Task 1' },
        { id: 'task-2', name: 'Task 2' },
        { id: 'task-3', name: 'Task 3' },
      ])
      expect(response.body.data.status).toBe('pending')
      expect(response.body.data).toHaveProperty('created_at')
    })

    it('should return 400 if name is missing', async () => {
      const response = await request(app)
        .post('/api/plans')
        .send({
          tasks: [{ id: 'task-1', name: 'Task 1' }],
        })
        .expect(400)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('name and tasks are required')
    })

    it('should return 400 if tasks is missing', async () => {
      const response = await request(app)
        .post('/api/plans')
        .send({
          name: 'Test Plan',
        })
        .expect(400)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('name and tasks are required')
    })
  })

  describe('GET /api/plans', () => {
    it('should return empty array when no plans exist', async () => {
      const response = await request(app)
        .get('/api/plans')
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toEqual([])
    })

    it('should return all plans ordered by created_at DESC', async () => {
      // Create three plans
      await request(app)
        .post('/api/plans')
        .send({ name: 'Plan 1', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      await new Promise(resolve => setTimeout(resolve, 10)) // Small delay to ensure different timestamps

      await request(app)
        .post('/api/plans')
        .send({ name: 'Plan 2', tasks: [{ id: 'task-2', name: 'Task 2' }] })

      await new Promise(resolve => setTimeout(resolve, 10))

      await request(app)
        .post('/api/plans')
        .send({ name: 'Plan 3', tasks: [{ id: 'task-3', name: 'Task 3' }] })

      const response = await request(app)
        .get('/api/plans')
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toHaveLength(3)
      expect(response.body.data[0].name).toBe('Plan 3') // Most recent first
      expect(response.body.data[1].name).toBe('Plan 2')
      expect(response.body.data[2].name).toBe('Plan 1')
    })

    it('should filter by status=pending - should return only pending plans', async () => {
      // Create plans with different statuses
      const pendingPlan = await request(app)
        .post('/api/plans')
        .send({ name: 'Pending Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const runningPlan = await request(app)
        .post('/api/plans')
        .send({ name: 'Running Plan', tasks: [{ id: 'task-2', name: 'Task 2' }] })
      await request(app)
        .post(`/api/plans/${runningPlan.body.data.id}/start`)
        .send({ client_id: 'client-123' })

      const successPlan = await request(app)
        .post('/api/plans')
        .send({ name: 'Success Plan', tasks: [{ id: 'task-3', name: 'Task 3' }] })
      await request(app)
        .post(`/api/plans/${successPlan.body.data.id}/start`)
        .send({ client_id: 'client-456' })
      await request(app)
        .post(`/api/plans/${successPlan.body.data.id}/complete`)
        .send({ status: 'success', result: 'Completed successfully' })

      const failedPlan = await request(app)
        .post('/api/plans')
        .send({ name: 'Failed Plan', tasks: [{ id: 'task-4', name: 'Task 4' }] })
      await request(app)
        .post(`/api/plans/${failedPlan.body.data.id}/start`)
        .send({ client_id: 'client-789' })
      await request(app)
        .post(`/api/plans/${failedPlan.body.data.id}/complete`)
        .send({ status: 'failed', result: 'Failed with error' })

      const response = await request(app)
        .get('/api/plans?status=pending')
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].id).toBe(pendingPlan.body.data.id)
      expect(response.body.data[0].status).toBe('pending')
      expect(response.body.data[0].name).toBe('Pending Plan')
    })

    it('should filter by status=running - should return only running plans', async () => {
      // Create plans with different statuses
      await request(app)
        .post('/api/plans')
        .send({ name: 'Pending Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const runningPlan = await request(app)
        .post('/api/plans')
        .send({ name: 'Running Plan', tasks: [{ id: 'task-2', name: 'Task 2' }] })
      await request(app)
        .post(`/api/plans/${runningPlan.body.data.id}/start`)
        .send({ client_id: 'client-123' })

      const successPlan = await request(app)
        .post('/api/plans')
        .send({ name: 'Success Plan', tasks: [{ id: 'task-3', name: 'Task 3' }] })
      await request(app)
        .post(`/api/plans/${successPlan.body.data.id}/start`)
        .send({ client_id: 'client-456' })
      await request(app)
        .post(`/api/plans/${successPlan.body.data.id}/complete`)
        .send({ status: 'success', result: 'Completed successfully' })

      const response = await request(app)
        .get('/api/plans?status=running')
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].id).toBe(runningPlan.body.data.id)
      expect(response.body.data[0].status).toBe('running')
      expect(response.body.data[0].name).toBe('Running Plan')
    })

    it('should filter by status=success - should return only completed plans', async () => {
      // Create plans with different statuses
      await request(app)
        .post('/api/plans')
        .send({ name: 'Pending Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      await request(app)
        .post('/api/plans')
        .send({ name: 'Running Plan', tasks: [{ id: 'task-2', name: 'Task 2' }] })

      const successPlan1 = await request(app)
        .post('/api/plans')
        .send({ name: 'Success Plan 1', tasks: [{ id: 'task-3', name: 'Task 3' }] })
      await request(app)
        .post(`/api/plans/${successPlan1.body.data.id}/start`)
        .send({ client_id: 'client-123' })
      await request(app)
        .post(`/api/plans/${successPlan1.body.data.id}/complete`)
        .send({ status: 'success', result: 'Completed successfully' })

      const successPlan2 = await request(app)
        .post('/api/plans')
        .send({ name: 'Success Plan 2', tasks: [{ id: 'task-4', name: 'Task 4' }] })
      await request(app)
        .post(`/api/plans/${successPlan2.body.data.id}/start`)
        .send({ client_id: 'client-456' })
      await request(app)
        .post(`/api/plans/${successPlan2.body.data.id}/complete`)
        .send({ status: 'success', result: 'Also completed' })

      const response = await request(app)
        .get('/api/plans?status=success')
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toHaveLength(2)
      expect(response.body.data.every(plan => plan.status === 'success')).toBe(true)
      expect(response.body.data.some(plan => plan.name === 'Success Plan 1')).toBe(true)
      expect(response.body.data.some(plan => plan.name === 'Success Plan 2')).toBe(true)
    })

    it('should filter by status=failed - should return only failed plans', async () => {
      // Create plans with different statuses
      await request(app)
        .post('/api/plans')
        .send({ name: 'Pending Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const failedPlan1 = await request(app)
        .post('/api/plans')
        .send({ name: 'Failed Plan 1', tasks: [{ id: 'task-2', name: 'Task 2' }] })
      await request(app)
        .post(`/api/plans/${failedPlan1.body.data.id}/start`)
        .send({ client_id: 'client-123' })
      await request(app)
        .post(`/api/plans/${failedPlan1.body.data.id}/complete`)
        .send({ status: 'failed', result: 'Failed with error' })

      const successPlan = await request(app)
        .post('/api/plans')
        .send({ name: 'Success Plan', tasks: [{ id: 'task-3', name: 'Task 3' }] })
      await request(app)
        .post(`/api/plans/${successPlan.body.data.id}/start`)
        .send({ client_id: 'client-456' })
      await request(app)
        .post(`/api/plans/${successPlan.body.data.id}/complete`)
        .send({ status: 'success', result: 'Completed successfully' })

      const failedPlan2 = await request(app)
        .post('/api/plans')
        .send({ name: 'Failed Plan 2', tasks: [{ id: 'task-4', name: 'Task 4' }] })
      await request(app)
        .post(`/api/plans/${failedPlan2.body.data.id}/start`)
        .send({ client_id: 'client-789' })
      await request(app)
        .post(`/api/plans/${failedPlan2.body.data.id}/complete`)
        .send({ status: 'failed', result: 'Another failure' })

      const response = await request(app)
        .get('/api/plans?status=failed')
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toHaveLength(2)
      expect(response.body.data.every(plan => plan.status === 'failed')).toBe(true)
      expect(response.body.data.some(plan => plan.name === 'Failed Plan 1')).toBe(true)
      expect(response.body.data.some(plan => plan.name === 'Failed Plan 2')).toBe(true)
    })

    it('should combine project_id and status filters - should return plans matching both', async () => {
      // Create plans for different projects with different statuses
      const projectAPending = await request(app)
        .post('/api/plans')
        .send({
          name: 'Project A Pending',
          project_id: 'project-a',
          tasks: [{ id: 'task-1', name: 'Task 1' }]
        })

      const projectARunning = await request(app)
        .post('/api/plans')
        .send({
          name: 'Project A Running',
          project_id: 'project-a',
          tasks: [{ id: 'task-2', name: 'Task 2' }]
        })
      await request(app)
        .post(`/api/plans/${projectARunning.body.data.id}/start`)
        .send({ client_id: 'client-123' })

      const projectBRunning = await request(app)
        .post('/api/plans')
        .send({
          name: 'Project B Running',
          project_id: 'project-b',
          tasks: [{ id: 'task-3', name: 'Task 3' }]
        })
      await request(app)
        .post(`/api/plans/${projectBRunning.body.data.id}/start`)
        .send({ client_id: 'client-456' })

      const projectASuccess = await request(app)
        .post('/api/plans')
        .send({
          name: 'Project A Success',
          project_id: 'project-a',
          tasks: [{ id: 'task-4', name: 'Task 4' }]
        })
      await request(app)
        .post(`/api/plans/${projectASuccess.body.data.id}/start`)
        .send({ client_id: 'client-789' })
      await request(app)
        .post(`/api/plans/${projectASuccess.body.data.id}/complete`)
        .send({ status: 'success', result: 'Completed' })

      // Filter by project-a and running status
      const response = await request(app)
        .get('/api/plans?project_id=project-a&status=running')
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].id).toBe(projectARunning.body.data.id)
      expect(response.body.data[0].project_id).toBe('project-a')
      expect(response.body.data[0].status).toBe('running')
      expect(response.body.data[0].name).toBe('Project A Running')
    })

    it('should return empty array for invalid status value', async () => {
      // Create some plans
      await request(app)
        .post('/api/plans')
        .send({ name: 'Plan 1', tasks: [{ id: 'task-1', name: 'Task 1' }] })
      await request(app)
        .post('/api/plans')
        .send({ name: 'Plan 2', tasks: [{ id: 'task-2', name: 'Task 2' }] })

      const response = await request(app)
        .get('/api/plans?status=invalid_status')
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toEqual([])
    })

    it('should return all plans when no status parameter is provided (backward compatibility)', async () => {
      // Create plans with different statuses
      await request(app)
        .post('/api/plans')
        .send({ name: 'Pending Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const runningPlan = await request(app)
        .post('/api/plans')
        .send({ name: 'Running Plan', tasks: [{ id: 'task-2', name: 'Task 2' }] })
      await request(app)
        .post(`/api/plans/${runningPlan.body.data.id}/start`)
        .send({ client_id: 'client-123' })

      const successPlan = await request(app)
        .post('/api/plans')
        .send({ name: 'Success Plan', tasks: [{ id: 'task-3', name: 'Task 3' }] })
      await request(app)
        .post(`/api/plans/${successPlan.body.data.id}/start`)
        .send({ client_id: 'client-456' })
      await request(app)
        .post(`/api/plans/${successPlan.body.data.id}/complete`)
        .send({ status: 'success', result: 'Completed' })

      const failedPlan = await request(app)
        .post('/api/plans')
        .send({ name: 'Failed Plan', tasks: [{ id: 'task-4', name: 'Task 4' }] })
      await request(app)
        .post(`/api/plans/${failedPlan.body.data.id}/start`)
        .send({ client_id: 'client-789' })
      await request(app)
        .post(`/api/plans/${failedPlan.body.data.id}/complete`)
        .send({ status: 'failed', result: 'Failed' })

      const response = await request(app)
        .get('/api/plans')
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toHaveLength(4)
      expect(response.body.data.some(plan => plan.status === 'pending')).toBe(true)
      expect(response.body.data.some(plan => plan.status === 'running')).toBe(true)
      expect(response.body.data.some(plan => plan.status === 'success')).toBe(true)
      expect(response.body.data.some(plan => plan.status === 'failed')).toBe(true)
    })
  })

  describe('GET /api/plans/pending', () => {
    it('should return only pending plans', async () => {
      // Create a pending plan
      const pendingResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Pending Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = pendingResponse.body.data.id

      // Create another plan and mark it as running
      const runningResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Running Plan', tasks: [{ id: 'task-2', name: 'Task 2' }] })

      await request(app)
        .post(`/api/plans/${runningResponse.body.data.id}/start`)
        .send({ client_id: 'client-123' })

      const response = await request(app)
        .get('/api/plans/pending')
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].id).toBe(planId)
      expect(response.body.data[0].status).toBe('pending')
    })

    it('should return empty array when no pending plans exist', async () => {
      // Create a plan and mark it as running
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      await request(app)
        .post(`/api/plans/${createResponse.body.data.id}/start`)
        .send({ client_id: 'client-123' })

      const response = await request(app)
        .get('/api/plans/pending')
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toEqual([])
    })
  })

  describe('GET /api/plans/:id', () => {
    it('should return plan details with log count', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      // Add some logs
      await request(app)
        .post(`/api/plans/${planId}/logs`)
        .send([
          { task_id: 'task-1', level: 'info', message: 'Starting task' },
          { task_id: 'task-1', level: 'info', message: 'Completed task' },
        ])

      const response = await request(app)
        .get(`/api/plans/${planId}`)
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.id).toBe(planId)
      expect(response.body.data.name).toBe('Test Plan')
      expect(response.body.data.log_count).toBe(2)
    })

    it('should return 404 for non-existent plan', async () => {
      const response = await request(app)
        .get('/api/plans/non-existent-id')
        .expect(404)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toContain('Plan not found')
    })
  })

  describe('POST /api/plans/:id/start', () => {
    it('should start a pending plan', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      const response = await request(app)
        .post(`/api/plans/${planId}/start`)
        .send({ client_id: 'client-123' })
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.status).toBe('running')
      expect(response.body.data.client_id).toBe('client-123')
      expect(response.body.data).toHaveProperty('started_at')
    })

    it('should return 400 if client_id is missing', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      const response = await request(app)
        .post(`/api/plans/${planId}/start`)
        .send({})
        .expect(400)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('client_id is required')
    })

    it('should return 400 if plan is not pending', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      // Start the plan
      await request(app)
        .post(`/api/plans/${planId}/start`)
        .send({ client_id: 'client-123' })

      // Try to start it again
      const response = await request(app)
        .post(`/api/plans/${planId}/start`)
        .send({ client_id: 'client-123' })
        .expect(400)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('Plan is not in pending status')
    })

    it('should return 404 for non-existent plan', async () => {
      const response = await request(app)
        .post('/api/plans/non-existent-id/start')
        .send({ client_id: 'client-123' })
        .expect(404)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('Plan not found')
    })
  })

  describe('POST /api/plans/:id/complete', () => {
    it('should complete a running plan with success', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      // Start the plan
      await request(app)
        .post(`/api/plans/${planId}/start`)
        .send({ client_id: 'client-123' })

      // Complete the plan
      const response = await request(app)
        .post(`/api/plans/${planId}/complete`)
        .send({
          status: 'success',
          result: 'All tasks completed successfully',
        })
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.status).toBe('success')
      expect(response.body.data.result).toBe('All tasks completed successfully')
      expect(response.body.data).toHaveProperty('completed_at')
    })

    it('should complete a running plan with failure', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      // Start the plan
      await request(app)
        .post(`/api/plans/${planId}/start`)
        .send({ client_id: 'client-123' })

      // Complete the plan with failure
      const response = await request(app)
        .post(`/api/plans/${planId}/complete`)
        .send({
          status: 'failed',
          result: 'Task failed with error',
        })
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.status).toBe('failed')
      expect(response.body.data.result).toBe('Task failed with error')
      expect(response.body.data).toHaveProperty('completed_at')
    })

    it('should return 400 if status is missing', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      // Start the plan
      await request(app)
        .post(`/api/plans/${planId}/start`)
        .send({ client_id: 'client-123' })

      const response = await request(app)
        .post(`/api/plans/${planId}/complete`)
        .send({ result: 'Some result' })
        .expect(400)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('status and result are required')
    })

    it('should return 400 if result is missing', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      // Start the plan
      await request(app)
        .post(`/api/plans/${planId}/start`)
        .send({ client_id: 'client-123' })

      const response = await request(app)
        .post(`/api/plans/${planId}/complete`)
        .send({ status: 'success' })
        .expect(400)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('status and result are required')
    })

    it('should return 400 if status is invalid', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      // Start the plan
      await request(app)
        .post(`/api/plans/${planId}/start`)
        .send({ client_id: 'client-123' })

      const response = await request(app)
        .post(`/api/plans/${planId}/complete`)
        .send({
          status: 'invalid',
          result: 'Some result',
        })
        .expect(400)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('status must be success or failed')
    })

    it('should return 400 if plan is not in a completable status', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      const response = await request(app)
        .post(`/api/plans/${planId}/complete`)
        .send({
          status: 'success',
          result: 'Completed',
        })
        .expect(400)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toContain('not in a completable status')
    })
  })

  describe('POST /api/plans/:id/logs', () => {
    it('should append log entries to a plan', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      const logs = [
        { task_id: 'task-1', level: 'info', message: 'Starting task' },
        { task_id: 'task-1', level: 'debug', message: 'Processing data' },
        { task_id: 'task-1', level: 'info', message: 'Completed task' },
      ]

      const response = await request(app)
        .post(`/api/plans/${planId}/logs`)
        .send(logs)
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.inserted).toBe(3)
    })

    it('should return 400 if logs is not an array', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      const response = await request(app)
        .post(`/api/plans/${planId}/logs`)
        .send({ task_id: 'task-1', level: 'info', message: 'Not an array' })
        .expect(400)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('logs must be a non-empty array')
    })

    it('should return 400 if logs array is empty', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      const response = await request(app)
        .post(`/api/plans/${planId}/logs`)
        .send([])
        .expect(400)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('logs must be a non-empty array')
    })

    it('should return 404 for non-existent plan', async () => {
      const logs = [
        { task_id: 'task-1', level: 'info', message: 'Test message' },
      ]

      const response = await request(app)
        .post('/api/plans/non-existent-id/logs')
        .send(logs)
        .expect(404)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('Plan not found')
    })
  })

  describe('GET /api/plans/:id/logs', () => {
    it('should return all logs for a plan ordered by created_at ASC', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      const logs = [
        { task_id: 'task-1', level: 'info', message: 'First log' },
        { task_id: 'task-2', level: 'warn', message: 'Second log' },
        { task_id: 'task-3', level: 'error', message: 'Third log' },
      ]

      await request(app)
        .post(`/api/plans/${planId}/logs`)
        .send(logs)

      const response = await request(app)
        .get(`/api/plans/${planId}/logs`)
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toHaveLength(3)
      expect(response.body.data[0].message).toBe('First log')
      expect(response.body.data[1].message).toBe('Second log')
      expect(response.body.data[2].message).toBe('Third log')
    })

    it('should return empty array when no logs exist', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      const response = await request(app)
        .get(`/api/plans/${planId}/logs`)
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toEqual([])
    })

    it('should return 404 for non-existent plan', async () => {
      const response = await request(app)
        .get('/api/plans/non-existent-id/logs')
        .expect(404)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('Plan not found')
    })
  })

  describe('POST /api/plans/:id/execute - Retry', () => {
    it('should clear old logs when retrying a plan', async () => {
      // Create a plan
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      // Add some logs
      const logs = [
        { task_id: 'task-1', level: 'info', message: 'First log' },
        { task_id: 'task-1', level: 'info', message: 'Second log' },
      ]

      await request(app)
        .post(`/api/plans/${planId}/logs`)
        .send(logs)

      // Mark plan as completed
      await request(app)
        .post(`/api/plans/${planId}/complete`)
        .send({ status: 'success', result: 'Completed' })

      // Verify logs exist
      const logsBefore = await request(app)
        .get(`/api/plans/${planId}/logs`)
        .expect(200)

      expect(logsBefore.body.data).toHaveLength(2)

      // Execute (retry) the plan
      await request(app)
        .post(`/api/plans/${planId}/execute`)
        .expect(200)

      // Verify old logs were cleared (only the execute log remains)
      const logsAfter = await request(app)
        .get(`/api/plans/${planId}/logs`)
        .expect(200)

      expect(logsAfter.body.data).toHaveLength(1)
      expect(logsAfter.body.data[0].message).toContain('re-executed')
    })

    it('should reset plan status to pending when retrying', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      // Mark plan as completed
      await request(app)
        .post(`/api/plans/${planId}/complete`)
        .send({ status: 'success', result: 'Completed' })

      // Execute (retry) the plan
      const response = await request(app)
        .post(`/api/plans/${planId}/execute`)
        .expect(200)

      expect(response.body.data.status).toBe('pending')
      expect(response.body.data.started_at).toBeNull()
      expect(response.body.data.completed_at).toBeNull()
      expect(response.body.data.result).toBeNull()
    })
  })

  describe('POST /api/plans/:id/resume - Resume', () => {
    it('should keep old logs when resuming a plan', async () => {
      // Create a plan
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      // Add some logs
      const logs = [
        { task_id: 'task-1', level: 'info', message: 'First log' },
        { task_id: 'task-1', level: 'info', message: 'Second log' },
      ]

      await request(app)
        .post(`/api/plans/${planId}/logs`)
        .send(logs)

      // Mark plan as completed
      await request(app)
        .post(`/api/plans/${planId}/complete`)
        .send({ status: 'success', result: 'Completed' })

      // Verify logs exist
      const logsBefore = await request(app)
        .get(`/api/plans/${planId}/logs`)
        .expect(200)

      expect(logsBefore.body.data).toHaveLength(2)

      // Resume the plan
      await request(app)
        .post(`/api/plans/${planId}/resume`)
        .expect(200)

      // Verify old logs were kept (original logs + resume log)
      const logsAfter = await request(app)
        .get(`/api/plans/${planId}/logs`)
        .expect(200)

      expect(logsAfter.body.data).toHaveLength(3)
      expect(logsAfter.body.data[0].message).toContain('resumed')
      expect(logsAfter.body.data[1].message).toBe('First log')
      expect(logsAfter.body.data[2].message).toBe('Second log')
    })

    it('should keep started_at when resuming a plan', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      // Mark plan as completed
      await request(app)
        .post(`/api/plans/${planId}/complete`)
        .send({ status: 'success', result: 'Completed' })

      // Get the plan to check started_at
      const planBefore = await request(app)
        .get(`/api/plans/${planId}`)
        .expect(200)

      const startedAt = planBefore.body.data.started_at

      // Resume the plan
      const response = await request(app)
        .post(`/api/plans/${planId}/resume`)
        .expect(200)

      expect(response.body.data.status).toBe('pending')
      expect(response.body.data.started_at).toBe(startedAt) // started_at is preserved
      expect(response.body.data.completed_at).toBeNull()
      expect(response.body.data.result).toBeNull()
    })
  })

  describe('Race Condition Handling', () => {
    it('should allow completing a plan that was marked as failed', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      // Start the plan
      await request(app)
        .post(`/api/plans/${planId}/start`)
        .send({ client_id: 'client-123' })

      // Simulate the API marking it as failed (e.g., by recoverStuckPlans)
      await request(app)
        .post(`/api/plans/${planId}/complete`)
        .send({
          status: 'failed',
          result: 'Plan timed out',
        })

      const failedPlan = await request(app)
        .get(`/api/plans/${planId}`)
        .expect(200)

      expect(failedPlan.body.data.status).toBe('failed')

      // Daemon completes the plan successfully after timeout
      const response = await request(app)
        .post(`/api/plans/${planId}/complete`)
        .send({
          status: 'success',
          result: 'All tasks completed successfully',
          daemon_completed_at: new Date().toISOString(),
        })
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.status).toBe('success')
      expect(response.body.data.result).toBe('All tasks completed successfully')
      expect(response.body.data).toHaveProperty('completed_at')
    })

    it('should allow completing a plan with completing status', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      // Start the plan
      await request(app)
        .post(`/api/plans/${planId}/start`)
        .send({ client_id: 'client-123' })

      // Manually set status to 'completing' (simulating transitional state)
      db.prepare('UPDATE plans SET status = ? WHERE id = ?').run('completing', planId)

      // Complete the plan from completing state
      const response = await request(app)
        .post(`/api/plans/${planId}/complete`)
        .send({
          status: 'success',
          result: 'All tasks completed successfully',
          daemon_completed_at: new Date().toISOString(),
        })
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.status).toBe('success')
      expect(response.body.data.result).toBe('All tasks completed successfully')
      expect(response.body.data).toHaveProperty('completed_at')
    })

    it('should reject completion for non-completable statuses', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      // Try to complete a plan that is pending (not started)
      const response = await request(app)
        .post(`/api/plans/${planId}/complete`)
        .send({
          status: 'success',
          result: 'All tasks completed successfully',
        })
        .expect(400)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toContain('not in a completable status')
    })
  })

  describe('Heartbeat', () => {
    it('should update heartbeat timestamp for a running plan', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      // Start the plan
      await request(app)
        .post(`/api/plans/${planId}/start`)
        .send({ client_id: 'test-daemon' })
        .expect(200)

      // Send heartbeat
      const heartbeatResponse = await request(app)
        .post(`/api/plans/${planId}/heartbeat`)
        .expect(200)

      expect(heartbeatResponse.body.data).toHaveProperty('heartbeat_at')
      expect(heartbeatResponse.body.error).toBeNull()

      // Verify heartbeat was saved
      const planResponse = await request(app)
        .get(`/api/plans/${planId}`)
        .expect(200)

      expect(planResponse.body.data.last_heartbeat_at).toBe(heartbeatResponse.body.data.heartbeat_at)
    })

    it('should reject heartbeat for non-running plans', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      // Try to send heartbeat for pending plan
      const response = await request(app)
        .post(`/api/plans/${planId}/heartbeat`)
        .expect(400)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toContain('not running')
    })

    it('should update heartbeat multiple times', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Test Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      // Start the plan
      await request(app)
        .post(`/api/plans/${planId}/start`)
        .send({ client_id: 'test-daemon' })
        .expect(200)

      // Send first heartbeat
      const firstHeartbeat = await request(app)
        .post(`/api/plans/${planId}/heartbeat`)
        .expect(200)

      const firstTimestamp = firstHeartbeat.body.data.heartbeat_at

      // Wait a bit and send second heartbeat
      await new Promise(resolve => setTimeout(resolve, 10))

      const secondHeartbeat = await request(app)
        .post(`/api/plans/${planId}/heartbeat`)
        .expect(200)

      const secondTimestamp = secondHeartbeat.body.data.heartbeat_at

      // Verify timestamps are different
      expect(secondTimestamp).not.toBe(firstTimestamp)
      expect(new Date(secondTimestamp).getTime()).toBeGreaterThan(new Date(firstTimestamp).getTime())
    })
  })

  describe('GET /api/plans/approaching-timeout', () => {
    it('should return plans approaching timeout (80% threshold)', async () => {
      // Create and start a plan
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Long Running Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      await request(app)
        .post(`/api/plans/${planId}/start`)
        .send({ client_id: 'test-daemon' })
        .expect(200)

      // Manually set started_at to simulate an old plan (96 minutes ago for 120 min timeout)
      const ninetySixMinutesAgo = new Date(Date.now() - 96 * 60 * 1000).toISOString()
      db.prepare('UPDATE plans SET started_at = ? WHERE id = ?').run(ninetySixMinutesAgo, planId)

      // Get approaching timeout plans
      const response = await request(app)
        .get('/api/plans/approaching-timeout')
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toHaveProperty('count')
      expect(response.body.data).toHaveProperty('plans')
      expect(response.body.data.count).toBeGreaterThanOrEqual(1)

      // Verify the plan is in the list
      const plan = response.body.data.plans.find((p: any) => p.id === planId)
      expect(plan).toBeDefined()
      expect(plan.name).toBe('Long Running Plan')
      expect(plan.minutes_running).toBeGreaterThan(95)
      expect(plan.timeout_in_minutes).toBeLessThanOrEqual(25)
    })

    it('should not return plans that are not approaching timeout', async () => {
      // Create and start a plan
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Fresh Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      await request(app)
        .post(`/api/plans/${planId}/start`)
        .send({ client_id: 'test-daemon' })
        .expect(200)

      // Get approaching timeout plans
      const response = await request(app)
        .get('/api/plans/approaching-timeout')
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.count).toBe(0)
      expect(response.body.data.plans).toEqual([])
    })

    it('should only include running plans', async () => {
      // Create and start a plan
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Old Running Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      await request(app)
        .post(`/api/plans/${planId}/start`)
        .send({ client_id: 'test-daemon' })
        .expect(200)

      // Complete the plan
      await request(app)
        .post(`/api/plans/${planId}/complete`)
        .send({ status: 'success', result: 'Completed' })

      // Manually set started_at to simulate an old plan
      const ninetySixMinutesAgo = new Date(Date.now() - 96 * 60 * 1000).toISOString()
      db.prepare('UPDATE plans SET started_at = ? WHERE id = ?').run(ninetySixMinutesAgo, planId)

      // Get approaching timeout plans
      const response = await request(app)
        .get('/api/plans/approaching-timeout')
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.count).toBe(0)
      expect(response.body.data.plans).toEqual([])
    })

    it('should order plans by started_at (oldest first)', async () => {
      // Create multiple plans with different start times
      const plan1Response = await request(app)
        .post('/api/plans')
        .send({ name: 'Oldest Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const plan2Response = await request(app)
        .post('/api/plans')
        .send({ name: 'Newest Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const plan1Id = plan1Response.body.data.id
      const plan2Id = plan2Response.body.data.id

      // Start both plans
      await request(app)
        .post(`/api/plans/${plan1Id}/start`)
        .send({ client_id: 'test-daemon' })

      await request(app)
        .post(`/api/plans/${plan2Id}/start`)
        .send({ client_id: 'test-daemon' })

      // Set different start times (plan1 older than plan2)
      const hundredMinutesAgo = new Date(Date.now() - 100 * 60 * 1000).toISOString()
      const ninetySixMinutesAgo = new Date(Date.now() - 96 * 60 * 1000).toISOString()

      db.prepare('UPDATE plans SET started_at = ? WHERE id = ?').run(hundredMinutesAgo, plan1Id)
      db.prepare('UPDATE plans SET started_at = ? WHERE id = ?').run(ninetySixMinutesAgo, plan2Id)

      // Get approaching timeout plans
      const response = await request(app)
        .get('/api/plans/approaching-timeout')
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.plans).toHaveLength(2)

      // Verify ordering (oldest first)
      expect(response.body.data.plans[0].id).toBe(plan1Id)
      expect(response.body.data.plans[1].id).toBe(plan2Id)
    })
  })

  describe('recoverStuckPlans function', () => {
    it('should recover plans without heartbeats that exceed timeout', async () => {
      // Create and start a plan
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Stuck Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      await request(app)
        .post(`/api/plans/${planId}/start`)
        .send({ client_id: 'test-daemon' })
        .expect(200)

      // Set started_at to exceed timeout (130 minutes ago for 120 min timeout)
      const hundredThirtyMinutesAgo = new Date(Date.now() - 130 * 60 * 1000).toISOString()
      db.prepare('UPDATE plans SET started_at = ? WHERE id = ?').run(hundredThirtyMinutesAgo, planId)

      // Import and run recoverStuckPlans
      const { recoverStuckPlans } = await import('../../src/routes/plans.js')
      const result = recoverStuckPlans(db)

      expect(result.recovered).toBe(1)
      expect(result.plans).toHaveLength(1)
      expect(result.plans[0].id).toBe(planId)
      expect(result.plans[0].name).toBe('Stuck Plan')
      expect(result.plans[0].minutes_running).toBeGreaterThan(129)

      // Verify plan was marked as failed
      const planResponse = await request(app)
        .get(`/api/plans/${planId}`)
        .expect(200)

      expect(planResponse.body.data.status).toBe('failed')
      expect(planResponse.body.data.result).toContain('timed out')
    })

    it('should use last_heartbeat_at when available', async () => {
      // Create and start a plan
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Plan With Heartbeat', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      await request(app)
        .post(`/api/plans/${planId}/start`)
        .send({ client_id: 'test-daemon' })
        .expect(200)

      // Set started_at to be recent (5 minutes ago)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      db.prepare('UPDATE plans SET started_at = ? WHERE id = ?').run(fiveMinutesAgo, planId)

      // Set last_heartbeat_at to be old (130 minutes ago)
      const hundredThirtyMinutesAgo = new Date(Date.now() - 130 * 60 * 1000).toISOString()
      db.prepare('UPDATE plans SET last_heartbeat_at = ? WHERE id = ?').run(hundredThirtyMinutesAgo, planId)

      // Import and run recoverStuckPlans
      const { recoverStuckPlans } = await import('../../src/routes/plans.js')
      const result = recoverStuckPlans(db)

      // Plan should be recovered based on last_heartbeat_at
      expect(result.recovered).toBe(1)
      expect(result.plans).toHaveLength(1)
      expect(result.plans[0].id).toBe(planId)
    })

    it('should not recover plans with recent heartbeats', async () => {
      // Create and start a plan
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Active Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      await request(app)
        .post(`/api/plans/${planId}/start`)
        .send({ client_id: 'test-daemon' })
        .expect(200)

      // Set started_at to be old (130 minutes ago)
      const hundredThirtyMinutesAgo = new Date(Date.now() - 130 * 60 * 1000).toISOString()
      db.prepare('UPDATE plans SET started_at = ? WHERE id = ?').run(hundredThirtyMinutesAgo, planId)

      // Set last_heartbeat_at to be recent (5 minutes ago)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      db.prepare('UPDATE plans SET last_heartbeat_at = ? WHERE id = ?').run(fiveMinutesAgo, planId)

      // Import and run recoverStuckPlans
      const { recoverStuckPlans } = await import('../../src/routes/plans.js')
      const result = recoverStuckPlans(db)

      // Plan should NOT be recovered because heartbeat is recent
      expect(result.recovered).toBe(0)
      expect(result.plans).toHaveLength(0)

      // Verify plan is still running
      const planResponse = await request(app)
        .get(`/api/plans/${planId}`)
        .expect(200)

      expect(planResponse.body.data.status).toBe('running')
    })

    it('should not recover plans that have not exceeded timeout', async () => {
      // Create and start a plan
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ name: 'Recent Plan', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const planId = createResponse.body.data.id

      await request(app)
        .post(`/api/plans/${planId}/start`)
        .send({ client_id: 'test-daemon' })
        .expect(200)

      // Set started_at to be recent (60 minutes ago, less than 120 min timeout)
      const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      db.prepare('UPDATE plans SET started_at = ? WHERE id = ?').run(sixtyMinutesAgo, planId)

      // Import and run recoverStuckPlans
      const { recoverStuckPlans } = await import('../../src/routes/plans.js')
      const result = recoverStuckPlans(db)

      // Plan should NOT be recovered
      expect(result.recovered).toBe(0)
      expect(result.plans).toHaveLength(0)

      // Verify plan is still running
      const planResponse = await request(app)
        .get(`/api/plans/${planId}`)
        .expect(200)

      expect(planResponse.body.data.status).toBe('running')
    })

    it('should return detailed metrics for recovered plans', async () => {
      // Create and start multiple stuck plans
      const plan1Response = await request(app)
        .post('/api/plans')
        .send({ name: 'Stuck Plan 1', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const plan2Response = await request(app)
        .post('/api/plans')
        .send({ name: 'Stuck Plan 2', tasks: [{ id: 'task-1', name: 'Task 1' }] })

      const plan1Id = plan1Response.body.data.id
      const plan2Id = plan2Response.body.data.id

      // Start both plans
      await request(app)
        .post(`/api/plans/${plan1Id}/start`)
        .send({ client_id: 'test-daemon' })

      await request(app)
        .post(`/api/plans/${plan2Id}/start`)
        .send({ client_id: 'test-daemon' })

      // Set both plans to be stuck
      const hundredThirtyMinutesAgo = new Date(Date.now() - 130 * 60 * 1000).toISOString()
      db.prepare('UPDATE plans SET started_at = ? WHERE id = ?').run(hundredThirtyMinutesAgo, plan1Id)
      db.prepare('UPDATE plans SET started_at = ? WHERE id = ?').run(hundredThirtyMinutesAgo, plan2Id)

      // Import and run recoverStuckPlans
      const { recoverStuckPlans } = await import('../../src/routes/plans.js')
      const result = recoverStuckPlans(db)

      expect(result.recovered).toBe(2)
      expect(result.plans).toHaveLength(2)

      // Verify plan details
      expect(result.plans[0]).toHaveProperty('id')
      expect(result.plans[0]).toHaveProperty('name')
      expect(result.plans[0]).toHaveProperty('started_at')
      expect(result.plans[0]).toHaveProperty('minutes_running')
      expect(result.plans[0].minutes_running).toBeGreaterThan(129)
    })
  })
})
