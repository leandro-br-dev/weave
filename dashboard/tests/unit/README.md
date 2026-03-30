# Dashboard Unit Tests

Unit tests for dashboard utilities, hooks, and helper functions.

## Purpose

Unit tests verify that individual utilities, hooks, and helper functions work correctly in isolation.

## Test Structure

```typescript
// utils.test.ts
import { describe, it, expect } from 'vitest'
import { formatDate, calculateProgress } from '../utils'

describe('formatDate', () => {
  it('should format date correctly', () => {
    const date = new Date('2024-01-01')
    expect(formatDate(date)).toBe('January 1, 2024')
  })

  it('should handle invalid dates', () => {
    expect(formatDate(new Date('invalid'))).toBe('Invalid Date')
  })
})

describe('calculateProgress', () => {
  it('should calculate percentage correctly', () => {
    expect(calculateProgress(5, 10)).toBe(50)
    expect(calculateProgress(0, 10)).toBe(0)
    expect(calculateProgress(10, 10)).toBe(100)
  })
})
```

## Running Tests

```bash
# Run all unit tests
npm test -- dashboard/tests/unit/

# Run specific file
npm test -- dashboard/tests/unit/utils.test.ts

# Run with coverage
npm test -- dashboard/tests/unit/ --coverage
```

## Guidelines

1. **Test pure functions**: Focus on functions without side effects
2. **Mock React hooks**: Use appropriate testing utilities for hooks
3. **Test edge cases**: Include boundary conditions and error cases
4. **Keep tests fast**: Unit tests should run in milliseconds
5. **Use descriptive names**: Test names should describe what they test

## Common Patterns

### Testing Utility Functions
```typescript
describe('string utilities', () => {
  it('should capitalize first letter', () => {
    expect(capitalize('hello')).toBe('Hello')
  })
})
```

### Testing Custom Hooks
```typescript
import { renderHook } from '@testing-library/react'
import { useAgentStatus } from '../hooks'

describe('useAgentStatus', () => {
  it('should return initial status', () => {
    const { result } = renderHook(() => useAgentStatus())
    expect(result.current.status).toBe('idle')
  })
})
```

### Testing Data Transformation
```typescript
describe('agent transformer', () => {
  it('should transform agent data', () => {
    const agent = { id: '1', name: 'test' }
    const result = transformAgent(agent)
    expect(result).toHaveProperty('displayName')
  })
})
```

### Testing Validation
```typescript
describe('form validation', () => {
  it('should validate required fields', () => {
    const result = validateAgentForm({ name: '' })
    expect(result.valid).toBe(false)
    expect(result.errors).toHaveProperty('name')
  })
})
```
