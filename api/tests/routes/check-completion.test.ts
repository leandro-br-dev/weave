/**
 * Check Completion API Endpoint Tests
 *
 * Tests the POST /api/plans/:id/check-completion endpoint including:
 * - Task completion detection via log patterns
 * - Auto-completion when all tasks finish
 * - Handling of various completion log patterns
 * - Edge cases (no tasks, non-existent tasks, etc.)
 *
 * @testType Integration
 * @category Plans
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import express, { Express } from 'express'
import { db } from '../../src/db/index.js'
import plansRouter from '../../src/routes/plans.js'
import { createTestPlan } from '../helpers/test-db.js'

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

describe('POST /api/plans/:id/check-completion', () => {
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
   * Ensures each test starts with a clean slate.
   */
  beforeEach(() => {
    db.exec('DELETE FROM plan_logs')
    db.exec('DELETE FROM plans')
  })

  /**
   * Clean up database tables after each test.
   */
  afterEach(() => {
    db.exec('DELETE FROM plan_logs')
    db.exec('DELETE FROM plans')
  })

  it('should detect that no tasks are completed', async () => {
    const planId = createTestPlan({
      name: 'Test Plan',
      tasks: JSON.stringify([
        { id: 'task-1', content: 'Task 1' },
        { id: 'task-2', content: 'Task 2' },
        { id: 'task-3', content: 'Task 3' }
      ]),
      status: 'running'
    })

    const response = await request(app)
      .post('/api/plans/' + planId + '/check-completion')
      .expect(200)

    expect(response.body.error).toBeNull()
    expect(response.body.data.completed).toBe(false)
    expect(response.body.data.total_tasks).toBe(3)
    expect(response.body.data.completed_tasks).toBe(0)
    expect(response.body.data.pending_tasks).toBe(3)
    expect(response.body.data.completed_task_ids).toEqual([])
  })

  it('should detect that some tasks are completed', async () => {
    const planId = createTestPlan({
      name: 'Test Plan',
      tasks: JSON.stringify([
        { id: 'task-1', content: 'Task 1' },
        { id: 'task-2', content: 'Task 2' },
        { id: 'task-3', content: 'Task 3' }
      ]),
      status: 'running'
    })

    // Add completion logs for task-1 and task-2
    db.prepare(
      'INSERT INTO plan_logs (plan_id, task_id, level, message, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))'
    ).run(planId, 'task-1', 'info', '✔ finished — end_turn')
    db.prepare(
      'INSERT INTO plan_logs (plan_id, task_id, level, message, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))'
    ).run(planId, 'task-2', 'info', 'Task completed successfully')

    const response = await request(app)
      .post('/api/plans/' + planId + '/check-completion')
      .expect(200)

    expect(response.body.error).toBeNull()
    expect(response.body.data.completed).toBe(false)
    expect(response.body.data.total_tasks).toBe(3)
    expect(response.body.data.completed_tasks).toBe(2)
    expect(response.body.data.pending_tasks).toBe(1)
    expect(response.body.data.completed_task_ids).toContain('task-1')
    expect(response.body.data.completed_task_ids).toContain('task-2')
    expect(response.body.data.completed_task_ids).not.toContain('task-3')
  })

  it('should detect that all tasks are completed but not auto-complete if not running', async () => {
    const planId = createTestPlan({
      name: 'Test Plan',
      tasks: JSON.stringify([
        { id: 'task-1', content: 'Task 1' },
        { id: 'task-2', content: 'Task 2' }
      ]),
      status: 'pending'
    })

    // Add completion logs for all tasks
    db.prepare(
      'INSERT INTO plan_logs (plan_id, task_id, level, message, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))'
    ).run(planId, 'task-1', 'info', '✔ finished — end_turn')
    db.prepare(
      'INSERT INTO plan_logs (plan_id, task_id, level, message, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))'
    ).run(planId, 'task-2', 'success', 'Task completed')

    const response = await request(app)
      .post('/api/plans/' + planId + '/check-completion')
      .expect(200)

    expect(response.body.error).toBeNull()
    expect(response.body.data.completed).toBe(true)
    expect(response.body.data.total_tasks).toBe(2)
    expect(response.body.data.completed_tasks).toBe(2)
    expect(response.body.data.auto_completed).toBe(false) // Not running, so no auto-complete
    expect(response.body.data.plan_status).toBe('pending')
  })

  it('should auto-complete plan when all tasks finished and status is running', async () => {
    const planId = createTestPlan({
      name: 'Test Plan',
      tasks: JSON.stringify([
        { id: 'task-1', content: 'Task 1' },
        { id: 'task-2', content: 'Task 2' }
      ]),
      status: 'running'
    })

    // Add completion logs for all tasks
    db.prepare(
      'INSERT INTO plan_logs (plan_id, task_id, level, message, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))'
    ).run(planId, 'task-1', 'info', '✔ finished — end_turn')
    db.prepare(
      'INSERT INTO plan_logs (plan_id, task_id, level, message, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))'
    ).run(planId, 'task-2', 'info', '✔ finished — tool_use')

    const response = await request(app)
      .post('/api/plans/' + planId + '/check-completion')
      .expect(200)

    expect(response.body.error).toBeNull()
    expect(response.body.data.completed).toBe(true)
    expect(response.body.data.total_tasks).toBe(2)
    expect(response.body.data.completed_tasks).toBe(2)
    expect(response.body.data.auto_completed).toBe(true)
    expect(response.body.data.plan_status).toBe('success')

    // Verify the plan was actually updated in the database
    const updatedPlan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId) as any
    expect(updatedPlan.status).toBe('success')
    expect(updatedPlan.result).toBe('All tasks completed successfully')
    expect(updatedPlan.completed_at).not.toBeNull()

    // Verify a log entry was added for auto-completion
    const logs = db.prepare(
      'SELECT * FROM plan_logs WHERE plan_id = ? AND task_id = \'system\' ORDER BY created_at DESC'
    ).all(planId) as any[]
    expect(logs.length).toBeGreaterThan(0)
    expect(logs[0].message).toContain('All tasks completed - automatically marked as success')
  })

  it('should recognize success level as completion', async () => {
    const planId = createTestPlan({
      name: 'Test Plan',
      tasks: JSON.stringify([
        { id: 'task-1', content: 'Task 1' }
      ]),
      status: 'running'
    })

    // Add a success-level log
    db.prepare(
      'INSERT INTO plan_logs (plan_id, task_id, level, message, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))'
    ).run(planId, 'task-1', 'success', 'Operation completed')

    const response = await request(app)
      .post('/api/plans/' + planId + '/check-completion')
      .expect(200)

    expect(response.body.error).toBeNull()
    expect(response.body.data.completed).toBe(true)
    expect(response.body.data.auto_completed).toBe(true)
    expect(response.body.data.plan_status).toBe('success')
  })

  it('should return 404 for non-existent plan', async () => {
    const response = await request(app)
      .post('/api/plans/non-existent-id/check-completion')
      .expect(404)

    expect(response.body.error).toContain('Plan not found')
  })

  it('should handle plan with no tasks', async () => {
    const planId = createTestPlan({
      name: 'Empty Plan',
      tasks: JSON.stringify([]),
      status: 'running'
    })

    const response = await request(app)
      .post('/api/plans/' + planId + '/check-completion')
      .expect(200)

    expect(response.body.error).toBeNull()
    expect(response.body.data.completed).toBe(false)
    expect(response.body.data.total_tasks).toBe(0)
    expect(response.body.data.message).toBe('Plan has no tasks')
  })

  it('should ignore completion logs for non-existent tasks', async () => {
    const planId = createTestPlan({
      name: 'Test Plan',
      tasks: JSON.stringify([
        { id: 'task-1', content: 'Task 1' }
      ]),
      status: 'running'
    })

    // Add completion logs for a task that doesn't exist in the plan
    db.prepare(
      'INSERT INTO plan_logs (plan_id, task_id, level, message, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))'
    ).run(planId, 'ghost-task', 'info', '✔ finished — end_turn')

    const response = await request(app)
      .post('/api/plans/' + planId + '/check-completion')
      .expect(200)

    expect(response.body.error).toBeNull()
    expect(response.body.data.completed).toBe(false)
    expect(response.body.data.total_tasks).toBe(1)
    expect(response.body.data.completed_tasks).toBe(0)
  })

  it('should recognize both "✔ finished" and "Task completed" patterns', async () => {
    const planId = createTestPlan({
      name: 'Test Plan',
      tasks: JSON.stringify([
        { id: 'task-1', content: 'Task 1' },
        { id: 'task-2', content: 'Task 2' }
      ]),
      status: 'running'
    })

    // Add different completion patterns
    db.prepare(
      'INSERT INTO plan_logs (plan_id, task_id, level, message, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))'
    ).run(planId, 'task-1', 'info', '✔ finished — end_turn')
    db.prepare(
      'INSERT INTO plan_logs (plan_id, task_id, level, message, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))'
    ).run(planId, 'task-2', 'info', 'Task completed with some result')

    const response = await request(app)
      .post('/api/plans/' + planId + '/check-completion')
      .expect(200)

    expect(response.body.error).toBeNull()
    expect(response.body.data.completed).toBe(true)
    expect(response.body.data.auto_completed).toBe(true)
  })
})
