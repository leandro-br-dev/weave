import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { v4 as uuid } from 'uuid'
import { db } from '../db/index.js'

// JWT Configuration
const JWT_SECRET: string = process.env.JWT_SECRET || 'change-this-secret-in-production'
const JWT_EXPIRES_IN = '24h'

/**
 * Hash a password using bcrypt with 12 salt rounds.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

/**
 * Compare a plaintext password against a bcrypt hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Generate a signed JWT containing userId and username.
 */
export function generateToken(userId: string, username: string): string {
  return jwt.sign({ userId, username }, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: JWT_EXPIRES_IN,
  })
}

/**
 * Verify and decode a JWT. Returns the payload or null on failure.
 */
export function verifyToken(
  token: string
): { userId: string; username: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as {
      userId: string
      username: string
    }
    return decoded
  } catch {
    return null
  }
}

/**
 * Create a new user.
 *
 * Validation rules:
 *  - username: min 3 characters, alphanumeric + underscore only
 *  - password: min 6 characters
 *  - username must be unique
 *
 * Returns the new user object (without password_hash).
 * Throws on validation failure or duplicate username.
 */
export function createUser(
  username: string,
  password: string
): { id: string; username: string } {
  // Validate username
  if (!username || username.length < 3) {
    throw new Error('Username must be at least 3 characters long')
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    throw new Error('Username must contain only letters, numbers, and underscores')
  }

  // Validate password
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long')
  }

  // Check uniqueness
  const existing = db
    .prepare('SELECT id FROM users WHERE username = ?')
    .get(username) as { id: string } | undefined
  if (existing) {
    throw new Error('Username already exists')
  }

  const id = uuid()
  const passwordHash = bcrypt.hashSync(password, 12)

  db.prepare(
    'INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)'
  ).run(id, username, passwordHash)

  return { id, username }
}

/**
 * Authenticate a user by username and password.
 *
 * Returns the user object with a JWT token on success, or null on failure.
 */
export async function authenticateUser(
  username: string,
  password: string
): Promise<{ id: string; username: string; token: string } | null> {
  const user = db
    .prepare('SELECT id, username, password_hash, is_active FROM users WHERE username = ?')
    .get(username) as { id: string; username: string; password_hash: string; is_active: number } | undefined

  if (!user) {
    return null
  }

  if (!user.is_active) {
    return null
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    return null
  }

  const token = generateToken(user.id, user.username)
  return { id: user.id, username: user.username, token }
}

/**
 * Change a user's password after verifying the current one.
 *
 * Returns true on success, false if the current password is incorrect.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<boolean> {
  const user = db
    .prepare('SELECT password_hash FROM users WHERE id = ?')
    .get(userId) as { password_hash: string } | undefined

  if (!user) {
    return false
  }

  const valid = await bcrypt.compare(currentPassword, user.password_hash)
  if (!valid) {
    return false
  }

  const newHash = await bcrypt.hash(newPassword, 12)
  db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
    newHash,
    userId
  )

  return true
}

/**
 * Reset a user's password without verifying the current one.
 *
 * This should only be called from localhost (e.g. initial setup / recovery).
 * Returns true on success, false if the user was not found.
 */
export async function resetPasswordLocalhost(
  userId: string,
  newPassword: string
): Promise<boolean> {
  const newHash = await bcrypt.hash(newPassword, 12)

  const result = db
    .prepare(
      'UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?'
    )
    .run(newHash, userId)

  return result.changes > 0
}

/**
 * Get a user by ID (excludes password_hash).
 */
export function getUserById(userId: string): any | null {
  const row = db
    .prepare(
      'SELECT id, username, is_active, created_at, updated_at FROM users WHERE id = ?'
    )
    .get(userId)

  return row || null
}

/**
 * Get a user by username (excludes password_hash).
 */
export function getUserByUsername(username: string): any | null {
  const row = db
    .prepare(
      'SELECT id, username, is_active, created_at, updated_at FROM users WHERE username = ?'
    )
    .get(username)

  return row || null
}

/**
 * List all users (excludes password_hash).
 */
export function getAllUsers(): any[] {
  return db
    .prepare(
      'SELECT id, username, is_active, created_at, updated_at FROM users ORDER BY created_at'
    )
    .all()
}

/**
 * Return the total number of users.
 */
export function getUserCount(): number {
  const row = db.prepare('SELECT COUNT(*) as count FROM users').get() as {
    count: number
  }
  return row.count
}

/**
 * Create or return the singleton owner user.
 *
 * In single-user mode the username is always "owner".
 * If an owner already exists, simply returns it (ignores the password).
 * Otherwise creates the owner with the given password and assigns
 * all unowned data to them.
 */
export function getOrCreateOwnerUser(password: string): { id: string; username: string } {
  const existing = db.prepare("SELECT id, username FROM users WHERE username = 'owner'").get() as { id: string; username: string } | undefined
  if (existing) return existing

  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long')
  }

  const id = uuid()
  const passwordHash = bcrypt.hashSync(password, 12)

  db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(id, 'owner', passwordHash)

  // Associate orphaned records with the new owner
  assignFirstUserData(id)

  return { id, username: 'owner' }
}

/**
 * Authenticate a user by password only (no username needed).
 *
 * In single-user mode (one active user), accepts the password directly.
 * In multi-user mode (multiple active users), also accepts the password directly.
 * Returns the user object with a JWT token on success, or null on failure.
 */
export async function authenticateByPassword(
  password: string
): Promise<{ id: string; username: string; token: string } | null> {
  const users = db
    .prepare("SELECT id, username, password_hash, is_active FROM users WHERE is_active = 1")
    .all() as { id: string; username: string; password_hash: string; is_active: number }[]

  if (!users.length) {
    return null
  }

  // Try to authenticate against all active users
  for (const user of users) {
    const valid = await bcrypt.compare(password, user.password_hash)
    if (valid) {
      const token = generateToken(user.id, user.username)
      return { id: user.id, username: user.username, token }
    }
  }

  return null
}

/**
 * Data migration: assign all existing unowned records to the first user.
 *
 * Runs inside a transaction so that all five updates succeed or fail together.
 * This should be called once after the very first user is created.
 */
export function assignFirstUserData(firstUserId: string): void {
  const transaction = db.transaction(() => {
    db.prepare('UPDATE projects SET user_id = ? WHERE user_id IS NULL').run(firstUserId)
    db.prepare('UPDATE plans SET user_id = ? WHERE user_id IS NULL').run(firstUserId)
    db.prepare('UPDATE chat_sessions SET user_id = ? WHERE user_id IS NULL').run(firstUserId)
    db.prepare('UPDATE kanban_tasks SET user_id = ? WHERE user_id IS NULL').run(firstUserId)
    db.prepare('UPDATE kanban_templates SET user_id = ? WHERE user_id IS NULL').run(firstUserId)
  })

  transaction()
}
