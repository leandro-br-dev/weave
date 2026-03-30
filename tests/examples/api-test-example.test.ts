/**
 * API Test Example
 *
 * This example demonstrates patterns for testing API endpoints.
 * Focuses on HTTP request/response testing, validation, authentication,
 * and error handling.
 *
 * Use this as a reference for writing API endpoint tests.
 */

import { describe, it, expect, beforeAll, afterEach, beforeEach } from 'vitest'
import request from 'supertest'
import express, { Express, Request, Response } from 'express'

// =============================================================================
// TEST SETUP
// =============================================================================

describe('API Endpoint Tests', () => {
  let app: Express
  let authToken: string

  // Setup - runs once before all tests
  beforeAll(async () => {
    // Create Express app with middleware
    app = express()
    app.use(express.json())

    // Setup authentication middleware
    app.use((req: Request, res: Response, next) => {
      const authHeader = req.headers.authorization
      if (authHeader?.startsWith('Bearer ')) {
        req.headers['user'] = 'test-user'
        next()
      } else if (req.path !== '/api/auth/login') {
        res.status(401).json({ error: 'Unauthorized' })
      } else {
        next()
      }
    })

    // Setup test routes
    setupTestRoutes(app)
  })

  // Setup - runs before each test
  beforeEach(() => {
    // Reset test state
    authToken = 'test-token'
  })

  // Teardown - runs after each test
  afterEach(() => {
    // Clean up test data
  })

  // =============================================================================
  // AUTHENTICATION ENDPOINTS
  // Tests for login, logout, and token refresh
  // =============================================================================

  describe('POST /api/auth/login', () => {
    it('should authenticate valid credentials', async () => {
      // Arrange
      const credentials = {
        username: 'testuser',
        password: 'password123',
      }

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send(credentials)

      // Assert
      expect(response.status).toBe(200)
      expect(response.body.token).toBeDefined()
      expect(response.body.user).toBeDefined()
      expect(response.body.user.username).toBe('testuser')
    })

    it('should reject invalid credentials', async () => {
      // Arrange
      const invalidCredentials = {
        username: 'testuser',
        password: 'wrongpassword',
      }

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidCredentials)

      // Assert
      expect(response.status).toBe(401)
      expect(response.body.error).toBeDefined()
      expect(response.body.token).toBeUndefined()
    })

    it('should validate required fields', async () => {
      // Arrange
      const incompleteCredentials = {
        username: 'testuser',
        // Missing password
      }

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send(incompleteCredentials)

      // Assert
      expect(response.status).toBe(400)
      expect(response.body.errors).toBeDefined()
    })
  })

  // =============================================================================
  // GET ENDPOINTS
  // Tests for retrieving resources
  // =============================================================================

  describe('GET /api/resources/:id', () => {
    it('should return resource by ID with authentication', async () => {
      // Arrange
      const resourceId = 'resource-123'

      // Act
      const response = await request(app)
        .get(`/api/resources/${resourceId}`)
        .set('Authorization', `Bearer ${authToken}`)

      // Assert
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        id: resourceId,
        name: 'Test Resource',
        description: 'A test resource',
      })
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
      expect(response.body.error).toContain('not found')
    })

    it('should return 401 without authentication', async () => {
      // Arrange
      const resourceId = 'resource-123'

      // Act
      const response = await request(app)
        .get(`/api/resources/${resourceId}`)
        // No Authorization header

      // Assert
      expect(response.status).toBe(401)
      expect(response.body.error).toBeDefined()
    })

    it('should support query parameters', async () => {
      // Arrange
      const resourceId = 'resource-123'

      // Act
      const response = await request(app)
        .get(`/api/resources/${resourceId}?include=metadata,stats`)
        .set('Authorization', `Bearer ${authToken}`)

      // Assert
      expect(response.status).toBe(200)
      expect(response.body.metadata).toBeDefined()
      expect(response.body.stats).toBeDefined()
    })
  })

  describe('GET /api/resources', () => {
    it('should return list of resources', async () => {
      // Act
      const response = await request(app)
        .get('/api/resources')
        .set('Authorization', `Bearer ${authToken}`)

      // Assert
      expect(response.status).toBe(200)
      expect(Array.isArray(response.body.data)).toBe(true)
      expect(response.body.data.length).toBeGreaterThan(0)
      expect(response.body.pagination).toBeDefined()
    })

    it('should support pagination', async () => {
      // Arrange
      const page = 1
      const limit = 10

      // Act
      const response = await request(app)
        .get(`/api/resources?page=${page}&limit=${limit}`)
        .set('Authorization', `Bearer ${authToken}`)

      // Assert
      expect(response.status).toBe(200)
      expect(response.body.data.length).toBeLessThanOrEqual(limit)
      expect(response.body.pagination).toMatchObject({
        page: page,
        limit: limit,
        total: expect.any(Number),
      })
    })

    it('should support filtering', async () => {
      // Act
      const response = await request(app)
        .get('/api/resources?status=active&category=test')
        .set('Authorization', `Bearer ${authToken}`)

      // Assert
      expect(response.status).toBe(200)
      response.body.data.forEach((item: any) => {
        expect(item.status).toBe('active')
        expect(item.category).toBe('test')
      })
    })

    it('should support sorting', async () => {
      // Act
      const response = await request(app)
        .get('/api/resources?sort=name&order=asc')
        .set('Authorization', `Bearer ${authToken}`)

      // Assert
      expect(response.status).toBe(200)
      const names = response.body.data.map((item: any) => item.name)
      const sortedNames = [...names].sort()
      expect(names).toEqual(sortedNames)
    })
  })

  // =============================================================================
  // POST ENDPOINTS
  // Tests for creating resources
  // =============================================================================

  describe('POST /api/resources', () => {
    it('should create new resource with valid data', async () => {
      // Arrange
      const newResource = {
        name: 'New Resource',
        description: 'A new test resource',
        category: 'test',
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
      expect(response.body.description).toBe(newResource.description)
      expect(response.body.createdAt).toBeDefined()
    })

    it('should validate required fields', async () => {
      // Arrange
      const incompleteResource = {
        description: 'Missing required name field',
      }

      // Act
      const response = await request(app)
        .post('/api/resources')
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompleteResource)

      // Assert
      expect(response.status).toBe(400)
      expect(response.body.errors).toBeDefined()
      expect(response.body.errors.some((e: any) => e.field === 'name')).toBe(true)
    })

    it('should validate data types', async () => {
      // Arrange
      const invalidResource = {
        name: 'Test Resource',
        count: 'not-a-number', // Should be number
      }

      // Act
      const response = await request(app)
        .post('/api/resources')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidResource)

      // Assert
      expect(response.status).toBe(400)
      expect(response.body.errors).toBeDefined()
    })

    it('should handle duplicate resources', async () => {
      // Arrange
      const duplicateResource = {
        id: 'existing-123',
        name: 'Duplicate Resource',
      }

      // Act
      const response = await request(app)
        .post('/api/resources')
        .set('Authorization', `Bearer ${authToken}`)
        .send(duplicateResource)

      // Assert
      expect(response.status).toBe(409)
      expect(response.body.error).toContain('already exists')
    })

    it('should return 401 without authentication', async () => {
      // Arrange
      const newResource = { name: 'Test Resource' }

      // Act
      const response = await request(app)
        .post('/api/resources')
        .send(newResource)
        // No Authorization header

      // Assert
      expect(response.status).toBe(401)
    })
  })

  // =============================================================================
  // PUT/PATCH ENDPOINTS
  // Tests for updating resources
  // =============================================================================

  describe('PATCH /api/resources/:id', () => {
    it('should update existing resource', async () => {
      // Arrange
      const resourceId = 'resource-123'
      const updates = {
        name: 'Updated Resource Name',
        description: 'Updated description',
      }

      // Act
      const response = await request(app)
        .patch(`/api/resources/${resourceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)

      // Assert
      expect(response.status).toBe(200)
      expect(response.body.name).toBe(updates.name)
      expect(response.body.description).toBe(updates.description)
      expect(response.body.updatedAt).toBeDefined()
    })

    it('should handle partial updates', async () => {
      // Arrange
      const resourceId = 'resource-123'
      const partialUpdate = {
        description: 'Only updating description',
      }

      // Act
      const response = await request(app)
        .patch(`/api/resources/${resourceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(partialUpdate)

      // Assert
      expect(response.status).toBe(200)
      expect(response.body.description).toBe(partialUpdate.description)
      // Other fields should remain unchanged
      expect(response.body.name).toBeDefined()
    })

    it('should return 404 for non-existent resource', async () => {
      // Arrange
      const nonExistentId = 'non-existent-123'
      const updates = { name: 'Updated Name' }

      // Act
      const response = await request(app)
        .patch(`/api/resources/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)

      // Assert
      expect(response.status).toBe(404)
    })

    it('should validate update data', async () => {
      // Arrange
      const resourceId = 'resource-123'
      const invalidUpdate = {
        name: '', // Invalid: empty name
      }

      // Act
      const response = await request(app)
        .patch(`/api/resources/${resourceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidUpdate)

      // Assert
      expect(response.status).toBe(400)
      expect(response.body.errors).toBeDefined()
    })
  })

  // =============================================================================
  // DELETE ENDPOINTS
  // Tests for deleting resources
  // =============================================================================

  describe('DELETE /api/resources/:id', () => {
    it('should delete existing resource', async () => {
      // Arrange
      const resourceId = 'resource-123'

      // Act
      const response = await request(app)
        .delete(`/api/resources/${resourceId}`)
        .set('Authorization', `Bearer ${authToken}`)

      // Assert
      expect(response.status).toBe(204)
      expect(response.body).toEqual({})

      // Verify deletion
      const getResponse = await request(app)
        .get(`/api/resources/${resourceId}`)
        .set('Authorization', `Bearer ${authToken}`)
      expect(getResponse.status).toBe(404)
    })

    it('should return 404 for non-existent resource', async () => {
      // Arrange
      const nonExistentId = 'non-existent-123'

      // Act
      const response = await request(app)
        .delete(`/api/resources/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)

      // Assert
      expect(response.status).toBe(404)
    })

    it('should return 401 without authentication', async () => {
      // Arrange
      const resourceId = 'resource-123'

      // Act
      const response = await request(app)
        .delete(`/api/resources/${resourceId}`)
        // No Authorization header

      // Assert
      expect(response.status).toBe(401)
    })
  })

  // =============================================================================
  // ERROR HANDLING
  // Tests for error scenarios
  // =============================================================================

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      // Act
      const response = await request(app)
        .post('/api/resources')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('invalid json')

      // Assert
      expect(response.status).toBe(400)
      expect(response.body.error).toBeDefined()
    })

    it('should handle unsupported media types', async () => {
      // Act
      const response = await request(app)
        .post('/api/resources')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'text/xml')
        .send('<data>test</data>')

      // Assert
      expect(response.status).toBe(415)
    })

    it('should handle rate limiting', async () => {
      // Arrange
      const requests = Array.from({ length: 101 }, (_, i) =>
        request(app)
          .get('/api/resources')
          .set('Authorization', `Bearer ${authToken}`)
      )

      // Act
      const responses = await Promise.all(requests)

      // Assert - Last request should be rate limited
      expect(responses[responses.length - 1].status).toBe(429)
    })

    it('should handle server errors gracefully', async () => {
      // Act
      const response = await request(app)
        .get('/api/resources/error')

      // Assert
      expect(response.status).toBe(500)
      expect(response.body.error).toBeDefined()
    })
  })

  // =============================================================================
  // HEADERS AND METADATA
  // Tests for HTTP headers and response metadata
  // =============================================================================

  describe('Headers and Metadata', () => {
    it('should include CORS headers', async () => {
      // Act
      const response = await request(app)
        .get('/api/resources')
        .set('Authorization', `Bearer ${authToken}`)

      // Assert
      expect(response.headers['access-control-allow-origin']).toBeDefined()
    })

    it('should include content-type header', async () => {
      // Act
      const response = await request(app)
        .get('/api/resources')
        .set('Authorization', `Bearer ${authToken}`)

      // Assert
      expect(response.headers['content-type']).toContain('application/json')
    })

    it('should respect conditional requests', async () => {
      // Arrange
      const resourceId = 'resource-123'

      // Act
      const firstResponse = await request(app)
        .get(`/api/resources/${resourceId}`)
        .set('Authorization', `Bearer ${authToken}`)

      const etag = firstResponse.headers['etag']

      const secondResponse = await request(app)
        .get(`/api/resources/${resourceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('If-None-Match', etag)

      // Assert
      expect(secondResponse.status).toBe(304)
    })
  })
})

// =============================================================================
// HELPER FUNCTIONS
// Setup test routes for the Express app
// =============================================================================

function setupTestRoutes(app: Express) {
  // Authentication route
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({
        errors: [
          { field: 'username', message: 'Username is required' },
          { field: 'password', message: 'Password is required' },
        ],
      })
    }

    if (username === 'testuser' && password === 'password123') {
      return res.json({
        token: 'test-token-123',
        user: { id: 'user-123', username },
      })
    }

    res.status(401).json({ error: 'Invalid credentials' })
  })

  // Get resource by ID
  app.get('/api/resources/:id', (req: Request, res: Response) => {
    const { id } = req.params
    const include = req.query.include?.toString().split(',')

    const resource: any = {
      id,
      name: 'Test Resource',
      description: 'A test resource',
    }

    if (include?.includes('metadata')) {
      resource.metadata = { created: '2024-01-01', version: '1.0' }
    }

    if (include?.includes('stats')) {
      resource.stats = { views: 100, likes: 50 }
    }

    if (id === 'non-existent-123') {
      return res.status(404).json({ error: 'Resource not found' })
    }

    res.json(resource)
  })

  // List resources
  app.get('/api/resources', (req: Request, res: Response) => {
    const page = parseInt(req.query.page?.toString() || '1')
    const limit = parseInt(req.query.limit?.toString() || '10')
    const status = req.query.status?.toString()
    const category = req.query.category?.toString()
    const sort = req.query.sort?.toString() || 'id'
    const order = req.query.order?.toString() || 'asc'

    let resources = [
      { id: '1', name: 'Resource 1', status: 'active', category: 'test' },
      { id: '2', name: 'Resource 2', status: 'active', category: 'test' },
      { id: '3', name: 'Resource 3', status: 'inactive', category: 'other' },
    ]

    // Apply filters
    if (status) {
      resources = resources.filter(r => r.status === status)
    }
    if (category) {
      resources = resources.filter(r => r.category === category)
    }

    // Apply sorting
    resources.sort((a, b) => {
      const aVal = (a as any)[sort]
      const bVal = (b as any)[sort]
      return order === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal)
    })

    // Apply pagination
    const start = (page - 1) * limit
    const paginatedResources = resources.slice(start, start + limit)

    res.json({
      data: paginatedResources,
      pagination: {
        page,
        limit,
        total: resources.length,
      },
    })
  })

  // Create resource
  app.post('/api/resources', (req: Request, res: Response) => {
    const { name, description, category } = req.body

    if (!name) {
      return res.status(400).json({
        errors: [{ field: 'name', message: 'Name is required' }],
      })
    }

    if (req.body.id === 'existing-123') {
      return res.status(409).json({ error: 'Resource already exists' })
    }

    res.status(201).json({
      id: `resource-${Date.now()}`,
      name,
      description,
      category,
      createdAt: new Date().toISOString(),
    })
  })

  // Update resource
  app.patch('/api/resources/:id', (req: Request, res: Response) => {
    const { id } = req.params
    const updates = req.body

    if (id === 'non-existent-123') {
      return res.status(404).json({ error: 'Resource not found' })
    }

    if (updates.name === '') {
      return res.status(400).json({
        errors: [{ field: 'name', message: 'Name cannot be empty' }],
      })
    }

    res.json({
      id,
      name: 'Test Resource',
      ...updates,
      updatedAt: new Date().toISOString(),
    })
  })

  // Delete resource
  app.delete('/api/resources/:id', (req: Request, res: Response) => {
    const { id } = req.params

    if (id === 'non-existent-123') {
      return res.status(404).json({ error: 'Resource not found' })
    }

    res.status(204).send()
  })

  // Error endpoint
  app.get('/api/resources/error', () => {
    throw new Error('Internal server error')
  })

  // Error handler
  app.use((err: any, req: Request, res: Response, next: any) => {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  })
}

// =============================================================================
// RUNNING THE TESTS
// =============================================================================
//
// Run all API tests:
//   npm test -- tests/examples/api-test-example.test.ts
//
// Run with coverage:
//   npm test -- tests/examples/api-test-example.test.ts --coverage
//
// Run specific test suite:
//   npm test -- tests/examples/api-test-example.test.ts -t "GET endpoints"
//
// Run with verbose output:
//   npm test -- tests/examples/api-test-example.test.ts --reporter=verbose
//
// Run in watch mode:
//   npm test -- tests/examples/api-test-example.test.ts --watch
//
// Run with debug output:
//   npm test -- tests/examples/api-test-example.test.ts --debug
// =============================================================================
