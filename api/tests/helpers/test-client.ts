/**
 * HTTP test client utilities
 * Provides helper functions for setting up test HTTP clients and making requests
 */

import request from 'supertest'
import express, { Express } from 'express'
import { db } from '../../src/db/index.js'

/**
 * Create a test Express app with basic middleware
 */
export function createTestApp(): Express {
  const app = express()
  app.use(express.json())
  return app
}

/**
 * Setup test app with a router
 */
export function setupTestApp(router: any, basePath: string = '/api'): Express {
  const app = createTestApp()
  app.use(basePath, router)
  return app
}

/**
 * Make a GET request
 */
export async function getRequest(app: Express, path: string, token?: string) {
  const req = request(app).get(path)
  if (token) {
    req.set('Authorization', `Bearer ${token}`)
  }
  return req
}

/**
 * Make a POST request
 */
export async function postRequest(app: Express, path: string, body: any, token?: string) {
  const req = request(app).post(path).send(body)
  if (token) {
    req.set('Authorization', `Bearer ${token}`)
  }
  return req
}

/**
 * Make a PATCH request
 */
export async function patchRequest(app: Express, path: string, body: any, token?: string) {
  const req = request(app).patch(path).send(body)
  if (token) {
    req.set('Authorization', `Bearer ${token}`)
  }
  return req
}

/**
 * Make a PUT request
 */
export async function putRequest(app: Express, path: string, body: any, token?: string) {
  const req = request(app).put(path).send(body)
  if (token) {
    req.set('Authorization', `Bearer ${token}`)
  }
  return req
}

/**
 * Make a DELETE request
 */
export async function deleteRequest(app: Express, path: string, token?: string) {
  const req = request(app).delete(path)
  if (token) {
    req.set('Authorization', `Bearer ${token}`)
  }
  return req
}

/**
 * Test response helper - check for success response
 */
export function expectSuccess(response: any, expectedStatus: number = 200) {
  expect(response.status).toBe(expectedStatus)
  expect(response.body.error).toBeNull()
  expect(response.body.data).toBeDefined()
  return response.body.data
}

/**
 * Test response helper - check for error response
 */
export function expectError(response: any, expectedStatus: number, expectedError: string) {
  expect(response.status).toBe(expectedStatus)
  expect(response.body.data).toBeNull()
  expect(response.body.error).toBe(expectedError)
}

/**
 * Wait for async operations (useful for testing delays)
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Poll a condition until it's true or timeout
 */
export async function poll(
  condition: () => boolean | Promise<boolean>,
  options: { interval?: number; timeout?: number } = {}
): Promise<void> {
  const { interval = 100, timeout = 5000 } = options
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return
    }
    await delay(interval)
  }

  throw new Error(`Polling timed out after ${timeout}ms`)
}
