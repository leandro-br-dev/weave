/**
 * Projects API Route Tests
 *
 * Tests the project creation endpoint including:
 * - Basic project creation
 * - Project creation with git_url
 * - Project creation with create_default_envs (auto environment creation)
 * - Validation errors (missing git_url when create_default_envs=true)
 * - Invalid git_url format
 *
 * @testType Integration
 * @category Projects
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import express, { Express } from 'express'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { db } from '../../src/db/index.js'

// Mock the git clone service to avoid actual git operations in tests
vi.mock('../../src/services/gitClone.js', () => ({
  isValidGitUrl: (url: string) => {
    if (!url || typeof url !== 'string') return false
    const trimmed = url.trim()
    return /^https?:\/\/.+/i.test(trimmed) || /^git@.+:.+/.test(trimmed) || /^git:\/\/.+/i.test(trimmed)
  },
  createDefaultEnvironments: (gitUrl: string, projectName: string) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'weave-test-env-'))
    return [
      {
        name: 'plan',
        project_path: path.join(tmpDir, projectName, 'plan'),
        branch: 'main',
        success: true,
      },
      {
        name: 'dev',
        project_path: path.join(tmpDir, projectName, 'dev'),
        branch: 'dev',
        success: true,
      },
      {
        name: 'staging',
        project_path: path.join(tmpDir, projectName, 'staging'),
        branch: 'staging',
        success: true,
      },
    ]
  },
  DEFAULT_ENVIRONMENTS: [],
  getProjectEnvsBaseDir: () => '',
  getEnvProjectPath: () => '',
  cloneRepository: () => 'main',
}))

// Mock auth middleware to bypass authentication
vi.mock('../../src/middleware/auth.js', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { userId: 'test-user', username: 'testuser' }
    next()
  },
}))

// Import after mocks are set up
import projectsRouter from '../../src/routes/projects.js'

describe('Projects API', () => {
  let app: Express

  beforeAll(() => {
    app = express()
    app.use(express.json())
    app.set('trust proxy', true)
    app.use('/api/projects', projectsRouter)
  })

  beforeEach(() => {
    // Clear all data in reverse dependency order
    const tables = [
      'kanban_tasks', 'kanban_templates',
      'chat_messages', 'chat_sessions',
      'plan_logs', 'approvals', 'plans',
      'environments', 'project_agents',
      'projects', 'users',
    ]
    for (const table of tables) {
      try { db.exec(`DELETE FROM ${table}`) } catch {}
    }
  })

  afterEach(() => {
    const tables = [
      'kanban_tasks', 'kanban_templates',
      'chat_messages', 'chat_sessions',
      'plan_logs', 'approvals', 'plans',
      'environments', 'project_agents',
      'projects', 'users',
    ]
    for (const table of tables) {
      try { db.exec(`DELETE FROM ${table}`) } catch {}
    }
  })

  // ===========================================================================
  // POST /api/projects — Basic creation
  // ===========================================================================
  describe('POST /api/projects', () => {
    it('should create a project with minimal fields', async () => {
      const res = await request(app)
        .post('/api/projects')
        .send({ name: 'Test Project' })
        .expect(201)

      expect(res.body.error).toBeNull()
      expect(res.body.data).toBeDefined()
      expect(res.body.data.name).toBe('Test Project')
      expect(res.body.data.id).toBeDefined()
      expect(res.body.data.environments).toEqual([])
    })

    it('should create a project with all fields', async () => {
      const res = await request(app)
        .post('/api/projects')
        .send({
          name: 'Full Project',
          description: 'A full test project',
          color: '#ff0000',
          git_url: 'https://github.com/user/repo.git',
        })
        .expect(201)

      expect(res.body.error).toBeNull()
      expect(res.body.data.name).toBe('Full Project')
      expect(res.body.data.description).toBe('A full test project')
      expect(res.body.data.color).toBe('#ff0000')
      expect(res.body.data.git_url).toBe('https://github.com/user/repo.git')
      expect(res.body.data.environments).toEqual([])
    })

    it('should reject project creation without name', async () => {
      const res = await request(app)
        .post('/api/projects')
        .send({ description: 'No name project' })
        .expect(400)

      expect(res.body.error).toBe('name is required')
      expect(res.body.data).toBeNull()
    })

    // ===========================================================================
    // Git URL validation
    // ===========================================================================
    describe('git_url validation', () => {
      it('should accept HTTPS git URL', async () => {
        const res = await request(app)
          .post('/api/projects')
          .send({
            name: 'HTTPS Project',
            git_url: 'https://github.com/user/repo.git',
          })
          .expect(201)

        expect(res.body.data.git_url).toBe('https://github.com/user/repo.git')
      })

      it('should accept SSH git URL', async () => {
        const res = await request(app)
          .post('/api/projects')
          .send({
            name: 'SSH Project',
            git_url: 'git@github.com:user/repo.git',
          })
          .expect(201)

        expect(res.body.data.git_url).toBe('git@github.com:user/repo.git')
      })

      it('should reject invalid git URL format', async () => {
        const res = await request(app)
          .post('/api/projects')
          .send({
            name: 'Invalid URL Project',
            git_url: 'not-a-valid-url',
          })
          .expect(400)

        expect(res.body.error).toContain('git_url must be a valid git URL')
      })
    })

    // ===========================================================================
    // create_default_envs feature
    // ===========================================================================
    describe('create_default_envs', () => {
      it('should reject create_default_envs without git_url', async () => {
        const res = await request(app)
          .post('/api/projects')
          .send({
            name: 'No Git URL Project',
            create_default_envs: true,
          })
          .expect(400)

        expect(res.body.error).toBe('git_url is required when create_default_envs is true')
      })

      it('should create project with default environments when create_default_envs=true', async () => {
        const res = await request(app)
          .post('/api/projects')
          .send({
            name: 'Auto Envs Project',
            git_url: 'https://github.com/user/repo.git',
            create_default_envs: true,
          })
          .expect(201)

        expect(res.body.error).toBeNull()
        expect(res.body.data.name).toBe('Auto Envs Project')
        expect(res.body.data.environments).toBeDefined()
        expect(res.body.data.environments.length).toBe(3)

        // Verify the three default environments were created
        const envNames = res.body.data.environments.map((e: any) => e.name)
        expect(envNames).toContain('plan')
        expect(envNames).toContain('dev')
        expect(envNames).toContain('staging')

        // Verify each environment has the correct structure
        for (const env of res.body.data.environments) {
          expect(env.id).toBeDefined()
          expect(env.type).toBe('local-wsl')
          expect(env.project_path).toBeDefined()
          expect(env.branch).toBeDefined()
        }

        // Verify environments were persisted in the database
        const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(res.body.data.id) as any
        expect(project).toBeDefined()

        const envs = db.prepare('SELECT * FROM environments WHERE project_id = ?').all(res.body.data.id) as any[]
        expect(envs.length).toBe(3)

        const dbEnvNames = envs.map((e: any) => e.name)
        expect(dbEnvNames).toContain('plan')
        expect(dbEnvNames).toContain('dev')
        expect(dbEnvNames).toContain('staging')
      })

      it('should not create environments when create_default_envs=false', async () => {
        const res = await request(app)
          .post('/api/projects')
          .send({
            name: 'No Auto Envs Project',
            git_url: 'https://github.com/user/repo.git',
            create_default_envs: false,
          })
          .expect(201)

        expect(res.body.data.environments).toEqual([])
      })

      it('should not create environments when create_default_envs is not provided', async () => {
        const res = await request(app)
          .post('/api/projects')
          .send({
            name: 'Default Behavior Project',
            git_url: 'https://github.com/user/repo.git',
          })
          .expect(201)

        expect(res.body.data.environments).toEqual([])
      })
    })

    // ===========================================================================
    // GET /api/projects/:id — Verify environment inclusion
    // ===========================================================================
    describe('GET /api/projects/:id', () => {
      it('should include auto-created environments when fetching project', async () => {
        // Create project with default environments
        const createRes = await request(app)
          .post('/api/projects')
          .send({
            name: 'Fetch Test Project',
            git_url: 'https://github.com/user/repo.git',
            create_default_envs: true,
          })
          .expect(201)

        const projectId = createRes.body.data.id

        // Fetch the project
        const fetchRes = await request(app)
          .get(`/api/projects/${projectId}`)
          .expect(200)

        expect(fetchRes.body.data.environments.length).toBe(3)
        const envNames = fetchRes.body.data.environments.map((e: any) => e.name)
        expect(envNames).toContain('plan')
        expect(envNames).toContain('dev')
        expect(envNames).toContain('staging')
      })
    })
  })
})
