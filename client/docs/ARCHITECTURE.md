# Architecture

## Overview

The Agent Client is a Python-based execution engine that orchestrates multi-agent workflows using the Claude Agent SDK. It follows a modular architecture with clear separation of concerns, making it easy to maintain and extend.

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        main.py                               │
│                   (CLI Entry Point)                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  parse_args() - CLI parsing                         │   │
│  │  dry_run() - Preview execution                      │   │
│  │  run_daemon() - Daemon mode loop                    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
┌──────────────────────┐          ┌──────────────────────┐
│   DaemonClient       │          │     Plan Loader      │
│ (HTTP API Client)    │          │  (orchestrator/plan) │
│                      │          │                      │
│ - API communication  │          │ - Load JSON plans    │
│ - Plan polling       │          │ - Dependency resolution│
│ - Log streaming      │          │ - Execution order    │
└──────────────────────┘          └──────────────────────┘
         │                                    │
         ▼                                    ▼
┌──────────────────────┐          ┌──────────────────────┐
│  Kanban Pipeline     │          │     Runner           │
│ (orchestrator/       │          │ (orchestrator/runner)│
│  kanban_pipeline)    │          │                      │
│                      │          │ - Agent execution    │
│ - Task detection     │          │ - Task orchestration │
│ - Plan generation    │          │ - Output collection  │
│ - Workflow creation  │          │ - Error handling     │
└──────────────────────┘          └──────────────────────┘
         │                                    │
         ▼                                    ▼
┌──────────────────────┐          ┌──────────────────────┐
│  Chat Runner         │          │   Claude Agent SDK   │
│ (orchestrator/       │          │                      │
│  chat_runner)        │          │ - Agent sessions     │
│                      │          │ - Tool execution     │
│ - Chat sessions      │          │ - Output streaming   │
│ - Context management │          │ - Permission handling│
└──────────────────────┘          └──────────────────────┘
```

---

## Core Components

### 1. main.py - CLI Entry Point

**Purpose**: Command-line interface and daemon loop

**Key Functions**:
- `parse_args()` - Parse CLI arguments
- `dry_run()` - Preview execution order
- `run_daemon()` - Daemon mode loop
- `run_plan_with_logging()` - Execute plan with log streaming

**Responsibilities**:
- Parse command-line arguments
- Route to appropriate execution mode
- Handle graceful shutdown
- Manage daemon lifecycle

### 2. orchestrator/plan.py - Plan Management

**Purpose**: Plan loading and dependency resolution

**Key Classes**:
- `Task` - Task dataclass with configuration
- `Plan` - Plan dataclass with tasks
- `load_plan()` - Load plan from JSON file

**Key Methods**:
- `Plan.execution_order()` - Calculate execution waves
- `Task.from_dict()` - Create task from dictionary
- `Plan.get_task()` - Get task by ID

**Responsibilities**:
- Load and validate plan files
- Resolve task dependencies
- Calculate execution order
- Provide task lookup

### 3. orchestrator/runner.py - Plan Execution

**Purpose**: Execute plans using Claude Agent SDK

**Key Functions**:
- `run_plan()` - Execute entire plan
- `run_wave()` - Execute tasks in a wave
- `run_task()` - Execute single task
- `extract_structured_output()` - Extract JSON from agent output

**Responsibilities**:
- Execute tasks via Claude Agent SDK
- Manage task lifecycle
- Collect output and logs
- Handle errors gracefully

### 4. orchestrator/daemon_client.py - API Client

**Purpose**: HTTP client for API communication

**Key Class**:
- `DaemonClient` - HTTP client with authentication

**Key Methods**:
- `get_pending_plans()` - Poll for pending plans
- `start_plan()` - Mark plan as running
- `send_logs()` - Send logs to API
- `complete_plan()` - Mark plan as complete
- `get_pending_kanban_tasks()` - Fetch kanban tasks
- `create_plan_from_data()` - Create workflow from plan

**Responsibilities**:
- Communicate with weave API
- Handle authentication
- Stream logs to API
- Report plan status

### 5. orchestrator/kanban_pipeline.py - Kanban Integration

**Purpose**: Automatic plan generation from kanban tasks

**Key Functions**:
- `poll_kanban_tasks()` - Poll for pending kanban tasks
- `process_kanban_task()` - Process single kanban task (Blackboard pattern)
- `load_plan_from_file()` - Load plan from workflow directory (plan.json)
- `build_planning_prompt()` - Build prompt for planning agent
- `normalize_plan_tasks()` - Normalize task configuration

**Responsibilities**:
- Detect kanban tasks needing workflows
- Generate execution plans
- Create and link workflows
- Handle planning errors

### 6. orchestrator/chat_runner.py - Chat Sessions

**Purpose**: Execute chat sessions via Claude Agent SDK

**Key Functions**:
- `run_chat_session()` - Execute chat session
- `collect_chat_output()` - Collect chat output

**Responsibilities**:
- Execute chat sessions
- Collect output and logs
- Handle chat errors

### 7. orchestrator/logger.py - Logging

**Purpose**: Colored terminal output

**Key Functions**:
- `header()` - Print section headers
- `info()` - Print info messages
- `success()` - Print success messages
- `warning()` - Print warning messages
- `error()` - Print error messages

**Responsibilities**:
- Provide colored logging
- Format terminal output
- Support different log levels

---

## Data Flow

### Standard Execution Flow

```
User runs: python main.py plans/example.json
         │
         ▼
main.py: load_plan(plan_path)
         │
         ▼
orchestrator/plan.py: Load and validate plan
         │
         ▼
main.py: runner.run_plan(plan)
         │
         ▼
orchestrator/runner.py: Calculate execution waves
         │
         ▼
For each wave:
    For each task in wave:
        │
        ▼
    runner.run_task(task)
        │
        ▼
    Claude Agent SDK: Execute agent
        │
        ▼
    Collect output and logs
        │
        ▼
    Return results
         │
         ▼
Return plan results
```

### Daemon Mode Flow

```
User runs: python main.py --daemon
         │
         ▼
main.py: Initialize DaemonClient
         │
         ▼
main.py: Start daemon loop
         │
         ▼
Every 5 seconds:
    │
    ▼
daemon_client.get_pending_plans()
    │
    ▼
If plans found:
    For each plan:
        │
        ▼
    daemon_client.start_plan(plan_id)
        │
        ▼
    Convert API plan to Plan object
        │
        ▼
    runner.run_plan(plan)
        │
        ▼
    After each task:
        │
        ▼
    daemon_client.send_logs(plan_id, logs)
        │
        ▼
    After plan completes:
        │
        ▼
    daemon_client.complete_plan(plan_id, status, result)
```

### Kanban Pipeline Flow

```
Daemon loop: poll_kanban_tasks(client)
         │
         ▼
For each project:
    │
    ▼
daemon_client.get_pending_kanban_tasks(project_id)
    │
    ▼
For each task without workflow:
    │
    ▼
Spawn background task: process_kanban_task(task, client)
    │
    ▼
Mark task as 'planning'
    │
    ▼
Find planner workspace
    │
    ▼
Build planning prompt with context
    │
    ▼
Pre-create workflow directory (Blackboard)
    │
    ▼
Run planning agent via SDK (agent saves plan.json to workflow dir)
    │
    ▼
Load plan from workflow directory (plan.json)
    │
    ▼
daemon_client.create_plan_from_data(plan_data, workflow_id)
    │
    ▼
Link workflow to kanban task
    │
    ▼
If auto_approve: daemon_client.start_plan_async(plan_id)
    │
    ▼
Mark task as 'awaiting_approval' or 'running'
```

---

## Claude Agent SDK Integration

### SDK Configuration

The Agent Client uses the Claude Agent SDK for agent execution:

```python
from claude_agent_sdk import (
    ClaudeAgentOptions,
    query,
    AssistantMessage,
    TextBlock,
    ToolUseBlock,
)
```

### Agent Options

```python
options = ClaudeAgentOptions(
    tools=task.tools,
    permission_mode=task.permission_mode,
    system_prompt=task.system_prompt,
    env=task.env,
    # Additional options
)
```

### Query Execution

```python
async with query(task.prompt, options) as response:
    async for event in response:
        # Handle events
        if isinstance(event, AssistantMessage):
            # Process assistant message
        elif isinstance(event, ToolUseBlock):
            # Process tool use
```

### Custom API Endpoint

The SDK supports custom API endpoints via environment variables:

```bash
export ANTHROPIC_BASE_URL=http://your-custom-endpoint
export ANTHROPIC_API_KEY=your-api-key
```

---

## Dependency Resolution

### Algorithm

The dependency resolver uses a topological sort algorithm:

1. **Initialization**: Start with all tasks unresolved
2. **Wave Calculation**:
   - Find all tasks with no unresolved dependencies
   - Add them to the current wave
   - Mark them as resolved
   - Repeat until no tasks remain
3. **Circular Dependency Detection**:
   - If no tasks can be added to a wave but tasks remain
   - Raise circular dependency error

### Example

Given tasks:
- A: no dependencies
- B: no dependencies
- C: depends on A
- D: depends on A, B
- E: depends on C, D

Execution order:
- Wave 1: [A, B] (no dependencies)
- Wave 2: [C] (depends on A)
- Wave 3: [D] (depends on A, B)
- Wave 4: [E] (depends on C, D)

---

## Error Handling

### Levels of Error Handling

1. **Task Level**: Individual task failures
2. **Wave Level**: Failures affecting a wave
3. **Plan Level**: Failures affecting entire plan
4. **Daemon Level**: Failures affecting daemon operation

### Error Handling Strategy

```python
try:
    # Execute task
    result = await run_task(task)
except TaskExecutionError as e:
    # Log error
    logger.error(f"Task failed: {e}")
    # Continue with next task if possible
    # Or fail plan if critical
except Exception as e:
    # Unexpected error
    logger.error(f"Unexpected error: {e}")
    # Fail plan
    raise
```

### Error Recovery

- **Transient Errors**: Retry with exponential backoff
- **Permanent Errors**: Log and continue/abort as appropriate
- **Daemon Errors**: Log and continue polling

---

## Logging Architecture

### Log Levels

- **DEBUG**: Detailed debugging information
- **INFO**: General informational messages
- **SUCCESS**: Successful operations
- **WARNING**: Warning messages
- **ERROR**: Error messages

### Log Streaming

In daemon mode, logs are streamed to the API:

```python
# Collect logs during task execution
log_collector = DaemonLogCollector()
log_collector.set_task(task_id)

# Add logs
log_collector.add_log("info", "Task started")

# Send logs to API
client.send_logs(plan_id, log_collector.get_logs())
```

### Log Format

Logs include:
- Timestamp
- Level (INFO, WARNING, ERROR, SUCCESS)
- Message
- Task ID (if applicable)
- Plan ID (if applicable)

---

## State Management

### Plan State

- **Pending**: Plan is waiting to be executed
- **Running**: Plan is currently executing
- **Completed**: Plan completed successfully
- **Failed**: Plan failed with error

### Task State

- **Pending**: Task is waiting to be executed
- **Running**: Task is currently executing
- **Completed**: Task completed successfully
- **Failed**: Task failed with error

### Kanban Task State

- **Idle**: Task is not being processed
- **Planning**: Task is being planned
- **Awaiting Approval**: Workflow created, awaiting approval
- **Running**: Workflow is executing
- **Completed**: Workflow completed successfully
- **Failed**: Workflow or planning failed

---

## Concurrency Model

### Task Execution

- **Sequential within waves**: Tasks in same wave run sequentially (SDK limitation)
- **Parallel across waves**: Different waves execute sequentially
- **Async/await**: Uses `anyio` for async operations

### Background Processing

- **Kanban tasks**: Spawn background tasks with `asyncio.create_task()`
- **Non-blocking**: Background tasks don't block daemon loop
- **Tracking**: Global set tracks running tasks to prevent duplicates

### Example

```python
# Spawn background task
task = asyncio.create_task(process_kanban_task(task_data, client))
_running_kanban_tasks.add(task_id)

# Non-blocking: daemon loop continues
# Task completes in background
```

---

## Security Considerations

### Authentication

- **Bearer Token**: Daemon uses bearer token for API authentication
- **Token Storage**: Token passed via CLI flag or environment variable
- **Token Transmission**: Token sent in HTTP headers

### Authorization

- **Plan Access**: Daemon only accesses plans it's authorized to execute
- **Project Access**: Kanban processing respects project permissions
- **Workspace Access**: Agent workspaces isolated by project

### Sandboxing

- **Agent Workspaces**: Each agent has isolated workspace
- **Environment Variables**: Task-specific env vars isolated
- **Tool Permissions**: Tools controlled by permission_mode

---

## Performance Optimization

### Plan Execution

- **Dependency Resolution**: Efficient topological sort
- **Wave Execution**: Parallel execution within waves
- **Output Collection**: Efficient log buffering

### Daemon Mode

- **Polling Interval**: 5-second balance between responsiveness and load
- **Background Processing**: Non-blocking kanban task processing
- **Log Batching**: Batch logs before sending to API

### Memory Management

- **Log Buffering**: Logs buffered in memory, cleared after sending
- **Task Cleanup**: Background tasks cleaned up after completion
- **Connection Pooling**: HTTP client uses connection pooling

---

## Testing Strategy

### Unit Tests

- **Plan Loading**: Test plan validation and loading
- **Dependency Resolution**: Test execution order calculation
- **Task Execution**: Test individual task execution
- **Error Handling**: Test error scenarios

### Integration Tests

- **Daemon Mode**: Test daemon lifecycle and polling
- **Kanban Pipeline**: Test kanban task processing
- **API Communication**: Test API client methods

### End-to-End Tests

- **Plan Execution**: Test complete plan execution
- **Daemon Execution**: Test daemon with real API
- **Kanban Flow**: Test kanban to workflow flow

---

## Future Enhancements

### Potential Improvements

1. **Parallel Task Execution**: True parallel execution within waves
2. **Task Caching**: Cache task results for reuse
3. **Conditional Execution**: Support conditional task execution
4. **Dynamic Plans**: Support plans that modify themselves during execution
5. **Resource Limits**: Enforce resource limits per task
6. **Priority Queuing**: Execute high-priority plans first

### Scalability

- **Horizontal Scaling**: Multiple daemon instances
- **Load Balancing**: Distribute plans across daemons
- **Resource Management**: Better resource tracking and allocation

---

## Related Documentation

- **README.md**: Agent client overview
- **DAEMON_MODE.md**: Daemon mode usage
- **PLAN_EXECUTION.md**: Plan format and execution
- **TESTING.md**: Testing documentation

---

**Last Updated**: 2026-03-16
**Version**: 1.0.0
**Status**: Production Ready ✅
