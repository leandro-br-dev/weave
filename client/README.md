# agent-orchestrator

Runs multi-agent plans locally via the **Claude Agent SDK**.  
Each task maps to one Claude Code agent session — with dependency management, parallel execution, and live terminal output.

---

## Prerequisites

- Python 3.10+
- Node.js 18+ (required by the Claude Agent SDK internally)
- Claude Code CLI installed: `curl -fsSL https://claude.ai/install.sh | bash`

---

## Installation

```bash
cd agent-orchestrator
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## Usage

```bash
# Run a plan
python main.py plans/example.json

# Preview execution order without running agents
python main.py plans/example.json --dry-run
```

---

## Plan format

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
      "max_turns": null,
      "system_prompt": null,
      "env": {}
    },
    {
      "id": "reviewer",
      "name": "Review PR",
      "prompt": "Review the changes and open a PR",
      "cwd": "/path/to/workspace-review",
      "tools": ["Read", "Bash", "Glob"],
      "permission_mode": "acceptEdits",
      "depends_on": ["coder"]
    }
  ]
}
```

### Task fields

| Field | Required | Description |
|---|---|---|
| `id` | ✅ | Unique identifier — used in `depends_on` |
| `name` | ✅ | Human-readable name shown in the terminal |
| `prompt` | ✅ | Instructions sent to the agent |
| `cwd` | ✅ | Working directory (WSL path) |
| `tools` | ❌ | Defaults to `["Read", "Write", "Edit", "Bash", "Glob"]` |
| `permission_mode` | ❌ | Defaults to `acceptEdits` (auto-approve) |
| `depends_on` | ❌ | List of task IDs that must complete first |
| `max_turns` | ❌ | Max agent turns (null = unlimited) |
| `system_prompt` | ❌ | Override the agent system prompt |
| `env` | ❌ | Extra env vars for this task only |

### Execution model

Tasks without dependencies run in **wave 1**. Tasks whose dependencies are in wave 1 run in **wave 2**, and so on. Tasks in the same wave run **in parallel**.

```
Wave 1: [coder]          ← no dependencies
Wave 2: [reviewer]       ← depends on coder
```

---

## Project structure

```
agent-orchestrator/
├── main.py                  # CLI entry point
├── requirements.txt
├── plans/
│   └── example.json         # Example plan
└── orchestrator/
    ├── plan.py              # Plan loader and dependency resolver
    ├── runner.py            # Agent execution via SDK
    └── logger.py            # Colored terminal output
```
