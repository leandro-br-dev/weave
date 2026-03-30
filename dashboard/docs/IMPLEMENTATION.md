# Implementation Guide

**Last Updated:** 2026-03-16
**Version:** 1.0.0

---

## Table of Contents

1. [React Patterns](#react-patterns)
2. [Component Implementation](#component-implementation)
3. [Feature Implementation](#feature-implementation)
4. [Form Handling](#form-handling)
5. [Error Handling](#error-handling)
6. [Auto-Move Toggle Implementation](#auto-move-toggle-implementation)
7. [Testing Implementation](#testing-implementation)
8. [Build & Deployment](#build--deployment)

---

## React Patterns

### Functional Components with Hooks

All components are functional and use React hooks.

**Basic component:**
```tsx
interface Props {
  title: string
  onClick: () => void
}

export function Button({ title, onClick }: Props) {
  return (
    <button onClick={onClick} className="px-4 py-2 bg-gray-900 text-white rounded">
      {title}
    </button>
  )
}
```

**Component with state:**
```tsx
export function Counter() {
  const [count, setCount] = useState(0)

  const increment = () => setCount(c => c + 1)
  const decrement = () => setCount(c => c - 1)

  return (
    <div>
      <button onClick={decrement}>-</button>
      <span>{count}</span>
      <button onClick={increment}>+</button>
    </div>
  )
}
```

### Custom Hooks

Extract reusable logic into custom hooks.

**Example: useLocalStorage hook**
```tsx
function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      return initialValue
    }
  })

  const setValue = (value: T) => {
    try {
      setStoredValue(value)
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.error('Error saving to localStorage:', error)
    }
  }

  return [storedValue, setValue] as const
}

// Usage
const [theme, setTheme] = useLocalStorage('theme', 'light')
```

**Example: useDebounce hook**
```tsx
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Usage
const debouncedSearchTerm = useDebounce(searchTerm, 500)
```

### useEffect Patterns

**Run on mount:**
```tsx
useEffect(() => {
  console.log('Component mounted')
  return () => console.log('Component unmounted')
}, [])
```

**Run when dependencies change:**
```tsx
useEffect(() => {
  if (userId) {
    fetchUser(userId)
  }
}, [userId])
```

**Run on every render:**
```tsx
useEffect(() => {
  console.log('Component rendered')
})
```

### Context API

Share state across components without prop drilling.

**Create context:**
```tsx
interface ThemeContextType {
  theme: 'light' | 'dark'
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  const toggleTheme = () => {
    setTheme(t => (t === 'light' ? 'dark' : 'light'))
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
```

**Use context:**
```tsx
function ThemedButton() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className={theme === 'light' ? 'bg-white text-black' : 'bg-black text-white'}
    >
      Toggle Theme
    </button>
  )
}
```

---

## Component Implementation

### Button Component

```tsx
import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/cn'
import { buttonVariants } from '@/lib/colors'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', isLoading, disabled, className, children, ...props }, ref) => {
    const colors = buttonVariants[variant]

    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'rounded-md font-medium transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          colors.bg,
          colors.text,
          colors.border,
          colors.hoverBg,
          sizeClasses[size],
          (disabled || isLoading) && 'opacity-50 cursor-not-allowed',
          className
        )}
        {...props}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
            Loading...
          </span>
        ) : (
          children
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'
```

### Input Component

```tsx
import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/cn'
import { errorColors } from '@/lib/colors'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'px-3 py-2 rounded-md border',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500',
            error
              ? `${errorColors.border} ${errorColors.bg}`
              : 'border-gray-300 focus:border-indigo-500',
            error && `${errorColors.text}`,
            className
          )}
          {...props}
        />
        {error && (
          <span className={cn('text-sm', errorColors.text)}>{error}</span>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
```

### Switch Component

```tsx
import { ComponentProps, forwardRef } from 'react'
import { cn } from '@/lib/cn'

interface SwitchProps extends ComponentProps<'button'> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked = false, onCheckedChange, disabled, className, ...props }, ref) => {
    const handleClick = () => {
      if (!disabled) {
        onCheckedChange?.(!checked)
      }
    }

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
          checked ? 'bg-gray-900' : 'bg-gray-300',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        {...props}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5'
          )}
        />
      </button>
    )
  }
)

Switch.displayName = 'Switch'
```

### StatusBadge Component

```tsx
import { statusColors } from '@/lib/colors'
import { cn } from '@/lib/cn'

interface StatusBadgeProps {
  status: 'pending' | 'running' | 'success' | 'failed' | 'timeout' | 'approved' | 'denied' | 'unknown'
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export function StatusBadge({ status, size = 'md', showLabel = true }: StatusBadgeProps) {
  const colors = statusColors[status] || statusColors.unknown

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        colors.bg,
        colors.text,
        colors.border,
        sizeClasses[size]
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', colors.solid)} />
      {showLabel && colors.label}
    </span>
  )
}
```

---

## Feature Implementation

### Auto-Move Toggle Implementation

The auto-move toggle allows users to enable/disable automatic task movement on the Kanban board.

#### Files Created/Modified

**1. Created: `src/components/Switch.tsx`**
- Reusable toggle switch component
- Fully accessible with ARIA attributes
- Supports disabled state
- Smooth animations for state transitions

**2. Created: `src/components/Switch.test.tsx`**
- Comprehensive test suite with 6 passing tests
- Tests cover rendering, click behavior, disabled state, and toggle functionality

**3. Modified: `src/components/index.ts`**
- Added export for Switch component

**4. Modified: `src/pages/KanbanPage.tsx`**
- Added auto-move toggle functionality
- Integrated with project settings
- Handles state persistence

#### Implementation Details

**Imports:**
```tsx
import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'
import { Switch } from '@/components'
import { useUpdateProject } from '@/api/projects'
```

**State:**
```tsx
const [autoMoveEnabled, setAutoMoveEnabled] = useState(false)
const [autoMoveProjectId, setAutoMoveProjectId] = useState<string>('')
```

**Mutation:**
```tsx
const updateProject = useUpdateProject()
```

**Initialization:**
```tsx
useEffect(() => {
  if (projectFilter) {
    const project = projects.find(p => p.id === projectFilter)
    setAutoMoveEnabled(project?.settings?.auto_move_enabled ?? false)
    setAutoMoveProjectId(projectFilter)
  } else if (projects.length === 1) {
    setAutoMoveEnabled(projects[0]?.settings?.auto_move_enabled ?? false)
    setAutoMoveProjectId(projects[0]?.id ?? '')
  }
}, [projectFilter, projects])
```

**Handler:**
```tsx
const handleToggleAutoMove = (enabled: boolean) => {
  setAutoMoveEnabled(enabled)
  if (autoMoveProjectId) {
    const project = projects.find(p => p.id === autoMoveProjectId)
    updateProject.mutate({
      id: autoMoveProjectId,
      settings: {
        auto_move_enabled: enabled,
        auto_approve_workflows: project?.settings?.auto_approve_workflows ?? false
      }
    })
  }
}
```

**UI Component:**
```tsx
{autoMoveProjectId && (
  <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-md">
    <Zap className={`h-4 w-4 ${autoMoveEnabled ? 'text-yellow-500' : 'text-gray-400'}`} />
    <span className="text-sm text-gray-700">Auto-move</span>
    <Switch
      checked={autoMoveEnabled}
      onCheckedChange={handleToggleAutoMove}
      disabled={updateProject.isPending}
    />
  </div>
)}
```

#### Visual Design

**Location:** Kanban Board page header (left of project filter)

**Appearance:**
- **Icon:** ⚡ Zap (yellow when enabled, gray when disabled)
- **Label:** "Auto-move"
- **Switch:** Smooth toggle animation
- **Container:** Clean white box with border

**States:**
- **Disabled:** Gray icon, toggle off
- **Enabled:** Yellow icon, toggle on
- **Loading:** Disabled during update operation

#### Accessibility Features

✅ **Keyboard Navigation:** Tab to focus, Space/Enter to toggle
✅ **ARIA Attributes:** Proper role="switch" and aria-checked
✅ **Focus Indicator:** Visible focus ring for keyboard users
✅ **Screen Reader:** Announces state changes to screen readers
✅ **Touch Targets:** Adequate size for touch interactions (36px height)

#### Testing Results

✅ **TypeScript Compilation:** No errors
✅ **Component Tests:** 6/6 tests passing
✅ **Integration:** Properly integrated with KanbanPage

#### User Experience Flow

1. Navigate to Kanban Board
2. Toggle appears when project is selected
3. Current state loaded from settings
4. Click toggle to change state
5. Setting immediately saved to database
6. Toggle reflects new state
7. State persists across page reloads

---

## Form Handling

### Controlled Components

```tsx
function AgentForm() {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'inactive',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Submit form
  }

  return (
    <form onSubmit={handleSubmit}>
      <Input
        name="name"
        label="Name"
        value={formData.name}
        onChange={handleChange}
      />
      <button type="submit">Submit</button>
    </form>
  )
}
```

### Form Validation

```tsx
function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  validate: (values: T) => Record<string, string>
) {
  const [values, setValues] = useState<T>(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const handleChange = (name: keyof T) => (value: any) => {
    setValues(prev => ({ ...prev, [name]: value }))
    if (touched[name as string]) {
      setErrors(validate({ ...values, [name]: value }))
    }
  }

  const handleBlur = (name: keyof T) => () => {
    setTouched(prev => ({ ...prev, [name]: true }))
    setErrors(validate(values))
  }

  const handleSubmit = (onSubmit: (values: T) => void) => (e: React.FormEvent) => {
    e.preventDefault()
    const validationErrors = validate(values)
    setErrors(validationErrors)
    setTouched(Object.keys(values).reduce((acc, key) => ({ ...acc, [key]: true }), {}))

    if (Object.keys(validationErrors).length === 0) {
      onSubmit(values)
    }
  }

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
  }
}

// Usage
function CreateAgentForm() {
  const { values, errors, handleChange, handleSubmit } = useFormValidation(
    { name: '', description: '' },
    (values) => {
      const errors: Record<string, string> = {}
      if (!values.name) errors.name = 'Name is required'
      if (values.name.length < 3) errors.name = 'Name must be at least 3 characters'
      return errors
    }
  )

  return (
    <form onSubmit={handleSubmit((data) => console.log(data))}>
      <Input
        label="Name"
        value={values.name}
        onChange={(e) => handleChange('name')(e.target.value)}
        error={errors.name}
      />
      <button type="submit">Create</button>
    </form>
  )
}
```

---

## Error Handling

### Error Boundaries

```tsx
class ErrorBoundary extends React.Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <h2 className="text-lg font-semibold text-red-700">Something went wrong</h2>
          <p className="text-red-600">{this.state.error?.message}</p>
        </div>
      )
    }

    return this.props.children
  }
}

// Usage
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

### API Error Handling

```tsx
function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/agents')
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        return await response.json()
      } catch (error) {
        console.error('Failed to fetch agents:', error)
        toast.error('Failed to load agents')
        throw error
      }
    },
  })
}
```

### Loading and Error States

```tsx
function AgentsList() {
  const { data: agents, isLoading, error } = useAgents()

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (error) {
    return <ErrorMessage message={error.message} />
  }

  if (!agents || agents.length === 0) {
    return <EmptyState message="No agents found" />
  }

  return <div>{agents.map(agent => <AgentCard key={agent.id} agent={agent} />)}</div>
}
```

---

## Testing Implementation

### Component Testing

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Button } from '../Button'

describe('Button', () => {
  it('renders button with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click me</Button>)
    fireEvent.click(screen.getByText('Click me'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('is disabled when isLoading is true', () => {
    render(<Button isLoading>Click me</Button>)
    expect(screen.getByText('Click me')).toBeDisabled()
  })
})
```

### Testing Custom Hooks

```tsx
import { renderHook, act } from '@testing-library/react'
import { useCounter } from '../useCounter'

describe('useCounter', () => {
  it('increments counter', () => {
    const { result } = renderHook(() => useCounter())
    expect(result.current.count).toBe(0)

    act(() => {
      result.current.increment()
    })

    expect(result.current.count).toBe(1)
  })
})
```

### Integration Testing

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AgentsPage } from '../AgentsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
})

describe('AgentsPage', () => {
  it('displays agents', async () => {
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

---

## Build & Deployment

### Build Process

```bash
# Type check
npm run build

# This runs:
# 1. tsc -b (TypeScript compilation)
# 2. vite build (Bundle and optimize)
```

**Build output:**
```
dist/
├── index.html           # Entry HTML
├── assets/
│   ├── index-[hash].js  # Bundled JavaScript
│   └── index-[hash].css # Bundled CSS
```

### Environment Variables

**.env file:**
```bash
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

**Usage in code:**
```tsx
const apiUrl = import.meta.env.VITE_API_URL
```

### Deployment Checklist

**Pre-deployment:**
- [ ] Run tests: `npm test`
- [ ] Type check: `npx tsc --noEmit`
- [ ] Lint: `npm run lint`
- [ ] Build: `npm run build`
- [ ] Test production build: `npm run preview`

**Post-deployment:**
- [ ] Verify API connectivity
- [ ] Test WebSocket connection
- [ ] Check all user flows
- [ ] Monitor error tracking
- [ ] Check performance metrics

---

## Best Practices

### Performance

1. **Code Splitting**: Lazy load routes and heavy components
2. **Memoization**: Use `React.memo`, `useMemo`, `useCallback` appropriately
3. **Virtualization**: For long lists, use windowing
4. **Image Optimization**: Use appropriate formats and lazy loading
5. **Bundle Analysis**: Monitor bundle size

### Maintainability

1. **Type Safety**: Use TypeScript for all code
2. **Component Design**: Keep components focused and reusable
3. **Code Organization**: Follow established folder structure
4. **Documentation**: Add comments for complex logic
5. **Testing**: Write tests for all components and hooks

### Accessibility

1. **Semantic HTML**: Use proper HTML elements
2. **ARIA Attributes**: Add necessary ARIA attributes
3. **Keyboard Navigation**: Ensure all functionality is keyboard accessible
4. **Focus Management**: Implement proper focus management
5. **Color Contrast**: Meet WCAG AA standards

---

**Last Updated:** 2026-03-16
**Maintained By:** Development Team
