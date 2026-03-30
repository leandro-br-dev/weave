# Agent Client Documentation

## Overview

The Agent Client (`agent-orchestrator`) is a Python-based execution engine that runs multi-agent plans locally via the **Claude Agent SDK**. Each task in a plan maps to one Claude Code agent session, with support for dependency management, parallel execution, and live terminal output.

### Key Capabilities

- **Multi-Agent Orchestration**: Execute complex workflows with multiple specialized agents
- **Dependency Management**: Automatic task ordering based on dependencies
- **Parallel Execution**: Run independent tasks simultaneously in waves
- **Live Output Streaming**: Real-time terminal output during execution
- **Daemon Mode**: Continuous polling and execution of plans from a central API
- **Kanban Integration**: Automatic plan generation from kanban tasks

### What It Does

1. **Plan Execution**: Reads JSON plan files and executes tasks using Claude Agent SDK
2. **Daemon Mode**: Continuously polls for pending plans and executes them
3. **Kanban Pipeline**: Automatically generates execution plans from kanban tasks
4. **Log Streaming**: Sends execution logs to the central API in real-time
5. **Error Handling**: Comprehensive error handling and recovery

---

## Prerequisites

- **Python 3.10+**: Required for the client application
- **Node.js 18+**: Required internally by the Claude Agent SDK
- **Claude Code CLI**: Install via `curl -fsSL https://claude.ai/install.sh | bash`

---

## Installation

```bash
cd /root/projects/weave/client
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Dependencies

Key dependencies include:
- `claude-agent-sdk`: Claude Agent SDK for agent execution
- `anyio`: Async/await library for concurrent execution
- `httpx`: HTTP client for API communication
- `pytest`: Testing framework

---

## Quick Start

### 1. Standard Mode - Run a Plan File

Execute a plan from a local JSON file:

```bash
python main.py plans/example.json
```

### 2. Dry Run Mode - Preview Execution

Preview the execution order without running agents:

```bash
python main.py plans/example.json --dry-run
```

### 3. Daemon Mode - Continuous Execution

Run as a daemon, polling the API for pending plans:

```bash
python main.py --daemon --server http://localhost:3001 --token YOUR_TOKEN
```

Or using environment variables:

```bash
export WEAVE_URL="http://localhost:3001"
export WEAVE_TOKEN="your-token-here"
python main.py --daemon
```

---

## Usage Examples

### Example 1: Simple Plan Execution

```bash
# Run a plan from file
python main.py plans/my-plan.json

# Preview the execution order
python main.py plans/my-plan.json --dry-run
```

### Example 2: Daemon with Configuration

```bash
# Start daemon with explicit configuration
python main.py --daemon \
  --server http://localhost:3001 \
  --token dev-token-change-in-production

# Start daemon with environment variables
export WEAVE_URL="http://localhost:3001"
export WEAVE_TOKEN="your-token-here"
python main.py --daemon
```

### Example 3: Custom API Endpoint

```bash
# Export custom endpoint environment variables
export ANTHROPIC_BASE_URL=http://your-custom-endpoint
export ANTHROPIC_API_KEY=your-api-key

# The SDK will automatically use these
python main.py plans/my-plan.json
```

---

## Project Structure

```
client/
├── main.py                    # CLI entry point and daemon loop
├── requirements.txt           # Python dependencies
├── plans/                     # Example plan files
│   └── example.json
├── orchestrator/              # Core orchestration logic
│   ├── plan.py               # Plan loader and dependency resolver
│   ├── runner.py             # Agent execution via SDK
│   ├── logger.py             # Colored terminal output
│   ├── daemon_client.py      # HTTP client for API communication
│   ├── kanban_pipeline.py    # Kanban task processing
│   └── chat_runner.py        # Chat session execution
└── docs/                      # Documentation (this file)
    ├── README.md             # This file
    ├── DAEMON_MODE.md        # Daemon mode documentation
    ├── PLAN_EXECUTION.md     # Plan format and execution
    ├── ARCHITECTURE.md       # Architecture details
    └── TESTING.md            # Testing documentation
```

---

## Core Concepts

### Plans

A **plan** is a JSON file that defines a multi-agent workflow:

```json
{
  "name": "plan-name",
  "tasks": [
    {
      "id": "coder",
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

See **PLAN_EXECUTION.md** for complete plan format documentation.

### Execution Model

Tasks are organized into **waves** based on dependencies:
- **Wave 1**: Tasks with no dependencies run in parallel
- **Wave 2**: Tasks that depend on Wave 1 tasks run in parallel
- **And so on...**

Example:
```
Wave 1: [coder, tester]      ← no dependencies, run in parallel
Wave 2: [reviewer]           ← depends on coder and tester
```

### Daemon Mode

In daemon mode, the client:
1. Polls the API every 5 seconds for pending plans
2. Executes plans using the standard execution engine
3. Streams logs back to the API in real-time
4. Processes kanban tasks automatically

See **DAEMON_MODE.md** for complete daemon documentation.

---

## Key Features

### 1. Multi-Agent Coordination

- Execute multiple agents in a single workflow
- Automatic dependency resolution
- Parallel execution of independent tasks
- Context passing between dependent tasks

### 2. Live Output Streaming

- Real-time terminal output during execution
- Colored logging for better readability
- Log streaming to API in daemon mode

### 3. Error Handling

- Comprehensive error handling at all levels
- Graceful degradation on failures
- Detailed error messages and logging

### 4. Flexible Configuration

- CLI flags and environment variables
- Per-task configuration (cwd, tools, env)
- Support for custom system prompts

### 5. Kanban Integration

- Automatic plan generation from kanban tasks
- Integration with planning agents
- Workflow creation and linking

---

## Configuration

### CLI Flags

| Flag | Description | Default |
|------|-------------|---------|
| `plan` | Path to plan JSON file | Required (unless --daemon) |
| `--dry-run` | Preview execution without running | False |
| `--daemon` | Run in daemon mode | False |
| `--server` | API server URL | `http://localhost:3001` |
| `--token` | Bearer token for authentication | Required for daemon |

### Environment Variables

| Variable | Description | Overrides |
|----------|-------------|-----------|
| `WEAVE_URL` | API server URL | `--server` flag takes precedence |
| `WEAVE_TOKEN` | Bearer token | `--token` flag takes precedence |
| `ANTHROPIC_BASE_URL` | Custom API endpoint URL | Passed to SDK |
| `ANTHROPIC_API_KEY` | API key | Passed to SDK |

---

## Architecture

The agent client follows a modular architecture:

- **main.py**: CLI entry point and daemon loop
- **orchestrator/plan.py**: Plan loading and dependency resolution
- **orchestrator/runner.py**: Agent execution via Claude Agent SDK
- **orchestrator/daemon_client.py**: HTTP client for API communication
- **orchestrator/kanban_pipeline.py**: Kanban task processing
- **orchestrator/chat_runner.py**: Chat session execution

See **ARCHITECTURE.md** for complete architecture documentation.

---

## Testing

Run the test suite:

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=orchestrator

# Run specific test file
pytest tests/test_daemon_client.py

# Run with verbose output
pytest -v
```

See **TESTING.md** for complete testing documentation.

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

### High memory usage

**Cause**: Long-running tasks or memory leaks

**Solution**:
- Restart the daemon periodically
- Monitor resource usage with `top` or `htop`
- Implement maximum execution time per plan

---

## Related Documentation

- **DAEMON_MODE.md**: Daemon mode usage and configuration
- **PLAN_EXECUTION.md**: Plan format and execution model
- **ARCHITECTURE.md**: Architecture and implementation details
- **TESTING.md**: Testing and verification

---

## Additional Resources

- **Claude Agent SDK**: [Official Documentation](https://docs.anthropic.com/claude-agent-sdk)
- **weave API**: See `/api/docs` for API documentation
- **Dashboard**: See `/dashboard/docs` for dashboard documentation

---

**Last Updated**: 2026-03-16
**Version**: 1.0.0
**Status**: Production Ready ✅
