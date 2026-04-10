export interface Migration {
  version: number;
  description: string;
  up: string[];
}

export const migrations: Migration[] = [
  {
    version: 1,
    description: 'Initial schema — core tables (agents, workflows, executions, plans, plan_logs, approvals)',
    up: [
      `CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        config TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        config TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS executions (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        input TEXT,
        output TEXT,
        error TEXT,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id),
        FOREIGN KEY (agent_id) REFERENCES agents(id)
      )`,
      `CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        tasks TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        client_id TEXT,
        result TEXT,
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS plan_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id TEXT NOT NULL REFERENCES plans(id),
        task_id TEXT NOT NULL,
        level TEXT NOT NULL DEFAULT 'info',
        message TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        tool TEXT NOT NULL,
        input TEXT NOT NULL,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        responded_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    ],
  },
  {
    version: 2,
    description: 'Projects table',
    up: [
      `CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    ],
  },
  {
    version: 3,
    description: 'Projects — add settings column',
    up: [
      `ALTER TABLE projects ADD COLUMN settings TEXT DEFAULT '{}'`,
    ],
  },
  {
    version: 4,
    description: 'Projects — add color column',
    up: [
      `ALTER TABLE projects ADD COLUMN color TEXT DEFAULT ''`,
    ],
  },
  {
    version: 5,
    description: 'Environments table',
    up: [
      `CREATE TABLE IF NOT EXISTS environments (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'local-wsl',
        project_path TEXT NOT NULL,
        agent_workspace TEXT NOT NULL,
        ssh_config TEXT,
        env_vars TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    ],
  },
  {
    version: 6,
    description: 'Environments — add git_repository column',
    up: [
      `ALTER TABLE environments ADD COLUMN git_repository TEXT`,
    ],
  },
  {
    version: 7,
    description: 'Project agents table',
    up: [
      `CREATE TABLE IF NOT EXISTS project_agents (
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        workspace_path TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (project_id, workspace_path)
      )`,
    ],
  },
  {
    version: 8,
    description: 'Agent environments table',
    up: [
      `CREATE TABLE IF NOT EXISTS agent_environments (
        workspace_path TEXT NOT NULL,
        environment_id TEXT NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
        created_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (workspace_path, environment_id)
      )`,
    ],
  },
  {
    version: 9,
    description: 'Plans — add project_id column',
    up: [
      `ALTER TABLE plans ADD COLUMN project_id TEXT`,
    ],
  },
  {
    version: 10,
    description: 'Plans — add type column',
    up: [
      `ALTER TABLE plans ADD COLUMN type TEXT DEFAULT 'workflow'`,
    ],
  },
  {
    version: 11,
    description: 'Plans — add structured_output column',
    up: [
      `ALTER TABLE plans ADD COLUMN structured_output TEXT`,
    ],
  },
  {
    version: 12,
    description: 'Plans — add result_status column',
    up: [
      `ALTER TABLE plans ADD COLUMN result_status TEXT CHECK(result_status IN ('success','partial','needs_rework'))`,
    ],
  },
  {
    version: 13,
    description: 'Plans — add result_notes column',
    up: [
      `ALTER TABLE plans ADD COLUMN result_notes TEXT DEFAULT ''`,
    ],
  },
  {
    version: 14,
    description: 'Plans — add workspace_id column',
    up: [
      `ALTER TABLE plans ADD COLUMN workspace_id TEXT`,
    ],
  },
  {
    version: 15,
    description: 'Chat sessions table',
    up: [
      `CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        project_id TEXT,
        workspace_path TEXT NOT NULL,
        environment_id TEXT,
        sdk_session_id TEXT,
        status TEXT DEFAULT 'idle',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
    ],
  },
  {
    version: 16,
    description: 'Chat messages table',
    up: [
      `CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
    ],
  },
  {
    version: 17,
    description: 'Kanban tasks table',
    up: [
      `CREATE TABLE IF NOT EXISTS kanban_tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        column TEXT NOT NULL DEFAULT 'backlog' CHECK(column IN ('backlog','planning','in_progress','done')),
        priority INTEGER NOT NULL DEFAULT 3 CHECK(priority BETWEEN 1 AND 5),
        order_index INTEGER NOT NULL DEFAULT 0,
        workflow_id TEXT REFERENCES plans(id) ON DELETE SET NULL,
        result_status TEXT CHECK(result_status IN ('success','partial','needs_rework')),
        result_notes TEXT DEFAULT '',
        pipeline_status TEXT DEFAULT 'idle' CHECK(pipeline_status IN ('idle','planning','awaiting_approval','running','done','failed')),
        planning_started_at TEXT,
        error_message TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
    ],
  },
  {
    version: 18,
    description: 'Kanban tasks — add pipeline_status column',
    up: [
      `ALTER TABLE kanban_tasks ADD COLUMN pipeline_status TEXT DEFAULT 'idle' CHECK(pipeline_status IN ('idle','planning','awaiting_approval','running','done','failed'))`,
    ],
  },
  {
    version: 19,
    description: 'Kanban tasks — add planning_started_at column',
    up: [
      `ALTER TABLE kanban_tasks ADD COLUMN planning_started_at TEXT`,
    ],
  },
  {
    version: 20,
    description: 'Kanban tasks — add error_message column',
    up: [
      `ALTER TABLE kanban_tasks ADD COLUMN error_message TEXT DEFAULT ''`,
    ],
  },
  {
    version: 21,
    description: 'Plans — add last_heartbeat_at column',
    up: [
      `ALTER TABLE plans ADD COLUMN last_heartbeat_at TEXT`,
    ],
  },
  {
    version: 22,
    description: 'Kanban tasks — add is_template, recurrence, next_run_at, last_run_at columns',
    up: [
      `ALTER TABLE kanban_tasks ADD COLUMN is_template INTEGER DEFAULT 0`,
      `ALTER TABLE kanban_tasks ADD COLUMN recurrence TEXT DEFAULT ''`,
      `ALTER TABLE kanban_tasks ADD COLUMN next_run_at TEXT`,
      `ALTER TABLE kanban_tasks ADD COLUMN last_run_at TEXT`,
    ],
  },
  {
    version: 23,
    description: 'Kanban templates table',
    up: [
      `CREATE TABLE IF NOT EXISTS kanban_templates (
        id TEXT PRIMARY KEY,
        project_id TEXT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        priority INTEGER NOT NULL DEFAULT 3 CHECK(priority BETWEEN 1 AND 5),
        recurrence TEXT DEFAULT '',
        next_run_at TEXT,
        last_run_at TEXT,
        is_public INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
    ],
  },
  {
    version: 24,
    description: 'Workspace roles table',
    up: [
      `CREATE TABLE IF NOT EXISTS workspace_roles (
        workspace_path TEXT PRIMARY KEY,
        role TEXT NOT NULL DEFAULT 'coder' CHECK(role IN ('planner','coder','reviewer','tester','debugger','devops','generic'))
      )`,
    ],
  },
  {
    version: 25,
    description: 'Workspace models table',
    up: [
      `CREATE TABLE IF NOT EXISTS workspace_models (
        workspace_path TEXT PRIMARY KEY,
        model TEXT DEFAULT ''
      )`,
    ],
  },
  {
    version: 26,
    description: 'Environment variables table',
    up: [
      `CREATE TABLE IF NOT EXISTS environment_variables (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        description TEXT DEFAULT '',
        category TEXT DEFAULT 'general',
        is_secret INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    ],
  },
  {
    version: 27,
    description: 'Projects — add workflow limits columns',
    up: [
      `ALTER TABLE projects ADD COLUMN max_concurrent_workflows INTEGER DEFAULT 0`,
      `ALTER TABLE projects ADD COLUMN max_planning_tasks INTEGER DEFAULT 1`,
      `ALTER TABLE projects ADD COLUMN max_in_progress_tasks INTEGER DEFAULT 1`,
      `CREATE INDEX IF NOT EXISTS idx_projects_settings ON projects(settings)`,
    ],
  },
  {
    version: 28,
    description: 'Plans — add parent_plan_id and rework_prompt columns',
    up: [
      `ALTER TABLE plans ADD COLUMN parent_plan_id TEXT REFERENCES plans(id) ON DELETE SET NULL`,
      `ALTER TABLE plans ADD COLUMN rework_prompt TEXT DEFAULT ''`,
      `CREATE INDEX IF NOT EXISTS idx_plans_parent_plan_id ON plans(parent_plan_id)`,
    ],
  },
  {
    version: 29,
    description: 'Users table and user_id columns for multi-user support',
    up: [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `ALTER TABLE projects ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE SET NULL`,
      `ALTER TABLE plans ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE SET NULL`,
      `ALTER TABLE chat_sessions ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE SET NULL`,
      `ALTER TABLE kanban_tasks ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE SET NULL`,
      `ALTER TABLE kanban_templates ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE SET NULL`,
      `CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_plans_user_id ON plans(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_kanban_tasks_user_id ON kanban_tasks(user_id)`,
    ],
  },
  {
    version: 30,
    description: 'Message attachments table and attachments columns',
    up: [
      `CREATE TABLE IF NOT EXISTS message_attachments (
        id TEXT PRIMARY KEY,
        message_type TEXT NOT NULL CHECK(message_type IN ('chat', 'quick_action', 'plan_task', 'kanban')),
        message_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        storage_path TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `ALTER TABLE chat_messages ADD COLUMN attachments TEXT DEFAULT '[]'`,
      `ALTER TABLE plans ADD COLUMN attachments TEXT DEFAULT '[]'`,
      `ALTER TABLE kanban_tasks ADD COLUMN attachments TEXT DEFAULT '[]'`,
    ],
  },
  {
    version: 31,
    description: 'Plans — add rework_mode column',
    up: [
      `ALTER TABLE plans ADD COLUMN rework_mode TEXT DEFAULT 'full_workflow' CHECK(rework_mode IN ('full_workflow', 'quick_action'))`,
    ],
  },
  {
    version: 32,
    description: 'Move git_repository from environments to projects; rename workspace_* to team_*; rename workspace_id to team_id',
    up: [
      // 1. Add git_url column to projects
      `ALTER TABLE projects ADD COLUMN git_url TEXT`,

      // 2. Migrate git_repository from environments to projects (take first non-null value per project)
      `UPDATE projects SET git_url = (
        SELECT e.git_repository FROM environments e
        WHERE e.project_id = projects.id AND e.git_repository IS NOT NULL AND e.git_repository != ''
        LIMIT 1
      )`,

      // 3. Drop git_repository column from environments
      // SQLite doesn't support DROP COLUMN before 3.35.0, so we use the safe ignore approach
      `ALTER TABLE environments DROP COLUMN git_repository`,

      // 4. Rename workspace_roles → team_roles
      `ALTER TABLE workspace_roles RENAME TO team_roles`,

      // 5. Rename workspace_models → team_models
      `ALTER TABLE workspace_models RENAME TO team_models`,

      // 6. Rename workspace_id → team_id in plans
      // SQLite doesn't support ALTER TABLE RENAME COLUMN before 3.25.0,
      // so we recreate the table. The new table omits REFERENCES clauses
      // to avoid FK constraint issues during the table swap (plan_logs
      // references plans). FK constraints are advisory in this codebase.
      `CREATE TABLE IF NOT EXISTS plans_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        tasks TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        client_id TEXT,
        result TEXT,
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        project_id TEXT,
        type TEXT DEFAULT 'workflow',
        structured_output TEXT,
        result_status TEXT CHECK(result_status IN ('success','partial','needs_rework')),
        result_notes TEXT DEFAULT '',
        team_id TEXT,
        last_heartbeat_at TEXT,
        parent_plan_id TEXT,
        rework_prompt TEXT DEFAULT '',
        rework_mode TEXT DEFAULT 'full_workflow' CHECK(rework_mode IN ('full_workflow', 'quick_action')),
        user_id TEXT,
        attachments TEXT DEFAULT '[]'
      )`,
      `INSERT OR IGNORE INTO plans_new (
        id, name, tasks, status, client_id, result, started_at, completed_at, created_at,
        project_id, type, structured_output, result_status, result_notes, team_id,
        last_heartbeat_at, parent_plan_id, rework_prompt, rework_mode, user_id, attachments
      ) SELECT
        id, name, tasks, status, client_id, result, started_at, completed_at, created_at,
        project_id, type, structured_output, result_status, result_notes, workspace_id,
        last_heartbeat_at, parent_plan_id, rework_prompt, rework_mode, user_id, attachments
      FROM plans`,
      `DROP TABLE plans`,
      `ALTER TABLE plans_new RENAME TO plans`,
      // Recreate indexes on plans
      `CREATE INDEX IF NOT EXISTS idx_plans_parent_plan_id ON plans(parent_plan_id)`,
      `CREATE INDEX IF NOT EXISTS idx_plans_user_id ON plans(user_id)`,
    ],
  },
  {
    version: 33,
    description: 'Environments — add default_team column to track auto-created team',
    up: [
      `ALTER TABLE environments ADD COLUMN default_team TEXT`,
    ],
  },
  {
    version: 34,
    description: 'Environments — add env_type column to distinguish plan/dev/staging purpose',
    up: [
      `ALTER TABLE environments ADD COLUMN env_type TEXT DEFAULT 'dev'`,
    ],
  },
  {
    version: 35,
    description: 'Repair — set default_team for environments that have agent_workspace but no default_team',
    up: [
      `UPDATE environments SET default_team = agent_workspace WHERE default_team IS NULL AND agent_workspace IS NOT NULL AND agent_workspace != ''`,
    ],
  },
  {
    version: 36,
    description: 'Team native agents — store sub-agent definitions injected from native-agents/ when a team is created',
    up: [
      `CREATE TABLE IF NOT EXISTS team_native_agents (
        id TEXT PRIMARY KEY,
        team_workspace_path TEXT NOT NULL,
        slug TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        model TEXT NOT NULL DEFAULT '',
        tools TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT 'blue',
        system_prompt TEXT NOT NULL DEFAULT '',
        team_type TEXT NOT NULL DEFAULT '',
        source_path TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(team_workspace_path, slug)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_team_native_agents_workspace ON team_native_agents(team_workspace_path)`,
    ],
  },
  {
    version: 37,
    description: 'Kanban — expand column CHECK to support new pipeline phases (planning, in_dev, validation) and rename in_progress',
    up: [
      // Step 1: Migrate existing in_progress → in_dev (they're semantically equivalent)
      `UPDATE kanban_tasks SET column = 'in_dev' WHERE column = 'in_progress'`,

      // Step 2: Recreate table with expanded CHECK constraint
      `CREATE TABLE IF NOT EXISTS kanban_tasks_new (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        column TEXT NOT NULL DEFAULT 'backlog' CHECK(column IN ('backlog','planning','in_dev','validation','done')),
        priority INTEGER NOT NULL DEFAULT 3 CHECK(priority BETWEEN 1 AND 5),
        order_index INTEGER NOT NULL DEFAULT 0,
        workflow_id TEXT REFERENCES plans(id) ON DELETE SET NULL,
        result_status TEXT CHECK(result_status IN ('success','partial','needs_rework')),
        result_notes TEXT DEFAULT '',
        pipeline_status TEXT DEFAULT 'idle' CHECK(pipeline_status IN ('idle','planning','awaiting_approval','running','done','failed')),
        planning_started_at TEXT,
        error_message TEXT DEFAULT '',
        attachments TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL
      )`,
      `INSERT OR IGNORE INTO kanban_tasks_new (
        id, project_id, title, description, column, priority, order_index,
        workflow_id, result_status, result_notes, pipeline_status, planning_started_at,
        error_message, attachments, created_at, updated_at, user_id
      ) SELECT
        id, project_id, title, description, column, priority, order_index,
        workflow_id, result_status, result_notes, pipeline_status, planning_started_at,
        error_message, attachments, created_at, updated_at, user_id
      FROM kanban_tasks`,
      `DROP TABLE kanban_tasks`,
      `ALTER TABLE kanban_tasks_new RENAME TO kanban_tasks`,
      `CREATE INDEX IF NOT EXISTS idx_kanban_tasks_user_id ON kanban_tasks(user_id)`,
    ],
  },
  {
    version: 38,
    description: 'Plans — add workflow_path column to store the per-workflow directory path',
    up: [
      `ALTER TABLE plans ADD COLUMN workflow_path TEXT`,
    ],
  },
  {
    version: 39,
    description: 'Chat sessions — add last_read_at column to track unread assistant messages',
    up: [
      `ALTER TABLE chat_sessions ADD COLUMN last_read_at TEXT`,
    ],
  },
  {
    version: 40,
    description: 'Rename agent_workspace → team_workspace in environments table to disambiguate teams from agents',
    up: [
      // Add the new column alongside the old one
      `ALTER TABLE environments ADD COLUMN team_workspace TEXT`,
      // Migrate data
      `UPDATE environments SET team_workspace = agent_workspace WHERE agent_workspace IS NOT NULL`,
      // Drop old column (SQLite ≥ 3.35.0)
      `ALTER TABLE environments DROP COLUMN agent_workspace`,
    ],
  },
  {
    version: 41,
    description: 'Plans — add sdk_session_id column to persist Claude Code SDK session for resume',
    up: [
      `ALTER TABLE plans ADD COLUMN sdk_session_id TEXT`,
    ],
  },
];
