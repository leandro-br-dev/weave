/**
 * Authentication test utilities
 * Provides mock authentication middleware for testing
 */

import { Request, Response, NextFunction } from 'express'

/**
 * Mock authentication middleware for testing
 * This bypasses actual authentication and sets a test token
 */
export function mockAuthenticateToken(req: any, res: Response, next: NextFunction) {
  req.user = { userId: 'system', username: 'daemon' }
  next()
}

/**
 * Create a mock authentication object
 */
export function createMockAuth(token: string = 'test-token') {
  return {
    token,
    headers: {
      authorization: `Bearer ${token}`,
    },
  }
}

/**
 * Set authentication headers on a request object
 */
export function setAuthHeaders(req: Request, token: string = 'test-token') {
  req.headers['authorization'] = `Bearer ${token}`
  return req
}

/**
 * Mock vitest configuration for authentication
 * Use this in your test files to mock the auth middleware
 */
export const mockAuthConfig = {
  authenticateToken: mockAuthenticateToken,
}

/**
 * Helper to setup auth mocks in vitest
 */
export function setupAuthMock(vi: any) {
  return vi.mock('../../src/middleware/auth.js', () => ({
    authenticateToken: mockAuthenticateToken,
  }))
}
