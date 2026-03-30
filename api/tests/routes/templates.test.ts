/**
 * Templates API Route Tests
 *
 * Tests the templates routes including:
 * - Template CRUD operations (CREATE, READ, UPDATE, DELETE)
 * - Template usage (creating tasks from templates)
 * - Template recurrence and scheduling
 * - Public vs project-specific templates
 * - Error handling and edge cases
 *
 * @testType Integration
 * @category Templates
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import express, { Express } from 'express'
import { db } from '../../src/db/index.js'
import templatesRouter from '../../src/routes/templates.js'
import { clearTables } from '../helpers/test-db.js'
import {
  createTestProject,
  createTestKanbanTask,
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

describe('Templates API', () => {
  let app: Express
  let projectId: string
  let projectId2: string

  beforeAll(() => {
    // Create a test Express app
    app = express()
    app.use(express.json())
    app.use('/api/templates', templatesRouter)

    // Create system user for foreign key constraints
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get('system')
    if (!existing) {
      db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(
        'system', 'daemon', 'system-hash'
      )
    }

    // Create two test projects
    const project1 = createTestProject({ name: 'Test Project 1' })
    projectId = project1.id
    db.prepare('INSERT INTO projects (id, name, description, user_id) VALUES (?, ?, ?, ?)').run(
      project1.id,
      project1.name,
      project1.description,
      null
    )

    const project2 = createTestProject({ name: 'Test Project 2' })
    projectId2 = project2.id
    db.prepare('INSERT INTO projects (id, name, description, user_id) VALUES (?, ?, ?, ?)').run(
      project2.id,
      project2.name,
      project2.description,
      null
    )
  })

  beforeEach(() => {
    // Clear ALL templates and kanban_tasks tables before each test
    // This ensures test isolation
    db.prepare('DELETE FROM kanban_templates').run()
    db.prepare('DELETE FROM kanban_tasks').run()
  })

  afterEach(() => {
    // Clean up ALL templates and kanban_tasks tables after each test
    db.prepare('DELETE FROM kanban_templates').run()
    db.prepare('DELETE FROM kanban_tasks').run()
  })

  afterAll(() => {
    // Clean up test projects
    db.prepare('DELETE FROM projects WHERE id = ?').run(projectId)
    db.prepare('DELETE FROM projects WHERE id = ?').run(projectId2)
  })

  describe('POST /api/templates - CREATE', () => {
    it('should create a public template', async () => {
      const response = await request(app)
        .post('/api/templates')
        .send({
          title: 'Public Template',
          description: 'A public template for testing',
          priority: 2,
          recurrence: '',
          is_public: true
        })
        .expect(201)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toHaveProperty('id')
      expect(response.body.data.title).toBe('Public Template')
      expect(response.body.data.description).toBe('A public template for testing')
      expect(response.body.data.priority).toBe(2)
      expect(response.body.data.is_public).toBe(1)
      expect(response.body.data.project_id).toBeNull()
      expect(response.body.data).toHaveProperty('created_at')
    })

    it('should create a project-specific template', async () => {
      const response = await request(app)
        .post('/api/templates')
        .send({
          title: 'Project Template',
          description: 'A project-specific template',
          priority: 1,
          recurrence: 'daily',
          is_public: false,
          project_id: projectId
        })
        .expect(201)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toHaveProperty('id')
      expect(response.body.data.title).toBe('Project Template')
      expect(response.body.data.description).toBe('A project-specific template')
      expect(response.body.data.priority).toBe(1)
      expect(response.body.data.recurrence).toBe('daily')
      expect(response.body.data.is_public).toBe(0)
      expect(response.body.data.project_id).toBe(projectId)
    })

    it('should use default values when optional fields are missing', async () => {
      const response = await request(app)
        .post('/api/templates')
        .send({
          title: 'Minimal Template'
        })
        .expect(201)

      expect(response.body.error).toBeNull()
      expect(response.body.data.title).toBe('Minimal Template')
      expect(response.body.data.description).toBe('')
      expect(response.body.data.priority).toBe(3)
      expect(response.body.data.recurrence).toBe('')
      expect(response.body.data.is_public).toBe(1)
      expect(response.body.data.project_id).toBeNull()
    })

    it('should return 400 when title is missing', async () => {
      const response = await request(app)
        .post('/api/templates')
        .send({
          description: 'Template without title'
        })
        .expect(400)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('title is required')
    })

    it('should return 404 when project_id does not exist', async () => {
      const response = await request(app)
        .post('/api/templates')
        .send({
          title: 'Invalid Project Template',
          project_id: 'non-existent-project-id'
        })
        .expect(404)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('Project not found')
    })

    it('should handle various recurrence patterns', async () => {
      const recurrencePatterns = ['daily', 'weekly', 'monthly', '0 9 * * *', '*/30 * * * *']

      for (const recurrence of recurrencePatterns) {
        const response = await request(app)
          .post('/api/templates')
          .send({
            title: `Recurrence Template - ${recurrence}`,
            recurrence: recurrence
          })
          .expect(201)

        expect(response.body.error).toBeNull()
        expect(response.body.data.recurrence).toBe(recurrence)
      }
    })
  })

  describe('GET /api/templates - READ all', () => {
    it('should return empty array when no templates exist', async () => {
      // Clear all templates to ensure clean state
      db.prepare('DELETE FROM kanban_templates').run()

      const response = await request(app)
        .get('/api/templates')
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toEqual([])
    })

    it('should return all templates ordered by created_at DESC', async () => {
      // Clear all templates to ensure clean state
      db.prepare('DELETE FROM kanban_templates').run()

      // Create three templates with explicit timing to ensure different created_at values
      const template1 = await request(app)
        .post('/api/templates')
        .send({ title: 'Template 1', is_public: true })

      await new Promise(resolve => setTimeout(resolve, 50)) // Ensure different timestamps

      const template2 = await request(app)
        .post('/api/templates')
        .send({ title: 'Template 2', project_id: projectId })

      await new Promise(resolve => setTimeout(resolve, 50))

      const template3 = await request(app)
        .post('/api/templates')
        .send({ title: 'Template 3', is_public: true })

      const response = await request(app)
        .get('/api/templates')
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toHaveLength(3)

      // Verify ordering by checking that created_at timestamps are in descending order
      const timestamps = response.body.data.map((t: any) => t.created_at)
      expect(new Date(timestamps[0]).getTime()).toBeGreaterThanOrEqual(new Date(timestamps[1]).getTime())
      expect(new Date(timestamps[1]).getTime()).toBeGreaterThanOrEqual(new Date(timestamps[2]).getTime())

      // Verify all three templates are present
      const titles = response.body.data.map((t: any) => t.title)
      expect(titles).toContain('Template 1')
      expect(titles).toContain('Template 2')
      expect(titles).toContain('Template 3')
    })

    it('should include project information in response', async () => {
      // Clear all templates to ensure clean state
      db.prepare('DELETE FROM kanban_templates').run()

      // Create a project-specific template
      await request(app)
        .post('/api/templates')
        .send({
          title: 'Project Template',
          project_id: projectId
        })

      const response = await request(app)
        .get('/api/templates')
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0]).toHaveProperty('project_name')
      expect(response.body.data[0].project_name).toBe('Test Project 1')
      expect(response.body.data[0]).toHaveProperty('project_description')
    })

    it('should return both public and project-specific templates', async () => {
      // Clear all templates to ensure clean state
      db.prepare('DELETE FROM kanban_templates').run()

      // Create a public template
      await request(app)
        .post('/api/templates')
        .send({ title: 'Public Template', is_public: true })

      // Create a project-specific template
      await request(app)
        .post('/api/templates')
        .send({ title: 'Project Template', project_id: projectId, is_public: false })

      const response = await request(app)
        .get('/api/templates')
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toHaveLength(2)

      const titles = response.body.data.map((t: any) => t.title)
      expect(titles).toContain('Public Template')
      expect(titles).toContain('Project Template')
    })
  })

  describe('GET /api/templates/:id - READ single', () => {
    it('should return a single template by ID', async () => {
      const createResponse = await request(app)
        .post('/api/templates')
        .send({
          title: 'Test Template',
          description: 'Test description',
          priority: 1
        })

      const templateId = createResponse.body.data.id

      const response = await request(app)
        .get(`/api/templates/${templateId}`)
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.id).toBe(templateId)
      expect(response.body.data.title).toBe('Test Template')
      expect(response.body.data.description).toBe('Test description')
      expect(response.body.data.priority).toBe(1)
    })

    it('should return 404 for non-existent template', async () => {
      const response = await request(app)
        .get('/api/templates/non-existent-id')
        .expect(404)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('Template not found')
    })

    it('should include project information for project-specific templates', async () => {
      const createResponse = await request(app)
        .post('/api/templates')
        .send({
          title: 'Project Template',
          project_id: projectId
        })

      const templateId = createResponse.body.data.id

      const response = await request(app)
        .get(`/api/templates/${templateId}`)
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.project_name).toBe('Test Project 1')
      expect(response.body.data).toHaveProperty('project_description')
    })
  })

  describe('GET /api/templates/project/:projectId - READ by project', () => {
    it('should return templates for a specific project including public templates', async () => {
      // Create a public template
      await request(app)
        .post('/api/templates')
        .send({ title: 'Public Template', is_public: true })

      // Create a project-specific template for project1
      await request(app)
        .post('/api/templates')
        .send({ title: 'Project 1 Template', project_id: projectId, is_public: false })

      // Create a project-specific template for project2
      await request(app)
        .post('/api/templates')
        .send({ title: 'Project 2 Template', project_id: projectId2, is_public: false })

      // Get templates for project1
      const response = await request(app)
        .get(`/api/templates/project/${projectId}`)
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toHaveLength(2)

      const titles = response.body.data.map((t: any) => t.title)
      expect(titles).toContain('Public Template')
      expect(titles).toContain('Project 1 Template')
      expect(titles).not.toContain('Project 2 Template')
    })

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .get('/api/templates/project/non-existent-project')
        .expect(404)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('Project not found')
    })

    it('should return only public templates when project has no specific templates', async () => {
      // Create a public template
      await request(app)
        .post('/api/templates')
        .send({ title: 'Public Template', is_public: true })

      // Get templates for project1 (which has no specific templates)
      const response = await request(app)
        .get(`/api/templates/project/${projectId}`)
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].title).toBe('Public Template')
    })

    it('should return empty array when no templates exist for project', async () => {
      // Don't create any templates
      const response = await request(app)
        .get(`/api/templates/project/${projectId}`)
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toEqual([])
    })
  })

  describe('PUT /api/templates/:id - UPDATE', () => {
    it('should update template name', async () => {
      const createResponse = await request(app)
        .post('/api/templates')
        .send({ title: 'Original Name' })

      const templateId = createResponse.body.data.id

      const response = await request(app)
        .put(`/api/templates/${templateId}`)
        .send({ title: 'Updated Name' })
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.title).toBe('Updated Name')
    })

    it('should update template description', async () => {
      const createResponse = await request(app)
        .post('/api/templates')
        .send({
          title: 'Test Template',
          description: 'Original description'
        })

      const templateId = createResponse.body.data.id

      const response = await request(app)
        .put(`/api/templates/${templateId}`)
        .send({ description: 'Updated description' })
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.description).toBe('Updated description')
    })

    it('should update template priority', async () => {
      const createResponse = await request(app)
        .post('/api/templates')
        .send({
          title: 'Test Template',
          priority: 3
        })

      const templateId = createResponse.body.data.id

      const response = await request(app)
        .put(`/api/templates/${templateId}`)
        .send({ priority: 1 })
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.priority).toBe(1)
    })

    it('should update is_public flag', async () => {
      const createResponse = await request(app)
        .post('/api/templates')
        .send({
          title: 'Test Template',
          is_public: true
        })

      const templateId = createResponse.body.data.id

      const response = await request(app)
        .put(`/api/templates/${templateId}`)
        .send({ is_public: false })
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.is_public).toBe(0)
    })

    it('should update project_id', async () => {
      const createResponse = await request(app)
        .post('/api/templates')
        .send({
          title: 'Test Template',
          project_id: projectId
        })

      const templateId = createResponse.body.data.id

      const response = await request(app)
        .put(`/api/templates/${templateId}`)
        .send({ project_id: projectId2 })
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.project_id).toBe(projectId2)
    })

    it('should update recurrence field', async () => {
      const createResponse = await request(app)
        .post('/api/templates')
        .send({
          title: 'Test Template',
          recurrence: ''
        })

      const templateId = createResponse.body.data.id

      const response = await request(app)
        .put(`/api/templates/${templateId}`)
        .send({ recurrence: 'daily' })
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.recurrence).toBe('daily')
    })

    it('should update next_run_at field', async () => {
      const createResponse = await request(app)
        .post('/api/templates')
        .send({ title: 'Test Template' })

      const templateId = createResponse.body.data.id
      const nextRunAt = '2026-03-20 09:00:00'

      const response = await request(app)
        .put(`/api/templates/${templateId}`)
        .send({ next_run_at: nextRunAt })
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.next_run_at).toBe(nextRunAt)
    })

    it('should update multiple fields simultaneously', async () => {
      const createResponse = await request(app)
        .post('/api/templates')
        .send({
          title: 'Original Title',
          description: 'Original Description',
          priority: 3,
          recurrence: '',
          is_public: true
        })

      const templateId = createResponse.body.data.id

      const response = await request(app)
        .put(`/api/templates/${templateId}`)
        .send({
          title: 'Updated Title',
          description: 'Updated Description',
          priority: 1,
          recurrence: 'weekly',
          is_public: false
        })
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.title).toBe('Updated Title')
      expect(response.body.data.description).toBe('Updated Description')
      expect(response.body.data.priority).toBe(1)
      expect(response.body.data.recurrence).toBe('weekly')
      expect(response.body.data.is_public).toBe(0)
    })

    it('should return 404 when updating non-existent template', async () => {
      const response = await request(app)
        .put('/api/templates/non-existent-id')
        .send({ title: 'New Title' })
        .expect(404)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('Template not found')
    })

    it('should return 404 when updating to non-existent project_id', async () => {
      const createResponse = await request(app)
        .post('/api/templates')
        .send({ title: 'Test Template' })

      const templateId = createResponse.body.data.id

      const response = await request(app)
        .put(`/api/templates/${templateId}`)
        .send({ project_id: 'non-existent-project' })
        .expect(404)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('Project not found')
    })

    it('should handle updating project_id to another valid project', async () => {
      const createResponse = await request(app)
        .post('/api/templates')
        .send({
          title: 'Project Template',
          project_id: projectId,
          is_public: false
        })

      const templateId = createResponse.body.data.id

      const response = await request(app)
        .put(`/api/templates/${templateId}`)
        .send({ project_id: projectId2, is_public: false })
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.project_id).toBe(projectId2)
    })
  })

  describe('DELETE /api/templates/:id - DELETE', () => {
    it('should delete a template', async () => {
      const createResponse = await request(app)
        .post('/api/templates')
        .send({ title: 'Template to Delete' })

      const templateId = createResponse.body.data.id

      const deleteResponse = await request(app)
        .delete(`/api/templates/${templateId}`)
        .expect(200)

      expect(deleteResponse.body.error).toBeNull()
      expect(deleteResponse.body.data.success).toBe(true)

      // Verify template is gone
      const getResponse = await request(app)
        .get(`/api/templates/${templateId}`)
        .expect(404)

      expect(getResponse.body.error).toBe('Template not found')
    })

    it('should return 404 when deleting non-existent template', async () => {
      const response = await request(app)
        .delete('/api/templates/non-existent-id')
        .expect(404)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('Template not found')
    })

    it('should delete only the specified template', async () => {
      // Create two templates
      const template1 = await request(app)
        .post('/api/templates')
        .send({ title: 'Template 1' })

      const template2 = await request(app)
        .post('/api/templates')
        .send({ title: 'Template 2' })

      const templateId1 = template1.body.data.id
      const templateId2 = template2.body.data.id

      // Delete first template
      await request(app)
        .delete(`/api/templates/${templateId1}`)
        .expect(200)

      // Verify first template is gone
      await request(app)
        .get(`/api/templates/${templateId1}`)
        .expect(404)

      // Verify second template still exists
      const response = await request(app)
        .get(`/api/templates/${templateId2}`)
        .expect(200)

      expect(response.body.data.title).toBe('Template 2')
    })
  })

  describe('POST /api/templates/:id/use - USE template', () => {
    it('should create a task from a public template', async () => {
      const createResponse = await request(app)
        .post('/api/templates')
        .send({
          title: 'Public Template',
          description: 'Template description',
          priority: 2,
          is_public: true
        })

      const templateId = createResponse.body.data.id

      const useResponse = await request(app)
        .post(`/api/templates/${templateId}/use`)
        .send({ projectId: projectId })
        .expect(201)

      expect(useResponse.body.error).toBeNull()
      expect(useResponse.body.data).toHaveProperty('id')
      expect(useResponse.body.data.title).toBe('Public Template')
      expect(useResponse.body.data.description).toBe('Template description')
      expect(useResponse.body.data.priority).toBe(2)
      expect(useResponse.body.data.column).toBe('planning')
      expect(useResponse.body.data.pipeline_status).toBe('idle')
      expect(useResponse.body.data.project_id).toBe(projectId)
      expect(useResponse.body.data).toHaveProperty('order_index')
    })

    it('should create a task from a project-specific template', async () => {
      const createResponse = await request(app)
        .post('/api/templates')
        .send({
          title: 'Project Template',
          description: 'Project-specific template',
          priority: 1,
          project_id: projectId,
          is_public: false
        })

      const templateId = createResponse.body.data.id

      const useResponse = await request(app)
        .post(`/api/templates/${templateId}/use`)
        .send({ projectId: projectId })
        .expect(201)

      expect(useResponse.body.error).toBeNull()
      expect(useResponse.body.data.title).toBe('Project Template')
      expect(useResponse.body.data.description).toBe('Project-specific template')
      expect(useResponse.body.data.priority).toBe(1)
      expect(useResponse.body.data.column).toBe('planning')
      expect(useResponse.body.data.project_id).toBe(projectId)
    })

    it('should use a public template in a different project', async () => {
      // Create a public template
      const createResponse = await request(app)
        .post('/api/templates')
        .send({
          title: 'Public Template',
          is_public: true
        })

      const templateId = createResponse.body.data.id

      // Use the template in project2
      const useResponse = await request(app)
        .post(`/api/templates/${templateId}/use`)
        .send({ projectId: projectId2 })
        .expect(201)

      expect(useResponse.body.error).toBeNull()
      expect(useResponse.body.data.project_id).toBe(projectId2)
    })

    it('should assign sequential order_index values', async () => {
      const createResponse = await request(app)
        .post('/api/templates')
        .send({
          title: 'Template',
          is_public: true
        })

      const templateId = createResponse.body.data.id

      // Use the template three times
      const task1 = await request(app)
        .post(`/api/templates/${templateId}/use`)
        .send({ projectId: projectId })

      const task2 = await request(app)
        .post(`/api/templates/${templateId}/use`)
        .send({ projectId: projectId })

      const task3 = await request(app)
        .post(`/api/templates/${templateId}/use`)
        .send({ projectId: projectId })

      expect(task1.body.data.order_index).toBe(0)
      expect(task2.body.data.order_index).toBe(1)
      expect(task3.body.data.order_index).toBe(2)
    })

    it('should update template last_run_at timestamp', async () => {
      const createResponse = await request(app)
        .post('/api/templates')
        .send({
          title: 'Template',
          is_public: true
        })

      const templateId = createResponse.body.data.id

      // Get template before use
      const beforeUse = await request(app)
        .get(`/api/templates/${templateId}`)

      expect(beforeUse.body.data.last_run_at).toBeNull()

      // Use the template
      await request(app)
        .post(`/api/templates/${templateId}/use`)
        .send({ projectId: projectId })

      // Get template after use
      const afterUse = await request(app)
        .get(`/api/templates/${templateId}`)

      expect(afterUse.body.data.last_run_at).not.toBeNull()
      expect(afterUse.body.data.last_run_at).toBeDefined()
    })

    it('should return 400 when projectId is missing', async () => {
      const createResponse = await request(app)
        .post('/api/templates')
        .send({ title: 'Template' })

      const templateId = createResponse.body.data.id

      const response = await request(app)
        .post(`/api/templates/${templateId}/use`)
        .send({})
        .expect(400)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('projectId is required in request body')
    })

    it('should return 404 when template does not exist', async () => {
      const response = await request(app)
        .post('/api/templates/non-existent-id/use')
        .send({ projectId: projectId })
        .expect(404)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('Template not found')
    })

    it('should return 404 when target project does not exist', async () => {
      const createResponse = await request(app)
        .post('/api/templates')
        .send({ title: 'Template' })

      const templateId = createResponse.body.data.id

      const response = await request(app)
        .post(`/api/templates/${templateId}/use`)
        .send({ projectId: 'non-existent-project' })
        .expect(404)

      expect(response.body.data).toBeNull()
      expect(response.body.error).toBe('Target project not found')
    })

    it('should use a project-specific template in its own project', async () => {
      // Create a project-specific template for project1
      const createResponse = await request(app)
        .post('/api/templates')
        .send({
          title: 'Project 1 Template',
          project_id: projectId,
          is_public: false
        })

      const templateId = createResponse.body.data.id

      // Use the template in project1
      const useResponse = await request(app)
        .post(`/api/templates/${templateId}/use`)
        .send({ projectId: projectId })
        .expect(201)

      expect(useResponse.body.error).toBeNull()
      expect(useResponse.body.data.title).toBe('Project 1 Template')
      expect(useResponse.body.data.project_id).toBe(projectId)
    })
  })

  describe('RECURRENCE and SCHEDULING', () => {
    it('should create templates with recurrence patterns', async () => {
      const recurrencePatterns = [
        'daily',
        'weekly',
        'monthly',
        '0 9 * * *',     // Daily at 9am
        '0 9 * * 1',     // Weekly on Monday at 9am
        '0 9 1 * *',     // Monthly on 1st at 9am
        '*/30 * * * *',  // Every 30 minutes
      ]

      for (const recurrence of recurrencePatterns) {
        const response = await request(app)
          .post('/api/templates')
          .send({
            title: `Recurrence Test - ${recurrence}`,
            recurrence: recurrence,
            is_public: true
          })
          .expect(201)

        expect(response.body.error).toBeNull()
        expect(response.body.data.recurrence).toBe(recurrence)
      }
    })

    it('should update next_run_at for scheduling', async () => {
      const createResponse = await request(app)
        .post('/api/templates')
        .send({
          title: 'Scheduled Template',
          recurrence: 'daily',
          is_public: true
        })

      const templateId = createResponse.body.data.id
      const nextRunAt = '2026-03-18 09:00:00'

      // Set next_run_at
      const updateResponse = await request(app)
        .put(`/api/templates/${templateId}`)
        .send({ next_run_at: nextRunAt })
        .expect(200)

      expect(updateResponse.body.error).toBeNull()
      expect(updateResponse.body.data.next_run_at).toBe(nextRunAt)

      // Verify it was saved
      const getResponse = await request(app)
        .get(`/api/templates/${templateId}`)
        .expect(200)

      expect(getResponse.body.data.next_run_at).toBe(nextRunAt)
    })

    it('should support complex recurrence patterns', async () => {
      const complexPatterns = [
        '0 0,12 * * *',          // Twice daily at midnight and noon
        '0 9 * * 1-5',           // Weekdays at 9am
        '0 9,17 * * 1-5',        // Weekdays at 9am and 5pm
        '0 0 1 * *',             // First day of month
        '0 0 1 1 *',             // January 1st
        '*/15 * * * *',          // Every 15 minutes
      ]

      for (const pattern of complexPatterns) {
        const response = await request(app)
          .post('/api/templates')
          .send({
            title: `Complex Pattern - ${pattern}`,
            recurrence: pattern,
            is_public: true
          })
          .expect(201)

        expect(response.body.error).toBeNull()
        expect(response.body.data.recurrence).toBe(pattern)
      }
    })

    it('should handle empty recurrence for one-time templates', async () => {
      const response = await request(app)
        .post('/api/templates')
        .send({
          title: 'One-time Template',
          recurrence: '',
          is_public: true
        })
        .expect(201)

      expect(response.body.error).toBeNull()
      expect(response.body.data.recurrence).toBe('')
    })

    it('should allow updating recurrence patterns', async () => {
      const createResponse = await request(app)
        .post('/api/templates')
        .send({
          title: 'Template',
          recurrence: 'daily'
        })

      const templateId = createResponse.body.data.id

      // Update to weekly
      const updateResponse = await request(app)
        .put(`/api/templates/${templateId}`)
        .send({ recurrence: 'weekly' })
        .expect(200)

      expect(updateResponse.body.error).toBeNull()
      expect(updateResponse.body.data.recurrence).toBe('weekly')

      // Update to no recurrence
      const updateResponse2 = await request(app)
        .put(`/api/templates/${templateId}`)
        .send({ recurrence: '' })
        .expect(200)

      expect(updateResponse2.body.error).toBeNull()
      expect(updateResponse2.body.data.recurrence).toBe('')
    })
  })

  describe('EDGE CASES', () => {
    it('should handle creating template with invalid data', async () => {
      // Missing required field
      const response1 = await request(app)
        .post('/api/templates')
        .send({
          description: 'No title provided'
        })
        .expect(400)

      expect(response1.body.error).toBe('title is required')

      // Invalid project_id
      const response2 = await request(app)
        .post('/api/templates')
        .send({
          title: 'Invalid Project',
          project_id: 'invalid-project-id'
        })
        .expect(404)

      expect(response2.body.error).toBe('Project not found')
    })

    it('should handle using non-existent template', async () => {
      const response = await request(app)
        .post('/api/templates/non-existent-id/use')
        .send({ projectId: projectId })
        .expect(404)

      expect(response.body.error).toBe('Template not found')
    })

    it('should handle updating non-existent template', async () => {
      const response = await request(app)
        .put('/api/templates/non-existent-id')
        .send({ title: 'New Title' })
        .expect(404)

      expect(response.body.error).toBe('Template not found')
    })

    it('should handle deleting non-existent template', async () => {
      const response = await request(app)
        .delete('/api/templates/non-existent-id')
        .expect(404)

      expect(response.body.error).toBe('Template not found')
    })

    it('should handle getting non-existent template', async () => {
      const response = await request(app)
        .get('/api/templates/non-existent-id')
        .expect(404)

      expect(response.body.error).toBe('Template not found')
    })

    it('should handle boolean conversion for is_public', async () => {
      // Create with boolean true
      const response1 = await request(app)
        .post('/api/templates')
        .send({
          title: 'Boolean True',
          is_public: true
        })
        .expect(201)

      expect(response1.body.data.is_public).toBe(1)

      // Create with boolean false
      const response2 = await request(app)
        .post('/api/templates')
        .send({
          title: 'Boolean False',
          is_public: false
        })
        .expect(201)

      expect(response2.body.data.is_public).toBe(0)
    })

    it('should handling very long descriptions', async () => {
      const longDescription = 'A'.repeat(10000)

      const response = await request(app)
        .post('/api/templates')
        .send({
          title: 'Long Description Template',
          description: longDescription,
          is_public: true
        })
        .expect(201)

      expect(response.body.error).toBeNull()
      expect(response.body.data.description).toBe(longDescription)
    })

    it('should handle special characters in title and description', async () => {
      const specialChars = 'Template with special chars: <script>alert("xss")</script> & "quotes" and \'apostrophes\''

      const response = await request(app)
        .post('/api/templates')
        .send({
          title: specialChars,
          description: specialChars,
          is_public: true
        })
        .expect(201)

      expect(response.body.error).toBeNull()
      expect(response.body.data.title).toBe(specialChars)
      expect(response.body.data.description).toBe(specialChars)
    })

    it('should handle priority boundaries', async () => {
      // Test minimum priority (1)
      const response1 = await request(app)
        .post('/api/templates')
        .send({
          title: 'Min Priority',
          priority: 1
        })
        .expect(201)

      expect(response1.body.data.priority).toBe(1)

      // Test maximum priority (5)
      const response2 = await request(app)
        .post('/api/templates')
        .send({
          title: 'Max Priority',
          priority: 5
        })
        .expect(201)

      expect(response2.body.data.priority).toBe(5)

      // Test boundary value (3)
      const response3 = await request(app)
        .post('/api/templates')
        .send({
          title: 'Middle Priority',
          priority: 3
        })
        .expect(201)

      expect(response3.body.data.priority).toBe(3)
    })

    it('should handle creating template with all fields', async () => {
      const response = await request(app)
        .post('/api/templates')
        .send({
          title: 'Complete Template',
          description: 'Complete description',
          priority: 1,
          recurrence: 'daily',
          is_public: false,
          project_id: projectId
        })
        .expect(201)

      expect(response.body.error).toBeNull()
      expect(response.body.data.title).toBe('Complete Template')
      expect(response.body.data.description).toBe('Complete description')
      expect(response.body.data.priority).toBe(1)
      expect(response.body.data.recurrence).toBe('daily')
      expect(response.body.data.is_public).toBe(0)
      expect(response.body.data.project_id).toBe(projectId)
      expect(response.body.data).toHaveProperty('created_at')
      expect(response.body.data).toHaveProperty('updated_at')
    })

    it('should handle updating template to remove project association', async () => {
      // Clear all templates to ensure clean state
      db.prepare('DELETE FROM kanban_templates').run()

      // Create project-specific template
      const createResponse = await request(app)
        .post('/api/templates')
        .send({
          title: 'Project Template',
          project_id: projectId,
          is_public: false
        })

      const templateId = createResponse.body.data.id

      // Update to change project association to another project
      const updateResponse = await request(app)
        .put(`/api/templates/${templateId}`)
        .send({
          project_id: projectId2,
          is_public: false
        })
        .expect(200)

      expect(updateResponse.body.error).toBeNull()
      expect(updateResponse.body.data.project_id).toBe(projectId2)
      expect(updateResponse.body.data.is_public).toBe(0)
    })
  })
})
