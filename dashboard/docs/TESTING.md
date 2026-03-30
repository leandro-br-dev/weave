# Testing Guide

**Last Updated:** 2026-03-16
**Version:** 1.0.0

---

## Table of Contents

1. [Testing Overview](#testing-overview)
2. [Testing Setup](#testing-setup)
3. [Component Testing](#component-testing)
4. [Hook Testing](#hook-testing)
5. [Integration Testing](#integration-testing)
6. [Color System Testing](#color-system-testing)
7. [E2E Testing](#e2e-testing)
8. [Test Coverage](#test-coverage)
9. [Best Practices](#best-practices)

---

## Testing Overview

### Testing Strategy

The dashboard uses a comprehensive testing approach:

1. **Unit Tests**: Test individual components and hooks in isolation
2. **Integration Tests**: Test component interactions with APIs
3. **Color System Tests**: Validate color consistency
4. **Visual Regression Tests**: Ensure UI consistency

### Testing Stack

| Tool | Version | Purpose |
|------|---------|---------|
| **Vitest** | 3.1.2 | Test runner |
| **Testing Library** | 16.3.1 | Component testing utilities |
| **jsdom** | 25.0.1 | DOM simulation |
| **Vitest UI** | 3.1.2 | Visual test interface |
| **Coverage V8** | 3.1.2 | Code coverage |

---

## Testing Setup

### Configuration

**vitest.config.ts:**
```tsx
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
      ],
    },
  },
})
```

**Setup file:**
```tsx
// src/test/setup.ts
import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'

// Cleanup after each test
afterEach(() => {
  cleanup()
})
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- Button.test.tsx

# Run tests matching pattern
npm test -- --grep "Button"
```

---

## Component Testing

### Basic Component Test

```tsx
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Button } from '../Button'

describe('Button', () => {
  it('renders button with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('renders with correct variant classes', () => {
    render(<Button variant="primary">Submit</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-gray-900', 'text-white')
  })
})
```

### Testing User Interactions

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '../Button'

describe('Button interactions', () => {
  it('calls onClick when clicked', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()

    render(<Button onClick={handleClick}>Click me</Button>)

    await user.click(screen.getByRole('button'))

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick when disabled', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()

    render(<Button onClick={handleClick} disabled>Click me</Button>)

    await user.click(screen.getByRole('button'))

    expect(handleClick).not.toHaveBeenCalled()
  })
})
```

### Testing Component Props

```tsx
describe('Button props', () => {
  it('renders in loading state', () => {
    render(<Button isLoading>Loading</Button>)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('is disabled when loading', () => {
    render(<Button isLoading>Submit</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('renders different sizes', () => {
    const { rerender } = render(<Button size="sm">Small</Button>)
    expect(screen.getByRole('button')).toHaveClass('text-sm')

    rerender(<Button size="lg">Large</Button>)
    expect(screen.getByRole('button')).toHaveClass('text-lg')
  })
})
```

### Testing Async Behavior

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { AgentsList } from '../AgentsList'

describe('AgentsList', () => {
  it('shows loading state initially', () => {
    render(<AgentsList />)
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('displays agents after loading', async () => {
    render(<AgentsList />)

    await waitFor(() => {
      expect(screen.getByText('Agent 1')).toBeInTheDocument()
    })
  })

  it('handles error state', async () => {
    // Mock failed API call
    vi.mock('@/api/agents', () => ({
      useAgents: () => ({ error: new Error('Failed to load'), isLoading: false }),
    }))

    render(<AgentsList />)

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
    })
  })
})
```

---

## Hook Testing

### Testing Custom Hooks

```tsx
import { renderHook, act } from '@testing-library/react'
import { useCounter } from '../useCounter'

describe('useCounter', () => {
  it('initializes with default value', () => {
    const { result } = renderHook(() => useCounter())
    expect(result.current.count).toBe(0)
  })

  it('increments counter', () => {
    const { result } = renderHook(() => useCounter())

    act(() => {
      result.current.increment()
    })

    expect(result.current.count).toBe(1)
  })

  it('decrements counter', () => {
    const { result } = renderHook(() => useCounter(5))

    act(() => {
      result.current.decrement()
    })

    expect(result.current.count).toBe(4)
  })
})
```

### Testing Hooks with Dependencies

```tsx
import { renderHook, act, waitFor } from '@testing-library/react'
import { useFetchData } from '../useFetchData'

describe('useFetchData', () => {
  it('fetches data on mount', async () => {
    const { result } = renderHook(() => useFetchData('/api/data'))

    await waitFor(() => {
      expect(result.current.data).toBeDefined()
    })
  })

  it('refetches when dependencies change', async () => {
    const { result, rerender } = renderHook(
      ({ id }) => useFetchData(`/api/data/${id}`),
      { initialProps: { id: '1' } }
    )

    await waitFor(() => {
      expect(result.current.data).toBeDefined()
    })

    act(() => {
      rerender({ id: '2' })
    })

    await waitFor(() => {
      expect(result.current.isFetching).toBe(true)
    })
  })
})
```

---

## Integration Testing

### Testing with TanStack Query

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AgentsPage } from '../AgentsPage'

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

describe('AgentsPage integration', () => {
  it('displays agents from API', async () => {
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <AgentsPage />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Agents')).toBeInTheDocument()
    })
  })
})
```

### Testing Form Submission

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateAgentForm } from '../CreateAgentForm'

describe('CreateAgentForm integration', () => {
  it('submits form with valid data', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<CreateAgentForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/name/i), 'Test Agent')
    await user.type(screen.getByLabelText(/description/i), 'Test description')
    await user.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Test Agent',
        description: 'Test description',
      })
    })
  })

  it('shows validation errors for invalid data', async () => {
    const user = userEvent.setup()

    render(<CreateAgentForm onSubmit={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument()
    })
  })
})
```

---

## Color System Testing

The dashboard has a comprehensive color system test suite with **100% coverage**.

### Test Overview

**Location:** `/root/projects/weave/dashboard/src/test/colors.test.ts`

**Results:**
- ✅ All Tests Passing: 22/22 (100%)
- ✅ Code Coverage: 100%
- ✅ Execution Time: < 20ms

### Test Categories

#### 1. Color Constants Exports (2 tests)

**exports all required color constants:**
```tsx
it('exports all required color constants', () => {
  expect(statusColors).toBeDefined()
  expect(buttonVariants).toBeDefined()
  expect(metricColors).toBeDefined()
  expect(errorColors).toBeDefined()
  expect(successColors).toBeDefined()
  expect(warningColors).toBeDefined()
  expect(infoColors).toBeDefined()
  expect(bgColors).toBeDefined()
  expect(textColors).toBeDefined()
  expect(borderColors).toBeDefined()
  expect(interactiveStates).toBeDefined()
  expect(colorPalette).toBeDefined()
})
```

**exports have correct TypeScript types:**
```tsx
it('exports have correct TypeScript types', () => {
  // Validates that status colors conform to StatusColorScheme interface
  expect(statusColors.pending).toMatchObject({
    bg: expect.any(String),
    text: expect.any(String),
    border: expect.any(String),
    solid: expect.any(String),
    label: expect.any(String),
  })
})
```

#### 2. Status Colors (4 tests)

**all required status colors exist:**
```tsx
it('all required status colors exist', () => {
  const requiredStatuses = ['pending', 'running', 'success', 'failed', 'timeout', 'approved', 'denied', 'unknown']

  requiredStatuses.forEach(status => {
    expect(statusColors[status]).toBeDefined()
    expect(statusColors[status]).toMatchObject({
      bg: expect.stringMatching(/^bg-/),
      text: expect.stringMatching(/^text-/),
      border: expect.stringMatching(/^border-/),
      solid: expect.stringMatching(/^bg-/),
      label: expect.any(String),
    })
  })
})
```

**status colors use consistent shade values:**
```tsx
it('status colors use consistent shade values', () => {
  const standardStatuses = ['pending', 'running', 'success', 'failed', 'timeout', 'approved', 'denied']

  standardStatuses.forEach(status => {
    const colors = statusColors[status]
    expect(colors.bg).toContain('-50')
    expect(colors.text).toContain('-700')
    expect(colors.border).toContain('-200')
    expect(colors.solid).toContain('-500')
  })
})
```

**related status colors share color families:**
```tsx
it('related status colors share color families', () => {
  // Success and approved should share green
  expect(statusColors.success.bg).toContain('green')
  expect(statusColors.approved.bg).toContain('green')

  // Failed and denied should share red
  expect(statusColors.failed.bg).toContain('red')
  expect(statusColors.denied.bg).toContain('red')
})
```

#### 3. Button Variants (3 tests)

**all required button variants exist:**
```tsx
it('all required button variants exist', () => {
  const requiredVariants = ['primary', 'secondary', 'danger', 'ghost']

  requiredVariants.forEach(variant => {
    expect(buttonVariants[variant]).toBeDefined()
    expect(buttonVariants[variant]).toMatchObject({
      bg: expect.any(String),
      text: expect.any(String),
      border: expect.any(String),
      hoverBg: expect.any(String),
    })
  })
})
```

**button variants use Tailwind classes:**
```tsx
it('button variants use Tailwind classes', () => {
  Object.values(buttonVariants).forEach(variant => {
    expect(variant.bg).toMatch(/^bg-/)
    expect(variant.text).toMatch(/^text-/)
    expect(variant.border).toMatch(/^border-/)
    expect(variant.hoverBg).toMatch(/^hover:bg-/)
  })
})
```

#### 4. Color Consistency (3 tests)

**colors use consistent shade values:**
```tsx
it('colors use consistent shade values across semantic groups', () => {
  const semanticColors = [errorColors, successColors, warningColors, infoColors]

  semanticColors.forEach(colorGroup => {
    expect(colorGroup.text).toContain('-600')
    expect(colorGroup.textAlt).toContain('-700')
    expect(colorGroup.bg).toContain('-50')
  })
})
```

**no duplicate color definitions:**
```tsx
it('no duplicate color definitions across semantic names', () => {
  const allColors = [
    ...Object.values(statusColors).map(s => s.bg),
    ...Object.values(buttonVariants).map(b => b.bg),
  ]

  const uniqueColors = new Set(allColors)
  expect(allColors.length).toBe(uniqueColors.size)
})
```

#### 5. Metric Colors (2 tests)

**metric colors have all required variants:**
```tsx
it('metric colors have all required variants', () => {
  const requiredMetrics = ['default', 'green', 'red', 'amber']

  requiredMetrics.forEach(metric => {
    expect(metricColors[metric]).toBeDefined()
  })
})
```

**metric colors use appropriate shade values:**
```tsx
it('metric colors use appropriate shade values', () => {
  const coloredMetrics = ['green', 'red', 'amber']

  coloredMetrics.forEach(metric => {
    expect(metricColors[metric]).toContain('-600')
  })
})
```

#### 6. Color Format Validation (1 test)

**all color strings follow Tailwind CSS format:**
```tsx
it('all color strings follow Tailwind CSS format', () => {
  const allColors = [
    ...Object.values(statusColors),
    ...Object.values(buttonVariants),
    ...Object.values(metricColors),
    errorColors,
    successColors,
    warningColors,
    infoColors,
    bgColors,
    textColors,
    borderColors,
    interactiveStates,
  ]

  allColors.forEach(colorObj => {
    Object.values(colorObj).forEach(color => {
      if (typeof color === 'string') {
        // Matches: bg-red-500, text-blue-600, hover:bg-gray-50, etc.
        expect(color).toMatch(/^(bg|text|border|ring|hover:bg|hover:text|hover:border|disabled:|focus:)-/)
      }
    })
  })
})
```

### Running Color Tests

```bash
# Run color tests only
npm test -- colors.test.ts

# Run with coverage
npm test -- colors.test.ts --coverage

# Run in watch mode
npm test -- colors.test.ts --watch
```

### Coverage Report

```
% Coverage report from v8
File           | % Stmts | % Branch | % Funcs | % Lines |
----------------|---------|----------|---------|---------|
.../colors.ts  |   100   |   100    |   100   |   100   |
```

### Consistency Rules Enforced

The color test suite enforces **8 consistency rules**:

1. ✅ **Status colors** follow bg-50, text-700, border-200, solid-500 pattern
2. ✅ **Button variants** have all required states (bg, text, border, hover)
3. ✅ **Semantic colors** use consistent shades (text-600, bg-50)
4. ✅ **Related statuses** share color families (success/approved, failed/denied)
5. ✅ **No duplicate** color definitions across semantic meanings
6. ✅ **Color palette** has complete shade ranges
7. ✅ **Neutral colors** maintain hierarchical structure
8. ✅ **Interactive states** use proper pseudo-classes

---

## E2E Testing

### Setting Up Playwright

```bash
# Install Playwright
npm install -D @playwright/test

# Install browsers
npx playwright install
```

**playwright.config.ts:**
```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
```

### E2E Test Example

```ts
// e2e/agents.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Agents Page', () => {
  test('displays agents list', async ({ page }) => {
    await page.goto('/agents')

    await expect(page.locator('h1')).toContainText('Agents')
    await expect(page.locator('[data-testid="agent-list"]')).toBeVisible()
  })

  test('creates new agent', async ({ page }) => {
    await page.goto('/agents')

    await page.click('button:has-text("Create Agent")')
    await page.fill('[name="name"]', 'Test Agent')
    await page.click('button:has-text("Create")')

    await expect(page.locator('text=Test Agent')).toBeVisible()
  })
})
```

---

## Test Coverage

### Generating Coverage

```bash
# Generate coverage report
npm run test:coverage

# View HTML coverage report
open coverage/index.html
```

### Coverage Goals

| Metric | Target | Current |
|--------|--------|---------|
| **Statements** | ≥ 80% | TBD |
| **Branches** | ≥ 80% | TBD |
| **Functions** | ≥ 80% | TBD |
| **Lines** | ≥ 80% | TBD |

### Excluding Files from Coverage

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'src/main.tsx',
      ],
    },
  },
})
```

---

## Best Practices

### General Guidelines

1. **Test Behavior, Not Implementation**: Focus on what users see and do
2. **Use Testing Library Queries**: Prefer accessible queries (getByRole, getByLabelText)
3. **Avoid Test Fragility**: Don't test implementation details
4. **Keep Tests Simple**: Each test should verify one thing
5. **Use Descriptive Names**: Test names should describe what is being tested

### Component Testing

**✅ Good:**
```tsx
it('submits form when user clicks submit button', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()

  render(<Form onSubmit={onSubmit} />)

  await user.type(screen.getByLabelText('Name'), 'Test')
  await user.click(screen.getByRole('button', { name: 'Submit' }))

  expect(onSubmit).toHaveBeenCalledWith({ name: 'Test' })
})
```

**❌ Bad:**
```tsx
it('calls onClick', () => {
  const onClick = vi.fn()
  render(<Button onClick={onClick} />)

  const button = container.querySelector('button')
  button.click()

  expect(onClick).toHaveBeenCalled()
})
```

### Async Testing

**✅ Good:**
```tsx
it('loads data', async () => {
  render(<DataList />)

  await waitFor(() => {
    expect(screen.getByText('Item 1')).toBeInTheDocument()
  })
})
```

**❌ Bad:**
```tsx
it('loads data', () => {
  render(<DataList />)

  expect(screen.getByText('Item 1')).toBeInTheDocument() // May fail due to timing
})
```

### Mocking

**✅ Good:** Mock at the API level
```tsx
vi.mock('@/api/agents', () => ({
  useAgents: () => ({ data: mockAgents, isLoading: false }),
}))
```

**❌ Bad:** Mock internal implementation
```tsx
vi.spyOn(component, 'internalMethod').mockReturnValue(true)
```

---

## Continuous Integration

### GitHub Actions Example

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Generate coverage
        run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## Troubleshooting

### Common Issues

**Tests timing out:**
- Increase timeout: `test.setTimeout(5000)`
- Check for infinite loops
- Verify async operations are properly awaited

**DOM not updating:**
- Use `waitFor` for async updates
- Check for missing `await` keywords
- Verify act() is used for state updates

**Mock not working:**
- Clear mocks between tests: `vi.clearAllMocks()`
- Verify mock is set up before test runs
- Check for incorrect mock paths

---

## Translation & Language Switching

Manual QA checklist for verifying i18n behavior. Run with `npm run dev` and open http://localhost:5174/.

### Console Check

- No `"rejecting language code not found in supportedLngs"` warning
- No translation key errors (raw key names showing as text)
- Console should be clean or show only i18next debug messages

### Language Switching

1. Navigate to Settings, find Language dropdown
2. Switch English → Portuguese: all text changes immediately, no console errors
3. Switch Portuguese → English: all text changes back, no console errors
4. Language persists on page refresh (localStorage key: `i18nextLng`)

### Component Checks

- **QuickActionModal** (Cmd/Ctrl+K): title and actions translated, updates on language change
- **Dashboard**: all cards and labels show translated text
- **Navigation**: sidebar items and tooltips update on language change
- **Settings**: all tabs (General, Connections, System) fully translated

### Translation Keys to Verify

Check these namespaces render correctly (not as raw key names):

- `workspaces.*` (title, basePath, description)
- `daemon.*` (title, status.running/stopped, actions.start/stop)
- `cloudflare.*` (title, status.*, actions.*)
- `client.*` (title, managed, managedDescription)
- `tabs.*` (general.label, connections.label, system.label)

### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Text shows as `key.name` | Missing translation key | Add key to locale JSON files |
| Language resets on refresh | Persistence not working | Check localStorage for `i18nextLng` |
| Mixed languages on page | Namespace mismatch | Verify translation namespace consistency |
| Text doesn't update on switch | Component not re-rendering | Ensure component listens to `languageChanged` event |

---

**Last Updated:** 2026-03-16
**Maintained By:** Development Team
