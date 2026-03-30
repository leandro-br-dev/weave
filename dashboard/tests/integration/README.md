# Dashboard Integration Tests

Integration tests for dashboard component interactions and API integration.

## Purpose

Integration tests verify that multiple components work together correctly and integrate properly with APIs.

## Test Structure

```typescript
// agent-list.integration.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AgentList } from '../components/AgentList'
import { server } from './mocks/server'
import { rest } from 'msw'

describe('AgentList Integration', () => {
  beforeEach(() => {
    server.listen()
  })

  afterEach(() => {
    server.resetHandlers()
  })

  it('should load and display agents', async () => {
    server.use(
      rest.get('/api/agents', (req, res, ctx) => {
        return res(ctx.json([
          { id: '1', name: 'Agent 1' },
          { id: '2', name: 'Agent 2' }
        ]))
      })
    )

    render(<AgentList />)

    await waitFor(() => {
      expect(screen.getByText('Agent 1')).toBeInTheDocument()
      expect(screen.getByText('Agent 2')).toBeInTheDocument()
    })
  })

  it('should handle loading state', async () => {
    server.use(
      rest.get('/api/agents', (req, res) => {
        return res((res) => {
          // Delay response
          setTimeout(() => res(ctx.json([])), 1000)
        })
      })
    )

    render(<AgentList />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('should handle error state', async () => {
    server.use(
      rest.get('/api/agents', (req, res, ctx) => {
        return res(ctx.status(500))
      })
    )

    render(<AgentList />)

    await waitFor(() => {
      expect(screen.getByText('Error loading agents')).toBeInTheDocument()
    })
  })
})
```

## Running Tests

```bash
# Run all integration tests
npm test -- dashboard/tests/integration/

# Run specific file
npm test -- dashboard/tests/integration/agent-list.integration.test.tsx

# Run with specific environment
NODE_ENV=test npm test -- dashboard/tests/integration/
```

## Setup

Integration tests require:
1. Mock API server (using MSW or similar)
2. Test utilities (@testing-library/react)
3. Proper cleanup between tests

## Guidelines

1. **Mock API calls**: Use MSW or similar to mock API responses
2. **Test loading states**: Verify loading indicators work
3. **Test error states**: Verify error handling works
4. **Test user interactions**: Verify buttons, forms, etc. work
5. **Clean up after tests**: Reset mocks and state between tests
6. **Use waitFor for async**: Wait for async operations to complete

## Common Patterns

### Testing Data Loading
```typescript
it('should load and display data', async () => {
  mockApiCall({ data: 'test' })
  render(<Component />)

  await waitFor(() => {
    expect(screen.getByText('test')).toBeInTheDocument()
  })
})
```

### Testing User Interactions
```typescript
it('should handle button click', async () => {
  const mockFn = vi.fn()
  render(<Button onClick={mockFn}>Click me</Button>)

  fireEvent.click(screen.getByText('Click me'))

  expect(mockFn).toHaveBeenCalled()
})
```

### Testing Form Submission
```typescript
it('should submit form data', async () => {
  mockApiCall({ success: true })
  render(<AgentForm />)

  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Test Agent' }
  })
  fireEvent.click(screen.getByText('Submit'))

  await waitFor(() => {
    expect(screen.getByText('Agent created')).toBeInTheDocument()
  })
})
```

### Testing Navigation
```typescript
it('should navigate on click', async () => {
  const mockNavigate = vi.fn()
  render(<AgentCard navigate={mockNavigate} />)

  fireEvent.click(screen.getByText('View Details'))

  expect(mockNavigate).toHaveBeenCalledWith('/agents/1')
})
```

### Testing State Updates
```typescript
it('should update state after action', async () => {
  render(<AgentList />)

  fireEvent.click(screen.getByText('Refresh'))

  await waitFor(() => {
    expect(screen.getByText('Updated')).toBeInTheDocument()
  })
})
```
