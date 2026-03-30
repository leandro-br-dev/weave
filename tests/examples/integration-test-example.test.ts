/**
 * Integration Test Example
 *
 * This example demonstrates integration test patterns for testing
 * interactions between multiple components (database, API, services).
 *
 * Use this as a reference for writing integration tests that verify
 * components work together correctly.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express, { Express } from 'express'

// =============================================================================
// TEST SETUP
// =============================================================================

describe('Integration Tests Example', () => {
  let app: Express
  let authToken: string

  // Setup - runs once before all tests
  beforeAll(async () => {
    // Create test Express app
    app = express()
    app.use(express.json())

    // Setup test routes
    setupTestRoutes(app)

    // Initialize test data
    await initializeTestData()
  })

  // Teardown - runs once after all tests
  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData()
  })

  // =============================================================================
  // DATABASE INTEGRATION TESTS
  // Tests for database operations
  // =============================================================================

  describe('Database Integration', () => {
    beforeEach(async () => {
      // Clear test data before each test
      await clearTestData()
    })

    afterEach(async () => {
      // Clean up after each test
      await clearTestData()
    })

    it('should create and retrieve resource from database', async () => {
      // Arrange
      const resourceId = 'test-resource-123'
      const resourceData = {
        id: resourceId,
        name: 'Test Resource',
        description: 'A test resource',
      }

      // Act - Create resource
      await createResourceInDatabase(resourceData)

      // Act - Retrieve resource
      const result = await getResourceFromDatabase(resourceId)

      // Assert
      expect(result).toBeDefined()
      expect(result.id).toBe(resourceId)
      expect(result.name).toBe('Test Resource')
      expect(result.description).toBe('A test resource')
    })

    it('should handle foreign key relationships correctly', async () => {
      // Arrange - Create parent resource
      const projectId = await createProjectInDatabase({
        id: 'test-project-123',
        name: 'Test Project',
      })

      // Act - Create child resource with foreign key
      const taskId = await createTaskInDatabase({
        id: 'test-task-456',
        projectId: projectId,
        title: 'Test Task',
      })

      // Assert - Verify relationship
      const task = await getTaskFromDatabase(taskId)
      expect(task.projectId).toBe(projectId)
    })

    it('should cascade delete correctly', async () => {
      // Arrange - Create parent and child resources
      const projectId = await createProjectInDatabase({
        id: 'test-project-123',
        name: 'Test Project',
      })

      await createTaskInDatabase({
        id: 'test-task-456',
        projectId: projectId,
        title: 'Test Task',
      })

      // Act - Delete parent
      await deleteProjectFromDatabase(projectId)

      // Assert - Verify child was deleted
      const task = await getTaskFromDatabase('test-task-456')
      expect(task).toBeNull()
    })
  })

  // =============================================================================
  // API INTEGRATION TESTS
  // Tests for API endpoints
  // =============================================================================

  describe('API Integration', () => {
    describe('GET endpoints', () => {
      it('should return resource by ID', async () => {
        // Arrange
        const resourceId = 'test-resource-123'
        await createResourceInDatabase({
          id: resourceId,
          name: 'Test Resource',
        })

        // Act
        const response = await request(app)
          .get(`/api/resources/${resourceId}`)
          .set('Authorization', `Bearer ${authToken}`)

        // Assert
        expect(response.status).toBe(200)
        expect(response.body.id).toBe(resourceId)
        expect(response.body.name).toBe('Test Resource')
      })

      it('should return 404 for non-existent resource', async () => {
        // Arrange
        const nonExistentId = 'non-existent-123'

        // Act
        const response = await request(app)
          .get(`/api/resources/${nonExistentId}`)
          .set('Authorization', `Bearer ${authToken}`)

        // Assert
        expect(response.status).toBe(404)
        expect(response.body.error).toBeDefined()
      })

      it('should return list of resources', async () => {
        // Arrange
        await createResourceInDatabase({ id: 'res-1', name: 'Resource 1' })
        await createResourceInDatabase({ id: 'res-2', name: 'Resource 2' })

        // Act
        const response = await request(app)
          .get('/api/resources')
          .set('Authorization', `Bearer ${authToken}`)

        // Assert
        expect(response.status).toBe(200)
        expect(Array.isArray(response.body.data)).toBe(true)
        expect(response.body.data.length).toBeGreaterThanOrEqual(2)
      })

      it('should support pagination', async () => {
        // Arrange
        for (let i = 1; i <= 15; i++) {
          await createResourceInDatabase({ id: `res-${i}`, name: `Resource ${i}` })
        }

        // Act
        const response = await request(app)
          .get('/api/resources?page=1&limit=10')
          .set('Authorization', `Bearer ${authToken}`)

        // Assert
        expect(response.status).toBe(200)
        expect(response.body.data.length).toBeLessThanOrEqual(10)
        expect(response.body.pagination).toBeDefined()
        expect(response.body.pagination.total).toBe(15)
      })
    })

    describe('POST endpoints', () => {
      it('should create new resource', async () => {
        // Arrange
        const newResource = {
          name: 'New Resource',
          description: 'A new test resource',
        }

        // Act
        const response = await request(app)
          .post('/api/resources')
          .set('Authorization', `Bearer ${authToken}`)
          .send(newResource)

        // Assert
        expect(response.status).toBe(201)
        expect(response.body.id).toBeDefined()
        expect(response.body.name).toBe(newResource.name)
      })

      it('should validate request data', async () => {
        // Arrange
        const invalidData = {
          name: '', // Invalid: empty name
        }

        // Act
        const response = await request(app)
          .post('/api/resources')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidData)

        // Assert
        expect(response.status).toBe(400)
        expect(response.body.errors).toBeDefined()
      })

      it('should return 401 without authentication', async () => {
        // Arrange
        const newResource = { name: 'New Resource' }

        // Act
        const response = await request(app)
          .post('/api/resources')
          .send(newResource)

        // Assert
        expect(response.status).toBe(401)
      })
    })

    describe('PUT/PATCH endpoints', () => {
      it('should update existing resource', async () => {
        // Arrange
        const resourceId = await createResourceInDatabase({
          id: 'test-resource-123',
          name: 'Original Name',
        })
        const updates = { name: 'Updated Resource' }

        // Act
        const response = await request(app)
          .patch(`/api/resources/${resourceId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updates)

        // Assert
        expect(response.status).toBe(200)
        expect(response.body.name).toBe(updates.name)
      })

      it('should handle partial updates', async () => {
        // Arrange
        const resourceId = await createResourceInDatabase({
          id: 'test-resource-123',
          name: 'Test Resource',
          description: 'Original description',
        })
        const partialUpdate = { description: 'Updated description' }

        // Act
        const response = await request(app)
          .patch(`/api/resources/${resourceId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(partialUpdate)

        // Assert
        expect(response.status).toBe(200)
        expect(response.body.description).toBe(partialUpdate.description)
        expect(response.body.name).toBe('Test Resource') // Unchanged
      })
    })

    describe('DELETE endpoints', () => {
      it('should delete resource', async () => {
        // Arrange
        const resourceId = await createResourceInDatabase({
          id: 'test-resource-123',
          name: 'Test Resource',
        })

        // Act
        const response = await request(app)
          .delete(`/api/resources/${resourceId}`)
          .set('Authorization', `Bearer ${authToken}`)

        // Assert
        expect(response.status).toBe(204)

        // Verify deletion
        const deleted = await getResourceFromDatabase(resourceId)
        expect(deleted).toBeNull()
      })
    })
  })

  // =============================================================================
  // SERVICE LAYER INTEGRATION TESTS
  // Tests for service layer coordinating between components
  // =============================================================================

  describe('Service Layer Integration', () => {
    it('should create resource via service', async () => {
      // Arrange
      const resourceData = {
        id: 'test-resource-123',
        name: 'Test Resource',
      }

      // Act
      const service = new ResourceService()
      const resource = await service.create(resourceData)

      // Assert
      expect(resource.id).toBe(resourceData.id)
      expect(resource.name).toBe(resourceData.name)

      // Verify in database
      const result = await getResourceFromDatabase(resourceData.id)
      expect(result).toBeDefined()
    })

    it('should coordinate between multiple services', async () => {
      // Arrange
      const projectData = {
        id: 'test-project-123',
        name: 'Test Project',
      }
      const taskData = {
        id: 'test-task-456',
        projectId: 'test-project-123',
        title: 'Test Task',
      }

      // Act
      const projectService = new ProjectService()
      const taskService = new TaskService()

      await projectService.create(projectData)
      const task = await taskService.create(taskData)

      // Assert
      expect(task.projectId).toBe(projectData.id)

      // Verify in database
      const project = await getProjectFromDatabase(projectData.id)
      const taskResult = await getTaskFromDatabase(taskData.id)
      expect(project).toBeDefined()
      expect(taskResult).toBeDefined()
    })
  })

  // =============================================================================
  // WORKFLOW INTEGRATION TESTS
  // Tests for multi-step workflows across components
  // =============================================================================

  describe('Workflow Integration', () => {
    it('should complete full CRUD workflow', async () => {
      // Arrange
      const resourceData = {
        name: 'Test Resource',
        description: 'A test resource',
      }

      // Act - Create
      const createResponse = await request(app)
        .post('/api/resources')
        .set('Authorization', `Bearer ${authToken}`)
        .send(resourceData)

      expect(createResponse.status).toBe(201)
      const resourceId = createResponse.body.id

      // Act - Read
      const readResponse = await request(app)
        .get(`/api/resources/${resourceId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(readResponse.status).toBe(200)

      // Act - Update
      const updateResponse = await request(app)
        .patch(`/api/resources/${resourceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Resource' })

      expect(updateResponse.status).toBe(200)

      // Act - Delete
      const deleteResponse = await request(app)
        .delete(`/api/resources/${resourceId}`)
        .set('Authorization', `Bearer ${authToken}`)

      // Assert
      expect(deleteResponse.status).toBe(204)
    })

    it('should handle multi-step transaction workflow', async () => {
      // Arrange
      const projectId = 'test-project-123'

      try {
        // Act - Start transaction
        await startTransaction()

        // Create project
        await createProjectInDatabase({
          id: projectId,
          name: 'Test Project',
        })

        // Create tasks
        await createTaskInDatabase({
          id: 'task-1',
          projectId: projectId,
          title: 'Task 1',
        })
        await createTaskInDatabase({
          id: 'task-2',
          projectId: projectId,
          title: 'Task 2',
        })

        // Commit transaction
        await commitTransaction()

        // Assert - Verify all data was created
        const project = await getProjectFromDatabase(projectId)
        const tasks = await getTasksByProject(projectId)

        expect(project).toBeDefined()
        expect(tasks.length).toBe(2)
      } catch (error) {
        // Rollback on error
        await rollbackTransaction()
        throw error
      }
    })
  })
})

// =============================================================================
// HELPER FUNCTIONS (Mock implementations)
// In real tests, these would connect to actual database/API
// =============================================================================

function setupTestRoutes(app: Express) {
  // Setup test routes
  app.get('/api/resources/:id', (req, res) => {
    res.json({ id: req.params.id, name: 'Test Resource' })
  })

  app.get('/api/resources', (req, res) => {
    res.json({
      data: [
        { id: 'res-1', name: 'Resource 1' },
        { id: 'res-2', name: 'Resource 2' },
      ],
      pagination: { total: 2, page: 1, limit: 10 },
    })
  })

  app.post('/api/resources', (req, res) => {
    res.status(201).json({ id: 'new-id', ...req.body })
  })

  app.patch('/api/resources/:id', (req, res) => {
    res.json({ id: req.params.id, ...req.body })
  })

  app.delete('/api/resources/:id', (req, res) => {
    res.status(204).send()
  })
}

async function initializeTestData() {
  authToken = 'test-token-123'
}

async function cleanupTestData() {
  // Clean up all test data
}

async function clearTestData() {
  // Clear test data
}

async function createResourceInDatabase(data: any) {
  // Mock implementation
  return data.id
}

async function getResourceFromDatabase(id: string) {
  // Mock implementation
  return { id, name: 'Test Resource' }
}

async function createProjectInDatabase(data: any) {
  // Mock implementation
  return data.id
}

async function createTaskInDatabase(data: any) {
  // Mock implementation
  return data.id
}

async function getTaskFromDatabase(id: string) {
  // Mock implementation
  return { id, projectId: 'test-project-123' }
}

async function deleteProjectFromDatabase(id: string) {
  // Mock implementation
}

async function getProjectFromDatabase(id: string) {
  // Mock implementation
  return { id, name: 'Test Project' }
}

async function getTasksByProject(projectId: string) {
  // Mock implementation
  return [
    { id: 'task-1', projectId },
    { id: 'task-2', projectId },
  ]
}

async function startTransaction() {
  // Mock implementation
}

async function commitTransaction() {
  // Mock implementation
}

async function rollbackTransaction() {
  // Mock implementation
}

// Mock service classes
class ResourceService {
  async create(data: any) {
    return data
  }
}

class ProjectService {
  async create(data: any) {
    return data
  }
}

class TaskService {
  async create(data: any) {
    return data
  }
}

// =============================================================================
// RUNNING THE TESTS
// =============================================================================
//
// Run all integration tests:
//   npm test -- tests/examples/integration-test-example.test.ts
//
// Run with coverage:
//   npm test -- tests/examples/integration-test-example.test.ts --coverage
//
// Run specific test suite:
//   npm test -- tests/examples/integration-test-example.test.ts -t "Database Integration"
//
// Run with verbose output:
//   npm test -- tests/examples/integration-test-example.test.ts --reporter=verbose
//
// Run in watch mode:
//   npm test -- tests/examples/integration-test-example.test.ts --watch
// =============================================================================
