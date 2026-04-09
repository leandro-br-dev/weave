# Weave API Documentation

## Overview

The Weave API is a RESTful API built with Express.js and TypeScript that provides comprehensive management capabilities for AI agents, projects, workflows, and execution plans. It serves as the central backend for the Weave platform.

## Quick Start

### Base URL
```
http://localhost:3000/api
```

### Authentication
All endpoints require Bearer token authentication:
```bash
Authorization: Bearer <your-token>
```

Default development token: `dev-token-change-in-production`

Configure via environment variable: `API_BEARER_TOKEN`

### Health Check
```bash
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "message": "Weave API is running"
}
```

## API Endpoints Summary

### Core Resources

| Resource | Base Path | Description |
|----------|-----------|-------------|
| **Plans** | `/api/plans` | Manage execution plans and workflows |
| **Workspaces** | `/api/workspaces` | Manage agent workspaces and configurations |
| **Projects** | `/api/projects` | Manage projects and environments |
| **Approvals** | `/api/approvals` | Handle approval requests for tool usage |
| **Kanban** | `/api/kanban` | Kanban task management |
| **Daemon** | `/api/daemon` | Daemon process control |
| **Sessions** | `/api/sessions` | Chat session management |
| **Native Skills** | `/api/native-skills` | Native skill library |
| **Marketplace** | `/api/marketplace` | Skills and agents marketplace |
| **Quick Actions** | `/api/quick-actions` | Quick action templates |

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "data": <response_data>,
  "error": null
}
```

### Error Response
```json
{
  "data": null,
  "error": "<error_message>"
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

## Key Features

### 1. Plans & Workflows
- Create and manage execution plans
- Support for task dependencies
- Real-time log streaming via SSE
- Plan approval workflow
- Structured output support

### 2. Workspace Management
- Create and configure agent workspaces
- Role-based agent assignments (planner, coder, reviewer, etc.)
- Model selection per workspace
- Environment linking
- Skills and agents management

### 3. Project Management
- Multi-project support
- Environment configuration (local-wsl, SSH)
- Agent-to-project linking
- Project-specific settings

### 4. Kanban Integration
- Visual task management
- Auto-move based on business rules
- Template-based task creation
- Recurring task support
- Pipeline status tracking

### 5. Approval System
- Tool usage approval workflow
- Timeout handling (configurable)
- Real-time approval polling

### 6. Chat Sessions
- Interactive chat with agents
- Message history
- Session management
- Real-time streaming via SSE

### 7. Marketplace
- Search GitHub repositories
- Browse skillsmp.com
- Preview skill contents
- Install skills to workspaces

## Database

The API uses SQLite with better-sqlite3 for data persistence. Database file: `api/data/database.db`

### Key Tables
- `plans` - Execution plans
- `projects` - Projects
- `environments` - Project environments
- `workspaces` - Agent workspaces
- `kanban_tasks` - Kanban tasks
- `approvals` - Approval requests
- `chat_sessions` - Chat sessions
- `chat_messages` - Chat messages

## Authentication

### Bearer Token
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/plans
```

### Query Parameter (for SSE)
```bash
http://localhost:3000/api/plans/:id/logs/stream?token=<token>
```

## Real-time Features

### Server-Sent Events (SSE)

The API supports real-time updates via SSE:

1. **Plan Logs Streaming**
   ```
   GET /api/plans/:id/logs/stream
   ```

2. **Chat Session Streaming**
   ```
   GET /api/sessions/:id/stream
   ```

## Getting Started

### 1. Install Dependencies
```bash
cd api
npm install
```

### 2. Configure Environment
```bash
export API_BEARER_TOKEN="your-secret-token"
export PORT=3000
export WEAVE_TOKEN="your-token"
```

### 3. Start the Server
```bash
npm run dev
```

### 4. Make Your First Request
```bash
curl -H "Authorization: Bearer dev-token-change-in-production" \
  http://localhost:3000/api/health
```

## Documentation Structure

- **[ENDPOINTS.md](./ENDPOINTS.md)** - Complete API endpoint reference
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and data models
- **[IMPLEMENTATION.md](./IMPLEMENTATION.md)** - Implementation details and patterns
- **[TESTING.md](./TESTING.md)** - Testing guide and coverage

## Additional Resources

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | API server port |
| `API_BEARER_TOKEN` | `dev-token-change-in-production` | Authentication token |
| `WEAVE_TOKEN` | `dev-token-change-in-production` | Manager token for daemon |
| `APPROVAL_TIMEOUT_MINUTES` | `10` | Approval timeout in minutes |
| `PLAN_TIMEOUT_MINUTES` | `120` | Plan execution timeout in minutes (must match client's PLAN_TIMEOUT_SECONDS/60) |
| `TEAMS_BASE_PATH` | `~/.local/share/weave/projects` | Base path for team workspaces |

### CORS Configuration
The API supports CORS for:
- `localhost:*` (any port)
- Domains from `ALLOWED_ORIGINS` environment variable

## Support

For detailed endpoint documentation, see [ENDPOINTS.md](./ENDPOINTS.md).

For architecture and data models, see [ARCHITECTURE.md](./ARCHITECTURE.md).

For implementation details, see [IMPLEMENTATION.md](./IMPLEMENTATION.md).

For testing information, see [TESTING.md](./TESTING.md).
