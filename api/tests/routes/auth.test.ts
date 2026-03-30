/**
 * Auth API Route Tests — Single-User (Owner) Mode
 *
 * Tests the authentication system including:
 * - Initial setup flow (owner creation, password only)
 * - Login flow (password only + rate limiting)
 * - Token validation (JWT verification)
 * - Password management (change + reset)
 * - Registration is disabled (returns 403)
 *
 * @testType Integration
 * @category Auth
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import express, { Express } from 'express'
import { db } from '../../src/db/index.js'
import authRouter from '../../src/routes/auth.js'
import projectsRouter from '../../src/routes/projects.js'
import { generateToken } from '../../src/services/userService.js'

/**
 * Helper: perform setup via POST /api/auth/setup.
 *
 * The setup endpoint requires `requireLocalhost` middleware.
 * Supertest sends requests from `::ffff:127.0.0.1`, which does not
 * match the allowlist (`127.0.0.1`, `::1`, `localhost`).
 * We set `X-Forwarded-For: 127.0.0.1` so the middleware sees a
 * recognised localhost IP.
 */
async function setupOwner(
  app: Express,
  password: string,
): Promise<{ id: string; token: string }> {
  const res = await request(app)
    .post('/api/auth/setup')
    .set('X-Forwarded-For', '127.0.0.1')
    .send({ password, confirmPassword: password })
    .expect(201)

  return {
    id: res.body.data.user.id,
    token: res.body.data.token,
  }
}

/**
 * Helper: login via POST /api/auth/login (password only).
 *
 * @param fakeIp  Optional X-Forwarded-For IP. Useful to avoid rate-limit
 *                collisions when multiple tests share the same router.
 */
async function loginOwner(
  app: Express,
  password: string,
  fakeIp?: string,
): Promise<{ id: string; token: string }> {
  const req = request(app)
    .post('/api/auth/login')
    .send({ password })

  if (fakeIp) req.set('X-Forwarded-For', fakeIp)

  const res = await req.expect(200)

  return {
    id: res.body.data.user.id,
    token: res.body.data.token,
  }
}

describe('Auth API — Single-User Mode', () => {
  /** Test Express application with auth router mounted */
  let app: Express
  /** Test Express application with auth + projects routers */
  let fullApp: Express

  beforeAll(() => {
    app = express()
    app.use(express.json())
    app.set('trust proxy', true)
    app.use('/api/auth', authRouter)

    fullApp = express()
    fullApp.use(express.json())
    fullApp.set('trust proxy', true)
    fullApp.use('/api/auth', authRouter)
    fullApp.use('/api/projects', projectsRouter)
  })

  beforeEach(() => {
    // Clear all data in reverse dependency order
    try { db.exec('DELETE FROM kanban_tasks') } catch {}
    try { db.exec('DELETE FROM kanban_templates') } catch {}
    try { db.exec('DELETE FROM chat_messages') } catch {}
    try { db.exec('DELETE FROM chat_sessions') } catch {}
    try { db.exec('DELETE FROM plan_logs') } catch {}
    try { db.exec('DELETE FROM approvals') } catch {}
    try { db.exec('DELETE FROM plans') } catch {}
    try { db.exec('DELETE FROM environments') } catch {}
    try { db.exec('DELETE FROM project_agents') } catch {}
    try { db.exec('DELETE FROM projects') } catch {}
    try { db.exec('DELETE FROM users') } catch {}
  })

  afterEach(() => {
    try { db.exec('DELETE FROM kanban_tasks') } catch {}
    try { db.exec('DELETE FROM kanban_templates') } catch {}
    try { db.exec('DELETE FROM chat_messages') } catch {}
    try { db.exec('DELETE FROM chat_sessions') } catch {}
    try { db.exec('DELETE FROM plan_logs') } catch {}
    try { db.exec('DELETE FROM approvals') } catch {}
    try { db.exec('DELETE FROM plans') } catch {}
    try { db.exec('DELETE FROM environments') } catch {}
    try { db.exec('DELETE FROM project_agents') } catch {}
    try { db.exec('DELETE FROM projects') } catch {}
    try { db.exec('DELETE FROM users') } catch {}
  })

  // ===========================================================================
  // 1. Setup flow (owner creation — password only)
  // ===========================================================================
  describe('Setup flow (POST /api/auth/setup)', () => {
    it('should create owner user and return JWT with valid data', async () => {
      const { id, token } = await setupOwner(app, 'securepass123')

      expect(id).toBeDefined()
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(0)

      // Verify user was actually created in the database as "owner"
      const user = db.prepare("SELECT * FROM users WHERE username = 'owner'").get() as any
      expect(user).toBeDefined()
      expect(user.username).toBe('owner')
      expect(user.password_hash).toBeDefined()
    })

    it('should always create user with username "owner" regardless of input', async () => {
      const { id } = await setupOwner(app, 'securepass123')

      // Verify only the "owner" user exists
      const users = db.prepare('SELECT username FROM users').all() as any[]
      expect(users.length).toBe(1)
      expect(users[0].username).toBe('owner')
    })

    it('should fail when users already exist (403)', async () => {
      // Create the owner
      await setupOwner(app, 'password123')

      // Attempt a second setup should fail
      const response = await request(app)
        .post('/api/auth/setup')
        .set('X-Forwarded-For', '127.0.0.1')
        .send({
          password: 'password456',
          confirmPassword: 'password456',
        })
        .expect(403)

      expect(response.body.error).toContain('already been completed')
    })

    it('should reject mismatched passwords (400)', async () => {
      const response = await request(app)
        .post('/api/auth/setup')
        .set('X-Forwarded-For', '127.0.0.1')
        .send({
          password: 'password123',
          confirmPassword: 'differentpassword',
        })
        .expect(400)

      expect(response.body.error).toBe('Passwords do not match')
      expect(response.body.data).toBeNull()
    })

    it('should reject short password (400)', async () => {
      const response = await request(app)
        .post('/api/auth/setup')
        .set('X-Forwarded-For', '127.0.0.1')
        .send({
          password: '12345',
          confirmPassword: '12345',
        })
        .expect(400)

      expect(response.body.error).toBe('Password must be at least 6 characters long')
    })

    it('should assign all existing unowned data to the owner', async () => {
      // Create unowned projects and plans before setup
      db.prepare('INSERT INTO projects (id, name, description) VALUES (?, ?, ?)')
        .run('proj-unowned-1', 'Unowned Project 1', 'Before setup')
      db.prepare('INSERT INTO projects (id, name, description) VALUES (?, ?, ?)')
        .run('proj-unowned-2', 'Unowned Project 2', 'Also before setup')
      db.prepare('INSERT INTO plans (id, name, tasks, status) VALUES (?, ?, ?, ?)')
        .run('plan-unowned-1', 'Unowned Plan', '[]', 'pending')

      // Run setup
      const { id: ownerId } = await setupOwner(app, 'password123')

      // Verify projects were assigned
      const projects = db.prepare('SELECT * FROM projects WHERE user_id = ?').all(ownerId) as any[]
      expect(projects.length).toBe(2)

      // Verify plans were assigned
      const plans = db.prepare('SELECT * FROM plans WHERE user_id = ?').all(ownerId) as any[]
      expect(plans.length).toBe(1)
    })

    it('GET /api/auth/status shows hasUsers=false before setup and true after', async () => {
      // Check before setup
      const beforeResponse = await request(app)
        .get('/api/auth/status')
        .expect(200)

      expect(beforeResponse.body.data.hasUsers).toBe(false)
      expect(beforeResponse.body.data.currentUser).toBeNull()

      // Run setup
      await setupOwner(app, 'password123')

      // Check after setup
      const afterResponse = await request(app)
        .get('/api/auth/status')
        .expect(200)

      expect(afterResponse.body.data.hasUsers).toBe(true)
      expect(afterResponse.body.data.currentUser).toBeNull() // no token provided
    })
  })

  // ===========================================================================
  // 2. Login flow (password only)
  // ===========================================================================
  describe('Login flow (POST /api/auth/login)', () => {
    /**
     * Each test uses a unique X-Forwarded-For IP so that the in-memory
     * rate-limit map does not leak state between tests.
     */
    let userId: string

    beforeEach(async () => {
      const result = await setupOwner(app, 'loginpass123')
      userId = result.id
    })

    it('should return JWT with valid password (no username required)', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '127.0.0.2')
        .send({ password: 'loginpass123' })
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data).toHaveProperty('user')
      expect(response.body.data).toHaveProperty('token')
      expect(response.body.data.user.username).toBe('owner')
      expect(response.body.data.user.id).toBe(userId)
      expect(typeof response.body.data.token).toBe('string')
    })

    it('should return 401 with wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '127.0.0.3')
        .send({ password: 'wrongpassword' })
        .expect(401)

      expect(response.body.error).toBe('Invalid password')
    })

    it('should return 401 when password is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '127.0.0.5')
        .send({})
        .expect(401)

      expect(response.body.error).toBe('Invalid password')
    })

    it('should rate limit after 5 failed attempts (6th returns 429)', async () => {
      const ip = '127.0.0.10'

      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .set('X-Forwarded-For', ip)
          .send({ password: 'wrongpassword' })
          .expect(401)
      }

      // 6th attempt should be rate limited
      const response = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ password: 'loginpass123' }) // even correct password is blocked
        .expect(429)

      expect(response.body.error).toContain('Too many login attempts')
    })

    it('should reset rate limit counter on successful login', async () => {
      const ip = '127.0.0.11'

      // Make 3 failed attempts (below limit)
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/login')
          .set('X-Forwarded-For', ip)
          .send({ password: 'wrongpassword' })
          .expect(401)
      }

      // Successful login should reset counter
      await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ password: 'loginpass123' })
        .expect(200)

      // Should be able to fail 5 more times
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .set('X-Forwarded-For', ip)
          .send({ password: 'wrongpassword' })
          .expect(401)
      }

      // 6th failure after reset should be rate limited
      await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ password: 'loginpass123' })
        .expect(429)
    })
  })

  // ===========================================================================
  // 3. Token validation
  // ===========================================================================
  describe('Token validation', () => {
    let token: string
    let userId: string

    beforeEach(async () => {
      const result = await setupOwner(app, 'tokenpass123')
      token = result.token
      userId = result.id
    })

    it('protected routes return 401 without token', async () => {
      const response = await request(fullApp)
        .get('/api/auth/me')
        .expect(401)

      expect(response.body.error).toBe('Access token required')
    })

    it('protected routes work with valid JWT', async () => {
      const response = await request(fullApp)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      expect(response.body.error).toBeNull()
      expect(response.body.data.id).toBe(userId)
      expect(response.body.data.username).toBe('owner')
    })

    it('protected routes return 403 with expired JWT', async () => {
      // Generate an already-expired token
      const jwt = await import('jsonwebtoken')
      const expiredToken = jwt.default.sign(
        { userId, username: 'owner' },
        process.env.JWT_SECRET || 'change-this-secret-in-production',
        { algorithm: 'HS256', expiresIn: '-1s' },
      )

      const response = await request(fullApp)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(403)

      expect(response.body.error).toBe('Invalid or expired token')
    })

    it('protected routes return 403 with tampered JWT', async () => {
      const parts = token.split('.')
      const tamperedToken = [parts[0], 'invalidpayload', parts[2]].join('.')

      const response = await request(fullApp)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .expect(403)

      expect(response.body.error).toBe('Invalid or expired token')
    })

    it('protected routes return 403 with completely invalid token', async () => {
      const response = await request(fullApp)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer not-a-real-jwt')
        .expect(403)

      expect(response.body.error).toBe('Invalid or expired token')
    })

    it('protected routes work with bearer token fallback (daemon compat)', async () => {
      const staticToken = process.env.API_BEARER_TOKEN || 'test-token-for-testing-only'

      // /me returns 404 for system user since getUserById('system') won't exist,
      // but auth middleware should allow the request through.
      // Test against /users which always works for authenticated users.
      const usersResponse = await request(fullApp)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${staticToken}`)
        .expect(200)

      expect(usersResponse.body.error).toBeNull()
      expect(Array.isArray(usersResponse.body.data)).toBe(true)
    })

    it('optionalAuth routes work without token', async () => {
      const response = await request(app)
        .get('/api/auth/status')
        .expect(200)

      expect(response.body.data.hasUsers).toBe(true)
      expect(response.body.data.currentUser).toBeNull()
    })

    it('optionalAuth routes populate user with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      expect(response.body.data.hasUsers).toBe(true)
      expect(response.body.data.currentUser).toEqual({
        userId: userId,
        username: 'owner',
      })
    })
  })

  // ===========================================================================
  // 4. Password management
  // ===========================================================================
  describe('Password management', () => {
    let token: string
    let userId: string

    beforeEach(async () => {
      const result = await setupOwner(app, 'oldpass123')
      token = result.token
      userId = result.id
    })

    describe('POST /api/auth/change-password', () => {
      it('should change password with valid current password', async () => {
        const response = await request(app)
          .post('/api/auth/change-password')
          .set('Authorization', `Bearer ${token}`)
          .send({
            currentPassword: 'oldpass123',
            newPassword: 'newpass456',
            confirmPassword: 'newpass456',
          })
          .expect(200)

        expect(response.body.error).toBeNull()
        expect(response.body.data.success).toBe(true)

        // Verify can login with new password (use unique IP to avoid rate limits)
        const loginRes = await request(app)
          .post('/api/auth/login')
          .set('X-Forwarded-For', '127.0.0.20')
          .send({ password: 'newpass456' })
          .expect(200)

        expect(loginRes.body.data.user.id).toBe(userId)
      })

      it('should fail with wrong current password', async () => {
        const response = await request(app)
          .post('/api/auth/change-password')
          .set('Authorization', `Bearer ${token}`)
          .send({
            currentPassword: 'wrongpass',
            newPassword: 'newpass456',
            confirmPassword: 'newpass456',
          })
          .expect(400)

        expect(response.body.error).toBe('Current password is incorrect')
      })

      it('should fail with short new password', async () => {
        const response = await request(app)
          .post('/api/auth/change-password')
          .set('Authorization', `Bearer ${token}`)
          .send({
            currentPassword: 'oldpass123',
            newPassword: '12345',
            confirmPassword: '12345',
          })
          .expect(400)

        expect(response.body.error).toBe('New password must be at least 6 characters long')
      })

      it('should fail when new password and confirm do not match', async () => {
        const response = await request(app)
          .post('/api/auth/change-password')
          .set('Authorization', `Bearer ${token}`)
          .send({
            currentPassword: 'oldpass123',
            newPassword: 'newpass456',
            confirmPassword: 'different456',
          })
          .expect(400)

        expect(response.body.error).toBe('Passwords do not match')
      })

      it('should require authentication (401 without token)', async () => {
        await request(app)
          .post('/api/auth/change-password')
          .send({
            currentPassword: 'oldpass123',
            newPassword: 'newpass456',
            confirmPassword: 'newpass456',
          })
          .expect(401)
      })
    })

    describe('POST /api/auth/reset-password (localhost only)', () => {
      it('should reset password from localhost', async () => {
        const response = await request(app)
          .post('/api/auth/reset-password')
          .set('Authorization', `Bearer ${token}`)
          .set('X-Forwarded-For', '127.0.0.1')
          .send({
            newPassword: 'resetpass789',
            confirmPassword: 'resetpass789',
          })
          .expect(200)

        expect(response.body.error).toBeNull()
        expect(response.body.data.success).toBe(true)

        // Verify can login with reset password (use unique IP)
        await request(app)
          .post('/api/auth/login')
          .set('X-Forwarded-For', '127.0.0.21')
          .send({ password: 'resetpass789' })
          .expect(200)
      })

      it('should fail from non-localhost', async () => {
        const response = await request(app)
          .post('/api/auth/reset-password')
          .set('Authorization', `Bearer ${token}`)
          .set('X-Forwarded-For', '192.168.1.100')
          .send({
            newPassword: 'resetpass789',
            confirmPassword: 'resetpass789',
          })
          .expect(403)

        expect(response.body.error).toBe('This action is only available from localhost')
      })

      it('should fail with short new password', async () => {
        const response = await request(app)
          .post('/api/auth/reset-password')
          .set('Authorization', `Bearer ${token}`)
          .set('X-Forwarded-For', '127.0.0.1')
          .send({
            newPassword: 'short',
            confirmPassword: 'short',
          })
          .expect(400)

        expect(response.body.error).toBe('New password must be at least 6 characters long')
      })

      it('should fail when new password and confirm do not match', async () => {
        const response = await request(app)
          .post('/api/auth/reset-password')
          .set('Authorization', `Bearer ${token}`)
          .set('X-Forwarded-For', '127.0.0.1')
          .send({
            newPassword: 'newpass456',
            confirmPassword: 'mismatch789',
          })
          .expect(400)

        expect(response.body.error).toBe('Passwords do not match')
      })
    })
  })

  // ===========================================================================
  // 5. Registration is disabled in single-user mode
  // ===========================================================================
  describe('Registration disabled (POST /api/auth/register)', () => {
    it('should always return 403', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          password: 'password123',
          confirmPassword: 'password123',
        })
        .expect(403)

      expect(response.body.error).toBe('Single-user mode does not support registration')
    })

    it('should return 403 even with valid auth token', async () => {
      const { token } = await setupOwner(app, 'password123')

      const response = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Forwarded-For', '127.0.0.1')
        .send({
          username: 'newuser',
          password: 'password123',
          confirmPassword: 'password123',
        })
        .expect(403)

      expect(response.body.error).toBe('Single-user mode does not support registration')
    })
  })

  // ===========================================================================
  // Additional edge cases
  // ===========================================================================
  describe('Additional edge cases', () => {
    it('GET /api/auth/users returns list containing only owner when authenticated', async () => {
      const owner = await setupOwner(app, 'password123')

      const response = await request(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200)

      expect(response.body.error).toBeNull()
      const users = response.body.data as any[]
      expect(users.length).toBe(1)
      expect(users[0].username).toBe('owner')
      // Password hash should not be exposed
      expect(users[0].password_hash).toBeUndefined()
    })

    it('GET /api/auth/users returns 401 without authentication', async () => {
      await request(app)
        .get('/api/auth/users')
        .expect(401)
    })

    it('GET /api/auth/status reports isLocalhost and canResetPassword', async () => {
      const response = await request(app)
        .get('/api/auth/status')
        .expect(200)

      expect(response.body.data).toHaveProperty('isLocalhost')
      expect(typeof response.body.data.isLocalhost).toBe('boolean')
      expect(response.body.data).toHaveProperty('canResetPassword')
      expect(typeof response.body.data.canResetPassword).toBe('boolean')
      // canResetPassword should equal isLocalhost
      expect(response.body.data.canResetPassword).toBe(response.body.data.isLocalhost)
    })
  })
})
