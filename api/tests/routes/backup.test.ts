/**
 * Backup & Restore API Route Tests
 *
 * Tests the backup/restore system including:
 * - Export: collects all DB data + agent workspace filesystem data
 * - Import: restores DB data with new IDs + agent workspaces on disk
 * - Info: preview of what would be exported
 * - Validation: rejects invalid backup files
 * - ID remapping: foreign keys are correctly remapped during import
 *
 * @testType Integration
 * @category Backup
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express, { Express } from 'express'
import { db } from '../../src/db/index.js'
import authRouter from '../../src/routes/auth.js'
import backupRouter from '../../src/routes/backup.js'
import projectsRouter from '../../src/routes/projects.js'
import plansRouter from '../../src/routes/plans.js'
import kanbanRouter from '../../src/routes/kanban.js'
import chatSessionsRouter from '../../src/routes/chatSessions.js'
import environmentVariablesRouter from '../../src/routes/environmentVariables.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a test Express app with all relevant routes mounted */
function createApp(): Express {
  const app = express()
  app.use(express.json())
  app.set('trust proxy', true)
  app.use('/api/auth', authRouter)
  app.use('/api/backup', backupRouter)
  app.use('/api/projects', projectsRouter)
  app.use('/api/plans', plansRouter)
  app.use('/api/kanban', kanbanRouter)
  app.use('/api/sessions', chatSessionsRouter)
  app.use('/api/environment-variables', environmentVariablesRouter)
  return app
}

/** Setup owner + get JWT token */
async function setupAndGetToken(app: Express, password = 'testpass123'): Promise<string> {
  await request(app)
    .post('/api/auth/setup')
    .set('X-Forwarded-For', '127.0.0.1')
    .send({ password, confirmPassword: password })
    .expect(201)

  const loginRes = await request(app)
    .post('/api/auth/login')
    .set('X-Forwarded-For', '127.0.0.1')
    .send({ password })
    .expect(200)

  return loginRes.body.data.token
}

/** Clean all DB tables */
function cleanDb() {
  const tables = [
    'kanban_tasks', 'kanban_templates',
    'chat_messages', 'chat_sessions',
    'plan_logs', 'approvals', 'plans',
    'agent_environments', 'project_agents', 'environments',
    'workspace_roles', 'workspace_models',
    'environment_variables',
    'projects', 'users',
  ]
  for (const table of tables) {
    try { db.exec(`DELETE FROM ${table}`) } catch {}
  }
}

/** Create a temp directory for agent workspaces */
let tempAgentsDir: string
let originalDataDir: string | undefined
let originalAgentsBasePath: string | undefined

function setupTempAgentsDir() {
  tempAgentsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'weave-test-agents-'))
  // Save original env vars
  originalDataDir = process.env.DATA_DIR
  originalAgentsBasePath = process.env.AGENTS_BASE_PATH
  // Override for the test — clear DATA_DIR so AGENTS_BASE_PATH takes priority
  delete process.env.DATA_DIR
  process.env.AGENTS_BASE_PATH = tempAgentsDir
}

function cleanupTempAgentsDir() {
  if (tempAgentsDir && fs.existsSync(tempAgentsDir)) {
    fs.rmSync(tempAgentsDir, { recursive: true, force: true })
  }
  // Restore original env vars
  if (originalDataDir !== undefined) process.env.DATA_DIR = originalDataDir
  else delete process.env.DATA_DIR
  if (originalAgentsBasePath !== undefined) process.env.AGENTS_BASE_PATH = originalAgentsBasePath
  else delete process.env.AGENTS_BASE_PATH
}

/** Create a test agent workspace on the filesystem */
function createTestAgentWorkspace(projectSlug: string, agentName: string, opts?: {
  claudeMd?: string
  settings?: Record<string, any>
  skills?: { name: string; content: string }[]
}) {
  const agentPath = path.join(tempAgentsDir, projectSlug, 'agents', agentName)
  fs.mkdirSync(agentPath, { recursive: true })

  if (opts?.claudeMd) {
    fs.writeFileSync(path.join(agentPath, 'CLAUDE.md'), opts.claudeMd, 'utf-8')
  }

  if (opts?.settings) {
    const claudeDir = path.join(agentPath, '.claude')
    fs.mkdirSync(claudeDir, { recursive: true })
    fs.writeFileSync(
      path.join(claudeDir, 'settings.local.json'),
      JSON.stringify(opts.settings, null, 2),
      'utf-8'
    )
  }

  if (opts?.skills) {
    for (const skill of opts.skills) {
      const skillDir = path.join(agentPath, '.claude', 'skills', skill.name)
      fs.mkdirSync(skillDir, { recursive: true })
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skill.content, 'utf-8')
    }
  }

  return agentPath
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Backup API', () => {
  let app: Express
  let token: string

  beforeAll(() => {
    app = createApp()
  })

  beforeEach(async () => {
    cleanDb()
    setupTempAgentsDir()
    token = await setupAndGetToken(app)
  })

  afterEach(() => {
    cleanDb()
    cleanupTempAgentsDir()
  })

  // =========================================================================
  // GET /api/backup/info
  // =========================================================================
  describe('GET /api/backup/info', () => {
    it('should require authentication', async () => {
      await request(app)
        .get('/api/backup/info')
        .expect(401)
    })

    it('should return zero counts when database is empty', async () => {
      const res = await request(app)
        .get('/api/backup/info')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      const data = res.body.data
      expect(data.projects).toBe(0)
      expect(data.environments).toBe(0)
      expect(data.plans).toBe(0)
      expect(data.kanban_tasks).toBe(0)
      expect(data.chat_sessions).toBe(0)
      expect(data.chat_messages).toBe(0)
      expect(data.environment_variables).toBe(0)
      expect(data.agent_workspaces).toBe(0)
    })

    it('should return correct counts after creating data', async () => {
      // Create a project
      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test Project' })
        .expect(201)

      // Create an agent workspace on disk
      createTestAgentWorkspace('test-project', 'coder', {
        claudeMd: '# Coder Agent',
        settings: { env: { TEST: 'value' } },
      })

      const res = await request(app)
        .get('/api/backup/info')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      const data = res.body.data
      expect(data.projects).toBe(1)
      expect(data.agent_workspaces).toBe(1)
    })
  })

  // =========================================================================
  // POST /api/backup/export
  // =========================================================================
  describe('POST /api/backup/export', () => {
    it('should require authentication', async () => {
      await request(app)
        .post('/api/backup/export')
        .expect(401)
    })

    it('should export a valid backup structure', async () => {
      const res = await request(app)
        .post('/api/backup/export')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      const backup = res.body.data
      expect(backup.version).toBe('1.0.0')
      expect(backup.exported_at).toBeDefined()
      expect(Array.isArray(backup.projects)).toBe(true)
      expect(Array.isArray(backup.environments)).toBe(true)
      expect(Array.isArray(backup.plans)).toBe(true)
      expect(Array.isArray(backup.kanban_tasks)).toBe(true)
      expect(Array.isArray(backup.chat_sessions)).toBe(true)
      expect(Array.isArray(backup.chat_messages)).toBe(true)
      expect(Array.isArray(backup.environment_variables)).toBe(true)
      expect(Array.isArray(backup.approvals)).toBe(true)
      expect(Array.isArray(backup.agent_workspaces)).toBe(true)
    })

    it('should export projects with their data', async () => {
      // Create a project
      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'My Project', description: 'A test project', color: '#ff0000' })
        .expect(201)

      const res = await request(app)
        .post('/api/backup/export')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      const backup = res.body.data
      expect(backup.projects).toHaveLength(1)
      expect(backup.projects[0].name).toBe('My Project')
      expect(backup.projects[0].description).toBe('A test project')
      expect(backup.projects[0].color).toBe('#ff0000')
      expect(backup.metadata.projects_count).toBe(1)
    })

    it('should export agent workspaces from filesystem', async () => {
      createTestAgentWorkspace('my-app', 'coder', {
        claudeMd: '# My Coder\nYou are a helpful coder.',
        settings: { env: { MODEL: 'claude-sonnet-4-20250514' } },
        skills: [
          { name: 'review', content: '# Review Skill\nReview code quality.' },
          { name: 'debug', content: '# Debug Skill\nDebug issues.' },
        ],
      })

      const res = await request(app)
        .post('/api/backup/export')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      const backup = res.body.data
      expect(backup.agent_workspaces).toHaveLength(1)
      expect(backup.agent_workspaces[0].relative_path).toBe('my-app/agents/coder')
      expect(backup.agent_workspaces[0].claude_md).toContain('My Coder')
      expect(backup.agent_workspaces[0].settings.env.MODEL).toBe('claude-sonnet-4-20250514')
      expect(backup.agent_workspaces[0].skills).toHaveLength(2)
      const skillNames = backup.agent_workspaces[0].skills.map((s: any) => s.name)
      expect(skillNames).toContain('review')
      expect(skillNames).toContain('debug')
      expect(backup.metadata.agents_count).toBe(1)
    })

    it('should export environment variables', async () => {
      await request(app)
        .post('/api/environment-variables')
        .set('Authorization', `Bearer ${token}`)
        .send({ key: 'TEST_VAR', value: 'test_value', category: 'general' })
        .expect(201)

      const res = await request(app)
        .post('/api/backup/export')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      const backup = res.body.data
      expect(backup.environment_variables).toHaveLength(1)
      expect(backup.environment_variables[0].key).toBe('TEST_VAR')
    })
  })

  // =========================================================================
  // POST /api/backup/import
  // =========================================================================
  describe('POST /api/backup/import', () => {
    it('should require authentication', async () => {
      await request(app)
        .post('/api/backup/import')
        .expect(401)
    })

    it('should reject invalid backup (missing version)', async () => {
      await request(app)
        .post('/api/backup/import')
        .set('Authorization', `Bearer ${token}`)
        .send({ exported_at: new Date().toISOString() })
        .expect(400)
    })

    it('should reject invalid backup (missing exported_at)', async () => {
      await request(app)
        .post('/api/backup/import')
        .set('Authorization', `Bearer ${token}`)
        .send({ version: '1.0.0' })
        .expect(400)
    })

    it('should reject invalid backup (missing projects)', async () => {
      await request(app)
        .post('/api/backup/import')
        .set('Authorization', `Bearer ${token}`)
        .send({ version: '1.0.0', exported_at: new Date().toISOString(), projects: 'not-array' })
        .expect(400)
    })

    it('should import projects with new IDs', async () => {
      // First, create and export
      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Original Project' })
        .expect(201)

      const exportRes = await request(app)
        .post('/api/backup/export')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      const backup = exportRes.body.data
      const originalId = backup.projects[0].id

      // Clear and import
      cleanDb()
      // Re-setup user so we have a valid token
      token = await setupAndGetToken(app)

      const importRes = await request(app)
        .post('/api/backup/import')
        .set('Authorization', `Bearer ${token}`)
        .send(backup)
        .expect(200)

      expect(importRes.body.data.projects_imported).toBe(1)

      // Verify project was created with a NEW id
      const projects = db.prepare('SELECT * FROM projects').all() as any[]
      expect(projects).toHaveLength(1)
      expect(projects[0].name).toBe('Original Project')
      expect(projects[0].id).not.toBe(originalId)
    })

    it('should import agent workspaces to filesystem', async () => {
      const backup = {
        version: '1.0.0',
        exported_at: new Date().toISOString(),
        metadata: { projects_count: 0, environments_count: 0, agents_count: 1, plans_count: 0, kanban_tasks_count: 0, kanban_templates_count: 0, chat_sessions_count: 0, chat_messages_count: 0, environment_variables_count: 0, approvals_count: 0 },
        projects: [],
        environments: [],
        project_agents: [],
        agent_environments: [],
        workspace_roles: [],
        workspace_models: [],
        plans: [],
        plan_logs: [],
        kanban_tasks: [],
        kanban_templates: [],
        chat_sessions: [],
        chat_messages: [],
        environment_variables: [],
        approvals: [],
        agent_workspaces: [
          {
            relative_path: 'test-app/agents/coder',
            claude_md: '# Test Coder\nHello world.',
            settings: { env: { MY_VAR: '123' } },
            skills: [
              { name: 'test-skill', content: '# Test Skill\nDo things.' },
            ],
            agents: [
              { name: 'sub-agent.md', content: '# Sub Agent\nA sub-agent.' },
            ],
          },
        ],
      }

      const res = await request(app)
        .post('/api/backup/import')
        .set('Authorization', `Bearer ${token}`)
        .send(backup)
        .expect(200)

      expect(res.body.data.agents_restored).toBe(1)

      // Verify files were created on disk
      const agentPath = path.join(tempAgentsDir, 'test-app', 'agents', 'coder')
      expect(fs.existsSync(path.join(agentPath, 'CLAUDE.md'))).toBe(true)
      expect(fs.existsSync(path.join(agentPath, '.claude', 'settings.local.json'))).toBe(true)
      expect(fs.existsSync(path.join(agentPath, '.claude', 'skills', 'test-skill', 'SKILL.md'))).toBe(true)
      expect(fs.existsSync(path.join(agentPath, '.claude', 'agents', 'sub-agent.md'))).toBe(true)

      // Verify content
      const claudeMd = fs.readFileSync(path.join(agentPath, 'CLAUDE.md'), 'utf-8')
      expect(claudeMd).toContain('# Test Coder')

      const settings = JSON.parse(fs.readFileSync(path.join(agentPath, '.claude', 'settings.local.json'), 'utf-8'))
      expect(settings.env.MY_VAR).toBe('123')
    })

    it('should handle import gracefully when agent workspace restoration fails', async () => {
      const backup = {
        version: '1.0.0',
        exported_at: new Date().toISOString(),
        metadata: { projects_count: 0, environments_count: 0, agents_count: 1, plans_count: 0, kanban_tasks_count: 0, kanban_templates_count: 0, chat_sessions_count: 0, chat_messages_count: 0, environment_variables_count: 0, approvals_count: 0 },
        projects: [],
        environments: [],
        project_agents: [],
        agent_environments: [],
        workspace_roles: [],
        workspace_models: [],
        plans: [],
        plan_logs: [],
        kanban_tasks: [],
        kanban_templates: [],
        chat_sessions: [],
        chat_messages: [],
        environment_variables: [],
        approvals: [],
        agent_workspaces: [
          {
            relative_path: '',
            claude_md: null,
            settings: null,
            skills: [],
            agents: [],
          },
        ],
      }

      // An empty relative_path would cause path issues, but import should still succeed
      const res = await request(app)
        .post('/api/backup/import')
        .set('Authorization', `Bearer ${token}`)
        .send(backup)
        .expect(200)

      expect(res.body.data.projects_imported).toBe(0)
    })

    it('should import environment variables with new IDs', async () => {
      const backup = {
        version: '1.0.0',
        exported_at: new Date().toISOString(),
        metadata: { projects_count: 0, environments_count: 0, agents_count: 0, plans_count: 0, kanban_tasks_count: 0, kanban_templates_count: 0, chat_sessions_count: 0, chat_messages_count: 0, environment_variables_count: 2, approvals_count: 0 },
        projects: [],
        environments: [],
        project_agents: [],
        agent_environments: [],
        workspace_roles: [],
        workspace_models: [],
        plans: [],
        plan_logs: [],
        kanban_tasks: [],
        kanban_templates: [],
        chat_sessions: [],
        chat_messages: [],
        environment_variables: [
          { id: 'old-id-1', key: 'API_KEY', value: 'secret123', description: 'My API key', category: 'anthropic', is_secret: true },
          { id: 'old-id-2', key: 'BASE_URL', value: 'http://localhost:8083', description: 'Base URL', category: 'general', is_secret: false },
        ],
        approvals: [],
        agent_workspaces: [],
      }

      const res = await request(app)
        .post('/api/backup/import')
        .set('Authorization', `Bearer ${token}`)
        .send(backup)
        .expect(200)

      expect(res.body.data.env_vars_imported).toBe(2)

      const envVars = db.prepare('SELECT * FROM environment_variables').all() as any[]
      expect(envVars).toHaveLength(2)
      expect(envVars[0].key).toBe('API_KEY')
      expect(envVars[0].value).toBe('secret123')
      expect(envVars[0].id).not.toBe('old-id-1')
      expect(envVars[1].key).toBe('BASE_URL')
    })
  })

  // =========================================================================
  // Full round-trip: export → clear → import → verify
  // =========================================================================
  describe('Full round-trip (export → clear → import)', () => {
    it('should preserve all data through a full round-trip', async () => {
      // Create test data
      const projectRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Round-Trip Project', description: 'Test data for round-trip' })
        .expect(201)

      const projectId = projectRes.body.data.id

      // Create environment variable
      await request(app)
        .post('/api/environment-variables')
        .set('Authorization', `Bearer ${token}`)
        .send({ key: 'RT_VAR', value: 'rt_value', category: 'general' })
        .expect(201)

      // Create an agent workspace
      createTestAgentWorkspace('round-trip-project', 'dev', {
        claudeMd: '# Dev Agent\nRound trip test.',
        settings: { env: { RT: 'true' } },
        skills: [{ name: 'deploy', content: '# Deploy Skill\nDeploy code.' }],
      })

      // Export
      const exportRes = await request(app)
        .post('/api/backup/export')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      const backup = exportRes.body.data

      // Clear everything
      cleanDb()
      cleanupTempAgentsDir()
      setupTempAgentsDir()

      // Re-setup user
      token = await setupAndGetToken(app)

      // Verify DB is empty
      const emptyProjects = db.prepare('SELECT COUNT(*) as c FROM projects').get() as any
      expect(emptyProjects.c).toBe(0)

      const emptyEnvVars = db.prepare('SELECT COUNT(*) as c FROM environment_variables').get() as any
      expect(emptyEnvVars.c).toBe(0)

      // Import
      const importRes = await request(app)
        .post('/api/backup/import')
        .set('Authorization', `Bearer ${token}`)
        .send(backup)
        .expect(200)

      const result = importRes.body.data
      expect(result.projects_imported).toBe(1)
      expect(result.env_vars_imported).toBe(1)
      expect(result.agents_restored).toBe(1)

      // Verify DB was restored
      const projects = db.prepare('SELECT * FROM projects').all() as any[]
      expect(projects).toHaveLength(1)
      expect(projects[0].name).toBe('Round-Trip Project')
      expect(projects[0].description).toBe('Test data for round-trip')
      expect(projects[0].id).not.toBe(projectId) // new ID

      const envVars = db.prepare('SELECT * FROM environment_variables').all() as any[]
      expect(envVars).toHaveLength(1)
      expect(envVars[0].key).toBe('RT_VAR')
      expect(envVars[0].value).toBe('rt_value')

      // Verify agent workspace was restored
      const agentPath = path.join(tempAgentsDir, 'round-trip-project', 'agents', 'dev')
      expect(fs.existsSync(path.join(agentPath, 'CLAUDE.md'))).toBe(true)
      expect(fs.existsSync(path.join(agentPath, '.claude', 'settings.local.json'))).toBe(true)
      expect(fs.existsSync(path.join(agentPath, '.claude', 'skills', 'deploy', 'SKILL.md'))).toBe(true)
    })
  })
})
