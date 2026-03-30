# weave

AI agent orchestration platform. Create, execute and monitor multi-agent workflows directly from your browser — powered by Claude Code.

Built for developers who want a structured way to run complex autonomous tasks using specialized agents, with full visibility into what's happening and control over when to intervene.

---

## What it does

You describe a task. The platform generates an execution plan, assigns it to the right agents, runs it autonomously, and reports back. You can watch it happen live, approve sensitive steps, or let it run completely unattended.

The core loop:

```
Task (Kanban) → Planning Agent → Workflow → Coder/Reviewer Agents → Done
```

Everything is orchestrated through a daemon that polls for work, executes plans using the Claude Code SDK, and streams logs back to the UI in real time.

---

## Features

### Workflows
- Multi-task plans with explicit dependencies and parallel execution
- Visual plan builder via UI or JSON import/export
- Real-time execution logs via SSE streaming
- Force stop, resume, and manual approval for any plan
- Export plans to JSON for reuse

### Kanban Board
- Task management with Backlog → Planning → In Progress → Done columns
- Automatic pipeline: tasks in **Planning** trigger the planning agent, which generates and starts a workflow
- Auto-approve mode per project — fully autonomous or human-in-the-loop
- Task templates for recurring work
- Scheduled tasks with cron expressions (daily, weekly, monthly or custom)
- Auto-move: pulls next priority task from backlog automatically

### Agents
- Create agents with custom CLAUDE.md, skills, model selection, and permissions
- Roles: `planner`, `coder`, `reviewer`, `tester`, `debugger`, `devops`, `generic`
- Per-agent model selection: assign Opus to planners, Sonnet to coders
- Generate contextual agents from project analysis (analyzes stack, conventions, writes CLAUDE.md)
- Improve any CLAUDE.md with AI — reviews and proposes changes with approval flow
- Marketplace: browse and install skills from GitHub repositories

### Projects & Environments
- Organize work by project with linked agents and environments
- Environment types: local-wsl, local-windows, ssh
- Context injection: planning agents automatically receive the list of available agents and their roles
- Per-project settings: auto-approve, max concurrent tasks

### Chat
- Persistent chat sessions with any agent
- Agents remember context across messages via session IDs
- Chat responses containing `<plan>` blocks are detected and offered as one-click workflows

### Approvals
- Tool-level approvals (pause execution and ask before risky bash commands)
- Workflow-level approvals for generated plans before execution

### Settings & Operations
- Daemon start/stop from the UI with live status
- Agent daemon with parallel plan execution
- Automatic retry and graceful shutdown on interrupt
- Port conflict detection: kills stale processes or migrates to free port automatically

---

## Architecture

```
dashboard/          React 19 + TypeScript + Vite + Tailwind (port 5173)
api/                Express + SQLite — REST API (port 3000)
client/             Python daemon — executes plans via Claude Code SDK
  orchestrator/
    runner.py       Executes workflow tasks, streams logs
    chat_runner.py  Handles chat session turns
    kanban_pipeline.py  Monitors kanban, triggers planning, syncs status
    daemon_client.py    HTTP client for the API
```
```

Agent workspaces live outside the repository in the user's home directory:

```
~/.local/share/weave/projects/
  {project-slug}/
    agents/
      {agent-name}/
        CLAUDE.md
        .claude/
          settings.local.json
          skills/
```

---

## Quick Start

**WSL / Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/leandro-br-dev/weave/main/install.sh | bash
```

**Windows** (requires WSL):
```
irm https://raw.githubusercontent.com/leandro-br-dev/weave/main/install.ps1 | iex
```

Open **http://localhost:5173**

---

## Requirements

- Node.js 18+
- Python 3.11+
- [Claude Code CLI](https://docs.anthropic.com/claude-code) installed and authenticated
- Git

---

## Configuration

Copy `.env.example` to `.env` and adjust:

```bash
# Authentication
WEAVE_TOKEN=your-secret-token-here

# Ports (auto-resolved if in use by another app)
PORT=3000
DASHBOARD_PORT=5173

# Agent workspace location (default: ~/.local/share/weave/projects)
AGENTS_BASE_PATH=~/.local/share/weave/projects

# Timeouts
PLAN_TIMEOUT_SECONDS=7200
```

---

## Cloudflare Tunnel (Internet Access)

Expose your weave to the internet using Cloudflare Tunnel - no port forwarding or public IP required.

### Quick Setup

```bash
bash scripts/cloudflare-tunnel.sh
```

This will:
- Install and configure `cloudflared`
- Create DNS records: `weave.your-domain.com` and `api-weave.your-domain.com`
- Generate secure tunnel token
- Update your `.env` file automatically

Then start as usual:

```bash
bash start.sh
```

Your instance will be accessible at:
- **Dashboard**: https://weave.your-domain.com
- **API**: https://api-weave.your-domain.com

### Benefits

- ✅ No router configuration (no port forwarding)
- ✅ Automatic SSL/TLS encryption
- ✅ DDoS protection via Cloudflare
- ✅ Works from anywhere
- ✅ No public IP needed

### Documentation

See [CLOUDFLARE_QUICKSTART.md](CLOUDFLARE_QUICKSTART.md) for quick start or [docs/CLOUDFLARE_TUNNEL.md](docs/CLOUDFLARE_TUNNEL.md) for complete documentation.

**Having issues?** Check [docs/CLOUDFLARE_TUNNEL_TROUBLESHOOTING.md](docs/CLOUDFLARE_TUNNEL_TROUBLESHOOTING.md) for common problems and solutions.

---

## Updating

```bash
bash update.sh
```

Shows pending commits before asking to apply. Reinstalls only changed dependencies.

---

## Testing

Tests use an isolated database (`database.test.db`) that is never the production database.

```bash
# Run all tests
npm run test:all

# Python tests only
cd client && pytest

# API tests only
cd api && npm test

# Dashboard tests only
cd dashboard && npm test
```

---

## Documentation

### Project Documentation
- `docs/ARCHITECTURE.md` — system design and execution models
- `docs/USER_GUIDE.md` — getting started, UI walkthrough
- `docs/TROUBLESHOOTING.md` — common issues with daemon, API, timeouts

### Testing Documentation
- `docs/testing/README.md` — testing overview and setup
- `docs/testing/TEST_ARCHITECTURE.md` — test architecture and structure
- `docs/testing/TEST_WORKFLOWS.md` — testing workflows and procedures
- `docs/testing/TEST_CHECKLIST.md` — testing checklist and best practices
- `docs/testing/guides/TEST_WRITING_GUIDE.md` — guide for writing tests
- `docs/testing/reports/` — test execution reports and coverage data
- `docs/testing/logs/` — historical test logs (archived)

---

## License

MIT