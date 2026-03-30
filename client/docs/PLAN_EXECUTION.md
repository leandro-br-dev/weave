# Plan Execution

## Overview

A **plan** is a JSON file that defines a multi-agent workflow. Each plan consists of multiple tasks that can be executed sequentially or in parallel based on their dependencies. The Agent Client resolves dependencies automatically and executes tasks in waves.

### Key Concepts

- **Plan**: A JSON file defining a multi-agent workflow
- **Task**: A single agent execution with specific configuration
- **Dependencies**: Tasks can depend on other tasks, creating execution order
- **Waves**: Tasks are organized into waves based on dependencies
- **Parallel Execution**: Tasks in the same wave run in parallel

---

## Plan Format

### Basic Structure

```json
{
  "name": "plan-name",
  "tasks": [
    {
      "id": "task-id",
      "name": "Human readable name",
      "prompt": "What the agent should do",
      "cwd": "/path/to/workspace",
      "tools": ["Read", "Write", "Edit", "Bash", "Glob"],
      "permission_mode": "acceptEdits",
      "depends_on": [],
      "workspace": "/path/to/agent/workspace"
    }
  ]
}
```

### Complete Example

```json
{
  "name": "feature-implementation",
  "tasks": [
    {
      "id": "coder",
      "name": "Implement Feature",
      "prompt": "Implement user authentication with JWT tokens",
      "cwd": "/root/projects/my-app",
      "tools": ["Read", "Write", "Edit", "Bash", "Glob"],
      "permission_mode": "acceptEdits",
      "depends_on": [],
      "max_turns": null,
      "system_prompt": null,
      "env": {
        "NODE_ENV": "development"
      },
      "workspace": "/root/projects/weave/client/workspaces/coder",
      "agent_file": null,
      "env_context": "Dev Environment (local-wsl)\nProject path: /root/projects/my-app"
    },
    {
      "id": "tester",
      "name": "Run Tests",
      "prompt": "Run the test suite and verify all tests pass",
      "cwd": "/root/projects/my-app",
      "tools": ["Read", "Bash", "Glob"],
      "permission_mode": "acceptEdits",
      "depends_on": ["coder"],
      "workspace": "/root/projects/weave/client/workspaces/tester"
    },
    {
      "id": "reviewer",
      "name": "Review Changes",
      "prompt": "Review the code changes and provide feedback",
      "cwd": "/root/projects/my-app",
      "tools": ["Read", "Bash", "Glob"],
      "permission_mode": "acceptEdits",
      "depends_on": ["coder", "tester"],
      "workspace": "/root/projects/weave/client/workspaces/reviewer"
    }
  ]
}
```

---

## Task Fields

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier — used in `depends_on` |
| `name` | string | Human-readable name shown in the terminal |
| `prompt` | string | Instructions sent to the agent |
| `cwd` | string | Working directory (WSL path) |

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `tools` | array | `["Read", "Write", "Edit", "Bash", "Glob"]` | Tools available to the agent |
| `permission_mode` | string | `"acceptEdits"` | Permission mode for tool use |
| `depends_on` | array | `[]` | List of task IDs that must complete first |
| `max_turns` | number\|null | `null` | Max agent turns (null = unlimited) |
| `system_prompt` | string\|null | `null` | Override the agent system prompt |
| `env` | object | `{}` | Extra env vars for this task only |
| `workspace` | string\|null | `null` | Path to agent workspace directory |
| `agent_file` | string\|null | `null` | Path to .md file for agent instructions |
| `env_context` | string\|null | `null` | Environment context for prompt injection |

---

## Task Field Details

### `id` (Required)

Unique identifier for the task. Used in `depends_on` to specify dependencies.

```json
{
  "id": "coder"
}
```

### `name` (Required)

Human-readable name shown in terminal output.

```json
{
  "name": "Implement authentication middleware"
}
```

### `prompt` (Required)

Instructions sent to the agent. This is the main task description.

```json
{
  "prompt": "Implement JWT authentication middleware for the API. Include token validation, refresh logic, and error handling."
}
```

### `cwd` (Required)

Working directory where the agent will operate. This should be the project directory.

```json
{
  "cwd": "/root/projects/my-app"
}
```

**Important**: This is the project directory, not the agent workspace. See `workspace` field for agent workspace.

### `workspace` (Optional)

Path to the agent's workspace directory (contains `.claude/settings.local.json`).

```json
{
  "workspace": "/root/projects/weave/client/workspaces/coder"
}
```

**cwd vs workspace**:
- `cwd`: The project directory where code lives
- `workspace`: The agent's workspace directory with settings

### `tools` (Optional)

List of tools available to the agent. Default: `["Read", "Write", "Edit", "Bash", "Glob"]`

```json
{
  "tools": ["Read", "Write", "Edit", "Bash", "Glob", "AskUserQuestion"]
}
```

**Available Tools**:
- `Read` - Read files
- `Write` - Write files
- `Edit` - Edit files
- `Bash` - Execute bash commands
- `Glob` - File pattern matching
- `AskUserQuestion` - Ask user questions
- And more from Claude Agent SDK

### `permission_mode` (Optional)

Permission mode for tool use. Default: `"acceptEdits"`

```json
{
  "permission_mode": "acceptEdits"
}
```

**Values**:
- `acceptEdits` - Auto-approve all tool use
- `manual` - Require approval for tool use

### `depends_on` (Optional)

List of task IDs that must complete before this task can start. Default: `[]`

```json
{
  "depends_on": ["coder", "tester"]
}
```

This task will wait for both `coder` and `tester` tasks to complete before starting.

### `max_turns` (Optional)

Maximum number of agent turns. Default: `null` (unlimited)

```json
{
  "max_turns": 10
}
```

### `system_prompt` (Optional)

Override the agent's system prompt.

```json
{
  "system_prompt": "You are a senior backend developer focused on security and performance."
}
```

### `env` (Optional)

Extra environment variables for this task only.

```json
{
  "env": {
    "NODE_ENV": "development",
    "DEBUG": "true"
  }
}
```

### `agent_file` (Optional)

Path to a `.md` file that will be injected as the system prompt (like `CLAUDE.md`).

```json
{
  "agent_file": "/path/to/agent-instructions.md"
}
```

### `env_context` (Optional)

Environment context string for prompt injection.

```json
{
  "env_context": "Dev Environment (local-wsl)\nProject path: /root/projects/my-app"
}
```

---

## Execution Model

### Dependency Resolution

Tasks are organized into **waves** based on their dependencies:

1. **Wave 1**: Tasks with no dependencies
2. **Wave 2**: Tasks that depend only on Wave 1 tasks
3. **Wave 3**: Tasks that depend only on Wave 1 and Wave 2 tasks
4. **And so on...**

### Example Execution Order

Given this plan:

```json
{
  "name": "example",
  "tasks": [
    {
      "id": "coder",
      "depends_on": []
    },
    {
      "id": "tester",
      "depends_on": []
    },
    {
      "id": "reviewer",
      "depends_on": ["coder", "tester"]
    }
  ]
}
```

**Execution order:**

```
Wave 1: [coder, tester]    ← run in parallel
Wave 2: [reviewer]          ← runs after coder and tester complete
```

### Parallel Execution

Tasks in the same wave run in **parallel** (actually sequentially due to SDK anyio limitation, but conceptually parallel).

```
Wave 1: [coder, tester, documenter]  ← all start at the same time
```

### Sequential Execution

Tasks in different waves run **sequentially**:

```
Wave 1: [coder]          ← runs first
Wave 2: [tester]         ← runs after coder completes
Wave 3: [reviewer]       ← runs after tester completes
```

---

## Dry Run Mode

Preview the execution order without running agents:

```bash
python main.py plans/example.json --dry-run
```

**Output:**

```
Dry run: example
  Wave 1:
    [coder] Implement feature
         cwd: /root/projects/my-app
         tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob']
         (depends on: )
    [tester] Run tests
         cwd: /root/projects/my-app
         tools: ['Read', 'Bash', 'Glob']
         (depends on: )
  Wave 2:
    [reviewer] Review changes
         cwd: /root/projects/my-app
         tools: ['Read', 'Bash', 'Glob']
         (depends on: coder, tester)
```

---

## Plan Execution

### Standard Execution

Execute a plan from a file:

```bash
python main.py plans/example.json
```

### Daemon Execution

In daemon mode, plans are executed automatically when they appear in the API:

```bash
python main.py --daemon --server http://localhost:3001 --token YOUR_TOKEN
```

---

## Task Execution Flow

### 1. Task Initialization

For each task:
1. Load task configuration
2. Validate required fields
3. Set up environment variables
4. Initialize Claude Agent SDK

### 2. Agent Execution

1. Create agent with configured tools and permissions
2. Send prompt to agent
3. Agent executes tools based on prompt
4. Collect output and logs
5. Return results

### 3. Dependency Management

1. Resolve task dependencies
2. Organize tasks into waves
3. Execute each wave sequentially
4. Execute tasks within each wave in parallel

### 4. Error Handling

1. Capture task errors
2. Log error details
3. Continue with next task if possible
4. Report final status

---

## Advanced Features

### Context Passing

Tasks can pass context to dependent tasks through shared state:

```json
{
  "tasks": [
    {
      "id": "coder",
      "prompt": "Create a new API endpoint"
    },
    {
      "id": "tester",
      "prompt": "Test the API endpoint created in the previous task",
      "depends_on": ["coder"]
    }
  ]
}
```

The `tester` task can reference work done by the `coder` task.

### Structured Output

Tasks can produce structured output using special tags:

```json
{
  "prompt": "Generate a plan and output it in <plan>...</plan> tags"
}
```

The client will extract the structured output for further processing.

### Environment-Specific Context

Tasks can include environment context for better planning:

```json
{
  "env_context": "Dev Environment (local-wsl)\nProject path: /root/projects/my-app"
}
```

---

## Best Practices

### 1. Task Granularity

Keep tasks focused and atomic:
- ✅ Good: "Implement user authentication"
- ❌ Bad: "Implement the entire application"

### 2. Dependency Management

Use dependencies to enforce order:
- ✅ Good: `tester` depends on `coder`
- ❌ Bad: Assume tasks run in order automatically

### 3. Workspace Configuration

Always specify `workspace` for agent-specific settings:
- ✅ Good: `"workspace": "/path/to/agent/workspace"`
- ❌ Bad: Rely on default workspace

### 4. Tool Selection

Only include necessary tools:
- ✅ Good: `["Read", "Write", "Edit"]` for code changes
- ❌ Bad: Always include all tools

### 5. Error Handling

Design tasks to handle errors gracefully:
- ✅ Good: "Try to implement X, if Y fails, do Z"
- ❌ Bad: Assume everything works perfectly

---

## Common Patterns

### Pattern 1: Code → Test → Review

```json
{
  "tasks": [
    {
      "id": "coder",
      "name": "Implement Feature",
      "prompt": "Implement the feature"
    },
    {
      "id": "tester",
      "name": "Test Feature",
      "prompt": "Test the feature",
      "depends_on": ["coder"]
    },
    {
      "id": "reviewer",
      "name": "Review Feature",
      "prompt": "Review the implementation",
      "depends_on": ["coder", "tester"]
    }
  ]
}
```

### Pattern 2: Parallel Implementation

```json
{
  "tasks": [
    {
      "id": "frontend",
      "name": "Implement Frontend",
      "prompt": "Implement the frontend"
    },
    {
      "id": "backend",
      "name": "Implement Backend",
      "prompt": "Implement the backend"
    },
    {
      "id": "integrator",
      "name": "Integrate",
      "prompt": "Integrate frontend and backend",
      "depends_on": ["frontend", "backend"]
    }
  ]
}
```

### Pattern 3: Multi-Environment

```json
{
  "tasks": [
    {
      "id": "dev-deploy",
      "name": "Deploy to Dev",
      "prompt": "Deploy to development environment",
      "cwd": "/root/projects/my-app"
    },
    {
      "id": "dev-test",
      "name": "Test in Dev",
      "prompt": "Test in development environment",
      "depends_on": ["dev-deploy"]
    },
    {
      "id": "prod-deploy",
      "name": "Deploy to Production",
      "prompt": "Deploy to production",
      "depends_on": ["dev-test"]
    }
  ]
}
```

---

## Troubleshooting

### Circular Dependencies

**Error**: `Circular dependency or missing task`

**Cause**: Tasks depend on each other in a loop

**Solution**: Reorganize tasks to break the circular dependency

### Missing Tasks

**Error**: `Task not found: xyz`

**Cause**: Task ID in `depends_on` doesn't exist

**Solution**: Verify all task IDs in `depends_on` exist

### Invalid Working Directory

**Error**: `Working directory does not exist`

**Cause**: The `cwd` path doesn't exist

**Solution**: Verify the path is correct and exists

### Workspace Issues

**Error**: `Agent workspace not found`

**Cause**: The `workspace` path doesn't exist or is invalid

**Solution**: Verify the workspace path and that `.claude/settings.local.json` exists

---

## Related Documentation

- **README.md**: Agent client overview
- **DAEMON_MODE.md**: Daemon mode usage
- **ARCHITECTURE.md**: Architecture details
- **TESTING.md**: Testing documentation

---

**Last Updated**: 2026-03-16
**Version**: 1.0.0
**Status**: Production Ready ✅
