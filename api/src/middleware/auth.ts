import { Request, Response, NextFunction } from 'express'
import { verifyToken, getUserCount } from '../services/userService.js'

declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; username: string }
    }
  }
}

/**
 * JWT-based authentication middleware.
 *
 * Accepts a token via the `Authorization: Bearer <token>` header
 * or the `?token=<token>` query parameter (for SSE / EventSource).
 *
 * Falls back to a static bearer token (`API_BEARER_TOKEN` or
 * `AGENTS_MANAGER_TOKEN`) for daemon backward compatibility.
 * This fallback can be removed once the daemon fully migrates to JWT.
 *
 * On success: sets `req.user = { userId, username }` and calls `next()`.
 * On failure: returns 401 (no token) or 403 (invalid/expired token).
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization']
  const headerToken = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

  // Also support token via query parameter (for EventSource/SSE which doesn't support custom headers)
  const queryToken = req.query.token as string

  const token = headerToken || queryToken

  if (!token) {
    return res.status(401).json({ error: 'Access token required' })
  }

  // Daemon backward compatibility: if the token matches the static bearer token,
  // treat it as a system/internal token.
  const staticToken = process.env.API_BEARER_TOKEN || process.env.AGENTS_MANAGER_TOKEN
  if (staticToken && token === staticToken) {
    req.user = { userId: 'system', username: 'daemon' }
    return next()
  }

  const payload = verifyToken(token)

  if (!payload) {
    return res.status(403).json({ error: 'Invalid or expired token' })
  }

  req.user = { userId: payload.userId, username: payload.username }
  next()
}

/**
 * Middleware that restricts access to localhost only.
 *
 * Checks `req.ip`, `req.connection.remoteAddress`, and the
 * `X-Forwarded-For` header. Allows requests from `127.0.0.1`,
 * `::1`, or `localhost`.
 */
export function requireLocalhost(req: Request, res: Response, next: NextFunction) {
  const forwarded = req.headers['x-forwarded-for']
  const forwardedIp = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : ''

  const ip = req.ip || req.connection?.remoteAddress || forwardedIp || ''

  const allowed = ['127.0.0.1', '::1', 'localhost']
  if (!allowed.includes(ip)) {
    return res.status(403).json({ error: 'This action is only available from localhost' })
  }

  next()
}

/**
 * Middleware that only allows the request to proceed when zero users
 * exist in the database. Useful for the initial setup endpoint.
 */
export function requireNoUsers(req: Request, res: Response, next: NextFunction) {
  const count = getUserCount()

  if (count > 0) {
    return res.status(403).json({ error: 'Initial setup has already been completed' })
  }

  next()
}

/**
 * Like `authenticateToken` but does **not** fail when no token is provided.
 *
 * Sets `req.user` only when a valid JWT is found; otherwise proceeds
 * without authentication. Useful for endpoints that behave differently
 * depending on whether a user is authenticated (e.g. setup check).
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization']
  const headerToken = authHeader && authHeader.split(' ')[1]

  const queryToken = req.query.token as string

  const token = headerToken || queryToken

  if (token) {
    // Daemon backward compatibility
    const staticToken = process.env.API_BEARER_TOKEN || process.env.AGENTS_MANAGER_TOKEN
    if (staticToken && token === staticToken) {
      req.user = { userId: 'system', username: 'daemon' }
      return next()
    }

    const payload = verifyToken(token)
    if (payload) {
      req.user = { userId: payload.userId, username: payload.username }
    }
  }

  next()
}
