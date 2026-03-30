# Architecture Documentation

Complete guide to the weave system architecture, components, execution models, and design decisions.

## Table of Contents

1. [System Overview](#system-overview)
2. [Component Architecture](#component-architecture)
3. [Execution Models](#execution-models)
4. [Parallel Execution](#parallel-execution)
5. [Data Flow](#data-flow)
6. [Design Decisions](#design-decisions)

---

## System Overview

### High-Level Architecture

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

### Component Responsibilities

| Component | Language | Responsibility |
|-----------|----------|----------------|
| **Dashboard** | React/TypeScript | UI for managing plans, projects, agents, and monitoring execution |
| **API** | Express/Node.js | REST API, database, authentication, SSE streaming |
| **Client** | Python | Daemon for executing plans, orchestrating agents, collecting logs |
| **Claude CLI** | Node.js | Claude Code SDK for executing agent tasks |

---

## Component Architecture

### 1. API Backend (Express.js)

#### Routes & Endpoints

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
| `GET /api/projects/:id/agents-context` | Fetch available agents for project |
| `GET /api/projects/:id/planning-context` | Fetch complete project context |
| `POST /api/kanban/:projectId/auto-move` | Auto-move kanban tasks |

#### Database Schema (SQLite)

**Tables:**
- `plans` — Plans with tasks (JSON), status, client_id
- `plan_logs` — Log entries per plan/task
- `approvals` — Pending/resolved approval requests
- `projects` — Project definitions
- `environments` — Environments per project
- `project_agents` — Links projects to agent workspaces
- `workspace_roles` — Defines agent roles (planner, coder, reviewer, etc.)
- `kanban_tasks` — Kanban board tasks

#### Key Features

- **Authentication**: Bearer token authentication
- **SSE Streaming**: Real-time log streaming to dashboard
- **Transaction Safety**: Database operations use transactions
- **Error Handling**: Consistent `{data, error}` response envelope

### 2. Dashboard (React)

#### Page Structure

| Page | Purpose |
|------|---------|
| `/` | Plans list with status, import/export JSON |
| `/plans/:id` | Plan detail with live SSE logs |
| `/workflows` | Execution history and metrics |
| `/approvals` | Pending approval queue |
| `/projects` | Projects and environments |
| `/agents` | Agent workspaces (CLAUDE.md, settings, skills) |
| `/settings` | API status and daemon control |
| `/kanban` | Kanban board with auto-move |

#### State Management

- **React Query** — Server state, caching, and invalidation
- **React Context** — Toast notifications, project filter state
- **Local State** — Component-specific UI state

#### Key Features

- **Real-time Updates**: SSE for live logs
- **Optimistic UI**: Immediate feedback on mutations
- **Responsive Design**: Mobile-friendly interface
- **Type Safety**: Full TypeScript coverage

### 3. Python Client Daemon

#### Core Modules

| File | Purpose |
|------|---------|
| `main.py` | CLI entry point (`--daemon` mode) |
| `orchestrator/plan.py` | Task/Plan dataclasses, dependency wave resolver |
| `orchestrator/runner.py` | Executes tasks via Claude SDK, captures logs |
| `orchestrator/daemon_client.py` | HTTP client for weave API |
| `orchestrator/logger.py` | Colored terminal output |
| `orchestrator/chat_runner.py` | Chat session execution |
| `orchestrator/kanban_pipeline.py` | Kanban workflow automation |

#### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         main.py                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  run_daemon()                                        │   │
│  │  - Polls API every 5 seconds                         │   │
│  │  - Handles SIGINT/SIGTERM                           │   │
│  │  - Converts API plans to internal Plan format       │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  run_plan_with_logging()                             │   │
│  │  - Executes plan using runner.py                     │   │
│  │  - Collects logs after each task                    │   │
│  │  - Streams logs to API                              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
┌──────────────────────┐          ┌──────────────────────┐
│   DaemonClient       │          │     runner.py        │
│ (HTTP API Client)    │          │  (Plan Executor)     │
│                      │          │                      │
│ - get_pending_plans  │          │ - run_task()         │
│ - start_plan         │          │ - run_wave()         │
│ - send_logs          │          │ - run_plan()         │
│ - complete_plan      │          │                      │
└──────────────────────┘          └──────────────────────┘
         │
         ▼
┌──────────────────────┐
│  weave API  │
│  (Node.js/Express)   │
└──────────────────────┘
```

---

## Execution Models

### Plan Execution vs Session Execution

The daemon has two distinct execution models:

#### 1. Plan Execution (Parallel)

**Location**: Lines 167-254 in `run_daemon()` (client/main.py)

**Execution Model**: Parallel (non-blocking)

**Flow**:
```
1. Poll API for pending plans (line 169)
2. For each plan:
   - Check if already running (line 271-272)
   - Mark as running (line 275)
   - Create background task (line 285)
   - Add to tracking set (line 286)
   - Done callback to cleanup (line 287)
```

**Key Characteristics**:
- **Parallel Processing**: Multiple plans run concurrently using `asyncio.create_task()`
- **Non-Blocking**: Creates background tasks and immediately continues to next plan
- **Plan Tracking**: Uses `running_plans` set to prevent duplicate processing
- **Background Task Management**: Uses `background_tasks` set for cleanup
- **Fire-and-Forget**: Tasks run in background; daemon doesn't wait for completion

**Code Snippet**:
```python
# Create task to process plan asynchronously
# Use default argument to capture current plan_data value (closure bug fix)
async def _run_plan(p=plan_data):
    try:
        await _run_plan(p, client, running_plans)
    finally:
        running_plans.discard(p.get('id'))

task = asyncio.create_task(_run_plan())
background_tasks.add(task)
task.add_done_callback(background_tasks.discard)
```

#### 2. Session Execution (Parallel)

**Location**: Lines 255-288 in `run_daemon()` (client/main.py)

**Execution Model**: Parallel (non-blocking)

**Flow**:
```
1. Poll API for pending sessions (line 256)
2. For each session:
   - Check if already running (line 271-272)
   - Mark as running (line 275)
   - Create background task (line 285)
   - Add to tracking set (line 286)
   - Done callback to cleanup (line 287)
```

**Key Characteristics**:
- **Parallel Processing**: Multiple sessions run concurrently using `asyncio.create_task()`
- **Non-Blocking**: Creates background tasks and immediately continues to next session
- **Session Tracking**: Uses `running_sessions` set to prevent duplicate processing
- **Background Task Management**: Uses `background_tasks` set for cleanup
- **Fire-and-Forget**: Tasks run in background; daemon doesn't wait for completion

### Comparison Table

| Aspect | Plan Execution | Session Execution |
|--------|---------------|-------------------|
| **Parallelism** | Parallel (multiple concurrent) | Parallel (multiple concurrent) |
| **Blocking** | No (create_task) | No (create_task) |
| **Tracking** | running_plans set prevents duplicates | running_sessions set prevents duplicates |
| **Cleanup** | background_tasks set with done_callback | background_tasks set with done_callback |
| **Kanban Integration** | Yes (on_plan_completed) | No |
| **Log Streaming** | Yes (via run_plan_with_logging) | No (handled in process_chat_session) |
| **Completion Callback** | Yes (on_plan_completed) | No (fire-and-forget) |
| **Error Handling** | In try/except/finally | In _run_session wrapper |

---

## Parallel Execution

### Overview

The daemon executes multiple plans in parallel instead of sequentially, enabling significant performance improvements.

### Before vs After

#### Before: Sequential Execution
```
Time ──────────────────────────────────────────────>
      │
      ├─ Plan A starts
      │  └─ Task A1
      │  └─ Task A2
      │  └─ Task A3
      ├─ Plan A ends (10s)
      │
      ├─ Plan B starts
      │  └─ Task B1
      │  └─ Task B2
      ├─ Plan B ends (8s)
      │
      └─ Plan C starts (after A and B complete)
         └─ Task C1
         └─ Task C2
         └─ Plan C ends (6s)

Total Time: 24s
```

#### After: Parallel Execution
```
Time ──────────────────────────────────────────────>
      │
      ├─ Plan A starts ────────────────┤
      │  └─ Task A1                     ├─ Plan A ends (10s)
      │  └─ Task A2                     │
      │  └─ Task A3                     │
      │                                 │
      ├─ Plan B starts ───────────┤    │
      │  └─ Task B1                ├─ B ends (8s) │
      │  └─ Task B2                │              │
      │                            │              │
      └─ Plan C starts ────┤      │              │
         └─ Task C1        ├─ C ends (6s)       │
         └─ Task C2        │                    │
                           │                    │
Total Time: 10s (slowest plan)
```

### Performance Impact

| Scenario | Before (Sequential) | After (Parallel) | Speedup |
|----------|--------------------|------------------|---------|
| 1 plan (10s) | 10s | 10s | 1x |
| 2 plans (10s each) | 20s | 10s | 2x |
| 5 plans (10s each) | 50s | 10s | 5x |
| 10 plans (10s each) | 100s | 10s | 10x |

### Concurrency Model

| Aspect | Before | After |
|--------|--------|-------|
| Max concurrent plans | 1 | Unlimited (all pending) |
| Daemon loop blocking | Yes (waits for plan) | No (continues polling) |
| Polling interval | Pauses during execution | Consistent 5s |
| Failure isolation | No (stops daemon) | Yes (isolated per task) |

### Resource Utilization

| Metric | Before | After |
|--------|--------|-------|
| CPU utilization | Low (single plan) | High (multiple plans) |
| Memory usage | Linear (1 plan) | Linear × N (N plans) |
| Network I/O | Sequential | Parallel |
| Total throughput | Limited | Maximized |

### Safety Mechanisms

#### 1. Duplicate Prevention
```python
if plan_id in running_plans:
    logger.debug(f"Plan {plan_id} already running, skipping")
    continue

running_plans.add(plan_id)
```

#### 2. Closure Safety
```python
# Use default argument to capture current value
async def _run_plan_wrapper(p=plan_data):
    await _run_plan(p, client, running_plans)

task = asyncio.create_task(_run_plan_wrapper())
```

#### 3. Cleanup Guarantees
```python
finally:
    # Always remove from running set when done
    running_plans.discard(plan_id)
```

#### 4. Error Isolation
```python
except Exception as e:
    logger.error(f"Plan execution task error: {e}")
    running_plans.discard(p.get('id'))
```

### Recommended Limits

While the code allows unlimited concurrency, practical limits apply:
- **Conservative**: 3-5 concurrent plans (single daemon)
- **Moderate**: 5-10 concurrent plans (with monitoring)
- **Aggressive**: 10+ concurrent plans (requires scaling)

---

## Data Flow

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
10. If linked to kanban task → update kanban status
```

### Chat Session Flow

```
1. User creates chat session via dashboard
2. Session stored in database
3. Daemon polls for pending chat sessions
4. For each user message:
   - If planner agent → inject agents context
   - If planner agent → inject planning context
   - Execute via Claude SDK
   - Stream response to dashboard
5. Session completes or times out
```

### Kanban Pipeline Flow

```
1. Kanban task created in "planning" column
2. Daemon monitors tasks with pipeline_status='idle'
3. For idle task:
   - Fetch planning context
   - Create workflow plan
   - Attach workflow_id to task
   - Set pipeline_status='planning'
4. Workflow executes
5. On completion:
   - Move task to 'done' column
   - Set pipeline_status='done'
   - Attach result notes
```

---

## Design Decisions

### 1. Polling vs WebSockets

**Decision**: Use HTTP polling (5s interval) for daemon communication

**Rationale**:
- Simpler implementation and debugging
- Works across network boundaries
- Lower infrastructure complexity
- Sufficient for near-real-time updates

**Trade-offs**:
- 5s maximum latency for plan pickup
- Higher HTTP overhead vs persistent connections
- No server push capability

### 2. Parallel Plan Execution

**Decision**: Execute plans in parallel using asyncio.create_task()

**Rationale**:
- Significantly better throughput (N× speedup)
- Better resource utilization
- Isolated failures don't affect other plans
- Proven pattern (already used for chat sessions)

**Trade-offs**:
- Increased memory usage
- More complex error handling
- Potential resource contention

### 3. SQLite vs PostgreSQL

**Decision**: Use SQLite for development and small deployments

**Rationale**:
- Zero configuration
- Single file database
- Sufficient performance for < 100 concurrent users
- Easy backup and migration

**Trade-offs**:
- Limited write concurrency
- No network access
- Not suitable for large-scale deployments

**Future**: Support PostgreSQL option for production deployments

### 4. React Query for State Management

**Decision**: Use React Query instead of Redux/Context

**Rationale**:
- Automatic caching and revalidation
- Optimistic updates built-in
- Less boilerplate code
- Excellent TypeScript support

**Trade-offs**:
- Learning curve for developers unfamiliar with it
- Additional library dependency

### 5. Separate Daemon Process

**Decision**: Run daemon as separate Python process

**Rationale**:
- Language isolation (Python vs Node.js)
- Independent scaling
- Graceful shutdown of one component
- Easier debugging and monitoring

**Trade-offs**:
- More complex deployment
- Additional process monitoring needed
- Inter-process communication overhead

---

## Security Considerations

### Authentication

- **Bearer Token**: Simple token-based authentication
- **Environment Variables**: Tokens stored in .env files (gitignored)
- **API Routes**: All routes require authentication except health checks

### Authorization

- **Workspace Isolation**: Agents can only access configured directories
- **Project Isolation**: Projects have separate agents and environments
- **Permission System**: Granular tool-level permissions per agent

### Data Safety

- **Prepared Statements**: SQL injection protection via parameterized queries
- **Input Validation**: All user inputs validated before processing
- **Error Messages**: Generic error messages (no stack traces in API responses)
- **File Access**: Agents restricted to configured working directories

---

## Performance Optimization

### API Optimization

- **Connection Pooling**: Reuse database connections
- **Query Optimization**: Use indexes on frequently queried columns
- **Response Caching**: React Query caches API responses
- **SSE Streaming**: Real-time log streaming without polling

### Daemon Optimization

- **Parallel Execution**: Multiple plans run concurrently
- **Efficient Polling**: 5s interval balances latency and load
- **Log Batching**: Logs sent in batches (every 5 logs or on events)
- **Resource Cleanup**: Proper cleanup of tasks and connections

### Dashboard Optimization

- **Code Splitting**: Routes lazy-loaded with React.lazy()
- **Memoization**: Expensive computations cached with useMemo
- **Virtual Scrolling**: Large lists use virtual scrolling (future)
- **Optimistic Updates**: UI updates immediately, reverted on error

---

## Scalability

### Horizontal Scaling

- **Multiple Daemons**: Run multiple daemon instances (plans locked via API)
- **Load Balancer**: Distribute dashboard traffic across multiple instances
- **Database Scaling**: Migrate to PostgreSQL for better write concurrency

### Vertical Scaling

- **CPU**: More cores = more parallel plan execution
- **Memory**: Each plan requires ~50-100MB
- **Storage**: SQLite handles GBs of log data efficiently

### Bottlenecks

1. **Daemon CPU**: Processing multiple agent SDK calls
2. **API Rate Limits**: Concurrent requests to backend
3. **Memory**: Each plan loads its own workspace/context
4. **Network**: Bandwidth for parallel log streaming

---

## Monitoring & Observability

### Logs

- **Daemon Logs**: Colored terminal output with log levels
- **API Logs**: Request/response logging with correlation IDs
- **Plan Logs**: Stored in database, streamed via SSE

### Metrics

- **Execution Metrics**: Success rate, duration, throughput
- **Resource Metrics**: CPU, memory, disk usage (future)
- **Business Metrics**: Plans per project, agent utilization (future)

### Health Checks

- **API Health**: `GET /api/health` returns service status
- **Daemon Heartbeat**: Daemon updates last_seen timestamp
- **Dashboard Status**: Visual indicators for service health

---

## Future Enhancements

### Architecture

1. **WebSocket Support**: Replace polling with WebSocket for real-time updates
2. **Message Queue**: Use Redis/RabbitMQ for daemon communication
3. **Microservices**: Split API into smaller, focused services
4. **Event Sourcing**: Store all events for replay and audit

### Performance

1. **Plan Caching**: Cache plan results for identical inputs
2. **Incremental Execution**: Only execute changed tasks in plans
3. **Distributed Execution**: Distribute tasks across multiple machines
4. **Result Caching**: Cache Claude SDK responses

### Features

1. **Plan Templates**: Reusable plan templates with parameters
2. **Plan Scheduling**: Schedule plans to run at specific times
3. **Plan Chaining**: Chain multiple plans with dependencies
4. **Conditional Execution**: Execute tasks based on conditions

---

**Documentation Version**: 1.0.0
**Last Updated**: 2026-03-16
**Architecture Status**: ✅ Stable (Production Ready)
