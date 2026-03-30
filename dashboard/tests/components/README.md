# Dashboard Component Tests

Tests for individual UI components and their behavior.

## Purpose

Component tests verify that individual UI components render correctly and respond to user interactions.

## Test Structure

```typescript
// AgentCard.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AgentCard } from '../AgentCard'

describe('AgentCard', () => {
  const mockAgent = {
    id: '1',
    name: 'Test Agent',
    type: 'assistant',
    status: 'active'
  }

  it('should render agent information', () => {
    render(<AgentCard agent={mockAgent} />)

    expect(screen.getByText('Test Agent')).toBeInTheDocument()
    expect(screen.getByText('assistant')).toBeInTheDocument()
  })

  it('should render correct status badge', () => {
    render(<AgentCard agent={mockAgent} />)

    expect(screen.getByText('active')).toBeInTheDocument()
    expect(screen.getByText('active')).toHaveClass('badge-active')
  })

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn()
    render(<AgentCard agent={mockAgent} onClick={handleClick} />)

    fireEvent.click(screen.getByText('Test Agent'))

    expect(handleClick).toHaveBeenCalledWith(mockAgent)
  })

  it('should render edit button when editable', () => {
    render(<AgentCard agent={mockAgent} editable={true} />)

    expect(screen.getByText('Edit')).toBeInTheDocument()
  })

  it('should not render edit button when not editable', () => {
    render(<AgentCard agent={mockAgent} editable={false} />)

    expect(screen.queryByText('Edit')).not.toBeInTheDocument()
  })
})
```

## Running Tests

```bash
# Run all component tests
npm test -- dashboard/tests/components/

# Run specific file
npm test -- dashboard/tests/components/AgentCard.test.tsx

# Run specific test
npm test -- dashboard/tests/components/AgentCard.test.tsx -t "should render agent information"
```

## Guidelines

1. **Test rendering**: Verify components render correctly with different props
2. **Test interactions**: Verify clicks, form inputs, etc. work correctly
3. **Test edge cases**: Empty states, null values, etc.
4. **Test accessibility**: Verify ARIA labels, roles, etc.
5. **Use descriptive names**: Test names should describe what is being tested
6. **Mock dependencies**: Mock API calls, child components, etc.

## Common Patterns

### Testing Basic Rendering
```typescript
it('should render component', () => {
  render(<Component title="Test" />)
  expect(screen.getByText('Test')).toBeInTheDocument()
})
```

### Testing with Props
```typescript
it('should render with different props', () => {
  render(<Component variant="primary" />)
  expect(screen.getByRole('button')).toHaveClass('btn-primary')
})
```

### Testing User Interactions
```typescript
it('should handle click', () => {
  const handleClick = vi.fn()
  render(<Button onClick={handleClick}>Click</Button>)

  fireEvent.click(screen.getByText('Click'))

  expect(handleClick).toHaveBeenCalled()
})
```

### Testing Form Inputs
```typescript
it('should update input value', () => {
  render(<Input label="Name" />)

  const input = screen.getByLabelText('Name')
  fireEvent.change(input, { target: { value: 'Test' } })

  expect(input).toHaveValue('Test')
})
```

### Testing Conditional Rendering
```typescript
it('should show content when active', () => {
  render(<Component active={true} />)
  expect(screen.getByText('Content')).toBeInTheDocument()
})

it('should hide content when inactive', () => {
  render(<Component active={false} />)
  expect(screen.queryByText('Content')).not.toBeInTheDocument()
})
```

### Testing Lists
```typescript
it('should render list items', () => {
  const items = ['Item 1', 'Item 2', 'Item 3']
  render(<List items={items} />)

  items.forEach(item => {
    expect(screen.getByText(item)).toBeInTheDocument()
  })
})
```

### Testing Async Behavior
```typescript
it('should show loading state', () => {
  render(<Component loading={true} />)
  expect(screen.getByText('Loading...')).toBeInTheDocument()
})

it('should show data after loading', async () => {
  render(<Component fetchData={mockFetch} />)

  await waitFor(() => {
    expect(screen.getByText('Data loaded')).toBeInTheDocument()
  })
})
```

### Testing Error States
```typescript
it('should show error message', () => {
  render(<Component error="Something went wrong" />)
  expect(screen.getByText('Something went wrong')).toBeInTheDocument()
})
```

### Testing Accessibility
```typescript
it('should have proper ARIA attributes', () => {
  render(<Button aria-label="Close" />)
  expect(screen.getByLabelText('Close')).toBeInTheDocument()
})
```

## Testing Library Cheatsheet

### Rendering
- `render(<Component />)` - Render component
- `screen.getByText('text')` - Find by text
- `screen.getByRole('button')` - Find by role
- `screen.getByLabelText('Label')` - Find by label

### Interactions
- `fireEvent.click(element)` - Click element
- `fireEvent.change(input, { target: { value } })` - Change input
- `userEvent.click(element)` - More realistic interactions

### Assertions
- `expect(element).toBeInTheDocument()` - Element exists
- `expect(element).toHaveTextContent('text')` - Has text
- `expect(element).toHaveClass('class')` - Has class
- `expect(element).toHaveAttribute('attr', 'value')` - Has attribute
