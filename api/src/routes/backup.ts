import { Router } from 'express'
import { randomUUID } from 'crypto'
import { authenticateToken } from '../middleware/auth.js'
import { db } from '../db/index.js'
import { AGENTS_BASE_PATH } from '../utils/paths.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

const router = Router()

/**
 * Dynamically resolve the agents base path at call time.
 * This allows tests to override via env var after module import.
 */
function getAgentsBasePath(): string {
  // Priority: DATA_DIR > AGENTS_BASE_PATH > compiled default
  const dataDir = process.env.DATA_DIR
  if (dataDir) return path.join(dataDir, 'projects')
  const envPath = process.env.AGENTS_BASE_PATH
  if (envPath) {
    return envPath.startsWith('~') ? path.join(os.homedir(), envPath.slice(1)) : envPath
  }
  return AGENTS_BASE_PATH
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BackupData {
  version: string
  exported_at: string
  metadata: {
    projects_count: number
    environments_count: number
    agents_count: number
    plans_count: number
    kanban_tasks_count: number
    kanban_templates_count: number
    chat_sessions_count: number
    chat_messages_count: number
    environment_variables_count: number
    approvals_count: number
  }
  projects: any[]
  environments: any[]
  project_agents: any[]
  agent_environments: any[]
  workspace_roles: any[]
  workspace_models: any[]
  plans: any[]
  plan_logs: any[]
  kanban_tasks: any[]
  kanban_templates: any[]
  chat_sessions: any[]
  chat_messages: any[]
  environment_variables: any[]
  approvals: any[]
  agent_workspaces: {
    relative_path: string
    claude_md: string | null
    settings: any | null
    skills: { name: string; content: string }[]
    agents: { name: string; content: string }[]
  }[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readSkillsAndAgents(workspacePath: string): {
  skills: { name: string; content: string }[]
  agents: { name: string; content: string }[]
} {
  const skills: { name: string; content: string }[] = []
  const agents: { name: string; content: string }[] = []

  const skillsDir = path.join(workspacePath, '.claude', 'skills')
  if (fs.existsSync(skillsDir)) {
    const skillEntries = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
    for (const skillEntry of skillEntries) {
      const skillMd = path.join(skillsDir, skillEntry.name, 'SKILL.md')
      if (fs.existsSync(skillMd)) {
        skills.push({
          name: skillEntry.name,
          content: fs.readFileSync(skillMd, 'utf-8'),
        })
      }
    }
  }

  const agentsDir = path.join(workspacePath, '.claude', 'agents')
  if (fs.existsSync(agentsDir)) {
    const mdFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'))
    for (const mdFile of mdFiles) {
      agents.push({
        name: mdFile,
        content: fs.readFileSync(path.join(agentsDir, mdFile), 'utf-8'),
      })
    }
  }

  return { skills, agents }
}

function readWorkspace(workspacePath: string): BackupData['agent_workspaces'][number] | null {
  if (!fs.existsSync(workspacePath) || !fs.statSync(workspacePath).isDirectory()) {
    return null
  }

  const claudeMdPath = path.join(workspacePath, 'CLAUDE.md')
  const settingsPath = path.join(workspacePath, '.claude', 'settings.local.json')

  let settings: any = null
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
  } catch {
    // no settings file
  }

  const { skills, agents } = readSkillsAndAgents(workspacePath)

  return {
    relative_path: '', // caller will set this
    claude_md: fs.existsSync(claudeMdPath) ? fs.readFileSync(claudeMdPath, 'utf-8') : null,
    settings,
    skills,
    agents,
  }
}

/** Collect all agent workspace directories under the AGENTS_BASE_PATH */
function collectAgentWorkspaces(): BackupData['agent_workspaces'] {
  const workspaces: BackupData['agent_workspaces'] = []

  if (!fs.existsSync(getAgentsBasePath())) return workspaces

  const basePath = getAgentsBasePath()
  const projectDirs = fs.readdirSync(basePath, { withFileTypes: true })
    .filter(d => d.isDirectory())

  for (const projectDir of projectDirs) {
    const projectPath = path.join(basePath, projectDir.name)

    // New structure: {project}/agents/{agent-name}/
    const agentsDir = path.join(projectPath, 'agents')
    if (fs.existsSync(agentsDir)) {
      const agentDirs = fs.readdirSync(agentsDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
      for (const agentDir of agentDirs) {
        const fullPath = path.join(agentsDir, agentDir.name)
        const ws = readWorkspace(fullPath)
        if (ws) {
          ws.relative_path = path.relative(basePath, fullPath)
          workspaces.push(ws)
        }
      }
    }

    // Legacy structure: {project}/agent-coder/
    const legacyPath = path.join(projectPath, 'agent-coder')
    if (fs.existsSync(legacyPath)) {
      const ws = readWorkspace(legacyPath)
      if (ws) {
        ws.relative_path = path.relative(basePath, legacyPath)
        workspaces.push(ws)
      }
    }

    // Environment-based agents: {project}/{env-slug}/agent-coder|agent-planner/
    const envDirs = fs.readdirSync(projectPath, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name !== 'agents')

    for (const envDir of envDirs) {
      for (const agentType of ['agent-coder', 'agent-planner']) {
        const agentPath = path.join(projectPath, envDir.name, agentType)
        if (fs.existsSync(agentPath) && fs.statSync(agentPath).isDirectory()) {
          const ws = readWorkspace(agentPath)
          if (ws) {
            ws.relative_path = path.relative(basePath, agentPath)
            workspaces.push(ws)
          }
        }
      }
    }
  }

  return workspaces
}

/** Restore a single agent workspace on the filesystem */
function restoreWorkspace(ws: BackupData['agent_workspaces'][number]): void {
  const fullPath = path.join(getAgentsBasePath(), ws.relative_path)
  fs.mkdirSync(fullPath, { recursive: true })

  // CLAUDE.md
  if (ws.claude_md) {
    fs.writeFileSync(path.join(fullPath, 'CLAUDE.md'), ws.claude_md, 'utf-8')
  }

  // settings.local.json
  if (ws.settings) {
    const claudeDir = path.join(fullPath, '.claude')
    fs.mkdirSync(claudeDir, { recursive: true })
    fs.writeFileSync(
      path.join(claudeDir, 'settings.local.json'),
      JSON.stringify(ws.settings, null, 2),
      'utf-8'
    )
  }

  // Skills
  for (const skill of ws.skills || []) {
    const skillDir = path.join(fullPath, '.claude', 'skills', skill.name)
    fs.mkdirSync(skillDir, { recursive: true })
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skill.content, 'utf-8')
  }

  // Agent .md files
  for (const agentFile of ws.agents || []) {
    const agentsDir = path.join(fullPath, '.claude', 'agents')
    fs.mkdirSync(agentsDir, { recursive: true })
    fs.writeFileSync(path.join(agentsDir, agentFile.name), agentFile.content, 'utf-8')
  }

  // .gitignore
  const gitignorePath = path.join(fullPath, '.gitignore')
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, '.claude/\n.agent-docs/\n', 'utf-8')
  }
}

// ---------------------------------------------------------------------------
// GET /api/backup/info — preview what would be exported
// ---------------------------------------------------------------------------

router.get('/info', authenticateToken, (_req, res) => {
  try {
    const projects = db.prepare('SELECT COUNT(*) as count FROM projects').get() as any
    const environments = db.prepare('SELECT COUNT(*) as count FROM environments').get() as any
    const plans = db.prepare('SELECT COUNT(*) as count FROM plans').get() as any
    const kanbanTasks = db.prepare('SELECT COUNT(*) as count FROM kanban_tasks').get() as any
    const kanbanTemplates = db.prepare('SELECT COUNT(*) as count FROM kanban_templates').get() as any
    const chatSessions = db.prepare('SELECT COUNT(*) as count FROM chat_sessions').get() as any
    const chatMessages = db.prepare('SELECT COUNT(*) as count FROM chat_messages').get() as any
    const envVars = db.prepare('SELECT COUNT(*) as count FROM environment_variables').get() as any
    const approvals = db.prepare('SELECT COUNT(*) as count FROM approvals').get() as any
    const planLogs = db.prepare('SELECT COUNT(*) as count FROM plan_logs').get() as any

    const agentWorkspaces = collectAgentWorkspaces()

    return res.json({
      data: {
        projects: projects.count,
        environments: environments.count,
        plans: plans.count,
        plan_logs: planLogs.count,
        kanban_tasks: kanbanTasks.count,
        kanban_templates: kanbanTemplates.count,
        chat_sessions: chatSessions.count,
        chat_messages: chatMessages.count,
        environment_variables: envVars.count,
        approvals: approvals.count,
        agent_workspaces: agentWorkspaces.length,
      },
      error: null,
    })
  } catch (error: any) {
    console.error('[backup] Info failed:', error)
    return res.status(500).json({ data: null, error: 'Failed to get backup info: ' + error.message })
  }
})

// ---------------------------------------------------------------------------
// POST /api/backup/export
// ---------------------------------------------------------------------------

router.post('/export', authenticateToken, (_req, res) => {
  try {
    const now = new Date().toISOString()
    const agentWorkspaces = collectAgentWorkspaces()

    const backup: BackupData = {
      version: '1.0.0',
      exported_at: now,
      metadata: {
        projects_count: 0,
        environments_count: 0,
        agents_count: 0,
        plans_count: 0,
        kanban_tasks_count: 0,
        kanban_templates_count: 0,
        chat_sessions_count: 0,
        chat_messages_count: 0,
        environment_variables_count: 0,
        approvals_count: 0,
      },
      projects: [],
      environments: [],
      project_agents: [],
      agent_environments: [],
      workspace_roles: [],
      workspace_models: [],
      plans: [],
      plan_logs: [],
      kanban_tasks: [],
      kanban_templates: [],
      chat_sessions: [],
      chat_messages: [],
      environment_variables: [],
      approvals: [],
      agent_workspaces: agentWorkspaces,
    }

    // Relational data
    backup.projects = db.prepare('SELECT * FROM projects ORDER BY created_at').all() as any[]
    backup.environments = db.prepare('SELECT * FROM environments ORDER BY created_at').all() as any[]
    backup.project_agents = db.prepare('SELECT * FROM project_agents ORDER BY created_at').all() as any[]
    backup.agent_environments = db.prepare('SELECT * FROM agent_environments ORDER BY created_at').all() as any[]
    backup.workspace_roles = db.prepare('SELECT * FROM workspace_roles').all() as any[]
    backup.workspace_models = db.prepare('SELECT * FROM workspace_models').all() as any[]
    backup.plans = db.prepare('SELECT * FROM plans ORDER BY created_at').all() as any[]
    backup.plan_logs = db.prepare('SELECT * FROM plan_logs ORDER BY created_at').all() as any[]
    backup.kanban_tasks = db.prepare('SELECT * FROM kanban_tasks ORDER BY created_at').all() as any[]
    backup.kanban_templates = db.prepare('SELECT * FROM kanban_templates ORDER BY created_at').all() as any[]
    backup.chat_sessions = db.prepare('SELECT * FROM chat_sessions ORDER BY created_at').all() as any[]
    backup.chat_messages = db.prepare('SELECT * FROM chat_messages ORDER BY created_at').all() as any[]
    backup.environment_variables = db.prepare('SELECT * FROM environment_variables ORDER BY created_at').all() as any[]
    backup.approvals = db.prepare('SELECT * FROM approvals ORDER BY created_at').all() as any[]

    // Fill metadata
    backup.metadata = {
      projects_count: backup.projects.length,
      environments_count: backup.environments.length,
      agents_count: agentWorkspaces.length,
      plans_count: backup.plans.length,
      kanban_tasks_count: backup.kanban_tasks.length,
      kanban_templates_count: backup.kanban_templates.length,
      chat_sessions_count: backup.chat_sessions.length,
      chat_messages_count: backup.chat_messages.length,
      environment_variables_count: backup.environment_variables.length,
      approvals_count: backup.approvals.length,
    }

    return res.json({ data: backup, error: null })
  } catch (error: any) {
    console.error('[backup] Export failed:', error)
    return res.status(500).json({ data: null, error: 'Failed to export backup: ' + error.message })
  }
})

// ---------------------------------------------------------------------------
// POST /api/backup/import
// ---------------------------------------------------------------------------

router.post('/import', authenticateToken, (req, res) => {
  try {
    const backup: BackupData = req.body

    // Validate backup structure
    if (!backup.version || !backup.exported_at) {
      return res.status(400).json({ data: null, error: 'Invalid backup file: missing version or exported_at' })
    }

    if (!Array.isArray(backup.projects)) {
      return res.status(400).json({ data: null, error: 'Invalid backup file: missing projects data' })
    }

    const userId = req.user?.userId || 'system'

    // ID remapping: old IDs → new IDs so foreign keys stay consistent
    const idMap: Record<string, string> = {}

    const importDb = db.transaction(() => {
      // ---- 1. Projects -------------------------------------------------------
      const insertProject = db.prepare(`
        INSERT OR IGNORE INTO projects (id, name, description, settings, color, created_at, user_id, max_concurrent_workflows, max_planning_tasks, max_in_progress_tasks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      for (const p of backup.projects) {
        const newId = randomUUID()
        idMap[p.id] = newId
        insertProject.run(
          newId,
          p.name,
          p.description || null,
          p.settings || '{}',
          p.color || '',
          p.created_at || new Date().toISOString(),
          userId,
          p.max_concurrent_workflows || 0,
          p.max_planning_tasks || 1,
          p.max_in_progress_tasks || 1,
        )
      }

      // ---- 2. Environments ---------------------------------------------------
      const insertEnv = db.prepare(`
        INSERT OR IGNORE INTO environments (id, project_id, name, type, project_path, agent_workspace, ssh_config, env_vars, git_repository, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      for (const e of backup.environments) {
        const newId = randomUUID()
        idMap[e.id] = newId
        const mappedProjectId = idMap[e.project_id]
        if (!mappedProjectId) continue
        insertEnv.run(
          newId,
          mappedProjectId,
          e.name,
          e.type || 'local-wsl',
          e.project_path || '',
          e.agent_workspace || '',
          e.ssh_config || null,
          e.env_vars || null,
          e.git_repository || null,
          e.created_at || new Date().toISOString(),
        )
      }

      // ---- 3. Junction tables ------------------------------------------------
      const insertPA = db.prepare(`
        INSERT OR IGNORE INTO project_agents (project_id, workspace_path, created_at)
        VALUES (?, ?, ?)
      `)
      for (const pa of backup.project_agents) {
        const mappedProjectId = idMap[pa.project_id]
        if (!mappedProjectId) continue
        insertPA.run(mappedProjectId, pa.workspace_path || '', pa.created_at || new Date().toISOString())
      }

      const insertAE = db.prepare(`
        INSERT OR IGNORE INTO agent_environments (workspace_path, environment_id, created_at)
        VALUES (?, ?, ?)
      `)
      for (const ae of backup.agent_environments) {
        const mappedEnvId = idMap[ae.environment_id]
        if (!mappedEnvId) continue
        insertAE.run(ae.workspace_path || '', mappedEnvId, ae.created_at || new Date().toISOString())
      }

      const insertRole = db.prepare(`INSERT OR REPLACE INTO workspace_roles (workspace_path, role) VALUES (?, ?)`)
      for (const wr of backup.workspace_roles) {
        insertRole.run(wr.workspace_path, wr.role)
      }

      const insertModel = db.prepare(`INSERT OR REPLACE INTO workspace_models (workspace_path, model) VALUES (?, ?)`)
      for (const wm of backup.workspace_models) {
        insertModel.run(wm.workspace_path, wm.model)
      }

      // ---- 4. Plans ----------------------------------------------------------
      const insertPlan = db.prepare(`
        INSERT OR IGNORE INTO plans (id, name, tasks, status, client_id, result, started_at, completed_at, created_at, project_id, type, structured_output, result_status, result_notes, workspace_id, last_heartbeat_at, parent_plan_id, rework_prompt, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      for (const pl of backup.plans) {
        const newId = randomUUID()
        idMap[pl.id] = newId
        insertPlan.run(
          newId,
          pl.name,
          pl.tasks,
          pl.status,
          pl.client_id || null,
          pl.result || null,
          pl.started_at || null,
          pl.completed_at || null,
          pl.created_at || new Date().toISOString(),
          (pl.project_id && idMap[pl.project_id]) || null,
          pl.type || 'workflow',
          pl.structured_output || null,
          pl.result_status || null,
          pl.result_notes || '',
          pl.workspace_id || null,
          pl.last_heartbeat_at || null,
          (pl.parent_plan_id && idMap[pl.parent_plan_id]) || null,
          pl.rework_prompt || '',
          userId,
        )
      }

      // Plan logs
      const insertLog = db.prepare(`
        INSERT OR IGNORE INTO plan_logs (id, plan_id, task_id, level, message, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      for (const log of backup.plan_logs) {
        const mappedPlanId = idMap[log.plan_id]
        if (!mappedPlanId) continue
        insertLog.run(
          log.id || randomUUID(),
          mappedPlanId,
          log.task_id,
          log.level,
          log.message,
          log.created_at || new Date().toISOString(),
        )
      }

      // ---- 5. Kanban tasks ---------------------------------------------------
      const insertKanban = db.prepare(`
        INSERT OR IGNORE INTO kanban_tasks (id, project_id, title, description, column, priority, order_index, workflow_id, result_status, result_notes, pipeline_status, planning_started_at, error_message, created_at, updated_at, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const kt of backup.kanban_tasks) {
        const newId = randomUUID()
        idMap[kt.id] = newId
        insertKanban.run(
          newId,
          (kt.project_id && idMap[kt.project_id]) || null,
          kt.title,
          kt.description || '',
          kt.column || 'backlog',
          kt.priority || 3,
          kt.order_index || 0,
          (kt.workflow_id && idMap[kt.workflow_id]) || null,
          kt.result_status || null,
          kt.result_notes || '',
          kt.pipeline_status || 'idle',
          kt.planning_started_at || null,
          kt.error_message || '',
          kt.created_at || new Date().toISOString(),
          kt.updated_at || new Date().toISOString(),
          userId,
        )
      }

      // Kanban templates
      const insertTemplate = db.prepare(`
        INSERT OR IGNORE INTO kanban_templates (id, project_id, title, description, priority, recurrence, next_run_at, last_run_at, is_public, created_at, updated_at, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const tmpl of backup.kanban_templates) {
        const newId = randomUUID()
        idMap[tmpl.id] = newId
        insertTemplate.run(
          newId,
          (tmpl.project_id && idMap[tmpl.project_id]) || null,
          tmpl.title,
          tmpl.description || '',
          tmpl.priority || 3,
          tmpl.recurrence || '',
          tmpl.next_run_at || null,
          tmpl.last_run_at || null,
          tmpl.is_public != null ? tmpl.is_public : 1,
          tmpl.created_at || new Date().toISOString(),
          tmpl.updated_at || new Date().toISOString(),
          userId,
          userId,
        )
      }

      // ---- 6. Chat sessions --------------------------------------------------
      const insertSession = db.prepare(`
        INSERT OR IGNORE INTO chat_sessions (id, name, project_id, workspace_path, environment_id, sdk_session_id, status, created_at, updated_at, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const cs of backup.chat_sessions) {
        const newId = randomUUID()
        idMap[cs.id] = newId
        insertSession.run(
          newId,
          cs.name,
          (cs.project_id && idMap[cs.project_id]) || null,
          cs.workspace_path,
          (cs.environment_id && idMap[cs.environment_id]) || null,
          null, // reset runtime session
          'idle', // reset running sessions
          cs.created_at || new Date().toISOString(),
          cs.updated_at || new Date().toISOString(),
          userId,
        )
      }

      // Chat messages
      const insertMsg = db.prepare(`
        INSERT OR IGNORE INTO chat_messages (id, session_id, role, content, created_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      for (const msg of backup.chat_messages) {
        const mappedSessionId = idMap[msg.session_id]
        if (!mappedSessionId) continue
        insertMsg.run(
          msg.id || randomUUID(),
          mappedSessionId,
          msg.role,
          msg.content,
          msg.created_at || new Date().toISOString(),
        )
      }

      // ---- 7. Environment variables ------------------------------------------
      const insertEnvVar = db.prepare(`
        INSERT OR IGNORE INTO environment_variables (id, key, value, description, category, is_secret, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const ev of backup.environment_variables) {
        const newId = randomUUID()
        idMap[ev.id] = newId
        insertEnvVar.run(
          newId,
          ev.key,
          ev.value,
          ev.description || '',
          ev.category || 'general',
          ev.is_secret ? 1 : 0,
          ev.created_at || new Date().toISOString(),
          ev.updated_at || new Date().toISOString(),
        )
      }

      // ---- 8. Approvals ------------------------------------------------------
      const insertApproval = db.prepare(`
        INSERT OR IGNORE INTO approvals (id, plan_id, task_id, tool, input, reason, status, responded_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const ap of backup.approvals) {
        const newId = randomUUID()
        idMap[ap.id] = newId
        const mappedPlanId = idMap[ap.plan_id]
        if (!mappedPlanId) continue
        insertApproval.run(
          newId,
          mappedPlanId,
          ap.task_id,
          ap.tool,
          ap.input,
          ap.reason || null,
          ap.status === 'pending' ? 'timeout' : ap.status, // never restore pending
          ap.responded_at || null,
          ap.created_at || new Date().toISOString(),
        )
      }
    })

    // Execute DB import in a transaction
    importDb()

    // Restore agent workspaces on filesystem (outside transaction — filesystem ops are not transactional)
    let agentsRestored = 0
    for (const ws of backup.agent_workspaces || []) {
      try {
        restoreWorkspace(ws)
        agentsRestored++
      } catch (err: any) {
        console.warn(`[backup] Failed to restore agent workspace "${ws.relative_path}": ${err.message}`)
      }
    }

    const result = {
      projects_imported: backup.projects.length,
      environments_imported: backup.environments.length,
      plans_imported: backup.plans.length,
      plan_logs_imported: backup.plan_logs.length,
      kanban_tasks_imported: backup.kanban_tasks.length,
      kanban_templates_imported: backup.kanban_templates.length,
      chat_sessions_imported: backup.chat_sessions.length,
      chat_messages_imported: backup.chat_messages.length,
      env_vars_imported: backup.environment_variables.length,
      agents_restored: agentsRestored,
      version: backup.version,
      exported_at: backup.exported_at,
    }

    return res.json({ data: result, error: null })
  } catch (error: any) {
    console.error('[backup] Import failed:', error)
    return res.status(500).json({ data: null, error: 'Import failed: ' + error.message })
  }
})

export default router
