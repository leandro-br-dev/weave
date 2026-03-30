import { Router, Request, Response } from 'express'
import {
  getOrCreateOwnerUser,
  authenticateByPassword,
  generateToken,
  changePassword,
  resetPasswordLocalhost,
  getUserCount,
  getUserById,
  getAllUsers,
} from '../services/userService.js'
import {
  authenticateToken,
  requireLocalhost,
  requireNoUsers,
  optionalAuth,
} from '../middleware/auth.js'
import { db } from '../db/index.js'

const router = Router()

// ---------------------------------------------------------------------------
// In-memory rate limiter for login attempts
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number
  firstAttempt: number
}

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const RATE_LIMIT_MAX = 5
const loginAttempts = new Map<string, RateLimitEntry>()

function cleanRateLimitEntry(ip: string) {
  const entry = loginAttempts.get(ip)
  if (entry && Date.now() - entry.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.delete(ip)
  }
}

function isRateLimited(ip: string): boolean {
  cleanRateLimitEntry(ip)
  const entry = loginAttempts.get(ip)
  if (!entry) return false
  return entry.count >= RATE_LIMIT_MAX
}

function recordFailedAttempt(ip: string) {
  const existing = loginAttempts.get(ip)
  if (existing) {
    existing.count++
  } else {
    loginAttempts.set(ip, { count: 1, firstAttempt: Date.now() })
  }
}

function clearFailedAttempts(ip: string) {
  loginAttempts.delete(ip)
}

// ---------------------------------------------------------------------------
// Helper: check whether a request originates from localhost
// ---------------------------------------------------------------------------

function isLocalhostRequest(req: Request): boolean {
  const forwarded = req.headers['x-forwarded-for']
  const forwardedIp = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : ''
  const ip = req.ip || req.connection?.remoteAddress || forwardedIp || ''
  return ['127.0.0.1', '::1', 'localhost'].includes(ip)
}

// ---------------------------------------------------------------------------
// 1. GET /api/auth/status — public endpoint
// ---------------------------------------------------------------------------

router.get('/status', optionalAuth, (_req: Request, res: Response) => {
  try {
    const hasUsers = getUserCount() > 0
    // Only report real JWT users as authenticated — never system/daemon tokens
    const currentUser =
      _req.user && _req.user.userId !== 'system'
        ? { userId: _req.user.userId, username: _req.user.username }
        : null
    const local = isLocalhostRequest(_req)

    res.json({
      data: {
        hasUsers,
        currentUser,
        user: currentUser, // Alias for frontend compatibility
        authenticated: currentUser !== null,
        isLocalhost: local,
        canResetPassword: local,
      },
      error: null,
    })
  } catch (err: any) {
    console.error('Error fetching auth status:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})

// ---------------------------------------------------------------------------
// 2. POST /api/auth/setup — initial setup (no users yet, localhost only)
// ---------------------------------------------------------------------------

router.post('/setup', requireNoUsers, requireLocalhost, (req: Request, res: Response) => {
  try {
    const { password, confirmPassword } = req.body

    if (!password || password.length < 6) {
      return res.status(400).json({ data: null, error: 'Password must be at least 6 characters long' })
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ data: null, error: 'Passwords do not match' })
    }

    const user = getOrCreateOwnerUser(password)
    const token = generateToken(user.id, user.username)

    res.status(201).json({
      data: { user: { id: user.id, username: user.username }, token },
      error: null,
    })
  } catch (err: any) {
    res.status(400).json({ data: null, error: err.message })
  }
})

// ---------------------------------------------------------------------------
// 3. POST /api/auth/login
// ---------------------------------------------------------------------------

router.post('/login', async (req: Request, res: Response) => {
  try {
    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown'

    if (isRateLimited(clientIp)) {
      return res.status(429).json({ data: null, error: 'Too many login attempts. Please try again later.' })
    }

    const { password } = req.body

    if (!password) {
      recordFailedAttempt(clientIp)
      return res.status(401).json({ data: null, error: 'Invalid password' })
    }

    const result = await authenticateByPassword(password)

    if (!result) {
      recordFailedAttempt(clientIp)
      return res.status(401).json({ data: null, error: 'Invalid password' })
    }

    clearFailedAttempts(clientIp)

    res.json({
      data: { user: { id: result.id, username: result.username }, token: result.token },
      error: null,
    })
  } catch (err: any) {
    console.error('Error during login:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})

// ---------------------------------------------------------------------------
// 4. POST /api/auth/change-password
// ---------------------------------------------------------------------------

router.post('/change-password', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body
    const userId = req.user!.userId

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ data: null, error: 'New password must be at least 6 characters long' })
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ data: null, error: 'Passwords do not match' })
    }

    const success = await changePassword(userId, currentPassword, newPassword)

    if (!success) {
      return res.status(400).json({ data: null, error: 'Current password is incorrect' })
    }

    res.json({ data: { success: true }, error: null })
  } catch (err: any) {
    console.error('Error changing password:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})

// ---------------------------------------------------------------------------
// 5. POST /api/auth/reset-password — localhost only
// ---------------------------------------------------------------------------

router.post('/reset-password', requireLocalhost, async (req: Request, res: Response) => {
  try {
    const { newPassword, confirmPassword } = req.body

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ data: null, error: 'New password must be at least 6 characters long' })
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ data: null, error: 'Passwords do not match' })
    }

    // Reset password for ALL active users (localhost recovery mode)
    const users = db.prepare("SELECT id FROM users WHERE is_active = 1").all() as { id: string }[]
    if (!users.length) {
      return res.status(400).json({ data: null, error: 'No user found' })
    }

    for (const user of users) {
      await resetPasswordLocalhost(user.id, newPassword)
    }

    res.json({ data: { success: true }, error: null })
  } catch (err: any) {
    console.error('Error resetting password:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})

// ---------------------------------------------------------------------------
// 6. POST /api/auth/register — localhost only, authenticated
// ---------------------------------------------------------------------------

router.post('/register', (_req: Request, res: Response) => {
  res.status(403).json({ data: null, error: 'Single-user mode does not support registration' })
})

// ---------------------------------------------------------------------------
// 7. GET /api/auth/me
// ---------------------------------------------------------------------------

router.get('/me', authenticateToken, (req: Request, res: Response) => {
  try {
    const user = getUserById(req.user!.userId)

    if (!user) {
      return res.status(404).json({ data: null, error: 'User not found' })
    }

    res.json({ data: user, error: null })
  } catch (err: any) {
    console.error('Error fetching current user:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})

// ---------------------------------------------------------------------------
// 8. GET /api/auth/users
// ---------------------------------------------------------------------------

router.get('/users', authenticateToken, (_req: Request, res: Response) => {
  try {
    const users = getAllUsers()
    res.json({ data: users, error: null })
  } catch (err: any) {
    console.error('Error fetching users:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})

export default router
