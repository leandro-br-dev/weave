# Dashboard Architecture

**Last Updated:** 2026-03-16
**Version:** 1.0.0

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [State Management](#state-management)
5. [Routing](#routing)
6. [Data Flow](#data-flow)
7. [Component Architecture](#component-architecture)
8. [API Integration](#api-integration)
9. [Real-time Communication](#real-time-communication)
10. [Performance Optimization](#performance-optimization)

---

## System Overview

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   React App                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │   │
│  │  │   Pages      │  │  Components  │  │ Features  │ │   │
│  │  └──────────────┘  └──────────────┘  └───────────┘ │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │   │
│  │  │    Hooks     │  │     API      │  │    Lib    │ │   │
│  │  └──────────────┘  └──────────────┘  └───────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                  │
│  ┌────────────────────────┴────────────────────────────┐    │
│  │              TanStack Query (React Query)            │    │
│  │  • Caching  • Refetching  • Background Updates      │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                           │ REST API
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend Server                            │
│  Express.js + SQLite + Socket.IO                            │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Principles

1. **Component-Based UI**: Reusable, composable React components
2. **Unidirectional Data Flow**: Props down, events up
3. **Server State Management**: TanStack Query for API state
4. **Client State Management**: React hooks for local UI state
5. **Code Splitting**: Lazy loading for optimal performance
6. **Type Safety**: TypeScript throughout the application

---

## Technology Stack

### Core Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.2.0 | UI framework |
| **TypeScript** | 5.9.3 | Type safety |
| **Vite** | 7.3.1 | Build tool and dev server |
| **TanStack Query** | 5.90.21 | Server state management |
| **React Router** | 7.13.0 | Client-side routing |
| **Tailwind CSS** | 3.4.4 | Utility-first CSS framework |
| **Socket.IO Client** | 4.8.3 | Real-time communication |

### UI Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| **Radix UI Dialog** | 1.1.15 | Accessible dialogs |
| **Radix UI Select** | 2.2.6 | Accessible dropdowns |
| **DnD Kit** | 6.3.1 | Drag and drop |
| **Lucide React** | 0.575.0 | Icon library |
| **i18next** | 25.8.11 | Internationalization |

### Development Tools

| Tool | Version | Purpose |
|------|---------|---------|
| **Vitest** | 3.1.2 | Unit testing |
| **Testing Library** | 16.3.1 | Component testing |
| **ESLint** | 9.39.1 | Linting |
| **PostCSS** | 8.5.6 | CSS processing |
| **Autoprefixer** | 10.4.24 | CSS vendor prefixes |

---

## Project Structure

### Directory Organization

```
dashboard/
├── docs/                      # Documentation
│   ├── README.md             # Overview and quick start
│   ├── UI_COMPONENTS.md      # Component library
│   ├── ARCHITECTURE.md       # This file
│   ├── IMPLEMENTATION.md     # Implementation patterns
│   └── TESTING.md            # Testing documentation
├── src/
│   ├── api/                  # API client layer
│   │   ├── agents.ts         # Agent endpoints
│   │   ├── projects.ts       # Project endpoints
│   │   ├── plans.ts          # Plan endpoints
│   │   ├── approvals.ts      # Approval endpoints
│   │   ├── kanban.ts         # Kanban endpoints
│   │   ├── chat.ts           # Chat endpoints
│   │   ├── skills.ts         # Skills endpoints
│   │   ├── marketplace.ts    # Marketplace endpoints
│   │   └── quickActions.ts   # Quick actions
│   ├── components/           # Shared components
│   │   ├── Button.tsx        # Button component
│   │   ├── Input.tsx         # Input component
│   │   ├── Select.tsx        # Select component
│   │   ├── Switch.tsx        # Switch component
│   │   ├── StatusBadge.tsx   # Status badge
│   │   ├── MetricCard.tsx    # Metric display
│   │   ├── Card.tsx          # Card container
│   │   ├── Pagination.tsx    # Pagination
│   │   ├── Toast.tsx         # Toast notifications
│   │   ├── ConfirmDialog.tsx # Confirmation dialog
│   │   ├── QuickActionModal.tsx # Quick actions
│   │   ├── EmptyState.tsx    # Empty state
│   │   ├── PageHeader.tsx    # Page header
│   │   ├── Layout.tsx        # Main layout
│   │   └── index.ts          # Component exports
│   ├── features/             # Feature modules
│   │   ├── agents/           # Agent management
│   │   ├── projects/         # Project management
│   │   ├── plans/            # Plan management
│   │   ├── approvals/        # Approval workflows
│   │   ├── kanban/           # Kanban board
│   │   ├── chat/             # Chat sessions
│   │   ├── skills/           # Native skills
│   │   └── marketplace/      # Marketplace
│   ├── pages/                # Page components
│   │   ├── AgentsPage.tsx
│   │   ├── ProjectsPage.tsx
│   │   ├── PlansPage.tsx
│   │   ├── PlanDetailPage.tsx
│   │   ├── WorkflowsPage.tsx
│   │   ├── ApprovalsPage.tsx
│   │   ├── KanbanPage.tsx
│   │   ├── ChatPage.tsx
│   │   ├── SkillsPage.tsx
│   │   ├── MarketplacePage.tsx
│   │   └── SettingsPage.tsx
│   ├── lib/                  # Utilities
│   │   ├── colors.ts         # Color system
│   │   ├── utils.ts          # Utility functions
│   │   └── cn.ts             # Class name utility
│   ├── hooks/                # Custom hooks
│   ├── test/                 # Test utilities
│   ├── App.tsx               # Root component
│   └── main.tsx              # Entry point
├── public/                   # Static assets
├── index.html                # HTML template
├── vite.config.ts            # Vite config
├── tailwind.config.js        # Tailwind config
├── tsconfig.json             # TypeScript config
└── package.json              # Dependencies
```

### Module Organization

**API Layer (`src/api/`):**
- Encapsulates all HTTP communication
- Provides typed API hooks
- Handles error responses
- Manages request/response transformation

**Components (`src/components/`):**
- Reusable UI components
- No business logic
- Props-based configuration
- Shared across features

**Features (`src/features/`):**
- Feature-specific components
- Business logic
- API integration
- State management

**Pages (`src/pages/`):**
- Route-level components
- Layout composition
- Feature orchestration
- Navigation handling

---

## State Management

### Server State: TanStack Query

The dashboard uses TanStack Query for managing server state (API data).

**Benefits:**
- Automatic caching and refetching
- Background updates
- Optimistic updates
- Request deduplication
- Pagination support

**Configuration:**
```tsx
// src/main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,      // 30 seconds
      gcTime: 5 * 60 * 1000,     // 5 minutes
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
    </QueryClientProvider>
  )
}
```

**Query Example:**
```tsx
// src/api/agents.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const response = await fetch('/api/agents')
      if (!response.ok) throw new Error('Failed to fetch agents')
      return response.json()
    },
  })
}

export function useUpdateAgent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (agent: Agent) => {
      const response = await fetch(`/api/agents/${agent.id}`, {
        method: 'PUT',
        body: JSON.stringify(agent),
      })
      if (!response.ok) throw new Error('Failed to update agent')
      return response.json()
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
  })
}
```

### Client State: React Hooks

Local UI state is managed with React hooks.

**Common Patterns:**

**useState**: Component state
```tsx
const [isOpen, setIsOpen] = useState(false)
const [selectedId, setSelectedId] = useState<string>()
```

**useEffect**: Side effects
```tsx
useEffect(() => {
  if (projectFilter) {
    const project = projects.find(p => p.id === projectFilter)
    setAutoMoveEnabled(project?.settings?.auto_move_enabled ?? false)
  }
}, [projectFilter, projects])
```

**useReducer**: Complex state logic
```tsx
const [state, dispatch] = useReducer(formReducer, initialState)
```

**useContext**: Global state
```tsx
const { settings, updateSettings } = useSettings()
```

### State Flow

```
User Action → Component Handler → Mutation Hook → API Call
                                              ↓
                              TanStack Query Cache Update
                                              ↓
                                    Component Re-render
```

---

## Routing

### React Router Setup

The dashboard uses React Router for client-side routing.

**Configuration:**
```tsx
// src/main.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'

// Lazy load pages
const AgentsPage = lazy(() => import('./pages/AgentsPage'))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'))

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<AgentsPage />} />
            <Route path="agents" element={<AgentsPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            {/* ... other routes */}
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
```

### Route Structure

| Path | Component | Description |
|------|-----------|-------------|
| `/` | WorkflowsPage | Default page (workflows list) |
| `/agents` | AgentsPage | Agent management |
| `/projects` | ProjectsPage | Project management |
| `/plans/:id` | PlanDetailPage | Plan/workflow details |
| `/plans/new` | CreatePlanPage | Create new workflow |
| `/approvals` | ApprovalsPage | Approval requests |
| `/kanban` | KanbanPage | Kanban board |
| `/chat` | ChatPage | Chat sessions |
| `/marketplace` | MarketplacePage | Marketplace |
| `/settings` | SettingsPage | Settings |

### Navigation

**Declarative navigation:**
```tsx
import { Link, useNavigate } from 'react-router-dom'

function Navigation() {
  const navigate = useNavigate()

  return (
    <nav>
      <Link to="/agents">Agents</Link>
      <button onClick={() => navigate('/projects')}>
        Projects
      </button>
    </nav>
  )
}
```

**Programmatic navigation:**
```tsx
const navigate = useNavigate()

navigate('/agents')
navigate(-1) // Go back
navigate('/plans', { state: { from: 'dashboard' } })
```

### Route Parameters

```tsx
import { useParams } from 'react-router-dom'

function PlanDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: plan } = usePlan(id)

  return <div>{plan?.name}</div>
}
```

### Lazy Loading

Pages are lazy loaded for optimal performance:

```tsx
const AgentsPage = lazy(() => import('./pages/AgentsPage'))

<Suspense fallback={<PageSkeleton />}>
  <AgentsPage />
</Suspense>
```

---

## Data Flow

### Request/Response Flow

```
Component → API Hook → fetch() → Backend API
    ↓                                    ↓
Loading State ← ← ← ← ← ← ← ← ← ← ← ← JSON Response
    ↓
Success/Error State
    ↓
UI Update
```

### Example: Fetching Agents

```tsx
// 1. Component requests data
function AgentsPage() {
  const { data: agents, isLoading, error } = useAgents()

  // 2. Show loading state
  if (isLoading) return <LoadingSpinner />

  // 3. Handle error
  if (error) return <ErrorMessage message={error.message} />

  // 4. Render data
  return <AgentsList agents={agents} />
}

// 2. API hook fetches data
function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const response = await fetch('/api/agents')
      return response.json()
    },
  })
}

// 3. TanStack Query caches response
// 4. Component receives data and re-renders
```

### Mutation Flow

```
Component → Mutation Hook → API Call → Backend Update
              ↓                           ↓
         Optimistic Update ← ← ← ← ← ← ← Success/Error
              ↓
         Component Re-render
```

### Example: Updating Agent

```tsx
// 1. Component triggers mutation
function AgentForm({ agent }) {
  const updateAgent = useUpdateAgent()

  const handleSubmit = (data) => {
    updateAgent.mutate({ ...agent, ...data })
  }
}

// 2. Mutation hook sends request
function useUpdateAgent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (agent) => {
      const response = await fetch(`/api/agents/${agent.id}`, {
        method: 'PUT',
        body: JSON.stringify(agent),
      })
      return response.json()
    },
    // 3. Invalidate cache
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
  })
}

// 4. TanStack Query refetches data
// 5. Component updates with new data
```

---

## Component Architecture

### Component Types

**1. Page Components** (`src/pages/`)
- Route-level components
- Compose features and layouts
- Handle navigation and routing
- Minimal business logic

**2. Feature Components** (`src/features/`)
- Domain-specific logic
- API integration
- State management
- Business rules

**3. Shared Components** (`src/components/`)
- Reusable UI elements
- No business logic
- Props-driven
- Feature-agnostic

### Component Hierarchy

```
Layout
└── Page
    ├── PageHeader
    └── Content
        ├── Feature
        │   ├── Shared Components
        │   └── Feature Components
        └── Shared Components
```

### Props Pattern

**Composition over props drilling:**
```tsx
// ❌ Bad: Props drilling
<Page agents={agents} onUpdateAgent={onUpdateAgent} />

// ✅ Good: Composition
<Page>
  <AgentList />
</Page>
```

**Compound components:**
```tsx
<Card>
  <Card.Header>Title</Card.Header>
  <Card.Body>Content</Card.Body>
  <Card.Footer>Actions</Card.Footer>
</Card>
```

---

## API Integration

### API Client Structure

All API calls are organized in `src/api/` with consistent patterns.

**File Structure:**
```
src/api/
├── agents.ts          # Agent operations
├── projects.ts        # Project operations
├── plans.ts           # Plan operations
├── approvals.ts       # Approval operations
├── kanban.ts          # Kanban operations
├── chat.ts            # Chat operations
├── skills.ts          # Skills operations
├── marketplace.ts     # Marketplace operations
└── quickActions.ts    # Quick actions
```

### API Hook Pattern

Each API module exports:
1. **Query hooks**: For fetching data
2. **Mutation hooks**: For modifying data
3. **Utility functions**: For common operations

**Example:**
```tsx
// src/api/agents.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// Types
export interface Agent {
  id: string
  name: string
  status: 'active' | 'inactive'
}

// Query hook
export function useAgents() {
  return useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: fetchAgents,
  })
}

export function useAgent(id: string) {
  return useQuery<Agent>({
    queryKey: ['agents', id],
    queryFn: () => fetchAgent(id),
    enabled: !!id,
  })
}

// Mutation hooks
export function useCreateAgent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
  })
}

export function useUpdateAgent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateAgent,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      queryClient.setQueryData(['agents', data.id], data)
    },
  })
}

export function useDeleteAgent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
  })
}

// API functions
async function fetchAgents(): Promise<Agent[]> {
  const response = await fetch('/api/agents')
  if (!response.ok) throw new Error('Failed to fetch agents')
  return response.json()
}

async function fetchAgent(id: string): Promise<Agent> {
  const response = await fetch(`/api/agents/${id}`)
  if (!response.ok) throw new Error('Failed to fetch agent')
  return response.json()
}

async function createAgent(agent: Partial<Agent>): Promise<Agent> {
  const response = await fetch('/api/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(agent),
  })
  if (!response.ok) throw new Error('Failed to create agent')
  return response.json()
}

async function updateAgent(agent: Agent): Promise<Agent> {
  const response = await fetch(`/api/agents/${agent.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(agent),
  })
  if (!response.ok) throw new Error('Failed to update agent')
  return response.json()
}

async function deleteAgent(id: string): Promise<void> {
  const response = await fetch(`/api/agents/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) throw new Error('Failed to delete agent')
}
```

### Error Handling

**Consistent error handling across all API calls:**
```tsx
export function useAgents() {
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
        throw error
      }
    },
  })
}
```

---

## Real-time Communication

### Socket.IO Integration

The dashboard uses Socket.IO for real-time updates.

**Setup:**
```tsx
// src/lib/socket.ts
import { io, Socket } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['websocket'],
})

// Connect on first use
let isConnected = false

export function connectSocket() {
  if (!isConnected) {
    socket.connect()
    isConnected = true
  }
  return socket
}
```

**Usage:**
```tsx
import { useEffect } from 'react'
import { connectSocket } from '@/lib/socket'

function AgentsPage() {
  useEffect(() => {
    const socket = connectSocket()

    socket.on('agent:status:update', (data) => {
      console.log('Agent status updated:', data)
      // Update local state
    })

    return () => {
      socket.off('agent:status:update')
    }
  }, [])

  return <AgentsList />
}
```

### Real-time Events

**Common events:**
- `agent:status:update` - Agent status changed
- `plan:status:update` - Plan execution status
- `plan:step:update` - Plan step update
- `kanban:task:update` - Kanban task change
- `chat:message:new` - New chat message
- `approval:request:new` - New approval request

---

## Performance Optimization

### Code Splitting

**Route-based splitting:**
```tsx
const AgentsPage = lazy(() => import('./pages/AgentsPage'))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'))
```

**Component-based splitting:**
```tsx
const HeavyComponent = lazy(() => import('./HeavyComponent'))
```

### Memoization

**React.memo for expensive components:**
```tsx
const ExpensiveComponent = React.memo(({ data }) => {
  // Expensive rendering
})
```

**useMemo for expensive calculations:**
```tsx
const sortedAgents = useMemo(() => {
  return agents.sort((a, b) => a.name.localeCompare(b.name))
}, [agents])
```

**useCallback for stable references:**
```tsx
const handleClick = useCallback(() => {
  console.log('Clicked')
}, [])
```

### Lazy Loading Images

```tsx
<img
  src={image}
  loading="lazy"
  alt="Description"
/>
```

### Virtualization

For long lists, consider virtualization:
```tsx
import { useVirtualizer } from '@tanstack/react-virtual'

function VirtualList({ items }) {
  const parentRef = useRef(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
  })

  return (
    <div ref={parentRef} style={{ height: '400px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {items[virtualItem.index]}
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## Security Considerations

### XSS Prevention

React automatically escapes user input:
```tsx
// Safe: React escapes HTML
<div>{userInput}</div>

// Dangerous: Avoid dangerouslySetInnerHTML
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

### CSRF Protection

The API uses same-site cookie policy for CSRF protection.

### Authentication

JWT tokens are stored securely and sent with API requests:
```tsx
const response = await fetch('/api/agents', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
})
```

---

## Monitoring & Debugging

### React Query DevTools

```tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

### Error Tracking

**Global error handler:**
```tsx
// src/main.tsx
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error)
  // Send to error tracking service
})
```

---

**Last Updated:** 2026-03-16
**Maintained By:** Development Team
