/**
 * Kanban Auto-Move Integration Tests
 *
 * Tests the kanban auto-move endpoint with various scenarios
 * for automated task movement between columns
 *
 * @testType Integration
 * @category Kanban
 * @tags auto-move, kanban
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express, { Express } from 'express'
import { db } from '../../../api/src/db/index.js'
import kanbanRouter from '../../../api/src/routes/kanban.js'
import plansRouter from '../../../api/src/routes/plans.js'
import {
  createTestProject,
  createTestKanbanTask,
  createTestPlan,
  generateTestId,
  apiResponse
} from '../test-data-factory.js'

// Mock authentication
const mockAuth = (req: any, res: any, next: any) => {
  req.headers['authorization'] = 'Bearer dev-token-change-in-production'
  next()
}

describe('Kanban Auto-Move Endpoint', () => {
  let app: Express
  let testProject: any

  beforeAll(() => {
    // Create test Express app
    app = express()
    app.use(express.json())
    app.use((req: any, res: any, next: any) => {
      // Mock auth middleware
      req.headers['authorization'] = 'Bearer dev-token-change-in-production'
      next()
    })
    app.use('/api/kanban', kanbanRouter)
    app.use('/api/plans', plansRouter)

    // Create test project
    testProject = createTestProject()
    db.prepare('INSERT INTO projects (id, name, description) VALUES (?, ?, ?)').run(
      testProject.id,
      testProject.name,
      testProject.description
    )
  })

  beforeEach(() => {
    // Clear tables before each test
    db.prepare('DELETE FROM kanban_tasks WHERE project_id = ?').run(testProject.id)
    db.prepare('DELETE FROM plans WHERE project_id = ?').run(testProject.id)
  })

  afterEach(() => {
    // Clean up after each test
    db.prepare('DELETE FROM kanban_tasks WHERE project_id = ?').run(testProject.id)
    db.prepare('DELETE FROM plans WHERE project_id = ?').run(testProject.id)
  })

  afterAll(() => {
    // Clean up test project
    db.prepare('DELETE FROM projects WHERE id = ?').run(testProject.id)
  })

  async function createKanbanTask(taskData: any) {
    const response = await request(app)
      .post(`/api/kanban/${testProject.id}`)
      .send(taskData)
    return response
  }

  async function callAutoMove() {
    const response = await request(app)
      .post(`/api/kanban/${testProject.id}/auto-move`)
    return response
  }

  describe('Scenario 1: Backlog → Planning (planning column empty)', () => {
    it('should move highest priority task from backlog to planning', async () => {
      // Create tasks in backlog with different priorities
      await createKanbanTask({
        title: 'Low priority task',
        column: 'backlog',
        priority: 5
      })
      await createKanbanTask({
        title: 'Critical task',
        column: 'backlog',
        priority: 1
      })
      await createKanbanTask({
        title: 'Medium priority task',
        column: 'backlog',
        priority: 3
      })

      // Verify initial state
      const initialTasks = await request(app).get(`/api/kanban/${testProject.id}`)
      const backlogTasks = initialTasks.body.data.filter((t: any) => t.column === 'backlog')
      const planningTasks = initialTasks.body.data.filter((t: any) => t.column === 'planning')
      expect(planningTasks.length).toBe(0)
      expect(backlogTasks.length).toBe(3)

      // Call auto-move
      const moveResult = await callAutoMove()
      expect(moveResult.status).toBe(200)
      expect(moveResult.body.moved_tasks.length).toBe(1)

      // Verify results
      const afterTasks = await request(app).get(`/api/kanban/${testProject.id}`)
      const newBacklogTasks = afterTasks.body.data.filter((t: any) => t.column === 'backlog')
      const newPlanningTasks = afterTasks.body.data.filter((t: any) => t.column === 'planning')

      expect(newPlanningTasks.length).toBe(1)
      expect(newPlanningTasks[0].priority).toBe(1)
      expect(newPlanningTasks[0].title).toBe('Critical task')
      expect(newBacklogTasks.length).toBe(2)
    })
  })

  describe('Scenario 2: Planning → In Progress (in_progress empty, planning has workflow_id)', () => {
    it('should move task with workflow_id from planning to in_progress', async () => {
      // Create a plan to use as workflow_id
      const plan = createTestPlan(testProject.id, {
        name: 'Test Workflow',
        tasks: 'Task 1'
      })
      db.prepare('INSERT INTO plans (id, name, tasks, status) VALUES (?, ?, ?, ?)').run(
        plan.id,
        plan.name,
        plan.tasks,
        plan.status
      )

      // Create a task in planning with workflow_id
      const taskResponse = await createKanbanTask({
        title: 'Task with workflow',
        column: 'planning',
        priority: 2
      })

      const taskId = taskResponse.body.data.id

      // Update the task to have workflow_id
      await request(app)
        .patch(`/api/kanban/${testProject.id}/${taskId}/pipeline`)
        .send({
          workflow_id: plan.id
        })

      // Verify initial state
      const initialTasks = await request(app).get(`/api/kanban/${testProject.id}`)
      const planningTasks = initialTasks.body.data.filter((t: any) => t.column === 'planning')
      const inProgressTasks = initialTasks.body.data.filter((t: any) => t.column === 'in_progress')
      expect(inProgressTasks.length).toBe(0)
      expect(planningTasks.length).toBe(1)

      // Call auto-move
      const moveResult = await callAutoMove()
      expect(moveResult.status).toBe(200)
      expect(moveResult.body.moved_tasks.length).toBe(1)

      // Verify results
      const afterTasks = await request(app).get(`/api/kanban/${testProject.id}`)
      const newPlanningTasks = afterTasks.body.data.filter((t: any) => t.column === 'planning')
      const newInProgressTasks = afterTasks.body.data.filter((t: any) => t.column === 'in_progress')

      expect(newInProgressTasks.length).toBe(1)
      expect(newInProgressTasks[0].workflow_id).toBe(plan.id)
      expect(newPlanningTasks.length).toBe(0)

      // Clean up plan
      db.prepare('DELETE FROM plans WHERE id = ?').run(plan.id)
    })
  })

  describe('Scenario 3: No moves (planning not empty, in_progress not empty)', () => {
    it('should not move any tasks when conditions not met', async () => {
      // Create tasks in both planning and in_progress
      await createKanbanTask({
        title: 'Planning task',
        column: 'planning',
        priority: 2
      })
      await createKanbanTask({
        title: 'In progress task',
        column: 'in_progress',
        priority: 2
      })
      await createKanbanTask({
        title: 'Backlog task',
        column: 'backlog',
        priority: 1
      })

      // Verify initial state
      const initialTasks = await request(app).get(`/api/kanban/${testProject.id}`)
      const backlogTasks = initialTasks.body.data.filter((t: any) => t.column === 'backlog')
      const planningTasks = initialTasks.body.data.filter((t: any) => t.column === 'planning')
      const inProgressTasks = initialTasks.body.data.filter((t: any) => t.column === 'in_progress')
      expect(backlogTasks.length).toBe(1)
      expect(planningTasks.length).toBe(1)
      expect(inProgressTasks.length).toBe(1)

      // Call auto-move
      const moveResult = await callAutoMove()
      expect(moveResult.status).toBe(200)
      expect(moveResult.body.moved_tasks.length).toBe(0)
      expect(moveResult.body.reasons.length).toBe(0)

      // Verify state unchanged
      const afterTasks = await request(app).get(`/api/kanban/${testProject.id}`)
      const newBacklogTasks = afterTasks.body.data.filter((t: any) => t.column === 'backlog')
      const newPlanningTasks = afterTasks.body.data.filter((t: any) => t.column === 'planning')
      const newInProgressTasks = afterTasks.body.data.filter((t: any) => t.column === 'in_progress')

      expect(newBacklogTasks.length).toBe(backlogTasks.length)
      expect(newPlanningTasks.length).toBe(planningTasks.length)
      expect(newInProgressTasks.length).toBe(inProgressTasks.length)
    })
  })

  describe('Scenario 4: Planning → In Progress (no task with workflow_id)', () => {
    it('should not move task without workflow_id', async () => {
      // Create a task in planning WITHOUT workflow_id
      await createKanbanTask({
        title: 'Planning task without workflow',
        column: 'planning',
        priority: 2
      })

      // Verify initial state
      const initialTasks = await request(app).get(`/api/kanban/${testProject.id}`)
      const planningTasks = initialTasks.body.data.filter((t: any) => t.column === 'planning')
      const inProgressTasks = initialTasks.body.data.filter((t: any) => t.column === 'in_progress')
      expect(inProgressTasks.length).toBe(0)
      expect(planningTasks.length).toBe(1)

      // Call auto-move
      const moveResult = await callAutoMove()
      expect(moveResult.status).toBe(200)
      expect(moveResult.body.moved_tasks.length).toBe(0)

      // Verify no tasks were moved
      const afterTasks = await request(app).get(`/api/kanban/${testProject.id}`)
      const newPlanningTasks = afterTasks.body.data.filter((t: any) => t.column === 'planning')
      const newInProgressTasks = afterTasks.body.data.filter((t: any) => t.column === 'in_progress')

      expect(newInProgressTasks.length).toBe(0)
      expect(newPlanningTasks.length).toBe(1)
    })
  })

  describe('Scenario 5: Edge Cases', () => {
    it('should handle empty project correctly', async () => {
      // No tasks created - empty project

      const moveResult = await callAutoMove()
      expect(moveResult.status).toBe(200)
      expect(moveResult.body.moved_tasks.length).toBe(0)
    })

    it('should return 404 for non-existent project', async () => {
      const fakeProjectId = generateTestId('project')

      const response = await request(app)
        .post(`/api/kanban/${fakeProjectId}/auto-move`)

      expect(response.status).toBe(404)
      expect(response.body.error).toBeTruthy()
    })
  })
})
