/**
 * Dashboard Component Test Utilities
 *
 * Helper functions and utilities for testing React components.
 */

import { render, type RenderOptions } from '@testing-library/react'
import { type ReactElement } from 'react'
import { vi } from 'vitest'

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

/**
 * Custom render function with providers
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  // Add any providers here (QueryClient, Router, etc.)
  return render(ui, options)
}

/**
 * Test data factories for dashboard components
 */
export const dashboardTestData = {
  /**
   * Create a test project object
   */
  project: (overrides: any = {}) => ({
    id: 'test-project-1',
    name: 'Test Project',
    description: 'A test project',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides
  }),

  /**
   * Create a test kanban task object
   */
  kanbanTask: (overrides: any = {}) => ({
    id: 'test-task-1',
    project_id: 'test-project-1',
    title: 'Test Task',
    description: 'A test task',
    column: 'backlog',
    priority: 3,
    pipeline_status: 'idle',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides
  }),

  /**
   * Create a test agent object
   */
  agent: (overrides: any = {}) => ({
    id: 'test-agent-1',
    name: 'Test Agent',
    type: 'claude',
    model: 'claude-3-5-sonnet',
    status: 'idle',
    ...overrides
  }),

  /**
   * Create a test workspace object
   */
  workspace: (overrides: any = {}) => ({
    id: 'test-workspace-1',
    name: 'Test Workspace',
    project_id: 'test-project-1',
    path: '/tmp/test-workspace',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides
  })
}

/**
 * Mock API response helpers
 */
export const mockApi = {
  /**
   * Create a successful API response
   */
  success: (data: any) => ({
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data)
  }),

  /**
   * Create an error API response
   */
  error: (status: number, message: string) => ({
    ok: false,
    status,
    json: async () => ({ error: message }),
    text: async () => JSON.stringify({ error: message })
  })
}

/**
 * Wait for component updates
 */
export const waitForComponentUpdate = (ms: number = 100) =>
  new Promise(resolve => setTimeout(resolve, ms))

/**
 * Mock localStorage
 */
export const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}

// Set up localStorage mock
global.localStorage = mockLocalStorage as any

/**
 * Mock WebSocket
 */
export const mockWebSocket = vi.fn().mockImplementation(() => ({
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: 1 // OPEN
}))

// Set up WebSocket mock
global.WebSocket = mockWebSocket as any

/**
 * Test helpers for async operations
 */
export const testAsync = {
  /**
   * Wait for async operation to complete
   */
  wait: (ms: number = 100) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Flush promises
   */
  flushPromises: () => new Promise(resolve => setImmediate(resolve))
}

/**
 * Mock navigation
 */
export const mockNavigate = vi.fn()

/**
 * Common test selectors
 */
export const testSelectors = {
  /**
   * Get element by test ID
   */
  getByTestId: (testId: string) => `[data-testid="${testId}"]`,

  /**
   * Get element by role
   */
  getByRole: (role: string) => `[role="${role}"]`
}

// Re-export testing library utilities
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
