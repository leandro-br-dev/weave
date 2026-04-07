# User Guide

Welcome to weave! This comprehensive guide will help you get started with creating projects, agents, plans and workflows.

**Related Documentation:**
- **[README](README.md)** — Project overview and quick start
- **[Features](FEATURES.md)** — Complete feature documentation
- **[Architecture](ARCHITECTURE.md)** — System architecture and design decisions
- **[Technical](TECHNICAL.md)** — Implementation details and testing reports

## Getting Started

### Starting the platform

```bash
bash start.sh
```

This starts the API (port 3000), dashboard (port 5173), and agent daemon. Open http://localhost:5173.

> **Requirement**: Claude Code CLI must be installed and authenticated. Run `claude login` before starting if you haven't already.

### Creating a Project

1. Go to **Projects** in the sidebar
2. Click **New Project** and enter name and description
3. Inside the project, click **Add Environment**
4. Fill in:
   - **Name**: e.g. `Development`
   - **Type**: `local-wsl`, `local-windows`, or `ssh`
   - **Project Path**: where your project files are (e.g. `/root/projects/my-app`)
5. The team workspace is created automatically with CLAUDE.md and settings.local.json

### Managing Agents

1. Go to **Agents** in the sidebar
2. Each agent corresponds to a workspace folder with Claude configuration
3. Click an agent to edit:
   - **CLAUDE.md** — agent identity, instructions and context
   - **Settings** — environment variables and permission rules
   - **Skills** — on-demand skill files (SKILL.md)
   - **Sub-agents** — specialized agents this agent can delegate to

### Creating a Plan

#### Via UI
1. Go to **Plans** and click **New Plan**
2. Enter a plan name
3. Add tasks:
   - **Prompt**: what the agent should do
   - **Agent Workspace**: who executes (select from registered agents)
   - **Environment**: where to execute (select from registered environments)
   - **Depends on**: task IDs this task waits for before starting
4. Click **Create Plan**

#### Via JSON Import
1. Click **Import JSON** on the Plans page
2. Upload a `.json` file with this structure:
```json
{
  "name": "Plan name",
  "tasks": [
    {
      "id": "t1",
      "name": "Task name",
      "prompt": "What the agent should do",
      "cwd": "/root/projects/my-project",
      "workspace": "/root/projects/weave/projects/my-project/dev/team-coder",
      "tools": ["Read", "Write", "Edit", "Bash", "Glob"],
      "permission_mode": "acceptEdits",
      "depends_on": []
    }
  ]
}
```

### Monitoring Execution

- **Plan detail page**: shows live logs streamed via SSE while running
- **Force Stop**: red button appears on running plans — use when daemon has crashed
- **Retry**: re-queues a failed or completed plan
- **Export**: downloads the plan as a JSON template

### Approval Queue

When an agent requests human approval for a sensitive operation:
1. A badge appears on the **Approvals** sidebar link
2. Open **Approvals** to see the pending request
3. Review the operation and click **Approve** or **Deny**
4. The agent continues (or stops) based on your decision

Approvals auto-timeout after 10 minutes (configurable via `APPROVAL_TIMEOUT_MINUTES` in `api/.env`).

### Workflows & Metrics

The **Workflows** page shows:
- Total plans, success rate, average duration
- Last 7 days activity
- Full execution history table with links to each plan

---

## Architecture Overview

### System Components

weave is a three-component system:

```
┌─────────────────────────────────────────────┐
│              dashboard (React)               │
│  Plans · Workflows · Projects · Agents       │
│  Approvals · Settings                        │
└──────────────────┬──────────────────────────┘
                   │ HTTP + SSE
┌──────────────────▼──────────────────────────┐
│                api (Express)                 │
│  SQLite · REST endpoints · SSE streaming     │
└──────────────────┬──────────────────────────┘
                   │ HTTP polling (5s)
┌──────────────────▼──────────────────────────┐
│               client (Python)                │
│  Daemon · Orchestrator · Claude SDK runner   │
└──────────────────┬──────────────────────────┘
                   │ subprocess
┌──────────────────▼──────────────────────────┐
│           Claude Code CLI                    │
│  Executes agent tasks in project workspaces  │
└─────────────────────────────────────────────┘
```

### API Backend (Express.js)

| Route | Description |
|-------|-------------|
| `GET/POST /api/plans` | Plan management |
| `GET /api/plans/:id/logs/stream` | SSE log streaming |
| `GET /api/plans/metrics` | Execution statistics |
| `GET/POST /api/approvals` | Approval queue |
| `POST /api/approvals/:id/respond` | Approve or deny |
| `GET/POST /api/projects` | Projects and environments |
| `GET/POST /api/workspaces` | Agent workspace management |
| `GET/POST /api/daemon` | Daemon process control |

### Dashboard (React)

| Page | Purpose |
|------|---------|
| `/` | Plans list with status, import/export JSON |
| `/plans/:id` | Plan detail with live SSE logs |
| `/workflows` | Execution history and metrics |
| `/approvals` | Pending approval queue |
| `/projects` | Projects and environments |
| `/agents` | Agent workspaces (CLAUDE.md, settings, skills) |
| `/settings` | API status and daemon control |

### Python Client Daemon

| File | Purpose |
|------|---------|
| `main.py` | CLI entry point (`--daemon` mode) |
| `orchestrator/plan.py` | Task/Plan dataclasses, dependency wave resolver |
| `orchestrator/runner.py` | Executes tasks via Claude SDK, captures logs |
| `orchestrator/daemon_client.py` | HTTP client for weave API |
| `orchestrator/logger.py` | Colored terminal output |

### Project Workspace Structure

```
projects/
└── <project-slug>/
    └── <env-slug>/
        └── team-coder/
            ├── CLAUDE.md                 ← team identity
            └── .claude/
                ├── settings.local.json   ← env vars + permissions
                ├── skills/<n>/SKILL.md
                └── agents/<n>.md
```

### Plan Execution Flow

```
1. User creates plan (UI or JSON import)
2. Plan status → pending
3. Daemon polls GET /api/plans/pending every 5s
4. Daemon claims plan → status running
5. Tasks resolved into dependency waves
6. Wave tasks execute in parallel via Claude SDK
7. Logs streamed to API → SSE → dashboard
8. If task requires approval → paused until user responds
9. Plan completes → status success or failed
```

### Key Concepts

| Concept | Definition |
|---------|------------|
| **Project** | Logical grouping (e.g., MyApp, API-Backend) |
| **Environment** | Execution instance: dev/staging/prod, local/ssh |
| **Agent** | CLAUDE.md + .claude/ config folder (who executes) |
| **Working directory (cwd)** | Where project files are (what gets modified) |
| **Plan** | Named collection of tasks with dependencies |
| **Wave** | Group of tasks with no mutual dependencies (run in parallel) |

---

## Development Setup

### Project Structure

```
weave/
├── api/                    # Express.js backend
│   ├── src/
│   │   ├── index.ts        # App entry point, DB init, middleware
│   │   ├── db/             # Database setup and migrations
│   │   ├── middleware/     # Auth middleware
│   │   └── routes/         # API route handlers
│   ├── data/               # SQLite database (gitignored)
│   └── package.json
├── dashboard/              # React frontend
│   ├── src/
│   │   ├── api/            # React Query hooks per domain
│   │   ├── pages/          # Page components
│   │   ├── components/     # Shared components
│   │   └── router.tsx      # Route definitions
│   └── package.json
├── client/                 # Python daemon
│   ├── orchestrator/       # Core execution logic
│   ├── tests/              # pytest test suite
│   ├── main.py             # CLI entry point
│   └── requirements.txt
├── projects/               # Agent workspaces (gitignored)
├── docs/                   # Documentation
├── start.sh                # Unified start script
└── package.json            # Root scripts
```

### Manual Start

```bash
# API
cd api && npm run dev

# Dashboard
cd dashboard && npm run dev

# Daemon
cd client && source venv/bin/activate
export WEAVE_URL=http://localhost:3000
export WEAVE_TOKEN=dev-token-change-in-production
python main.py --daemon
```

### Environment Variables

#### api/.env
```
WEAVE_TOKEN=dev-token-change-in-production
TEAMS_BASE_PATH=/root/projects/weave/projects
APPROVAL_TIMEOUT_MINUTES=10
PLAN_TIMEOUT_MINUTES=120  # 2 hours (must match client's PLAN_TIMEOUT_SECONDS/60)
PORT=3000
ALLOWED_ORIGINS=         # comma-separated, leave empty for localhost only
```

#### dashboard/.env
```
VITE_API_BASE_URL=http://localhost:3000
VITE_API_TOKEN=dev-token-change-in-production
```

### Running Tests

```bash
# Python client tests
cd client && source venv/bin/activate
python -m pytest tests/ -v

# TypeScript build check
cd api && npm run build
cd dashboard && npm run build
```

### Database

SQLite at `api/data/database.db`. Tables:

| Table | Description |
|-------|-------------|
| `plans` | Plans with tasks (JSON), status, client_id |
| `plan_logs` | Log entries per plan/task |
| `approvals` | Pending/resolved approval requests |
| `projects` | Project definitions |
| `environments` | Environments per project |

Schema is auto-created on first API start via `db.exec()` in `src/db/index.ts`.

### Adding a New API Route

1. Create `api/src/routes/myroute.ts`
2. Register in `api/src/index.ts`: `app.use('/api/myroute', myrouteRouter)`
3. Add React Query hook in `dashboard/src/api/myroute.ts`
4. Use in a page component

### Agent Workspace Structure

Created automatically when an environment is added to a project:

```
projects/<project-slug>/<env-slug>/team-coder/
├── CLAUDE.md                     # Team instructions (edit via /agents)
└── .claude/
    ├── settings.local.json       # Permissions + env vars
    ├── skills/
    │   └── <skill-name>/
    │       └── SKILL.md
    └── agents/
        └── <agent-name>.md
```

Key settings.local.json fields:
```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:8083"
  },
  "permissions": {
    "allow": ["Read", "Edit", "Write", "Bash", "Glob"],
    "deny": [],
    "additionalDirectories": ["/root/projects/my-project"]
  }
}
```

---

## UI Patterns & Components

This section defines the visual language and component patterns for the weave dashboard. All new UI must follow these patterns to maintain consistency.

### Design Direction

**Industrial / Utilitarian** — precise, information-dense, no decoration for its own sake.

- Background: `#FAFAFA` (near-white)
- Surfaces: `#FFFFFF` with `border-gray-200` borders
- Primary action: `gray-900` (near-black)
- Text hierarchy: `gray-900` / `gray-600` / `gray-400`
- Font: `IBM Plex Sans` (UI) + `IBM Plex Mono` (paths, IDs, code)
- Transitions: `150ms ease` for all interactive states

### PageHeader

Use at the top of every page. Never use raw `<h1>` tags in pages.

```tsx
import { PageHeader } from '@/components'

<PageHeader
  title="Workflows"
  description="Monitor your agent workflows"
  actions={<Button variant="primary">New</Button>}
/>
```

### StatusBadge

Use for all status displays — plans, approvals, environments.

```tsx
import { StatusBadge } from '@/components'

<StatusBadge status="running" animate />  // animate adds pulse on running
<StatusBadge status="success" />
<StatusBadge status="failed" />
```

Supported statuses: `pending` `running` `success` `failed` `timeout` `approved` `denied`

### Button

Never use raw `<button>` with Tailwind classes. Always use the Button component.

```tsx
import { Button } from '@/components'

<Button variant="primary">Create</Button>        // dark bg, white text
<Button variant="secondary">Cancel</Button>      // white bg, gray border
<Button variant="danger">Delete</Button>         // white bg, red border+text
<Button variant="ghost">Edit</Button>            // transparent, gray text

<Button variant="primary" size="sm">Small</Button>
<Button loading={isPending}>Saving...</Button>
<Button disabled>Unavailable</Button>
```

### Card

Use for all content containers.

```tsx
import { Card, CardHeader } from '@/components'

<Card>
  <CardHeader title="Section title" actions={<Button size="sm">Add</Button>} />
  {/* content */}
</Card>

<Card padding="none">  {/* for tables */}
  <table>...</table>
</Card>
```

### ConfirmDialog

Never use `window.confirm()`. Always use ConfirmDialog for destructive actions.

```tsx
import { ConfirmDialog } from '@/components'

const [confirmOpen, setConfirmOpen] = useState(false)

<Button variant="danger" onClick={() => setConfirmOpen(true)}>Delete</Button>

<ConfirmDialog
  open={confirmOpen}
  title="Delete plan?"
  description="This action cannot be undone."
  confirmLabel="Delete"
  variant="danger"
  onConfirm={() => { deletePlan.mutate(id); setConfirmOpen(false) }}
  onCancel={() => setConfirmOpen(false)}
  loading={deletePlan.isPending}
/>
```

### Input & Select

Always use the Input and Select components for form fields.

```tsx
import { Input, Select } from '@/components'

<Input
  label="Plan name"
  value={name}
  onChange={e => setName(e.target.value)}
  placeholder="My workflow"
  hint="Give it a descriptive name"
  error={errors.name}
  required
/>

<Select
  label="Project"
  value={projectId}
  onChange={e => setProjectId(e.target.value)}
>
  <option value="">Select project...</option>
  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
</Select>
```

### EmptyState

Use when a list or section has no items.

```tsx
import { EmptyState } from '@/components'
import { Workflow } from 'lucide-react'

<EmptyState
  icon={<Workflow className="h-12 w-12" />}
  title="No workflows yet"
  description="Create your first workflow to get started"
  action={<Button variant="primary" onClick={...}>New Workflow</Button>}
/>
```

### Pagination

Use for any list with more than 15 items.

```tsx
import { Pagination } from '@/components'

const PAGE_SIZE = 15
const [page, setPage] = useState(1)
const totalPages = Math.ceil(items.length / PAGE_SIZE)
const paginated = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

// At the bottom of your table:
<Pagination
  page={page}
  totalPages={totalPages}
  total={items.length}
  pageSize={PAGE_SIZE}
  onPageChange={setPage}
/>
```

### MetricCard

Use in groups of 4 at the top of dashboard-style pages.

```tsx
import { MetricCard } from '@/components'

<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
  <MetricCard label="Total" value={17} />
  <MetricCard label="Success rate" value="23.5%" color="red" />
  <MetricCard label="Avg duration" value="33m" />
  <MetricCard label="Last 7 days" value="4✓ 13✗" />
</div>
```

### Page Layout

Every page must follow this structure:

```tsx
export default function MyPage() {
  return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      <PageHeader title="..." description="..." actions={...} />
      {/* content */}
    </div>
  )
}
```

### Sidebar Navigation

Order (fixed):
1. Workflows → `/` (LayoutDashboard icon)
2. Projects → `/projects` (FolderOpen icon)
3. Agents → `/agents` (Bot icon)
4. Approvals → `/approvals` (Bell icon) + red count badge when pending
5. Settings → `/settings` (Settings icon)

### Icons

Use only `lucide-react` icons. Common mapping:

| Context | Icon |
|---------|------|
| Create/Add | `Plus` |
| Import | `Upload` |
| Export/Download | `Download` |
| Delete | `Trash2` |
| Edit/Rename | `Pencil` |
| Link | `Link2` |
| Unlink | `Unlink` |
| Agent/Bot | `Bot` |
| Project | `FolderOpen` |
| Environment | `Server` |
| Workflows | `LayoutDashboard` |
| Approvals | `Bell` |
| Settings | `Settings` |
| Running | `Circle` (animated) |
| Stop | `StopCircle` |
| Refresh | `RefreshCw` |

### Typography Rules

- **Page titles**: `text-2xl font-semibold text-gray-900 tracking-tight` (via PageHeader)
- **Section headers**: `text-sm font-semibold text-gray-900`
- **Labels**: `text-xs font-medium text-gray-700`
- **Body**: `text-sm text-gray-600`
- **Meta / timestamps**: `text-xs text-gray-400`
- **Paths / IDs**: `text-xs font-mono text-gray-500`
- **Code blocks**: `bg-gray-900 text-gray-100 rounded p-3 text-xs font-mono`

### Do / Don't

✅ Do:
- Use component library for all UI elements
- Keep page layout consistent: `max-w-6xl mx-auto py-8 px-6`
- Use `text-xs font-mono` for filesystem paths and IDs
- Use `ConfirmDialog` for all destructive actions
- Show loading states with `Button loading={...}`

❌ Don't:
- Use `window.confirm()` or `window.alert()`
- Write inline Tailwind button styles (use Button component)
- Use different spacing patterns per page
- Use fonts other than IBM Plex Sans / IBM Plex Mono
- Add decorative elements (shadows, gradients, rounded-full buttons)

---

## Additional Documentation

For more detailed technical information about specific features, see:
- [AUTO_MOVE_COMPLETE.md](AUTO_MOVE_COMPLETE.md) — Comprehensive technical documentation for advanced features
- [AUTO_MOVE_FEATURE.md](AUTO_MOVE_FEATURE.md) — Feature guides and usage examples