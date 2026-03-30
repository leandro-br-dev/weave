# weave

AI agent orchestration platform. Create, execute and monitor multi-agent workflows from your browser.

Built for developers who use Claude Code as the execution engine and want a structured way to manage complex plans with multiple specialized agents.

## Quick Start

```bash
git clone git@github.com:leandro-br-dev/weave.git
cd weave
npm run install:all
bash start.sh
```

Open **http://localhost:5173**

## Features

- **Plan builder** — create multi-task plans with dependencies via UI or JSON import/export
- **Projects & Environments** — organize work by project (e.g., MyApp, API-Backend...) and environment (dev/staging/ssh)
- **Agent management** — configure agents with CLAUDE.md, skills, sub-agents and permissions per environment
- **Live execution logs** — real-time SSE streaming while agents run
- **Approval queue** — pause execution and request human approval for sensitive operations
- **Daemon management** — start/stop the agent daemon directly from the Settings page
- **Execution history** — metrics and full history on the Workflows page

## Documentation

### Core Documentation
- **[User Guide](USER_GUIDE.md)** — comprehensive guide covering getting started, architecture, development setup, and UI patterns
- **[Architecture](architecture/ARCHITECTURE.md)** — system architecture, execution models, parallel execution, and component interactions
- **[Technical](architecture/TECHNICAL.md)** — implementation details, testing strategies, and verification reports

### Features & Guides
- **[Features](features/FEATURES.md)** — complete feature documentation including agents context, planning context, and auto-move
- **[Templates](features/TEMPLATES.md)** — Kanban template workflows documentation
- **[i18n](features/I18N.md)** — internationalization overview ([implementation details](../dashboard/docs/I18N_USAGE.md))
- **[Setup Guide](guides/SETUP.md)** — documentation enforcement and pre-commit hook setup
- **[Database & Environment](guides/DATABASE_ENV_SETUP.md)** — multi-environment database configuration
- **[Environment Variables](guides/ENVIRONMENT_VARIABLES.md)** — environment variables API reference
- **[Context Generation](guides/CONTEXT_GENERATION.md)** — project context generation feature guide
- **[Troubleshooting](guides/TROUBLESHOOTING.md)** — general troubleshooting guide

### Cloudflare
- **[Cloudflare Docs](cloudflare/)** — Cloudflare Tunnel setup, architecture, and troubleshooting
  - **[Quick Start](cloudflare/QUICKSTART.md)** — Setup guide (automated + manual)
  - **[Architecture](cloudflare/ARCHITECTURE.md)** — System architecture and security model
  - **[Troubleshooting](cloudflare/TROUBLESHOOTING.md)** — CORS issues, tunnel errors, firewall config

### Testing Documentation
- **[Testing Overview](testing/README.md)** — Quick start, testing stack, and documentation index
- **[Test Architecture](testing/TEST_ARCHITECTURE.md)** — Test directory structure, categories, and coverage
- **[Test Workflows](testing/TEST_WORKFLOWS.md)** — Development workflows, CI/CD pipeline, debugging
- **[Test Checklist](testing/TEST_CHECKLIST.md)** — Pre-commit, pre-PR, and pre-release checklists
- **[Test Writing Guide](testing/guides/TEST_WRITING_GUIDE.md)** — Best practices for writing tests

### Migrations
- **[Workflow Limits Migration](migrations/V027_WORKFLOW_LIMITS.md)** — V027 workflow limits migration

## Requirements

- Node.js 18+
- Python 3.11+
- [Claude Code CLI](https://docs.anthropic.com/claude-code) installed and authenticated

## System Overview

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

## Key Concepts

| Concept | Definition |
|---------|------------|
| **Project** | Logical grouping (e.g., MyApp, API-Backend) |
| **Environment** | Execution instance: dev/staging/prod, local/ssh |
| **Agent** | CLAUDE.md + .claude/ config folder (who executes) |
| **Working directory (cwd)** | Where project files are (what gets modified) |
| **Plan** | Named collection of tasks with dependencies |
| **Wave** | Group of tasks with no mutual dependencies (run in parallel) |

## Getting Started

1. **Start the platform**: `bash start.sh`
2. **Create a project** in the Projects page
3. **Add environments** (dev, staging, prod)
4. **Configure agents** in the Agents page
5. **Create plans** with tasks and dependencies
6. **Monitor execution** in real-time with live logs

## Project Structure

```
weave/
├── api/                    # Express.js backend
├── dashboard/              # React frontend
├── client/                 # Python daemon
├── projects/               # Agent workspaces (gitignored)
├── docs/                   # Documentation (this folder)
└── start.sh                # Unified start script
```

## License

MIT
