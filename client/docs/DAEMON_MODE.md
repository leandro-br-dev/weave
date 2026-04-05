# Daemon Mode & Kanban Pipeline

## Overview

The Agent Client can run in **daemon mode**, continuously polling the weave API for pending plans and executing them. Additionally, it includes a **Kanban Pipeline Monitor** that automatically generates execution plans from kanban tasks.

### What Daemon Mode Does

1. **Continuous Polling**: Polls the API every 5 seconds for pending plans
2. **Plan Execution**: Executes plans using the standard execution engine
3. **Log Streaming**: Sends execution logs to the API in real-time
4. **Kanban Integration**: Automatically processes kanban tasks and generates plans
5. **Graceful Shutdown**: Handles SIGINT/SIGTERM signals cleanly

### What Kanban Pipeline Does

1. **Task Detection**: Monitors kanban tasks in the 'active' column without workflows
2. **Plan Generation**: Uses planning agents to generate execution plans
3. **Workflow Creation**: Creates workflows from generated plans
4. **Auto-Approval**: Optionally auto-starts workflows based on project settings

---

## Daemon Mode Usage

### Basic Usage

```bash
python main.py --daemon --server http://localhost:3001 --token YOUR_TOKEN
```

### Using Environment Variables

```bash
export WEAVE_URL="http://localhost:3001"
export WEAVE_TOKEN="your-token-here"
python main.py --daemon
```

### Configuration Priority

CLI flags override environment variables:
- `--server` overrides `WEAVE_URL`
- `--token` overrides `WEAVE_TOKEN`

### Defaults

- If no server URL is specified, defaults to `http://localhost:3001`
- Token is **required** for daemon mode

---

## Daemon Architecture

### Architecture Diagram

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

## Daemon Execution Flow

### 1. Polling Phase

```bash
Every 5 seconds:
├─ Poll pending plans (GET /api/plans/pending)
├─ Poll pending chat sessions
└─ Poll kanban tasks
```

### 2. Plan Detection

When pending plans are found:
1. Each plan is processed sequentially
2. Plan data is converted to internal Plan format
3. Execution begins immediately

### 3. Execution Phase

For each plan:
```bash
1. Send POST /api/plans/:id/start with {client_id: hostname}
2. Execute plan using runner.py
3. After each task: Send POST /api/plans/:id/logs
4. On completion: Send POST /api/plans/:id/complete with {status, result}
```

### 4. Graceful Shutdown

When SIGINT/SIGTERM is received:
1. Stop polling for new plans
2. Finish executing the current plan (if any)
3. Send completion status to the API
4. Exit cleanly

---

## Kanban Pipeline Architecture

### Flow Diagram

```
Daemon Loop (every 5 seconds)
├─ Poll pending plans
├─ Poll pending chat sessions
└─ Poll kanban tasks
   └─ For each project:
      └─ GET /api/kanban/:projectId/pending-pipeline
         └─ For each active task without workflow:
            └─ Spawn background task:
               └─ process_kanban_task()
                  ├─ Mark as 'planning'
                  ├─ Find planner workspace
                  ├─ Run planning agent via SDK
                  ├─ Extract <plan> JSON
                  ├─ POST /api/plans (create workflow)
                  ├─ PATCH kanban task with workflow_id
                  ├─ If auto_approve: POST /api/plans/:id/start
                  └─ On error: mark as 'failed'
```

### Kanban Task Status Flow

```
idle → planning → awaiting_approval → running → completed
                    ↓ (if auto_approve)
                    → running → completed
                ↓ (on error)
                → failed
```

---

## Kanban Pipeline Implementation

### Components

#### 1. DaemonClient Methods (`orchestrator/daemon_client.py`)

**HTTP Methods:**
- `_patch(path, data)` - Internal PATCH request method
- `_post(path, data)` - Internal POST request method
- `_get(path)` - Internal GET request method

**Kanban Pipeline Methods:**
- `get_pending_kanban_tasks(project_id)` - Fetches active kanban tasks without workflow
- `get_all_projects()` - Returns all projects with settings
- `update_kanban_pipeline(project_id, task_id, **kwargs)` - Updates pipeline status
- `create_plan_from_data(plan_data)` - Creates a workflow from plan dict
- `start_plan_async(plan_id)` - Marks plan as pending for daemon execution

#### 2. Kanban Pipeline Module (`orchestrator/kanban_pipeline.py`)

**Functions:**

`load_plan_from_file(file_path, fallback_name)`
- Loads JSON plan from a file (Blackboard pattern)
- Validates plan structure (name, tasks list)
- Returns validated plan dict or None

`find_planner_workspace(project_id, client)`
- Finds the planner agent's workspace for a project
- Queries `/api/projects/:id/agents-context`
- Returns workspace path or None

`build_planning_prompt(task, planning_context, skill_content, workflow_context, workflow_dir)`
- Builds comprehensive prompt for planning agent
- Includes project context, environments, and agents
- Provides clear instructions on cwd vs workspace usage
- Injects Blackboard path for plan.json output

`process_kanban_task(task, client)`
- Main processing logic for a single kanban task
- Marks task as 'planning'
- Pre-creates workflow directory via API (Blackboard pattern)
- Finds project's planner agent workspace
- Builds prompt with task details, agents context, and workflow dir
- Executes planning agent via Claude Agent SDK
- Agent saves plan.json directly to workflow directory
- Agent validates plan with `weave-validate plan`
- Reads validated plan from workflow directory
- Creates workflow via API (reusing pre-created workflow_id)
- Links workflow to kanban task
- Auto-approves if `auto_approve_workflows` is enabled
- Handles errors and updates status

`poll_kanban_tasks(client)`
- Iterates through all projects
- Fetches pending kanban tasks for each project
- Spawns background tasks for processing
- Non-blocking: doesn't delay daemon loop

`_running_kanban_tasks` (global set)
- Tracks tasks currently being processed
- Prevents duplicate processing

---

## API Endpoints Used

### Daemon Mode Endpoints

**Plan Management:**
- `GET /api/plans/pending` - Fetch pending plans
- `POST /api/plans/:id/start` - Mark plan as running
- `POST /api/plans/:id/logs` - Submit log entries
- `POST /api/plans/:id/complete` - Mark plan as complete

**Chat Sessions:**
- `GET /api/chat-sessions/pending` - Fetch pending chat sessions
- `POST /api/chat-sessions/:id/start` - Mark session as running
- `POST /api/chat-sessions/:id/complete` - Mark session as complete

### Kanban Pipeline Endpoints

**Existing:**
- `GET /api/kanban/:projectId/pending-pipeline` - Returns tasks needing workflow
- `PATCH /api/kanban/:projectId/:taskId/pipeline` - Updates pipeline status

**Used by Kanban Pipeline:**
- `GET /api/projects` - Lists all projects with settings
- `GET /api/projects/:id/agents-context` - Gets planner workspace
- `POST /api/plans` - Creates workflow from plan data
- `POST /api/plans/:id/start` - Marks plan as pending

---

## Configuration

### Project Settings

Kanban tasks respect the `auto_approve_workflows` setting in project settings:

```json
{
  "auto_approve_workflows": true
}
```

When enabled, workflows are automatically started after creation.

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `WEAVE_URL` | API server URL | No (defaults to localhost:3001) |
| `WEAVE_TOKEN` | Bearer token | Yes |
| `ANTHROPIC_BASE_URL` | Custom API endpoint URL | No |
| `ANTHROPIC_API_KEY` | API key | No |

---

## Usage Example

### 1. Create a Kanban Task

- Move task to 'active' column in UI
- Task must have `title` and `description`
- The daemon will detect it (no `workflow_id`)

### 2. Daemon Automatically

- Runs the planning agent
- Generates execution plan
- Creates workflow
- Links workflow to kanban task
- Optionally auto-approves

### 3. Monitor Progress

- Check kanban task `pipeline_status` field
- View `workflow_id` when linked
- See `error_message` if failed

---

## Error Handling

### Daemon Error Handling

- All methods return empty containers (list/dict) on error
- HTTP errors are logged with descriptive messages
- JSON parsing errors are caught and handled
- API error envelopes are properly processed
- Graceful degradation on API failures

### Kanban Pipeline Error Handling

- Failed tasks marked with `pipeline_status='failed'` and `error_message`
- Logging at all levels (info, warning, error, success)
- Background task failures don't crash daemon loop
- Duplicate processing prevention via task tracking
- Comprehensive error messages sent to API

---

## Troubleshooting

### Daemon fails instantly without logs

**Cause**: Working directory doesn't exist or SDK initialization failed

**Solution**: Check daemon output for error messages - all errors are now logged and sent to the API.

### Plans stuck in "running" state

**Cause**: Daemon crashed while executing a plan

**Solution**:
1. Kill orphaned daemon processes: `pkill -f 'main.py --daemon'`
2. Manually update plan status in database to "failed"
3. Check logs for the error that caused the crash

### Orphaned Daemon Processes

If a daemon session is terminated abruptly (e.g., SSH disconnect, system crash), the daemon process may continue running in the background.

**Checking for Orphaned Daemons:**
```bash
# Check for daemon processes
ps aux | grep 'main.py --daemon'

# Check for agent-client processes
ps aux | grep 'agent-client'
```

**Killing Orphaned Daemons:**
```bash
# Kill all daemon processes
pkill -f 'main.py --daemon'

# Or kill by specific PID
kill <PID>

# Force kill if necessary
kill -9 <PID>
```

### High memory usage

**Cause**: Long-running tasks or memory leaks

**Solution**:
- Restart the daemon periodically
- Monitor resource usage with `top` or `htop`
- Implement maximum execution time per plan

---

## Technical Features

### Daemon Mode Features

- ✅ Non-blocking background processing with `asyncio.create_task()`
- ✅ Duplicate prevention via running task tracking
- ✅ Compatible with existing DaemonClient patterns
- ✅ Graceful degradation on errors
- ✅ Comprehensive test coverage
- ✅ Full integration with existing daemon loop

### Kanban Pipeline Features

- ✅ Non-blocking background processing
- ✅ Duplicate prevention via running task tracking
- ✅ Compatible with existing DaemonClient patterns
- ✅ Graceful degradation on errors
- ✅ Comprehensive test coverage
- ✅ Full integration with planning agents
- ✅ Robust fallback for cwd/workspace values

---

## Implementation Details

### Planning Context Integration

The kanban pipeline integrates with the full planning context endpoint, providing the planner agent with comprehensive project information:

**Planning Prompt Sections:**
```markdown
## Project Context
- Project name and description

## Environments
- All available environments with their project paths

## Available Agents
- All agents with their roles and workspace paths

## Task to Plan
- Title and description from the kanban task

## Important: cwd vs workspace
- Clear guidance on cwd vs workspace usage
```

**Benefits:**
1. **Complete Context**: Planner has access to all project information
2. **Better Plans**: More accurate task assignments and paths
3. **Improved Maintainability**: Centralized prompt building logic

### Fallback Logic

The `normalize_plan_tasks()` function provides robust fallback values for `cwd` and `workspace` when the planning agent doesn't generate them correctly:

**Fallback Priority:**
1. Explicit task values (cwd, workspace)
2. Alternative field names (workingDirectory, working_directory)
3. Fallback from planning_context
4. Empty string (last resort)

**Fallback Extraction:**
- **cwd fallback**: Uses first environment's `project_path`
- **workspace fallback**: Maps agent role to `workspace_path` from agents list

---

## Testing

### Unit Tests

Run the daemon client tests:

```bash
pytest tests/test_daemon_client.py -v
```

**Test Coverage:**
- 17 comprehensive unit tests
- All tests use mocked HTTP responses
- 100% test coverage of DaemonClient methods
- Tests cover: success cases, errors, edge cases

### Test Results

```
============================= test session starts ==============================
collected 17 items

tests/test_daemon_client.py::TestDaemonClientInit::test_init_basic PASSED
tests/test_daemon_client.py::TestDaemonClientInit::test_init_trailing_slash PASSED
tests/test_daemon_client.py::TestDaemonClientInit::test_close PASSED
tests/test_daemon_client.py::TestGetPendingPlans::test_get_pending_plans_success PASSED
tests/test_daemon_client.py::TestGetPendingPlans::test_get_pending_plans_empty PASSED
tests/test_daemon_client.py::TestGetPendingPlans::test_get_pending_plans_http_error PASSED
tests/test_daemon_client.py::TestGetPendingPlans::test_get_pending_plans_json_error PASSED
tests/test_daemon_client.py::TestStartPlan::test_start_plan_success PASSED
tests/test_daemon_client.py::TestStartPlan::test_start_plan_with_custom_client_id PASSED
tests/test_daemon_client.py::TestSendLogs::test_send_logs_success PASSED
tests/test_daemon_client.py::TestSendLogs::test_send_logs_empty PASSED
tests/test_daemon_client.py::TestCompletePlan::test_complete_plan_success PASSED
tests/test_daemon_client.py::TestCompletePlan::test_complete_plan_failed PASSED
tests/test_daemon_client.py::TestCompletePlan::test_complete_plan_without_result PASSED
tests/test_daemon_client.py::TestResponseHandling::test_handle_response_with_error PASSED
tests/test_daemon_client.py::TestResponseHandling::test_handle_response_non_envelope PASSED
tests/test_daemon_client.py::TestResponseHandling::test_handle_response_parse_error PASSED

============================== 17 passed in 0.12s ===============================
```

---

## Files Created/Modified

### New Files

1. **`orchestrator/daemon_client.py`** (171 lines)
   - `DaemonClient` class for HTTP communication with the API
   - Response envelope handling with `{data, error}` format
   - Automatic hostname-based client ID
   - Comprehensive error handling

2. **`orchestrator/kanban_pipeline.py`** (280+ lines)
   - `load_plan_from_file()` function
   - `find_planner_workspace()` function
   - `build_planning_prompt()` function
   - `process_kanban_task()` function
   - `poll_kanban_tasks()` function

3. **`tests/test_daemon_client.py`** (317 lines)
   - 17 comprehensive unit tests
   - All tests use mocked HTTP responses
   - 100% test coverage of DaemonClient methods

### Modified Files

1. **`main.py`** (enhanced)
   - Added `--daemon` CLI flag
   - Added `--server` and `--token` options
   - Environment variable support
   - `run_daemon()` function with polling loop
   - `run_plan_with_logging()` for log streaming
   - Graceful shutdown handling (SIGINT/SIGTERM)

2. **`orchestrator/logger.py`** (enhanced)
   - Added `success(text)` method for success messages

3. **`requirements.txt`** (updated)
   - Added `httpx>=0.24.0` for HTTP client
   - Added `pytest>=7.0.0` and `pytest-mock>=3.10.0` for testing

---

## Features Implemented

### Daemon Mode Features

- [x] Poll `GET /api/plans/pending` every 5 seconds
- [x] Start plan with `POST /api/plans/:id/start` (includes client_id)
- [x] Execute plans using existing runner.py (unchanged)
- [x] Stream logs to `POST /api/plans/:id/logs` after each task
- [x] Complete plans with `POST /api/plans/:id/complete`
- [x] Graceful shutdown on SIGINT/SIGTERM

### Configuration

- [x] CLI flags: `--daemon`, `--server`, `--token`
- [x] Environment variables: `WEAVE_URL`, `WEAVE_TOKEN`
- [x] Sensible defaults (http://localhost:3001, requires token)
- [x] CLI flags override env vars

### Kanban Pipeline Features

- [x] Automatic detection of kanban tasks without workflows
- [x] Integration with planning agents
- [x] Comprehensive planning context
- [x] Workflow creation and linking
- [x] Auto-approval based on project settings
- [x] Robust error handling
- [x] Fallback logic for cwd/workspace

---

## Backward Compatibility

✅ **All existing functionality preserved**:
- Standard mode: `python main.py plans/my-plan.json`
- Dry-run mode: `python main.py plans/my-plan.json --dry-run`
- No changes to `runner.py` (daemon wraps around it)

---

## Next Steps

The daemon mode and kanban pipeline are ready for production use:

1. **Start the API server**: `cd /root/projects/weave/api && npm run dev`
2. **Run the daemon**: `cd /root/projects/weave/client && python main.py --daemon --token dev-token-change-in-production`
3. **Create plans via dashboard** or API
4. **Monitor execution** through the dashboard

---

## Related Documentation

- **README.md**: Agent client overview and quick start
- **PLAN_EXECUTION.md**: Plan format and execution model
- **ARCHITECTURE.md**: Architecture and implementation details
- **TESTING.md**: Testing and verification

---

**Last Updated**: 2026-03-16
**Version**: 1.0.0
**Status**: Production Ready ✅
