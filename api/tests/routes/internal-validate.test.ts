/**
 * Internal Validation Endpoints Tests
 *
 * Tests the /internal/validate/* routes that Claude agents use
 * to pre-validate payloads before submitting to the real API.
 *
 * These routes are localhost-only and have no authentication.
 *
 * @testType Unit
 * @category Validation
 */

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import express, { Express } from 'express'
import validateRouter from '../../src/routes/internal/validate.routes.js'

describe('POST /internal/validate/plan', () => {
  let app: Express

  beforeAll(() => {
    app = express()
    app.use(express.json())
    app.use('/internal/validate', validateRouter)
  })

  it('returns 200 for a valid plan with all required fields', async () => {
    const res = await request(app)
      .post('/internal/validate/plan')
      .send({
        name: 'Deploy backend',
        tasks: [
          {
            id: 'task-1',
            name: 'Build Docker image',
            prompt: 'Build the Docker image for the backend service',
            cwd: '/root/projects/my-app',
            workspace: '/root/projects/my-app',
          },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })

  it('returns 200 for a valid plan with optional fields', async () => {
    const res = await request(app)
      .post('/internal/validate/plan')
      .send({
        name: 'Full deploy',
        tasks: [
          {
            id: 'task-1',
            name: 'Run tests',
            prompt: 'Run all unit tests',
            cwd: '/root/projects/my-app',
            workspace: '/root/projects/my-app',
            tools: ['Bash', 'Read'],
            permission_mode: 'acceptEdits',
            depends_on: [],
            env_context: 'staging environment',
            attachment_ids: ['att-1'],
          },
        ],
        project_id: 'proj-123',
        status: 'pending',
      })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/internal/validate/plan')
      .send({
        tasks: [{ id: 't1', name: 'Task', prompt: 'do it', cwd: '/a', workspace: '/a' }],
      })

    expect(res.status).toBe(400)
    expect(res.text).toContain("Campo 'name'")
  })

  it('returns 400 when tasks is empty', async () => {
    const res = await request(app)
      .post('/internal/validate/plan')
      .send({
        name: 'Empty plan',
        tasks: [],
      })

    expect(res.status).toBe(400)
    expect(res.text).toContain("Campo 'tasks'")
    expect(res.text).toContain('pelo menos 1 tarefa')
  })

  it('returns 400 when a task is missing required fields', async () => {
    const res = await request(app)
      .post('/internal/validate/plan')
      .send({
        name: 'Bad plan',
        tasks: [
          {
            id: 'task-1',
            // missing name, prompt, cwd, workspace
          },
        ],
      })

    expect(res.status).toBe(400)
    const body = res.text
    expect(body).toContain('erros de validação')
    // Should report multiple missing fields within tasks[0]
  })

  it('returns 400 when status has an invalid value', async () => {
    const res = await request(app)
      .post('/internal/validate/plan')
      .send({
        name: 'Bad status',
        tasks: [{ id: 't1', name: 'T', prompt: 'p', cwd: '/a', workspace: '/a' }],
        status: 'invalid-status',
      })

    expect(res.status).toBe(400)
    expect(res.text).toContain("Campo 'status'")
  })

  it('returns 400 when body is not valid JSON', async () => {
    const res = await request(app)
      .post('/internal/validate/plan')
      .set('Content-Type', 'application/json')
      .send('not json')

    expect(res.status).toBe(400)
  })
})

describe('POST /internal/validate/team', () => {
  let app: Express

  beforeAll(() => {
    app = express()
    app.use(express.json())
    app.use('/internal/validate', validateRouter)
  })

  it('returns 200 for a valid team update body', async () => {
    const res = await request(app)
      .post('/internal/validate/team')
      .send({
        name: 'backend-team',
        project_id: 'proj-abc',
        role: 'coder',
        model: 'claude-sonnet-4-6',
      })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })

  it('returns 200 for a valid team template body', async () => {
    const res = await request(app)
      .post('/internal/validate/team')
      .send({
        id: 'plan-team',
        name: 'Plan Team',
        label: 'Plan Team',
        role: 'planner',
        subAgents: [
          { name: 'planner', role: 'planner', description: 'Plans work' },
          { name: 'coder', role: 'coder', description: 'Writes code' },
        ],
        permissions: { allow: ['Read'], deny: [] },
        claudeMd: '# Planner\n\nYou plan tasks.',
      })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/internal/validate/team')
      .send({
        project_id: 'proj-abc',
      })

    expect(res.status).toBe(400)
    expect(res.text).toContain("Campo 'name'")
  })

  it('returns 400 when project_id is missing', async () => {
    const res = await request(app)
      .post('/internal/validate/team')
      .send({
        name: 'my-team',
      })

    expect(res.status).toBe(400)
    expect(res.text).toContain("Campo 'project_id'")
  })

  it('returns 400 when role is invalid', async () => {
    const res = await request(app)
      .post('/internal/validate/team')
      .send({
        name: 'my-team',
        project_id: 'proj-abc',
        role: 'invalid-role',
      })

    expect(res.status).toBe(400)
    expect(res.text).toContain("Campo 'role'")
  })

  it('returns 400 when model is invalid', async () => {
    const res = await request(app)
      .post('/internal/validate/team')
      .send({
        name: 'my-team',
        project_id: 'proj-abc',
        model: 'gpt-4',
      })

    expect(res.status).toBe(400)
    expect(res.text).toContain("Campo 'model'")
  })

  it('returns 400 when a sub-agent has an invalid role', async () => {
    const res = await request(app)
      .post('/internal/validate/team')
      .send({
        id: 'dev-team',
        name: 'Dev Team',
        label: 'Dev Team',
        role: 'coder',
        subAgents: [
          { name: 'agent-1', role: 'nonexistent', description: 'Invalid' },
        ],
      })

    expect(res.status).toBe(400)
    expect(res.text).toContain('subAgents')
  })
})

describe('POST /internal/validate/agent', () => {
  let app: Express

  beforeAll(() => {
    app = express()
    app.use(express.json())
    app.use('/internal/validate', validateRouter)
  })

  // --- CLAUDE.md content ---

  it('returns 200 for valid CLAUDE.md content', async () => {
    const res = await request(app)
      .post('/internal/validate/agent')
      .send({
        content: '# Backend Agent\n\nYou are a backend developer.\n\n## Rules\n- Always write tests.',
      })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })

  it('returns 400 when content is missing for CLAUDE.md update', async () => {
    const res = await request(app)
      .post('/internal/validate/agent')
      .send({})

    expect(res.status).toBe(400)
    // {} is routed to the CLAUDE.md schema (no settings/model/role keys)
    expect(res.text).toContain("Campo 'content'")
  })

  it('returns 400 when content is empty string', async () => {
    const res = await request(app)
      .post('/internal/validate/agent')
      .send({ content: '' })

    expect(res.status).toBe(400)
    expect(res.text).toContain("Campo 'content'")
  })

  // --- Settings ---

  it('returns 200 for valid settings object', async () => {
    const res = await request(app)
      .post('/internal/validate/agent')
      .send({
        settings: {
          env: { ANTHROPIC_MODEL: 'claude-sonnet-4-6' },
          permissions: {
            allow: ['Read', 'Write', 'Bash'],
            deny: [],
            additionalDirectories: ['/root/projects/app'],
          },
        },
      })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })

  it('returns 400 when settings is not an object', async () => {
    const res = await request(app)
      .post('/internal/validate/agent')
      .send({
        settings: 'not-an-object',
      })

    expect(res.status).toBe(400)
    expect(res.text).toContain("Campo 'settings'")
  })

  // --- Model / Role update ---

  it('returns 200 for valid model update', async () => {
    const res = await request(app)
      .post('/internal/validate/agent')
      .send({ model: 'claude-opus-4-6' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })

  it('returns 200 for valid role update', async () => {
    const res = await request(app)
      .post('/internal/validate/agent')
      .send({ role: 'reviewer' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })

  it('returns 200 for valid model + role update', async () => {
    const res = await request(app)
      .post('/internal/validate/agent')
      .send({ model: 'claude-haiku-4-5-20251001', role: 'tester' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })

  it('returns 400 when model is invalid', async () => {
    const res = await request(app)
      .post('/internal/validate/agent')
      .send({ model: 'invalid-model' })

    expect(res.status).toBe(400)
    expect(res.text).toContain("Campo 'model'")
  })

  it('returns 400 when role is invalid', async () => {
    const res = await request(app)
      .post('/internal/validate/agent')
      .send({ role: 'manager' })

    expect(res.status).toBe(400)
    expect(res.text).toContain("Campo 'role'")
  })
})

describe('Error format', () => {
  let app: Express

  beforeAll(() => {
    app = express()
    app.use(express.json())
    app.use('/internal/validate', validateRouter)
  })

  it('returns plain-text errors with Content-Type text/plain', async () => {
    const res = await request(app)
      .post('/internal/validate/plan')
      .send({})

    expect(res.status).toBe(400)
    expect(res.headers['content-type']).toMatch(/text\/plain/)
  })

  it('formats single error with singular message', async () => {
    const res = await request(app)
      .post('/internal/validate/team')
      .send({ name: 'my-team', project_id: 'p', role: 'invalid' })

    expect(res.status).toBe(400)
    expect(res.text).toContain('1 erro de validação')
  })

  it('formats multiple errors with plural message', async () => {
    const res = await request(app)
      .post('/internal/validate/plan')
      .send({})

    expect(res.status).toBe(400)
    expect(res.text).toContain('erros de validação')
    // Should list errors with numbered items
    expect(res.text).toMatch(/\d+\.\s*Campo/)
  })
})
