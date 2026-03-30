# API Endpoints Reference

Complete documentation of all API endpoints with examples.

## Table of Contents

- [Plans](#plans)
- [Workspaces](#workspaces)
- [Projects](#projects)
- [Approvals](#approvals)
- [Kanban](#kanban)
- [Templates](#templates)
- [Daemon](#daemon)
- [Chat Sessions](#chat-sessions)
- [Native Skills](#native-skills)
- [Marketplace](#marketplace)
- [Quick Actions](#quick-actions)

---

## Plans

Execution plans and workflow management.

### GET /api/plans

List all plans, optionally filtered by project.

**Query Parameters:**
- `project_id` (optional) - Filter by project ID

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Plan name",
      "tasks": [...],
      "status": "pending|running|success|failed",
      "client_id": null,
      "result": null,
      "started_at": null,
      "completed_at": null,
      "created_at": "2025-01-01T00:00:00.000Z",
      "project_id": "uuid"
    }
  ],
  "error": null
}
```

### POST /api/plans

Create a new execution plan.

**Request Body:**
```json
{
  "name": "Plan name",
  "tasks": [
    {
      "id": "task-1",
      "name": "Task name",
      "prompt": "Task prompt",
      "cwd": "/working/directory",
      "workspace": "/workspace/path",
      "tools": ["Read", "Write", "Bash"],
      "permission_mode": "acceptEdits",
      "depends_on": []
    }
  ],
  "project_id": "uuid",
  "status": "pending"
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "id": "uuid",
    "name": "Plan name",
    "tasks": [...],
    "status": "pending",
    "created_at": "2025-01-01T00:00:00.000Z"
  },
  "error": null
}
```

### GET /api/plans/pending

Get pending plans for client polling.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Pending plan",
      "tasks": [...],
      "status": "pending",
      "created_at": "2025-01-01T00:00:00.000Z"
    }
  ],
  "error": null
}
```

### GET /api/plans/metrics

Get global plan statistics.

**Response:**
```json
{
  "data": {
    "total": 100,
    "by_status": {
      "pending": 10,
      "running": 5,
      "success": 80,
      "failed": 5
    },
    "success_rate": 94.12,
    "avg_duration_seconds": 245.5,
    "last_7_days": {
      "success": 45,
      "failed": 2
    }
  },
  "error": null
}
```

### GET /api/plans/:id

Get plan details with log count.

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "name": "Plan name",
    "tasks": [...],
    "status": "running",
    "log_count": 25,
    "structured_output": {},
    "created_at": "2025-01-01T00:00:00.000Z"
  },
  "error": null
}
```

### PUT /api/plans/:id

Edit a plan (only pending or awaiting_approval).

**Request Body:**
```json
{
  "name": "Updated plan name",
  "tasks": [...]
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "name": "Updated plan name",
    "tasks": [...],
    "status": "pending"
  },
  "error": null
}
```

### POST /api/plans/:id/approve

Approve a plan (awaiting_approval → pending).

**Response:** `200 OK`
```json
{
  "data": {
    "id": "uuid",
    "status": "pending"
  },
  "error": null
}
```

### POST /api/plans/:id/start

Start a plan execution.

**Request Body:**
```json
{
  "client_id": "client-uuid"
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "id": "uuid",
    "status": "running",
    "client_id": "client-uuid",
    "started_at": "2025-01-01T00:00:00.000Z"
  },
  "error": null
}
```

### POST /api/plans/:id/complete

Complete a plan execution.

**Request Body:**
```json
{
  "status": "success|failed",
  "result": "Execution result",
  "result_status": "success|partial|needs_rework",
  "result_notes": "Optional notes",
  "structured_output": {}
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "id": "uuid",
    "status": "success",
    "result": "Execution result",
    "completed_at": "2025-01-01T00:01:00.000Z"
  },
  "error": null
}
```

### POST /api/plans/:id/logs

Append log entries to a plan.

**Request Body:**
```json
[
  {
    "task_id": "task-1",
    "level": "info|warn|error|debug",
    "message": "Log message"
  }
]
```

**Response:** `200 OK`
```json
{
  "data": {
    "inserted": 5
  },
  "error": null
}
```

### GET /api/plans/:id/logs

Get all log entries for a plan.

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "plan_id": "uuid",
      "task_id": "task-1",
      "level": "info",
      "message": "Log message",
      "created_at": "2025-01-01T00:00:00.000Z"
    }
  ],
  "error": null
}
```

### GET /api/plans/:id/logs/stream

SSE endpoint for real-time log streaming.

**Authentication:** Use `token` query parameter

**Response:** Server-Sent Events stream
```
data: {"id":1,"plan_id":"uuid","task_id":"task-1","level":"info","message":"Log message","created_at":"2025-01-01T00:00:00.000Z"}

event: status
data: {"status":"running"}

event: done
data: {"status":"success"}
```

### POST /api/plans/:id/execute

Re-queue a failed or stuck plan for execution.

**Response:** `200 OK`
```json
{
  "data": {
    "id": "uuid",
    "status": "pending"
  },
  "error": null
}
```

### POST /api/plans/:id/force-stop

Force stop a running or pending plan.

**Response:** `200 OK`
```json
{
  "data": {
    "stopped": true
  },
  "error": null
}
```

### POST /api/plans/:id/resume

Resume a failed plan from where it left off.

**Response:** `200 OK`
```json
{
  "data": {
    "success": true,
    "message": "Plan queued for resume"
  },
  "error": null
}
```

### POST /api/plans/:id/reset

Reset a running plan back to pending (for daemon recovery).

**Response:** `200 OK`
```json
{
  "data": {
    "reset": true
  },
  "error": null
}
```

### POST /api/plans/:id/heartbeat

Send a heartbeat signal for a running plan to indicate the daemon is still active.

**Request**:
- Headers: `Authorization: Bearer <token>`
- Params: `id` - Plan ID
- Body: None

**Response:** `200 OK`
```json
{
  "data": {
    "heartbeat_at": "2025-01-19T10:30:00.000Z"
  },
  "error": null
}
```

**Error Responses**:
- `404`: Plan not found
- `400`: Plan is not in running status

**Notes**:
- Daemon sends heartbeats every 30 seconds during plan execution
- API uses `last_heartbeat_at` timestamp to detect stuck plans
- Falls back to `started_at` if no heartbeat has been sent

### GET /api/plans/approaching-timeout

Get plans that are nearing their timeout threshold (80% of configured timeout).

**Request**:
- Headers: `Authorization: Bearer <token>`
- Query params: None

**Response:** `200 OK`
```json
{
  "data": {
    "count": 2,
    "plans": [
      {
        "id": "...",
        "name": "Long Running Plan",
        "status": "running",
        "started_at": "2025-01-19T08:00:00.000Z",
        "last_heartbeat_at": "2025-01-19T09:45:00.000Z",
        "minutes_running": 105.5,
        "timeout_in_minutes": 14.5
      }
    ]
  },
  "error": null
}
```

**Notes**:
- Returns only plans with status 'running'
- Threshold is 80% of `PLAN_TIMEOUT_MINUTES`
- Ordered by `started_at` ASC (oldest first)
- Used for monitoring and alerting

### DELETE /api/plans/:id

Delete a plan (cannot delete running plans).

**Response:** `200 OK`
```json
{
  "data": {
    "deleted": true
  },
  "error": null
}
```

### POST /api/plans/:id/structured-output

Save structured output from quick actions.

**Request Body:**
```json
{
  "output": {
    "key": "value"
  }
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "saved": true
  },
  "error": null
}
```

---

## Workspaces

Agent workspace management.

### GET /api/workspaces

List all workspaces, optionally filtered by project.

**Query Parameters:**
- `project_id` (optional) - Filter by project ID

**Response:**
```json
{
  "data": [
    {
      "id": "base64url_encoded_path",
      "name": "workspace-name",
      "path": "/full/path/to/workspace",
      "exists": true,
      "hasSettings": true,
      "hasClaude": true,
      "baseUrl": "http://localhost:8083",
      "type": "agent|env-agent|legacy",
      "project_id": "uuid",
      "role": "coder",
      "model": "claude-sonnet-4-6"
    }
  ],
  "error": null
}
```

### GET /api/workspaces/templates

List available workspace templates.

**Response:**
```json
{
  "data": [
    {
      "id": "generic",
      "label": "Generic Agent",
      "description": "A versatile agent for general tasks"
    },
    {
      "id": "frontend",
      "label": "Frontend Specialist",
      "description": "Specialized in frontend development"
    }
  ],
  "error": null
}
```

### GET /api/workspaces/:id

Get workspace details.

**Response:**
```json
{
  "data": {
    "id": "base64url_encoded_id",
    "name": "workspace-name",
    "path": "/full/path/to/workspace",
    "exists": true,
    "claudeMd": "# Workspace context...",
    "settings": {
      "$schema": "...",
      "env": {...},
      "permissions": {...}
    },
    "skills": [
      {
        "name": "skill-name",
        "hasSkillMd": true
      }
    ],
    "agents": [
      {
        "name": "agent-name",
        "file": "agent-name.md"
      }
    ],
    "environments": [
      {
        "id": "uuid",
        "name": "dev",
        "type": "local-wsl",
        "project_path": "/path/to/project"
      }
    ],
    "project_id": "uuid",
    "role": "coder",
    "model": "claude-sonnet-4-6"
  },
  "error": null
}
```

### POST /api/workspaces

Create a new workspace.

**Request Body:**
```json
{
  "name": "workspace-name",
  "project_path": "/path/to/project",
  "anthropic_base_url": "http://localhost:8083",
  "project_id": "uuid",
  "template_id": "frontend"
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "id": "base64url_encoded_path",
    "path": "/full/path/to/workspace",
    "name": "workspace-name",
    "project_id": "uuid"
  },
  "error": null
}
```

### PUT /api/workspaces/:id

Update workspace properties (model, role, etc).

**Request Body:**
```json
{
  "role": "coder",
  "model": "claude-sonnet-4-6"
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "id": "base64url_encoded_id",
    "workspace_path": "/full/path/to/workspace",
    "role": "coder",
    "model": "claude-sonnet-4-6"
  },
  "error": null
}
```

### PUT /api/workspaces/:id/role

Update workspace role.

**Request Body:**
```json
{
  "role": "planner|coder|reviewer|tester|debugger|devops|generic"
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "role": "coder"
  },
  "error": null
}
```

### PUT /api/workspaces/:id/model

Update workspace model.

**Request Body:**
```json
{
  "model": "default|claude-opus-4-6|claude-sonnet-4-6|claude-haiku-4-5-20251001"
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "model": "claude-sonnet-4-6"
  },
  "error": null
}
```

### PUT /api/workspaces/:id/claude-md

Update CLAUDE.md content.

**Request Body:**
```json
{
  "content": "# Claude context\\n\\nWorkspace instructions..."
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "saved": true
  },
  "error": null
}
```

### PUT /api/workspaces/:id/settings

Update settings.local.json.

**Request Body:**
```json
{
  "settings": {
    "$schema": "...",
    "env": {...},
    "permissions": {...}
  }
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "saved": true
  },
  "error": null
}
```

### DELETE /api/workspaces/:id

Delete a workspace.

**Response:** `200 OK`
```json
{
  "data": {
    "deleted": true,
    "workspace_path": "/full/path/to/workspace"
  },
  "error": null
}
```

### GET /api/workspaces/:id/skills/:skill

Get skill content.

**Response:**
```json
{
  "data": {
    "name": "skill-name",
    "content": "# Skill\\n\\nSkill description..."
  },
  "error": null
}
```

### POST /api/workspaces/:id/skills

Install a skill.

**Request Body:**
```json
{
  "name": "skill-name",
  "content": "# Skill\\n\\nSkill content..."
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "name": "skill-name",
    "installed": true
  },
  "error": null
}
```

### DELETE /api/workspaces/:id/skills/:skill

Delete a skill.

**Response:** `200 OK`
```json
{
  "data": {
    "deleted": true
  },
  "error": null
}
```

### GET /api/workspaces/:id/agents/:agent

Get agent .md content.

**Response:**
```json
{
  "data": {
    "name": "agent-name",
    "content": "# Agent\\n\\nAgent configuration..."
  },
  "error": null
}
```

### PUT /api/workspaces/:id/agents/:agent

Create or update agent .md.

**Request Body:**
```json
{
  "content": "# Agent\\n\\nAgent configuration..."
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "saved": true
  },
  "error": null
}
```

### DELETE /api/workspaces/:id/agents/:agent

Delete agent .md.

**Response:** `200 OK`
```json
{
  "data": {
    "deleted": true
  },
  "error": null
}
```

### GET /api/workspaces/:id/environments

List linked environments.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "dev",
      "type": "local-wsl",
      "project_path": "/path/to/project",
      "project_name": "project-name"
    }
  ],
  "error": null
}
```

### POST /api/workspaces/:id/environments

Link an environment.

**Request Body:**
```json
{
  "environment_id": "uuid"
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "linked": true
  },
  "error": null
}
```

### DELETE /api/workspaces/:id/environments

Unlink an environment.

**Request Body:**
```json
{
  "environment_id": "uuid"
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "unlinked": true
  },
  "error": null
}
```

### POST /api/workspaces/:id/native-skills/:skillId

Link a native skill.

**Response:** `201 Created`
```json
{
  "data": {
    "installed": true,
    "path": "/full/path/to/skill"
  },
  "error": null
}
```

### DELETE /api/workspaces/:id/native-skills/:skillId

Remove a native skill.

**Response:** `200 OK`
```json
{
  "data": {
    "removed": true
  },
  "error": null
}
```

---

## Projects

Project and environment management.

### GET /api/projects

List all projects.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "project-name",
      "description": "Project description",
      "settings": {...},
      "environments": [...],
      "agent_paths": ["/path/to/agent1", "/path/to/agent2"]
    }
  ],
  "error": null
}
```

### POST /api/projects

Create a new project.

**Request Body:**
```json
{
  "name": "project-name",
  "description": "Project description",
  "settings": {}
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "id": "uuid",
    "name": "project-name",
    "description": "Project description",
    "settings": {}
  },
  "error": null
}
```

### GET /api/projects/:id

Get project details.

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "name": "project-name",
    "description": "Project description",
    "settings": {},
    "environments": [...],
    "agent_paths": ["/path/to/agent"]
  },
  "error": null
}
```

### PUT /api/projects/:id

Update a project.

**Request Body:**
```json
{
  "name": "updated-name",
  "description": "updated-description",
  "settings": {
    "key": "value"
  }
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "id": "uuid",
    "name": "updated-name",
    "description": "updated-description",
    "settings": {
      "key": "value"
    }
  },
  "error": null
}
```

### DELETE /api/projects/:id

Delete a project.

**Response:** `200 OK`
```json
{
  "data": {
    "deleted": true
  },
  "error": null
}
```

### POST /api/projects/:id/environments

Create an environment.

**Request Body:**
```json
{
  "name": "dev",
  "type": "local-wsl",
  "project_path": "/path/to/project",
  "ssh_config": {},
  "env_vars": {}
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "id": "uuid",
    "name": "dev",
    "type": "local-wsl",
    "project_path": "/path/to/project",
    "agent_workspace": "/path/to/agent/workspace"
  },
  "error": null
}
```

### PUT /api/projects/:projectId/environments/:envId

Update an environment.

**Request Body:**
```json
{
  "name": "updated-dev",
  "type": "local-wsl",
  "project_path": "/new/path",
  "ssh_config": {},
  "env_vars": {}
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "updated": true
  },
  "error": null
}
```

### DELETE /api/projects/:projectId/environments/:envId

Delete an environment.

**Response:** `200 OK`
```json
{
  "data": {
    "deleted": true
  },
  "error": null
}
```

### POST /api/projects/:id/agents

Link an agent to a project.

**Request Body:**
```json
{
  "workspace_path": "/path/to/workspace"
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "linked": true
  },
  "error": null
}
```

### DELETE /api/projects/:id/agents

Unlink an agent from a project.

**Request Body:**
```json
{
  "workspace_path": "/path/to/workspace"
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "unlinked": true
  },
  "error": null
}
```

### GET /api/projects/:id/agents-context

Get agents context for planner.

**Response:**
```json
{
  "data": [
    {
      "name": "agent-name",
      "role": "coder",
      "workspace_path": "/path/to/workspace",
      "cwd": null
    }
  ],
  "error": null
}
```

### GET /api/projects/:id/planning-context

Get complete planning context.

**Response:**
```json
{
  "data": {
    "project": {
      "id": "uuid",
      "name": "project-name",
      "description": "description",
      "settings": {}
    },
    "environments": [...],
    "agents": [...]
  },
  "error": null
}
```

### POST /api/projects/:id/generate-agent

Generate a new agent using agent-creator skill.

**Request Body:**
```json
{
  "role": "coder",
  "name": "agent-name",
  "description": "Agent description",
  "environment_id": "uuid"
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "plan_id": "uuid",
    "workspace_path": "/path/to/workspace",
    "agent_name": "agent-name",
    "role": "coder",
    "planner_workspace": "/path/to/planner"
  },
  "error": null
}
```

### POST /api/projects/:projectId/environments/:envId/generate-context

Generate structured project context including file structure, Git info, and statistics.

**Path Parameters:**
- `projectId` (string, required): Project ID
- `envId` (string, required): Environment ID

**Response:** `200 OK`
```json
{
  "data": {
    "environment_id": "string",
    "project_path": "string",
    "structure": {
      "type": "directory",
      "name": "string",
      "path": "string",
      "children": [
        {
          "type": "file",
          "name": "string",
          "path": "string",
          "extension": "string"
        }
      ]
    },
    "git_info": {
      "is_git_repo": true,
      "branch": "string",
      "last_commit": { "hash": "string", "message": "string" },
      "remote_url": "string",
      "has_changes": false
    },
    "stats": {
      "file_counts": { ".ts": 234, ".js": 123, ".json": 89 },
      "total_files": 345,
      "total_dirs": 64,
      "directories": { "path/to/dir": "description" }
    }
  },
  "error": null
}
```

**Error Responses:**
- `404` — Environment not found
- `400` — Project path does not exist or is not a directory
- `500` — Failed to generate context

**Notes:**
- Uses a Python script (`api/scripts/generate_project_context.py`) that filters out `node_modules`, `venv`, `.git`, `dist`, `build`, etc.
- Has a 30-second timeout for script execution, 10MB max buffer
- Test script available at `api/test-generate-context.sh`

---

## Approvals

Approval request management.

### POST /api/approvals

Create an approval request.

**Request Body:**
```json
{
  "plan_id": "uuid",
  "task_id": "task-1",
  "tool": "Bash",
  "input": {"command": "ls"},
  "reason": "Needs approval"
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "id": "uuid"
  },
  "error": null
}
```

### GET /api/approvals/pending

Get pending approvals.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "plan_id": "uuid",
      "task_id": "task-1",
      "tool": "Bash",
      "input": "{\"command\":\"ls\"}",
      "reason": "Needs approval",
      "status": "pending",
      "responded_at": null,
      "created_at": "2025-01-01T00:00:00.000Z",
      "plan_name": "Plan name"
    }
  ],
  "error": null
}
```

### GET /api/approvals/:id

Get approval details (for daemon polling).

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "plan_id": "uuid",
    "task_id": "task-1",
    "tool": "Bash",
    "input": "{\"command\":\"ls\"}",
    "reason": "Needs approval",
    "status": "approved",
    "responded_at": "2025-01-01T00:01:00.000Z",
    "created_at": "2025-01-01T00:00:00.000Z"
  },
  "error": null
}
```

### POST /api/approvals/:id/respond

Respond to an approval request.

**Request Body:**
```json
{
  "decision": "approved|denied"
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "id": "uuid",
    "decision": "approved"
  },
  "error": null
}
```

### POST /api/approvals/timeout

Timeout pending approvals (internal cron).

**Response:** `200 OK`
```json
{
  "data": {
    "timed_out": 3
  },
  "error": null
}
```

---

## Kanban

Kanban task management.

### GET /api/kanban

List all kanban tasks from all projects.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "title": "Task title",
      "description": "Task description",
      "column": "backlog|planning|in_progress|done",
      "priority": 3,
      "order_index": 0,
      "workflow_id": "uuid",
      "result_status": "success|partial|needs_rework",
      "result_notes": "",
      "pipeline_status": "idle|planning|awaiting_approval|running|done|failed",
      "planning_started_at": null,
      "error_message": "",
      "is_template": 0,
      "recurrence": "",
      "next_run_at": null,
      "last_run_at": null,
      "created_at": "2025-01-01T00:00:00.000Z",
      "updated_at": "2025-01-01T00:00:00.000Z",
      "project_name": "project-name",
      "workflow_status": "pending",
      "workflow_name": "workflow-name"
    }
  ],
  "error": null
}
```

### GET /api/kanban/scheduled

Get scheduled tasks ready for execution (must come before /:projectId).

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Recurring task",
      "recurrence": "0 9 * * 1-5",
      "next_run_at": "2025-01-01T09:00:00.000Z",
      "project_settings": {}
    }
  ],
  "error": null
}
```

### GET /api/kanban/:projectId

Get kanban tasks for a specific project.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "title": "Task title",
      "column": "backlog",
      "priority": 3,
      "order_index": 0,
      "pipeline_status": "idle",
      "created_at": "2025-01-01T00:00:00.000Z"
    }
  ],
  "error": null
}
```

### POST /api/kanban/:projectId

Create a new kanban task.

**Request Body:**
```json
{
  "title": "Task title",
  "description": "Task description",
  "column": "backlog",
  "priority": 3
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "id": "uuid",
    "title": "Task title",
    "description": "Task description",
    "column": "backlog",
    "priority": 3,
    "created_at": "2025-01-01T00:00:00.000Z"
  },
  "error": null
}
```

### PUT /api/kanban/:projectId/:taskId

Update a kanban task.

**Request Body:**
```json
{
  "title": "Updated title",
  "description": "Updated description",
  "column": "in_progress",
  "priority": 2,
  "order_index": 1,
  "workflow_id": "uuid",
  "result_status": "success",
  "result_notes": "Completed successfully",
  "pipeline_status": "running"
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "id": "uuid",
    "title": "Updated title",
    "column": "in_progress",
    "updated_at": "2025-01-01T00:01:00.000Z"
  },
  "error": null
}
```

### DELETE /api/kanban/:projectId/:taskId

Delete a kanban task.

**Response:** `200 OK`
```json
{
  "data": {
    "success": true
  },
  "error": null
}
```

### GET /api/kanban/:projectId/pending-pipeline

Get tasks in planning without workflow.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Task needing plan",
      "column": "planning",
      "priority": 3,
      "project_settings": {}
    }
  ],
  "error": null
}
```

### PATCH /api/kanban/:projectId/:taskId/pipeline

Update pipeline status.

**Request Body:**
```json
{
  "pipeline_status": "planning",
  "workflow_id": "uuid",
  "error_message": "",
  "column": "planning",
  "result_status": "success",
  "result_notes": "Notes"
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "id": "uuid",
    "pipeline_status": "planning",
    "workflow_id": "uuid",
    "updated_at": "2025-01-01T00:01:00.000Z"
  },
  "error": null
}
```

### POST /api/kanban/:projectId/auto-move

Auto-move tasks based on business rules.

**Response:** `200 OK`
```json
{
  "moved_tasks": [
    {
      "task": {...},
      "oldColumn": "backlog",
      "newColumn": "planning"
    }
  ],
  "reasons": [
    "Moved \"Task title\" from backlog to planning (highest priority: 1)"
  ],
  "error": null
}
```

---

## Daemon

Daemon process control.

### GET /api/daemon/status

Get daemon status.

**Response:**
```json
{
  "data": {
    "status": "running|stopped",
    "pid": 12345,
    "logs": [
      "[daemon] Daemon started",
      "[status] Daemon is running"
    ]
  },
  "error": null
}
```

### POST /api/daemon/start

Start the daemon.

**Response:** `200 OK`
```json
{
  "data": {
    "started": true,
    "pid": 12345
  },
  "error": null
}
```

### POST /api/daemon/stop

Stop the daemon.

**Response:** `200 OK`
```json
{
  "data": {
    "stopped": true
  },
  "error": null
}
```

---

## Chat Sessions

Interactive chat session management.

### GET /api/sessions

List all chat sessions.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Chat session",
      "project_id": "uuid",
      "workspace_path": "/path/to/workspace",
      "environment_id": "uuid",
      "sdk_session_id": "uuid",
      "status": "idle|running",
      "created_at": "2025-01-01T00:00:00.000Z",
      "updated_at": "2025-01-01T00:00:00.000Z"
    }
  ],
  "error": null
}
```

### POST /api/sessions

Create a new chat session.

**Request Body:**
```json
{
  "name": "New Chat",
  "project_id": "uuid",
  "workspace_path": "/path/to/workspace",
  "environment_id": "uuid"
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "id": "uuid",
    "name": "New Chat",
    "workspace_path": "/path/to/workspace"
  },
  "error": null
}
```

### GET /api/sessions/pending

Get pending sessions for daemon polling.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Chat session",
      "workspace_path": "/path/to/workspace",
      "environment_id": "uuid",
      "status": "running",
      "last_user_message": "User's last message",
      "env_project_path": "/path/to/project"
    }
  ],
  "error": null
}
```

### GET /api/sessions/:id

Get session details with messages.

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "name": "Chat session",
    "project_id": "uuid",
    "workspace_path": "/path/to/workspace",
    "environment_id": "uuid",
    "sdk_session_id": "uuid",
    "status": "idle",
    "created_at": "2025-01-01T00:00:00.000Z",
    "updated_at": "2025-01-01T00:00:00.000Z",
    "messages": [
      {
        "id": "uuid",
        "session_id": "uuid",
        "role": "user|assistant",
        "content": "Message content",
        "created_at": "2025-01-01T00:00:00.000Z"
      }
    ]
  },
  "error": null
}
```

### DELETE /api/sessions/:id

Delete a session (cannot delete running sessions).

**Response:** `200 OK`
```json
{
  "data": {
    "deleted": true,
    "id": "uuid"
  },
  "error": null
}
```

### POST /api/sessions/:id/message

Send a message to a session.

**Request Body:**
```json
{
  "content": "User message"
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "message_id": "uuid",
    "session_id": "uuid"
  },
  "error": null
}
```

### POST /api/sessions/:id/sdk-session

Register SDK session ID (daemon).

**Request Body:**
```json
{
  "sdk_session_id": "uuid"
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "saved": true
  },
  "error": null
}
```

### POST /api/sessions/:id/assistant-message

Send assistant response (daemon).

**Request Body:**
```json
{
  "content": "Assistant response",
  "structured_output": {}
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "message_id": "uuid"
  },
  "error": null
}
```

### DELETE /api/sessions/:id/messages

Clear all messages from a session.

**Response:** `200 OK`
```json
{
  "data": {
    "deleted": 10,
    "context_reset": true
  },
  "error": null
}
```

### DELETE /api/sessions/:id/messages/:msgId

Delete a specific message.

**Response:** `200 OK`
```json
{
  "data": {
    "deleted": true
  },
  "error": null
}
```

### GET /api/sessions/:id/stream

SSE endpoint for real-time message streaming.

**Authentication:** Use `token` query parameter

**Response:** Server-Sent Events stream
```
data: {"id":"uuid","role":"user","content":"message","created_at":"..."}

event: status
data: {"status":"idle"}
```

---

## Native Skills

Native skill library management.

### GET /api/native-skills

List available native skills.

**Response:**
```json
{
  "data": [
    {
      "id": "skill-name",
      "name": "Skill Display Name",
      "description": "Skill description",
      "path": "/full/path/to/skill"
    }
  ],
  "error": null
}
```

### GET /api/native-skills/:id

Get native skill content.

**Response:**
```json
{
  "data": {
    "content": "# Skill\\n\\nSkill content..."
  },
  "error": null
}
```

---

## Marketplace

Skills and agents marketplace.

### GET /api/marketplace/search

Search marketplace for skills and agents.

**Query Parameters:**
- `q` - Search query
- `type` - `skill|agent`
- `source` - `official|community|all`
- `page` - Page number (default: 1)

**Response:**
```json
{
  "data": [
    {
      "id": "gh:owner/repo",
      "name": "repo-name",
      "description": "Repository description",
      "author": "owner",
      "stars": 123,
      "url": "https://github.com/owner/repo",
      "clone_url": "https://github.com/owner/repo.git",
      "source": "github|official|community|skillsmp",
      "type": "skill|agent",
      "updated_at": "2025-01-01T00:00:00.000Z"
    }
  ],
  "error": null
}
```

### GET /api/marketplace/repo-contents

Browse repository contents.

**Query Parameters:**
- `repo` - Repository (owner/name)
- `path` - Path in repository (optional)

**Response:**
```json
{
  "data": [
    {
      "name": "skill-name",
      "path": "skills/skill-name",
      "type": "file|dir",
      "size": 1024,
      "download_url": "https://...",
      "is_skill": true
    }
  ],
  "error": null
}
```

### GET /api/marketplace/preview

Preview skill content.

**Query Parameters:**
- `repo` - Repository (owner/name)
- `path` - Path to SKILL.md

**Response:**
```json
{
  "data": {
    "content": "# Skill\\n\\nSkill content...",
    "path": "skills/skill-name/SKILL.md",
    "branch": "main"
  },
  "error": null
}
```

### POST /api/marketplace/install

Install a skill to a workspace.

**Request Body:**
```json
{
  "workspace_path": "/path/to/workspace",
  "skill_name": "skill-name",
  "skill_content": "# Skill\\n\\nContent...",
  "type": "skill"
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "installed": true,
    "path": "/full/path/to/SKILL.md",
    "skill_name": "skill-name",
    "workspace_path": "/path/to/workspace"
  },
  "error": null
}
```

### GET /api/marketplace/models

List available models.

**Response:**
```json
{
  "data": [
    {
      "id": "default",
      "label": "Default",
      "description": "Uses the default Claude model"
    },
    {
      "id": "claude-opus-4-6",
      "label": "Claude Opus 4.6",
      "description": "Most capable — recommended for planners"
    },
    {
      "id": "claude-sonnet-4-6",
      "label": "Claude Sonnet 4.6",
      "description": "Balanced — recommended for coders and reviewers"
    },
    {
      "id": "claude-haiku-4-5-20251001",
      "label": "Claude Haiku 4.5",
      "description": "Fast and efficient — good for simple tasks"
    }
  ],
  "error": null
}
```

---

## Quick Actions

Quick action templates (implementation details vary).

**Note:** This module's endpoints are defined in the codebase but specific documentation should be verified from the source implementation.

---

## Templates

Kanban board templates for creating reusable task layouts.

### GET /api/templates

Get all templates, optionally filtered by project.

**Query Parameters:**
- `project_id` (optional) - Filter by project ID
- `is_public` (optional) - Filter by public templates (1 or 0)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "title": "Template name",
      "description": "Template description",
      "priority": 3,
      "recurrence": "",
      "next_run_at": null,
      "last_run_at": null,
      "is_public": 1,
      "created_at": "2026-03-17 23:42:25",
      "updated_at": "2026-03-17 23:42:25",
      "project_name": "Project name",
      "project_description": "Project description"
    }
  ],
  "error": null
}
```

### GET /api/templates/:id

Get a specific template by ID including its columns and tasks.

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "project_id": "uuid",
    "title": "Template name",
    "description": "Template description",
    "priority": 3,
    "recurrence": "",
    "next_run_at": null,
    "last_run_at": null,
    "is_public": 1,
    "created_at": "2026-03-17 23:42:25",
    "updated_at": "2026-03-17 23:42:25",
    "project_name": "Project name",
    "project_description": "Project description",
    "columns": [
      {
        "id": "uuid",
        "template_id": "uuid",
        "name": "Backlog",
        "order_index": 0,
        "tasks": [
          {
            "id": "uuid",
            "template_column_id": "uuid",
            "title": "Task title",
            "description": "Task description",
            "priority": 3,
            "order_index": 0,
            "tags": "tag1,tag2"
          }
        ]
      }
    ]
  },
  "error": null
}
```

### POST /api/templates

Create a new kanban template.

**Request Body:**
```json
{
  "title": "Template name",
  "description": "Template description",
  "project_id": "uuid",
  "priority": 3,
  "is_public": 1,
  "columns": [
    {
      "name": "Backlog",
      "order_index": 0,
      "tasks": [
        {
          "title": "Task title",
          "description": "Task description",
          "priority": 3,
          "order_index": 0,
          "tags": "tag1,tag2"
        }
      ]
    }
  ]
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "project_id": "uuid",
    "title": "Template name",
    "description": "Template description",
    "priority": 3,
    "recurrence": "",
    "next_run_at": null,
    "last_run_at": null,
    "is_public": 1,
    "created_at": "2026-03-17 23:42:25",
    "updated_at": "2026-03-17 23:42:25"
  },
  "error": null
}
```

### PUT /api/templates/:id

Update an existing template.

**Request Body:**
```json
{
  "title": "Updated template name",
  "description": "Updated description",
  "priority": 2,
  "is_public": 0
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "project_id": "uuid",
    "title": "Updated template name",
    "description": "Updated description",
    "priority": 2,
    "recurrence": "",
    "next_run_at": null,
    "last_run_at": null,
    "is_public": 0,
    "created_at": "2026-03-17 23:42:25",
    "updated_at": "2026-03-17 23:45:00"
  },
  "error": null
}
```

### DELETE /api/templates/:id

Delete a template and all its columns and tasks.

**Response:**
```json
{
  "data": {
    "success": true
  },
  "error": null
}
```

---

## Error Codes

### Common Errors

| Code | Description |
|------|-------------|
| `400` | Bad Request - Invalid input data |
| `401` | Unauthorized - Missing or invalid authentication |
| `403` | Forbidden - Valid authentication but insufficient permissions |
| `404` | Not Found - Resource not found |
| `409` | Conflict - Resource state conflicts with request |
| `500` | Internal Server Error - Server-side error |

### Example Error Response

```json
{
  "data": null,
  "error": "Plan not found"
}
```

---

## Authentication Examples

### Using Bearer Token

```bash
curl -X GET http://localhost:3000/api/plans \
  -H "Authorization: Bearer dev-token-change-in-production"
```

### Using Query Parameter (for SSE)

```bash
curl http://localhost:3000/api/plans/uuid/logs/stream?token=dev-token-change-in-production
```

---

## Rate Limiting

Currently, no rate limiting is implemented. Consider implementing rate limiting for production deployments.

---

## Pagination

Pagination is not consistently implemented across all endpoints. Some endpoints return all data, while others support query parameters for filtering.

---

## Filtering and Sorting

### Plans
- Filter by `project_id` query parameter
- Sorted by `created_at DESC`

### Workspaces
- Filter by `project_id` query parameter
- No sorting specified

### Kanban Tasks
- Sorted by `column`, then `priority ASC`, then `order_index ASC`

---

For implementation details, see [IMPLEMENTATION.md](./IMPLEMENTATION.md).
For architecture information, see [ARCHITECTURE.md](./ARCHITECTURE.md).
For testing information, see [TESTING.md](./TESTING.md).
