# API Architecture

System architecture, data models, and database schema for the Weave API.

## Table of Contents

- [System Overview](#system-overview)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Data Models](#data-models)
- [Authentication Architecture](#authentication-architecture)
- [Middleware](#middleware)
- [Request/Response Flow](#requestresponse-flow)
- [Real-time Features](#real-time-features)
- [Error Handling](#error-handling)
- [CORS Configuration](#cors-configuration)

---

## System Overview

The Weave API is a RESTful backend service built with Express.js that manages AI agents, projects, workflows, and execution plans. It serves as the central coordination layer between the frontend dashboard and the execution daemon.

### Key Components

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Dashboard     │◄────►│   API Server    │◄────►│    Daemon       │
│  (Frontend)     │      │   (Express)     │      │   (Python)      │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                │
                                ▼
                         ┌─────────────────┐
                         │   SQLite DB     │
                         │  (better-sqlite3)│
                         └─────────────────┘
```

### Responsibilities

- **API Server**: REST endpoints, authentication, business logic
- **Dashboard**: Frontend UI for management
- **Daemon**: Background execution engine
- **Database**: Data persistence and relationships

---

## Technology Stack

### Core Framework
- **Express.js** - Web framework
- **TypeScript** - Type safety (transpiled to JavaScript)
- **Node.js** - Runtime environment

### Database
- **SQLite** - Embedded database
- **better-sqlite3** - Synchronous SQLite driver

### Authentication
- **Bearer Token** - Simple token-based authentication

### Real-time Features
- **Server-Sent Events (SSE)** - Real-time streaming

### HTTP Client
- **Fetch API** - External HTTP requests (GitHub API, marketplace)

---

## Project Structure

```
api/
├── src/
│   ├── index.ts              # Main application entry point
│   ├── db/
│   │   └── index.ts          # Database initialization and schema
│   ├── middleware/
│   │   └── auth.ts           # Authentication middleware
│   ├── routes/
│   │   ├── plans.ts          # Plans endpoints
│   │   ├── workspaces.ts     # Workspaces endpoints
│   │   ├── projects.ts       # Projects endpoints
│   │   ├── approvals.ts      # Approvals endpoints
│   │   ├── kanban.ts         # Kanban endpoints
│   │   ├── daemon.ts         # Daemon control endpoints
│   │   ├── chatSessions.ts   # Chat sessions endpoints
│   │   ├── nativeSkills.ts   # Native skills endpoints
│   │   ├── marketplace.ts    # Marketplace endpoints
│   │   └── quickActions.ts   # Quick actions endpoints
│   └── utils/
│       ├── paths.ts          # Path utilities
│       ├── agentSettings.ts  # Agent settings utilities
│       └── claudeMdTemplates.ts # CLAUDE.md templates
├── data/
│   └── database.db           # SQLite database file
├── docs/
│   ├── README.md             # API overview
│   ├── ENDPOINTS.md          # Endpoint documentation
│   ├── ARCHITECTURE.md       # This file
│   ├── IMPLEMENTATION.md     # Implementation details
│   └── TESTING.md            # Testing guide
└── package.json
```

---

## Database Schema

### Schema Initialization

The database is automatically initialized on API startup via `initDatabase()` in `src/db/index.ts`.

### Migration Strategy

The API uses a gradual migration approach with try-catch blocks for ALTER TABLE statements, allowing backward compatibility.

---

## Database Tables

### 1. plans

Stores execution plans and workflows.

```sql
CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tasks TEXT NOT NULL,              -- JSON string of task array
  status TEXT NOT NULL DEFAULT 'pending',
  client_id TEXT,
  result TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  project_id TEXT,
  type TEXT DEFAULT 'workflow',     -- 'workflow' or 'quick_action'
  structured_output TEXT,           -- JSON string for structured output
  result_status TEXT CHECK(result_status IN ('success','partial','needs_rework')),
  result_notes TEXT DEFAULT ''
)
```

**Status Values:**
- `pending` - Awaiting execution
- `awaiting_approval` - Awaiting user approval
- `running` - Currently executing
- `success` - Completed successfully
- `failed` - Failed

**Indexes:**
- `created_at DESC` - Default ordering
- `project_id` - For filtering

### 2. plan_logs

Stores log entries for plan execution.

```sql
CREATE TABLE plan_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  task_id TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',  -- 'info', 'warn', 'error', 'debug'
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

**Indexes:**
- `(plan_id, created_at ASC)` - For log streaming

### 3. projects

Stores project definitions.

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  settings TEXT DEFAULT '{}',        -- JSON string
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

**Settings Structure:**
```json
{
  "key": "value"
}
```

### 4. environments

Stores project environments.

```sql
CREATE TABLE environments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'local-wsl',
  project_path TEXT NOT NULL,
  agent_workspace TEXT NOT NULL,
  ssh_config TEXT,                   -- JSON string
  env_vars TEXT,                     -- JSON string
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

**Environment Types:**
- `local-wsl` - Local WSL environment
- `ssh` - Remote SSH environment

### 5. project_agents

Links projects to agent workspaces.

```sql
CREATE TABLE project_agents (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workspace_path TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (project_id, workspace_path)
)
```

### 6. agent_environments

Links workspaces to environments.

```sql
CREATE TABLE agent_environments (
  workspace_path TEXT NOT NULL,
  environment_id TEXT NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (workspace_path, environment_id)
)
```

### 7. workspace_roles

Stores workspace role assignments.

```sql
CREATE TABLE workspace_roles (
  workspace_path TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'coder' CHECK(role IN ('planner','coder','reviewer','tester','debugger','devops','generic'))
)
```

**Role Values:**
- `planner` - Planning agent
- `coder` - Coding agent
- `reviewer` - Review agent
- `tester` - Testing agent
- `debugger` - Debugging agent
- `devops` - DevOps agent
- `generic` - Generic agent

### 8. workspace_models

Stores workspace model assignments.

```sql
CREATE TABLE workspace_models (
  workspace_path TEXT PRIMARY KEY,
  model TEXT DEFAULT ''
)
```

**Model Values:**
- `default` - Uses the default Claude model
- `claude-opus-4-6` - Claude Opus 4.6
- `claude-sonnet-4-6` - Claude Sonnet 4.6
- `claude-haiku-4-5-20251001` - Claude Haiku 4.5

### 9. approvals

Stores tool approval requests.

```sql
CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  input TEXT NOT NULL,               -- JSON string
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  responded_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

**Status Values:**
- `pending` - Awaiting response
- `approved` - Approved by user
- `denied` - Denied by user
- `timeout` - Timed out

### 10. kanban_tasks

Stores kanban board tasks.

```sql
CREATE TABLE kanban_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  column TEXT NOT NULL DEFAULT 'backlog' CHECK(column IN ('backlog','planning','in_progress','done')),
  priority INTEGER NOT NULL DEFAULT 3 CHECK(priority BETWEEN 1 AND 5),
  order_index INTEGER NOT NULL DEFAULT 0,
  workflow_id TEXT REFERENCES plans(id) ON DELETE SET NULL,
  result_status TEXT CHECK(result_status IN ('success','partial','needs_rework')),
  result_notes TEXT DEFAULT '',
  pipeline_status TEXT DEFAULT 'idle' CHECK(pipeline_status IN ('idle','planning','awaiting_approval','running','done','failed')),
  planning_started_at TEXT,
  error_message TEXT DEFAULT '',
  is_template INTEGER DEFAULT 0,
  recurrence TEXT DEFAULT '',
  next_run_at TEXT,
  last_run_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)
```

**Column Values:**
- `backlog` - Backlog column
- `planning` - Planning column
- `in_progress` - In progress column
- `done` - Done column

**Priority Values:**
- `1` - Critical
- `2` - High
- `3` - Medium
- `4` - Low
- `5` - Lowest

**Pipeline Status Values:**
- `idle` - Not in pipeline
- `planning` - Creating workflow
- `awaiting_approval` - Awaiting approval
- `running` - Executing
- `done` - Completed
- `failed` - Failed

**Note:** The `is_template`, `recurrence`, `next_run_at`, and `last_run_at` columns are kept for backwards compatibility but should use the new `kanban_templates` table system for template functionality.

### 11. kanban_templates

Stores kanban board templates for reusable task layouts.

```sql
CREATE TABLE kanban_templates (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  priority INTEGER NOT NULL DEFAULT 3 CHECK(priority BETWEEN 1 AND 5),
  recurrence TEXT DEFAULT '',
  next_run_at TEXT,
  last_run_at TEXT,
  is_public INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)
```

**Priority Values:**
- `1` - Critical
- `2` - High
- `3` - Medium
- `4` - Low
- `5` - Lowest

**Visibility:**
- `is_public = 1` - Template can be used across projects
- `is_public = 0` - Template is project-specific

### 12. kanban_template_columns

Stores column definitions for kanban templates.

```sql
CREATE TABLE kanban_template_columns (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES kanban_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
)
```

**Indexes:**
- `(template_id, order_index ASC)` - For ordered retrieval

### 13. kanban_template_tasks

Stores task definitions within kanban template columns.

```sql
CREATE TABLE kanban_template_tasks (
  id TEXT PRIMARY KEY,
  template_column_id TEXT NOT NULL REFERENCES kanban_template_columns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  priority INTEGER NOT NULL DEFAULT 3 CHECK(priority BETWEEN 1 AND 5),
  order_index INTEGER NOT NULL DEFAULT 0,
  tags TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
)
```

**Indexes:**
- `(template_column_id, order_index ASC)` - For ordered retrieval

**Relationships:**
- `kanban_template_tasks.template_column_id → kanban_template_columns.id`
- `kanban_template_columns.template_id → kanban_templates.id`
- `kanban_templates.project_id → projects.id`

### 14. chat_sessions

Stores chat sessions.

```sql
CREATE TABLE chat_sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  project_id TEXT,
  workspace_path TEXT NOT NULL,
  environment_id TEXT,
  sdk_session_id TEXT,
  status TEXT DEFAULT 'idle',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)
```

**Status Values:**
- `idle` - Not active
- `running` - Currently executing

### 15. chat_messages

Stores chat messages.

```sql
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                -- 'user' or 'assistant'
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
)
```

---

## Data Models

### Plan Model

```typescript
interface Plan {
  id: string
  name: string
  tasks: Task[]
  status: 'pending' | 'awaiting_approval' | 'running' | 'success' | 'failed'
  client_id: string | null
  result: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  project_id: string | null
  type: 'workflow' | 'quick_action'
  structured_output: any
  result_status: 'success' | 'partial' | 'needs_rework' | null
  result_notes: string
  log_count?: number
}

interface Task {
  id: string
  name: string
  prompt: string
  cwd: string
  workspace: string
  tools: string[]
  permission_mode: string
  depends_on: string[]
}
```

### Workspace Model

```typescript
interface Workspace {
  id: string                        // base64url encoded path
  name: string
  path: string
  exists: boolean
  hasSettings: boolean
  hasClaude: boolean
  baseUrl: string | null
  type: 'agent' | 'env-agent' | 'legacy'
  project_id: string | null
  role: string
  model: string
  skills: Skill[]
  agents: Agent[]
  environments: Environment[]
  claudeMd: string | null
  settings: any
}

interface Skill {
  name: string
  hasSkillMd: boolean
}

interface Agent {
  name: string
  file: string
}
```

### Project Model

```typescript
interface Project {
  id: string
  name: string
  description: string | null
  settings: Record<string, any>
  environments: Environment[]
  agent_paths: string[]
  created_at: string
}

interface Environment {
  id: string
  project_id: string
  name: string
  type: string
  project_path: string
  agent_workspace: string
  ssh_config: any
  env_vars: any
  created_at: string
}
```

### Kanban Task Model

```typescript
interface KanbanTask {
  id: string
  project_id: string
  title: string
  description: string
  column: 'backlog' | 'planning' | 'in_progress' | 'done'
  priority: number                    // 1-5
  order_index: number
  workflow_id: string | null
  result_status: 'success' | 'partial' | 'needs_rework' | null
  result_notes: string
  pipeline_status: 'idle' | 'planning' | 'awaiting_approval' | 'running' | 'done' | 'failed'
  planning_started_at: string | null
  error_message: string
  is_template: boolean
  recurrence: string                  // cron expression
  next_run_at: string | null
  last_run_at: string | null
  created_at: string
  updated_at: string
}
```

### Approval Model

```typescript
interface Approval {
  id: string
  plan_id: string
  task_id: string
  tool: string
  input: any
  reason: string | null
  status: 'pending' | 'approved' | 'denied' | 'timeout'
  responded_at: string | null
  created_at: string
}
```

### Chat Session Model

```typescript
interface ChatSession {
  id: string
  name: string
  project_id: string | null
  workspace_path: string
  environment_id: string | null
  sdk_session_id: string | null
  status: 'idle' | 'running'
  created_at: string
  updated_at: string
  messages?: ChatMessage[]
}

interface ChatMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}
```

---

## Authentication Architecture

### Token-Based Authentication

The API uses simple Bearer token authentication:

```typescript
const VALID_TOKEN = process.env.WEAVE_TOKEN || 'dev-token-change-in-production'
```

### Authentication Methods

1. **Authorization Header** (preferred)
   ```
   Authorization: Bearer <token>
   ```

2. **Query Parameter** (for SSE)
   ```
   ?token=<token>
   ```

### Middleware

Authentication is handled by `authenticateToken` middleware in `src/middleware/auth.ts`:

```typescript
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization']
  const headerToken = authHeader && authHeader.split(' ')[1]
  const queryToken = req.query.token as string
  const token = headerToken || queryToken

  if (!token) {
    return res.status(401).json({ error: 'Access token required' })
  }

  if (token !== VALID_TOKEN) {
    return res.status(403).json({ error: 'Invalid or expired token' })
  }

  next()
}
```

### Route Protection

Protected routes apply the middleware:

```typescript
router.get('/', authenticateToken, (req, res) => {
  // Handler
})
```

Public routes (like health check) don't apply middleware:

```typescript
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})
```

---

## Middleware

### Built-in Middleware

1. **CORS** - Cross-Origin Resource Sharing
   ```typescript
   app.use(cors({
     origin: (origin, callback) => {
       // Allow requests without origin (curl, Postman, daemon)
       if (!origin) return callback(null, true)
       // Allow any localhost regardless of port
       if (origin.match(/^http:\/\/localhost:\d+$/)) {
         return callback(null, true)
       }
       // In production, add allowed domains via env var
       const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '').split(',')
       if (allowedOrigins.includes(origin)) {
         return callback(null, true)
       }
       callback(new Error(`CORS: origin ${origin} not allowed`))
     },
     credentials: true,
   }))
   ```

2. **JSON Parser** - Parse request bodies
   ```typescript
   app.use(express.json())
   ```

3. **Error Handler** - Global error handling
   ```typescript
   app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
     console.error(err.stack)
     res.status(500).json({ error: 'Something went wrong!' })
   })
   ```

### Custom Middleware

1. **Authentication** - Token validation
2. **Route-specific** - Custom logic per route

---

## Request/Response Flow

### Standard Request Flow

```
1. Request → CORS Middleware
2. Request → JSON Parser
3. Request → Route Handler
4. Route → authenticateToken (if protected)
5. Route → Business Logic
6. Response → JSON Formatter
7. Response → Client
```

### Example Flow

```typescript
// 1. Client sends request
GET /api/plans?project_id=uuid
Headers: Authorization: Bearer token

// 2. CORS middleware checks origin
// 3. JSON parser parses body (if any)
// 4. Route handler matches /api/plans
// 5. authenticateToken validates token
// 6. Business logic executes query
const plans = db.prepare('SELECT * FROM plans WHERE project_id = ?').all(project_id)
// 7. Response formatted and sent
res.json({ data: plans, error: null })
```

---

## Real-time Features

### Server-Sent Events (SSE)

The API supports real-time updates via SSE for:

1. **Plan Logs Streaming** - `GET /api/plans/:id/logs/stream`
2. **Chat Session Streaming** - `GET /api/sessions/:id/stream`

### SSE Implementation

```typescript
router.get('/:id/logs/stream', authenticateToken, (req: Request, res: Response) => {
  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  // Send initial data
  const existing = db.prepare('SELECT * FROM plan_logs WHERE plan_id = ?').all(id)
  for (const log of existing) {
    res.write(`data: ${JSON.stringify(log)}\n\n`)
  }

  // Poll for new data
  const interval = setInterval(() => {
    const newLogs = db.prepare('SELECT * FROM plan_logs WHERE plan_id = ? AND id > ?').all(id, lastId)
    for (const log of newLogs) {
      res.write(`data: ${JSON.stringify(log)}\n\n`)
    }

    // Send status update
    res.write(`event: status\ndata: ${JSON.stringify({ status })}\n\n`)

    // Close if terminal
    if (status === 'success' || status === 'failed') {
      res.write(`event: done\ndata: ${JSON.stringify({ status })}\n\n`)
      clearInterval(interval)
      res.end()
    }
  }, 500)

  // Cleanup on disconnect
  req.on('close', () => clearInterval(interval))
})
```

### SSE Event Types

- `data` - Regular data message
- `event: status` - Status update
- `event: done` - Stream completion
- `event: error` - Error occurrence

---

## Error Handling

### Global Error Handler

```typescript
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Something went wrong!' })
})
```

### Route-Level Error Handling

```typescript
router.get('/:id', authenticateToken, (req: Request, res: Response) => {
  try {
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id)
    if (!plan) {
      return res.status(404).json({ data: null, error: 'Plan not found' })
    }
    res.json({ data: plan, error: null })
  } catch (error) {
    console.error('Error fetching plan:', error)
    res.status(500).json({ data: null, error: 'Failed to fetch plan' })
  }
})
```

### Standard Error Response Format

```json
{
  "data": null,
  "error": "Error message"
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `204` - No Content
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Internal Server Error

---

## CORS Configuration

### CORS Origins

The API accepts requests from:

1. **No Origin** - curl, Postman, daemon
2. **Localhost** - Any port on localhost
3. **Configured Origins** - From `ALLOWED_ORIGINS` env var

### CORS Configuration

```typescript
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests without origin
    if (!origin) return callback(null, true)

    // Allow any localhost
    if (origin.match(/^http:\/\/localhost:\d+$/)) {
      return callback(null, true)
    }

    // Check allowed origins
    const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '').split(',')
    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }

    callback(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}))
```

### Credentials

The API supports credentials (cookies, authorization headers) via:

```typescript
credentials: true
```

---

## Background Jobs

### Approval Timeout Check

Runs every minute to timeout pending approvals:

```typescript
setInterval(() => {
  const timeoutMinutes = Number(process.env.APPROVAL_TIMEOUT_MINUTES ?? 10)
  const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString()
  const result = db.prepare(`
    UPDATE approvals SET status = 'timeout', responded_at = datetime('now')
    WHERE status = 'pending' AND created_at < ?
  `).run(cutoff)
  if (result.changes > 0) {
    console.log(`[approvals] Timed out ${result.changes} pending approval(s)`)
  }
}, 60_000)
```

### Stuck Plans Recovery

Runs on startup and periodically to recover stuck plans:

```typescript
export function recoverStuckPlans(db: any) {
  const timeoutMinutes = Number(process.env.PLAN_TIMEOUT_MINUTES ?? 10)
  const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString()
  const result = db.prepare(`
    UPDATE plans
    SET status = 'failed',
        result = 'Plan timed out - daemon may have crashed',
        completed_at = datetime('now')
    WHERE status = 'running'
    AND started_at < ?
  `).run(cutoff)

  if (result.changes > 0) {
    console.log(`[recovery] Marked ${result.changes} stuck plan(s) as failed`)
  }
}
```

---

## Plan Timeout and Recovery

### Timeout Mechanism

1. **Daemon Heartbeat**: Every 30 seconds during execution, the daemon sends a heartbeat via `POST /api/plans/:id/heartbeat`
2. **API Recovery**: Every 10 minutes (configurable), the API runs `recoverStuckPlans()` to mark stuck plans as failed
3. **Timeout Calculation**: A plan is considered stuck if:
   - Status is 'running'
   - Either `last_heartbeat_at` (if set) or `started_at` (if no heartbeat) is older than `PLAN_TIMEOUT_MINUTES`

### Completion After Timeout

If a plan completes after being marked as failed:
1. Daemon attempts to complete via `/api/plans/:id/complete`
2. API allows transition from 'failed' → 'success' if the daemon is completing it
3. Logs the transition for monitoring

This race condition handling ensures successful completion is preserved even if timeout recovery triggered.

### Configuration

- `PLAN_TIMEOUT_MINUTES` (API): Timeout in minutes (default: 120)
- `PLAN_TIMEOUT_SECONDS` (Client): Timeout in seconds (default: 7200)
- These must be synchronized to avoid premature timeouts

### Monitoring

- `GET /api/plans/approaching-timeout`: Returns plans nearing timeout (80% threshold)
- Dashboard displays warnings for long-running plans
- Logs track timeout recovery events

---

## Environment Variables

### API Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | API server port |
| `API_BEARER_TOKEN` | `dev-token-change-in-production` | Authentication token |
| `WEAVE_TOKEN` | `dev-token-change-in-production` | Manager token for daemon |
| `ALLOWED_ORIGINS` | `""` | Comma-separated list of allowed CORS origins |
| `APPROVAL_TIMEOUT_MINUTES` | `10` | Approval timeout in minutes |
| `PLAN_TIMEOUT_MINUTES` | `120` | Plan execution timeout in minutes. Plans running longer than this without a heartbeat will be marked as failed. Should match `PLAN_TIMEOUT_SECONDS` on the client daemon. |

### Path Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENTS_BASE_PATH` | `~/.local/share/weave/projects` | Base path for agent workspaces |
| `DATA_DIR` | — | Custom data directory (takes priority over AGENTS_BASE_PATH) |

---

## Database Relationships

### Entity Relationship Diagram

```
projects (1) ─────< (N) environments
    │
    │
    └────── project_agents (N) ─────> workspaces (paths)
                │
                └────── agent_environments (N) ─────> environments

workspaces (paths) ─────> workspace_roles
                        └────> workspace_models

projects (1) ─────< (N) kanban_tasks
    │
    └────── (optional) workflow_id ─────> plans

plans (1) ─────< (N) plan_logs
    │
    └────── (optional) approvals (N)

projects (1) ─────< (N) chat_sessions
    │
    └────── chat_sessions (1) ─────< (N) chat_messages
```

### Key Relationships

1. **Projects → Environments** (One-to-Many)
2. **Projects → Workspaces** (Many-to-Many via project_agents)
3. **Workspaces → Environments** (Many-to-Many via agent_environments)
4. **Plans → Kanban Tasks** (One-to-One, optional)
5. **Plans → Plan Logs** (One-to-Many)
6. **Plans → Approvals** (One-to-Many)
7. **Chat Sessions → Chat Messages** (One-to-Many)

---

For implementation details, see [IMPLEMENTATION.md](./IMPLEMENTATION.md).
For endpoint documentation, see [ENDPOINTS.md](./ENDPOINTS.md).
For testing information, see [TESTING.md](./TESTING.md).
