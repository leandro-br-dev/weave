import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { authenticateToken } from '../middleware/auth.js'
import { db } from '../db/index.js'
import { agentWorkspacePath, envAgentPath, slugify, AGENTS_BASE_PATH } from '../utils/paths.js'
import { updateAgentSettings, rebuildAgentSettings } from '../utils/agentSettings.js'
import { AGENT_TEMPLATES, renderTemplate } from '../utils/claudeMdTemplates.js'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import { getDefaultEnvironmentVariables, mergeEnvironmentVariables } from '../utils/environmentVariables.js'
import { TEAM_TEMPLATES, getTeamTemplateById, renderTeamClaudeMd } from '../utils/teamTemplates.js'
import { seedNativeAgentsForTeam } from '../services/nativeAgentsBootstrap.js'
import { ensureWorkflowDir } from '../services/workflowDir.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = Router()

function getWorkspacePath(project: string): string {
  return path.join(AGENTS_BASE_PATH, project, 'agent-coder')
}

interface WorkspaceInfo {
  id: string
  name: string
  path: string
  exists: boolean
  hasSettings: boolean
  hasClaude: boolean
  baseUrl: string | null
  type: 'agent' | 'env-agent' | 'legacy'
  project_id: string | null
  role: string
  model: string
}

function readJsonSafe(filePath: string): any {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

function listAllWorkspaces(): WorkspaceInfo[] {
  if (!fs.existsSync(AGENTS_BASE_PATH)) {
    return []
  }

  const results: WorkspaceInfo[] = []

  // Read all project directories
  const projectDirs = fs.readdirSync(AGENTS_BASE_PATH, { withFileTypes: true })
    .filter(d => d.isDirectory())

  for (const projectDir of projectDirs) {
    const projectPath = path.join(AGENTS_BASE_PATH, projectDir.name)
    const agentsDirPath = path.join(projectPath, 'agents')

    // New structure: {project}/agents/{agent-name}/
    if (fs.existsSync(agentsDirPath)) {
      const agentDirs = fs.readdirSync(agentsDirPath, { withFileTypes: true })
        .filter(d => d.isDirectory())

      for (const agentDir of agentDirs) {
        const fullPath = path.join(agentsDirPath, agentDir.name)
        const settingsPath = path.join(fullPath, '.claude', 'settings.local.json')
        const claudeMdPath = path.join(fullPath, 'CLAUDE.md')
        const settings = readJsonSafe(settingsPath)

        // Fetch project_id from project_agents table
        const projectLink = db.prepare(
          'SELECT project_id FROM project_agents WHERE workspace_path = ? LIMIT 1'
        ).get(fullPath) as any

        // Fetch role from team_roles table
        const roleRow = db.prepare(
          'SELECT role FROM team_roles WHERE workspace_path = ? LIMIT 1'
        ).get(fullPath) as any

        // Read model from settings.local.json (ANTHROPIC_MODEL env var)
        const model = settings?.env?.ANTHROPIC_MODEL || ''

        results.push({
          id: Buffer.from(fullPath).toString('base64url'),
          name: agentDir.name,
          path: fullPath,
          exists: true,
          hasSettings: fs.existsSync(settingsPath),
          hasClaude: fs.existsSync(claudeMdPath),
          baseUrl: settings?.env?.ANTHROPIC_BASE_URL ?? null,
          type: 'agent',
          project_id: projectLink?.project_id ?? null,
          role: roleRow?.role ?? 'coder',
          model: model
        })
      }
    }

    // Environment agents: {project}/{env}/agent-coder/ and {project}/{env}/agent-planner/
    const envDirs = fs.readdirSync(projectPath, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name !== 'agents')

    for (const envDir of envDirs) {
      const envDirPath = path.join(projectPath, envDir.name)
      // Scan for all agent subdirectories (agent-coder, agent-planner, etc.)
      const agentSubDirs = fs.readdirSync(envDirPath, { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name.startsWith('agent-'))

      for (const agentSubDir of agentSubDirs) {
        const agentPath = path.join(envDirPath, agentSubDir.name)
        const settingsPath = path.join(agentPath, '.claude', 'settings.local.json')
        const claudeMdPath = path.join(agentPath, 'CLAUDE.md')
        const settings = readJsonSafe(settingsPath)

        // Fetch project_id from project_agents table
        const projectLink = db.prepare(
          'SELECT project_id FROM project_agents WHERE workspace_path = ? LIMIT 1'
        ).get(agentPath) as any

        // Fetch role from team_roles table
        const roleRow = db.prepare(
          'SELECT role FROM team_roles WHERE workspace_path = ? LIMIT 1'
        ).get(agentPath) as any

        // Derive role from directory name as fallback
        const dirRole = agentSubDir.name.replace('agent-', '') // 'coder' or 'planner'

        // Read model from settings.local.json (ANTHROPIC_MODEL env var)
        const model = settings?.env?.ANTHROPIC_MODEL || ''

        results.push({
          id: Buffer.from(agentPath).toString('base64url'),
          name: `${projectDir.name}/${envDir.name}/${dirRole}`,
          path: agentPath,
          exists: true,
          hasSettings: fs.existsSync(settingsPath),
          hasClaude: fs.existsSync(claudeMdPath),
          baseUrl: settings?.env?.ANTHROPIC_BASE_URL ?? null,
          type: 'env-agent',
          project_id: projectLink?.project_id ?? null,
          role: roleRow?.role ?? dirRole,
          model: model
        })
      }
    }

    // Legacy structure: {project}/agent-coder/ (for backward compatibility)
    const legacyAgentCoderPath = path.join(projectPath, 'agent-coder')
    if (fs.existsSync(legacyAgentCoderPath)) {
      const settingsPath = path.join(legacyAgentCoderPath, '.claude', 'settings.local.json')
      const claudeMdPath = path.join(legacyAgentCoderPath, 'CLAUDE.md')
      const settings = readJsonSafe(settingsPath)

      // Fetch project_id from project_agents table
      const projectLink = db.prepare(
        'SELECT project_id FROM project_agents WHERE workspace_path = ? LIMIT 1'
      ).get(legacyAgentCoderPath) as any

      // Fetch role from team_roles table
      const roleRow = db.prepare(
        'SELECT role FROM team_roles WHERE workspace_path = ? LIMIT 1'
      ).get(legacyAgentCoderPath) as any

      // Read model from settings.local.json (ANTHROPIC_MODEL env var)
      const model = settings?.env?.ANTHROPIC_MODEL || ''

      results.push({
        id: Buffer.from(legacyAgentCoderPath).toString('base64url'),
        name: projectDir.name,
        path: legacyAgentCoderPath,
        exists: true,
        hasSettings: fs.existsSync(settingsPath),
        hasClaude: fs.existsSync(claudeMdPath),
        baseUrl: settings?.env?.ANTHROPIC_BASE_URL ?? null,
        type: 'legacy',
        project_id: projectLink?.project_id ?? null,
        role: roleRow?.role ?? 'coder',
        model: model
      })
    }
  }

  return results
}

function readFileSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

function getSkillParam(reqParams: any): string {
  const skill = reqParams.skill
  return Array.isArray(skill) ? skill[0] : skill
}

function getAgentParam(reqParams: any): string {
  const agent = reqParams.agent
  return Array.isArray(agent) ? agent[0] : agent
}

/**
 * Resolve a frontmatter agent name to the actual .md file on disk.
 * The frontend sends the frontmatter `name` (e.g. "dev-backend"), but the
 * file may be named differently (e.g. "backend-dev.md"). This helper
 * first tries the direct slug, then falls back to scanning the agents
 * directory for a matching frontmatter name.
 */
function resolveAgentFile(agentsDir: string, agentSlug: string): { filePath: string; fileSlug: string } | null {
  const directPath = path.join(agentsDir, `${agentSlug}.md`)
  if (fs.existsSync(directPath)) {
    return { filePath: directPath, fileSlug: agentSlug }
  }
  if (!fs.existsSync(agentsDir)) return null
  const mdFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'))
  for (const f of mdFiles) {
    try {
      const content = fs.readFileSync(path.join(agentsDir, f), 'utf-8')
      const fm = parseYamlFrontmatter(content)
      if (fm?.name === agentSlug) {
        return { filePath: path.join(agentsDir, f), fileSlug: f.replace(/\.md$/, '') }
      }
    } catch { /* skip unreadable files */ }
  }
  return null
}

function getIdParam(reqParams: any): string {
  const id = reqParams.id
  return Array.isArray(id) ? id[0] : id
}


// GET /api/teams/templates — listar templates de equipe disponíveis
router.get('/templates', authenticateToken, (_req, res) => {
  return res.json({
    data: AGENT_TEMPLATES.map(t => ({
      id: t.id,
      label: t.label,
      description: t.description,
    })),
    error: null
  })
})

// GET /api/teams/team-templates — listar templates de time pre-configurados
router.get('/team-templates', authenticateToken, (_req, res) => {
  return res.json({
    data: TEAM_TEMPLATES.map(t => ({
      id: t.id,
      name: t.name,
      label: t.label,
      description: t.description,
      role: t.role,
      subAgents: t.subAgents.map(sa => ({
        name: sa.name,
        role: sa.role,
        description: sa.description,
        suggestedModel: sa.suggestedModel,
      })),
      permissions: t.permissions,
      claudeMd: t.claudeMd,
    })),
    error: null
  })
})

// GET /api/workspaces — listar todos os projetos
router.get('/', authenticateToken, (req, res) => {
  const all = listAllWorkspaces()
  const { project_id } = req.query
  if (project_id) {
    const linked = db.prepare(
      'SELECT workspace_path FROM project_agents WHERE project_id = ?'
    ).all(project_id as string) as any[]
    const linkedPaths = new Set(linked.map(l => l.workspace_path))
    const filtered = all.filter(ws => linkedPaths.has(ws.path))
    return res.json({ data: filtered, error: null })
  }
  return res.json({ data: all, error: null })
})

// GET /api/workspaces/native-agents — listar todos os agentes nativos disponíveis
router.get('/native-agents', authenticateToken, (_req, res) => {
  const nativeAgentsPath = path.join(__dirname, '../../../native-agents')

  if (!fs.existsSync(nativeAgentsPath)) {
    return res.status(404).json({ data: null, error: 'Native agents directory not found' })
  }

  try {
    const agents: Array<{
      name: string
      description: string
      model: string
      tools: string | string[]
      color: string
      file: string
      teamType: string
      relativePath: string
    }> = []

    // Known team-type subdirectories to scan
    const teamTypes = ['plan', 'dev', 'staging']

    // Scan each team-type subdirectory
    for (const teamType of teamTypes) {
      const teamDir = path.join(nativeAgentsPath, teamType)
      if (!fs.existsSync(teamDir)) continue

      const files = fs.readdirSync(teamDir)
        .filter(f => f.endsWith('.md') && f !== 'README.md')

      for (const file of files) {
        const filePath = path.join(teamDir, file)
        const content = fs.readFileSync(filePath, 'utf-8')
        const frontmatter = parseYamlFrontmatter(content)

        agents.push({
          name: frontmatter?.name || file.replace('.md', ''),
          description: frontmatter?.description || '',
          model: frontmatter?.model || 'unknown',
          tools: frontmatter?.tools || [],
          color: frontmatter?.color || 'gray',
          file: file,
          teamType,
          relativePath: `${teamType}/${file}`,
        })
      }
    }

    // Also scan root-level .md files (excluding README, STRUCTURE, and known subdirectories)
    const rootEntries = fs.readdirSync(nativeAgentsPath, { withFileTypes: true })
    for (const entry of rootEntries) {
      if (!entry.isFile()) continue
      if (!entry.name.endsWith('.md')) continue
      if (entry.name === 'README.md') continue

      const filePath = path.join(nativeAgentsPath, entry.name)
      const content = fs.readFileSync(filePath, 'utf-8')
      const frontmatter = parseYamlFrontmatter(content)

      agents.push({
        name: frontmatter?.name || entry.name.replace('.md', ''),
        description: frontmatter?.description || '',
        model: frontmatter?.model || 'unknown',
        tools: frontmatter?.tools || [],
        color: frontmatter?.color || 'gray',
        file: entry.name,
        teamType: 'root',
        relativePath: entry.name,
      })
    }

    // Sort by teamType then name for consistent ordering
    agents.sort((a, b) => {
      const typeOrder: Record<string, number> = { plan: 0, dev: 1, staging: 2, root: 3 }
      const typeCompare = (typeOrder[a.teamType] ?? 99) - (typeOrder[b.teamType] ?? 99)
      if (typeCompare !== 0) return typeCompare
      return a.name.localeCompare(b.name)
    })

    return res.json({ data: agents, error: null })
  } catch (error) {
    console.error('Error reading native agents:', error)
    return res.status(500).json({
      data: null,
      error: error instanceof Error ? error.message : 'Failed to read native agents'
    })
  }
})

// GET /api/workspaces/:id — detalhes de um workspace
router.get('/:id', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const workspace = listAllWorkspaces().find(ws => ws.id === id)

  if (!workspace) {
    return res.status(404).json({ data: null, error: 'Workspace not found' })
  }

  const coderPath = workspace.path

  const settingsPath = path.join(coderPath, '.claude', 'settings.local.json')
  const claudeMdPath = path.join(coderPath, 'CLAUDE.md')
  const skillsPath = path.join(coderPath, '.claude', 'skills')
  const agentsPath = path.join(coderPath, '.claude', 'agents')

  const skills = fs.existsSync(skillsPath)
    ? fs.readdirSync(skillsPath, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => ({
          name: e.name,
          hasSkillMd: fs.existsSync(path.join(skillsPath, e.name, 'SKILL.md'))
        }))
    : []

  const agents = fs.existsSync(agentsPath)
    ? fs.readdirSync(agentsPath)
        .filter(f => f.endsWith('.md'))
        .map(f => {
          const content = fs.readFileSync(path.join(agentsPath, f), 'utf-8')
          const frontmatter = parseYamlFrontmatter(content)
          return {
            name: frontmatter?.name || f.replace('.md', ''),
            file: f
          }
        })
    : []

  // Fetch linked environments
  const linkedEnvs = db.prepare(`
    SELECT e.id, e.name, e.type, e.project_path
    FROM agent_environments ae
    JOIN environments e ON e.id = ae.environment_id
    WHERE ae.workspace_path = ?
  `).all(coderPath) as any[]

  // Fetch role from team_roles table
  const roleRow = db.prepare(
    'SELECT role FROM team_roles WHERE workspace_path = ? LIMIT 1'
  ).get(coderPath) as any

  // Read model from settings.local.json
  const settings = readJsonSafe(settingsPath)
  const model = settings?.env?.ANTHROPIC_MODEL || ''

  return res.json({
    data: {
      id: id,
      name: workspace.name,
      path: coderPath,
      exists: fs.existsSync(coderPath),
      claudeMd: readFileSafe(claudeMdPath),
      settings: settings,
      skills,
      agents,
      environments: linkedEnvs,
      project_id: workspace.project_id,
      role: roleRow?.role ?? 'coder',
      model: model,
    },
    error: null
  })
})

// POST /api/workspaces — criar novo workspace
router.post('/', authenticateToken, (req, res) => {
  const {
    name,
    project_path,
    anthropic_base_url = 'http://localhost:8083',
    project_id,
    template_id,
    team_id,
    role = 'coder',
    model = 'default',
    environment_variables: userEnvVars = {}
  } = req.body

  if (!name) {
    return res.status(400).json({ data: null, error: 'name is required' })
  }

  if (!project_id) {
    return res.status(400).json({
      data: null,
      error: 'project_id is required to create an agent. Agents must belong to a project.'
    })
  }

  // Buscar o projeto para obter o slug
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id) as any
  if (!project) {
    return res.status(404).json({ data: null, error: 'Project not found' })
  }

  // Gerar o path usando a nova estrutura
  const coderPath = agentWorkspacePath(AGENTS_BASE_PATH, project.name, name)

  if (fs.existsSync(coderPath)) {
    return res.status(409).json({ data: null, error: 'Workspace already exists' })
  }

  const claudeDir = path.join(coderPath, '.claude')
  fs.mkdirSync(path.join(claudeDir, 'skills'), { recursive: true })
  fs.mkdirSync(path.join(claudeDir, 'agents'), { recursive: true })

  // Create .gitignore in the workspace to exclude agent docs
  const wsGitignore = path.join(coderPath, '.gitignore')
  if (!fs.existsSync(wsGitignore)) {
    fs.writeFileSync(wsGitignore, '.agent-docs/\n')
  }

  const projectTarget = project_path || `/root/projects/${project.name}`
  if (!fs.existsSync(projectTarget)) {
    fs.mkdirSync(projectTarget, { recursive: true })
  }

  // Get default environment variables from database
  const defaultEnvVars = getDefaultEnvironmentVariables()

  // Start with user-provided base URL
  let userProvidedVars: Record<string, string> = {}
  if (anthropic_base_url) {
    userProvidedVars.ANTHROPIC_BASE_URL = anthropic_base_url
  }

  // Add model if specified
  if (model && model !== 'default') {
    userProvidedVars.ANTHROPIC_MODEL = model
  }

  // Merge user-provided environment variables with user-provided base URL
  userProvidedVars = { ...userProvidedVars, ...userEnvVars }

  // Final merge: user vars take precedence over defaults
  const finalEnvVars = mergeEnvironmentVariables(userProvidedVars, defaultEnvVars)

  // Resolve team template if team_id is provided
  const teamTemplate = team_id ? getTeamTemplateById(team_id) : null

  // Use team permissions or default
  const permissionsAllow = teamTemplate?.permissions.allow ?? ['Read', 'Edit', 'Write', 'Bash', 'Glob']
  const permissionsDeny = teamTemplate?.permissions.deny ?? ['Bash(git push --force)', 'Bash(sudo:*)']

  const settings = {
    $schema: 'https://json.schemastore.org/claude-code-settings.json',
    env: finalEnvVars,
    permissions: {
      allow: permissionsAllow,
      deny: permissionsDeny,
      additionalDirectories: [projectTarget]
    }
  }
  fs.writeFileSync(
    path.join(claudeDir, 'settings.local.json'),
    JSON.stringify(settings, null, 2)
  )

  // Gerar conteúdo do CLAUDE.md
  let claudeMdContent: string
  if (teamTemplate) {
    // Use team template CLAUDE.md (highest priority)
    claudeMdContent = renderTeamClaudeMd(teamTemplate, {
      agentName: name,
      projectName: project?.name ?? 'Unknown Project',
      workspacePath: coderPath,
    })
  } else if (template_id) {
    const template = AGENT_TEMPLATES.find(t => t.id === template_id)
    if (template) {
      claudeMdContent = renderTemplate(template, {
        agentName: name,
        projectName: project?.name ?? 'Unknown Project',
      })
    } else {
      claudeMdContent = `# ${name}\n\nAgent for project: ${project?.name ?? ''}\n`
    }
  } else {
    // Template genérico se nenhum selecionado
    const generic = AGENT_TEMPLATES.find(t => t.id === 'generic')!
    claudeMdContent = renderTemplate(generic, {
      agentName: name,
      projectName: project?.name ?? 'Unknown Project',
    })
  }

  fs.writeFileSync(path.join(coderPath, 'CLAUDE.md'), claudeMdContent)

  // Criar vínculo com o projeto
  db.prepare(
    'INSERT OR IGNORE INTO project_agents (project_id, workspace_path) VALUES (?, ?)'
  ).run(project_id, coderPath)

  // Save role if provided
  if (role && role !== 'generic') {
    db.prepare(
      'INSERT OR REPLACE INTO team_roles (workspace_path, role) VALUES (?, ?)'
    ).run(coderPath, role)
  }

  // Seed native agents when a team template is used
  if (team_id) {
    try {
      // Derive team type from the team template ID: 'plan-team' → 'plan', etc.
      const teamTypeMap: Record<string, string> = {
        'plan-team': 'plan',
        'dev-team': 'dev',
        'staging-team': 'staging',
      }
      const teamType = teamTypeMap[team_id]
      if (teamType) {
        seedNativeAgentsForTeam(coderPath, teamType)
      }
    } catch (err) {
      console.error('[workspaces] Failed to seed native agents:', err)
    }
  }

  return res.status(201).json({
    data: {
      id: Buffer.from(coderPath).toString('base64url'),
      path: coderPath,
      name: name,
      project_id: project_id,
      role: role
    },
    error: null
  })
})

// PUT /api/workspaces/:id/claude-md — salvar CLAUDE.md
router.put('/:id/claude-md', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const workspace = listAllWorkspaces().find(ws => ws.id === id)

  if (!workspace) {
    return res.status(404).json({ data: null, error: 'Workspace not found' })
  }

  const coderPath = workspace.path

  // Create agent-coder directory if it doesn't exist
  if (!fs.existsSync(coderPath)) {
    fs.mkdirSync(coderPath, { recursive: true })
  }

  const { content } = req.body
  if (typeof content !== 'string') {
    return res.status(400).json({ data: null, error: 'content must be a string' })
  }
  fs.writeFileSync(path.join(coderPath, 'CLAUDE.md'), content)
  return res.json({ data: { saved: true }, error: null })
})

// PUT /api/workspaces/:id/settings — salvar settings.local.json
router.put('/:id/settings', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const workspace = listAllWorkspaces().find(ws => ws.id === id)

  if (!workspace) {
    return res.status(404).json({ data: null, error: 'Workspace not found' })
  }

  const coderPath = workspace.path

  // Create agent-coder directory if it doesn't exist
  if (!fs.existsSync(coderPath)) {
    fs.mkdirSync(coderPath, { recursive: true })
  }

  const { settings } = req.body
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ data: null, error: 'settings must be an object' })
  }
  const claudeDir = path.join(coderPath, '.claude')
  if (!fs.existsSync(claudeDir)) fs.mkdirSync(claudeDir, { recursive: true })
  fs.writeFileSync(
    path.join(claudeDir, 'settings.local.json'),
    JSON.stringify(settings, null, 2)
  )
  return res.json({ data: { saved: true }, error: null })
})

// PUT /api/workspaces/:id — atualizar propriedades do workspace (model, role, etc)
router.put('/:id', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const workspace = listAllWorkspaces().find(ws => ws.id === id)

  if (!workspace) {
    return res.status(404).json({ data: null, error: 'Workspace not found' })
  }

  const { model, role } = req.body
  const updates: any = {}

  // Update role if provided
  if (role !== undefined && role !== null) {
    if (!role) {
      return res.status(400).json({ data: null, error: 'role cannot be empty' })
    }

    const validRoles = ['planner', 'coder', 'reviewer', 'tester', 'debugger', 'devops', 'generic']
    if (!validRoles.includes(role)) {
      return res.status(400).json({ data: null, error: `role must be one of: ${validRoles.join(', ')}` })
    }

    db.prepare(
      'INSERT OR REPLACE INTO team_roles (workspace_path, role) VALUES (?, ?)'
    ).run(workspace.path, role)

    updates.role = role
  }

  // Update model if provided
  if (model !== undefined && model !== null) {
    const validModels = ['default', 'claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001']
    if (!validModels.includes(model)) {
      return res.status(400).json({ data: null, error: `model must be one of: ${validModels.join(', ')}` })
    }

    // Update settings.local.json
    const coderPath = workspace.path
    const claudeDir = path.join(coderPath, '.claude')
    const settingsPath = path.join(claudeDir, 'settings.local.json')

    let settings: any = {}
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
    } else {
      // Create basic settings if it doesn't exist
      if (!fs.existsSync(claudeDir)) {
        fs.mkdirSync(claudeDir, { recursive: true })
      }
      settings = {
        '$schema': 'https://json.schemastore.org/claude-code-settings.json',
        env: {},
        permissions: { allow: ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Skill'], deny: [] }
      }
    }

    if (!settings.env) {
      settings.env = {}
    }

    // Set or remove ANTHROPIC_MODEL based on the value
    if (model && model !== 'default') {
      settings.env.ANTHROPIC_MODEL = model
    } else {
      // Remove the variable if model = default (uses the default Claude model)
      delete settings.env.ANTHROPIC_MODEL
    }

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))

    // Store in database for quick access
    db.prepare(
      'INSERT OR REPLACE INTO team_models (workspace_path, model) VALUES (?, ?)'
    ).run(workspace.path, model)

    updates.model = model
  }

  // Fetch updated workspace data
  const roleRow = db.prepare(
    'SELECT role FROM team_roles WHERE workspace_path = ? LIMIT 1'
  ).get(workspace.path) as any

  const modelRow = db.prepare(
    'SELECT model FROM team_models WHERE workspace_path = ? LIMIT 1'
  ).get(workspace.path) as any

  return res.json({
    data: {
      id: id,
      workspace_path: workspace.path,
      role: roleRow?.role ?? 'coder',
      model: modelRow?.model ?? '',
      ...updates
    },
    error: null
  })
})

// PUT /api/workspaces/:id/role — atualizar role do workspace
router.put('/:id/role', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const workspace = listAllWorkspaces().find(ws => ws.id === id)

  if (!workspace) {
    return res.status(404).json({ data: null, error: 'Workspace not found' })
  }

  const { role } = req.body
  if (!role) {
    return res.status(400).json({ data: null, error: 'role is required' })
  }

  const validRoles = ['planner', 'coder', 'reviewer', 'tester', 'debugger', 'devops', 'generic']
  if (!validRoles.includes(role)) {
    return res.status(400).json({ data: null, error: `role must be one of: ${validRoles.join(', ')}` })
  }

  db.prepare(
    'INSERT OR REPLACE INTO team_roles (workspace_path, role) VALUES (?, ?)'
  ).run(workspace.path, role)

  return res.json({ data: { role }, error: null })
})

// PUT /api/workspaces/:id/project — atualizar project_id do workspace
router.put('/:id/project', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const workspace = listAllWorkspaces().find(ws => ws.id === id)

  if (!workspace) {
    return res.status(404).json({ data: null, error: 'Workspace not found' })
  }

  const { project_id } = req.body
  if (project_id === undefined || project_id === null) {
    return res.status(400).json({ data: null, error: 'project_id is required' })
  }

  // Validate project_id format (basic validation)
  if (typeof project_id !== 'string') {
    return res.status(400).json({ data: null, error: 'project_id must be a string' })
  }

  const coderPath = workspace.path

  // Update project_agents table
  // First remove any existing link
  db.prepare(
    'DELETE FROM project_agents WHERE workspace_path = ?'
  ).run(coderPath)

  // If project_id is not empty string, create new link
  if (project_id !== '') {
    db.prepare(
      'INSERT OR REPLACE INTO project_agents (project_id, workspace_path) VALUES (?, ?)'
    ).run(project_id, coderPath)
  }

  return res.json({ data: { project_id }, error: null })
})

// PUT /api/workspaces/:id/model — atualizar model do workspace
router.put('/:id/model', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const workspace = listAllWorkspaces().find(ws => ws.id === id)

  if (!workspace) {
    return res.status(404).json({ data: null, error: 'Workspace not found' })
  }

  const { model } = req.body
  if (model === undefined || model === null) {
    return res.status(400).json({ data: null, error: 'model is required' })
  }

  const validModels = ['default', 'claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001']
  if (!validModels.includes(model)) {
    return res.status(400).json({ data: null, error: `model must be one of: ${validModels.join(', ')}` })
  }

  // Update settings.local.json
  const coderPath = workspace.path
  const claudeDir = path.join(coderPath, '.claude')
  const settingsPath = path.join(claudeDir, 'settings.local.json')

  let settings: any = {}
  if (fs.existsSync(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
  } else {
    // Create basic settings if it doesn't exist
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true })
    }
    settings = {
      '$schema': 'https://json.schemastore.org/claude-code-settings.json',
      env: {},
      permissions: { allow: ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Skill'], deny: [] }
    }
  }

  if (!settings.env) {
    settings.env = {}
  }

  // Set or remove ANTHROPIC_MODEL based on the value
  if (model && model !== 'default') {
    settings.env.ANTHROPIC_MODEL = model
  } else {
    // Remove the variable if model = default (uses the default Claude model)
    delete settings.env.ANTHROPIC_MODEL
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))

  // Store in database for quick access
  db.prepare(
    'INSERT OR REPLACE INTO team_models (workspace_path, model) VALUES (?, ?)'
  ).run(workspace.path, model)

  return res.json({ data: { model }, error: null })
})

// DELETE /api/workspaces/:id — remover workspace
router.delete('/:id', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const workspace = listAllWorkspaces().find(ws => ws.id === id)

  if (!workspace) {
    return res.status(404).json({ data: null, error: 'Workspace not found' })
  }

  const coderPath = workspace.path

  // Remove from project_agents table to clean up the link
  db.prepare(
    'DELETE FROM project_agents WHERE workspace_path = ?'
  ).run(coderPath)

  // Also remove from team_roles table if it exists
  try {
    db.prepare(
      'DELETE FROM team_roles WHERE workspace_path = ?'
    ).run(coderPath)
  } catch {}

  // Also remove from team_models table if it exists
  try {
    db.prepare(
      'DELETE FROM team_models WHERE workspace_path = ?'
    ).run(coderPath)
  } catch {}

  // Also remove from agent_environments table if any links exist
  db.prepare(
    'DELETE FROM agent_environments WHERE workspace_path = ?'
  ).run(coderPath)

  // Delete ONLY the specific workspace directory, not the entire project
  fs.rmSync(coderPath, { recursive: true, force: true })

  return res.json({ data: { deleted: true, workspace_path: coderPath }, error: null })
})

// PUT /api/workspaces/:id/rename — renomear workspace (equipe)
router.put('/:id/rename', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const { name } = req.body

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ data: null, error: 'name is required and must be a string' })
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return res.status(400).json({
      data: null,
      error: 'name must be alphanumeric (hyphens and underscores allowed)'
    })
  }

  const workspace = listAllWorkspaces().find(ws => ws.id === id)

  if (!workspace) {
    return res.status(404).json({ data: null, error: 'Workspace not found' })
  }

  const oldProjectPath = path.dirname(workspace.path) // The actual project root
  const newProjectPath = path.join(AGENTS_BASE_PATH, name)

  if (fs.existsSync(newProjectPath)) {
    return res.status(409).json({ data: null, error: 'An agent with this name already exists' })
  }

  try {
    fs.renameSync(oldProjectPath, newProjectPath)
    const oldCoderPath = workspace.path
    const newCoderPath = getWorkspacePath(name)
    return res.json({ data: { old_path: oldCoderPath, new_path: newCoderPath }, error: null })
  } catch (error) {
    return res.status(500).json({
      data: null,
      error: `Failed to rename agent: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
  }
})

// GET /api/workspaces/:id/skills/:skill — ler SKILL.md
router.get('/:id/skills/:skill', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const workspace = listAllWorkspaces().find(ws => ws.id === id)

  if (!workspace) {
    return res.status(404).json({ data: null, error: 'Workspace not found' })
  }

  const skillPath = path.join(
    workspace.path, '.claude', 'skills',
    getSkillParam(req.params), 'SKILL.md'
  )
  const content = readFileSafe(skillPath)
  if (content === null) return res.status(404).json({ data: null, error: 'Skill not found' })
  return res.json({ data: { name: getSkillParam(req.params), content }, error: null })
})

// POST /api/workspaces/:id/skills — instalar skill via URL ou conteúdo
router.post('/:id/skills', authenticateToken, (req, res) => {
  const { name, content } = req.body
  if (!name) return res.status(400).json({ data: null, error: 'name is required' })
  if (!content) return res.status(400).json({ data: null, error: 'content is required' })

  const id = getIdParam(req.params)
  const workspace = listAllWorkspaces().find(ws => ws.id === id)

  if (!workspace) {
    return res.status(404).json({ data: null, error: 'Workspace not found' })
  }

  const coderPath = workspace.path
  // Create agent-coder directory if it doesn't exist
  if (!fs.existsSync(coderPath)) {
    fs.mkdirSync(coderPath, { recursive: true })
  }

  const skillDir = path.join(coderPath, '.claude', 'skills', name)
  fs.mkdirSync(skillDir, { recursive: true })
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content)
  return res.status(201).json({ data: { name, installed: true }, error: null })
})

// DELETE /api/workspaces/:id/skills/:skill
router.delete('/:id/skills/:skill', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const workspace = listAllWorkspaces().find(ws => ws.id === id)

  if (!workspace) {
    return res.status(404).json({ data: null, error: 'Workspace not found' })
  }

  const skillDir = path.join(
    workspace.path, '.claude', 'skills', getSkillParam(req.params)
  )
  if (!fs.existsSync(skillDir)) {
    return res.status(404).json({ data: null, error: 'Skill not found' })
  }
  fs.rmSync(skillDir, { recursive: true, force: true })
  return res.json({ data: { deleted: true }, error: null })
})

// GET /api/workspaces/:id/agents/:agent — ler agent .md
router.get('/:id/agents/:agent', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const workspace = listAllWorkspaces().find(ws => ws.id === id)

  if (!workspace) {
    return res.status(404).json({ data: null, error: 'Agent not found' })
  }

  const agentSlug = getAgentParam(req.params)
  const agentsDir = path.join(workspace.path, '.claude', 'agents')
  const resolved = resolveAgentFile(agentsDir, agentSlug)
  if (!resolved) return res.status(404).json({ data: null, error: 'Agent not found' })
  const content = readFileSafe(resolved.filePath)
  if (content === null) return res.status(404).json({ data: null, error: 'Agent not found' })
  return res.json({ data: { name: agentSlug, content }, error: null })
})

// PUT /api/workspaces/:id/agents/:agent — criar ou editar agent .md
router.put('/:id/agents/:agent', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const workspace = listAllWorkspaces().find(ws => ws.id === id)

  if (!workspace) {
    return res.status(404).json({ data: null, error: 'Workspace not found' })
  }

  const coderPath = workspace.path
  // Create agent-coder directory if it doesn't exist
  if (!fs.existsSync(coderPath)) {
    fs.mkdirSync(coderPath, { recursive: true })
  }

  const { content } = req.body
  if (typeof content !== 'string') {
    return res.status(400).json({ data: null, error: 'content must be a string' })
  }
  const agentsDir = path.join(coderPath, '.claude', 'agents')
  if (!fs.existsSync(agentsDir)) fs.mkdirSync(agentsDir, { recursive: true })

  // If an existing file matches this agent name (by frontmatter), update it in place;
  // otherwise create a new file using the slug as filename.
  const agentSlug = getAgentParam(req.params)
  const resolved = resolveAgentFile(agentsDir, agentSlug)
  const destPath = resolved
    ? resolved.filePath
    : path.join(agentsDir, `${agentSlug}.md`)
  fs.writeFileSync(destPath, content)
  return res.json({ data: { saved: true }, error: null })
})

// DELETE /api/workspaces/:id/agents/:agent
router.delete('/:id/agents/:agent', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const workspace = listAllWorkspaces().find(ws => ws.id === id)

  if (!workspace) {
    return res.status(404).json({ data: null, error: 'Agent not found' })
  }

  const agentSlug = getAgentParam(req.params)
  const agentsDir = path.join(workspace.path, '.claude', 'agents')
  const resolved = resolveAgentFile(agentsDir, agentSlug)

  // Delete the file if it exists; if it's already gone, that's fine —
  // we still proceed to clean up any database references so the agent
  // is fully unlinked from the team.
  let fileDeleted = false
  if (resolved) {
    fs.unlinkSync(resolved.filePath)
    fileDeleted = true
  }

  // Clean up related database entries (team_native_agents, team_models)
  // Try both the frontmatter name and the file slug to cover all cases
  const workspacePath = workspace.path
  db.prepare(
    'DELETE FROM team_native_agents WHERE team_workspace_path = ? AND slug = ?'
  ).run(workspacePath, agentSlug)
  if (resolved) {
    db.prepare(
      'DELETE FROM team_native_agents WHERE team_workspace_path = ? AND slug = ?'
    ).run(workspacePath, resolved.fileSlug)
  }

  const modelKey = `${workspacePath}::${agentSlug}`
  db.prepare(
    'DELETE FROM team_models WHERE workspace_path = ?'
  ).run(modelKey)

  return res.json({ data: { deleted: true, fileExisted: fileDeleted }, error: null })
})

// GET /api/workspaces/:id/environments — listar ambientes vinculados
router.get('/:id/environments', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const ws = listAllWorkspaces().find(w => w.id === id)
  if (!ws) return res.status(404).json({ data: null, error: 'Not found' })

  const rows = db.prepare(`
    SELECT e.*, p.name as project_name
    FROM agent_environments ae
    JOIN environments e ON e.id = ae.environment_id
    JOIN projects p ON p.id = e.project_id
    WHERE ae.workspace_path = ?
  `).all(ws.path)

  return res.json({ data: rows, error: null })
})

// POST /api/workspaces/:id/environments — vincular ambiente
router.post('/:id/environments', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const ws = listAllWorkspaces().find(w => w.id === id)
  if (!ws) return res.status(404).json({ data: null, error: 'Not found' })

  const { environment_id, set_as_default } = req.body
  if (!environment_id) return res.status(400).json({ data: null, error: 'environment_id required' })

  const env = db.prepare('SELECT * FROM environments WHERE id = ?').get(environment_id) as any
  if (!env) return res.status(404).json({ data: null, error: 'Environment not found' })

  db.prepare(
    'INSERT OR IGNORE INTO agent_environments (workspace_path, environment_id) VALUES (?, ?)'
  ).run(ws.path, environment_id)

  // If set_as_default is true, also set this workspace as the environment's default team
  if (set_as_default) {
    db.prepare('UPDATE environments SET default_team = ? WHERE id = ?').run(ws.path, environment_id)
    // Also update agent_workspace for backwards compatibility if role is coder
    const roleRow = db.prepare('SELECT role FROM team_roles WHERE workspace_path = ?').get(ws.path) as any
    if (roleRow?.role === 'coder') {
      db.prepare('UPDATE environments SET agent_workspace = ? WHERE id = ?').run(ws.path, environment_id)
    }
  }

  // Atualizar additionalDirectories no settings.local.json
  if (env.project_path) {
    updateAgentSettings(ws.path, [env.project_path])
  }

  return res.status(201).json({ data: { linked: true }, error: null })
})

// DELETE /api/workspaces/:id/environments — desvincular ambiente
router.delete('/:id/environments', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const ws = listAllWorkspaces().find(w => w.id === id)
  if (!ws) return res.status(404).json({ data: null, error: 'Not found' })

  const { environment_id } = req.body

  // If this workspace is the default team for the environment, clear it
  const env = db.prepare('SELECT default_team FROM environments WHERE id = ?').get(environment_id) as any
  if (env && env.default_team === ws.path) {
    db.prepare('UPDATE environments SET default_team = NULL WHERE id = ?').run(environment_id)
    // Also clear agent_workspace if it matches
    db.prepare('UPDATE environments SET agent_workspace = ? WHERE id = ? AND agent_workspace = ?').run('', environment_id, ws.path)
  }

  db.prepare(
    'DELETE FROM agent_environments WHERE workspace_path = ? AND environment_id = ?'
  ).run(ws.path, environment_id)

  // Reconstruir additionalDirectories sem o ambiente removido
  const remaining = db.prepare(`
    SELECT e.project_path FROM agent_environments ae
    JOIN environments e ON e.id = ae.environment_id
    WHERE ae.workspace_path = ? AND e.project_path IS NOT NULL
  `).all(ws.path) as any[]

  rebuildAgentSettings(ws.path, remaining.map(r => r.project_path))

  return res.json({ data: { unlinked: true }, error: null })
})

// POST /api/workspaces/:id/native-skills/:skillId — vincular skill nativa
router.post('/:id/native-skills/:skillId', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const skillId = Array.isArray(req.params.skillId) ? req.params.skillId[0] : req.params.skillId
  const ws = listAllWorkspaces().find(w => w.id === id)
  if (!ws) return res.status(404).json({ data: null, error: 'Not found' })

  const nativeSkillsPath = path.join(__dirname, '../../../native-skills')
  const skillSrc = path.join(nativeSkillsPath, skillId, 'SKILL.md')
  if (!fs.existsSync(skillSrc)) {
    return res.status(404).json({ data: null, error: 'Native skill not found' })
  }

  const skillDest = path.join(ws.path, '.claude', 'skills', skillId)
  fs.mkdirSync(skillDest, { recursive: true })
  fs.copyFileSync(skillSrc, path.join(skillDest, 'SKILL.md'))

  return res.status(201).json({ data: { installed: true, path: skillDest }, error: null })
})

// DELETE /api/workspaces/:id/native-skills/:skillId — remover skill nativa
router.delete('/:id/native-skills/:skillId', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const skillId = Array.isArray(req.params.skillId) ? req.params.skillId[0] : req.params.skillId
  const ws = listAllWorkspaces().find(w => w.id === id)
  if (!ws) return res.status(404).json({ data: null, error: 'Not found' })

  const skillPath = path.join(ws.path, '.claude', 'skills', skillId)
  if (fs.existsSync(skillPath)) {
    fs.rmSync(skillPath, { recursive: true })
  }
  return res.json({ data: { removed: true }, error: null })
})

// Helper function to parse YAML frontmatter
function parseYamlFrontmatter(content: string): any {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---/
  const match = content.match(frontmatterRegex)

  if (!match) {
    return null
  }

  const yamlContent = match[1]
  const result: any = {}

  // Parse simple YAML key-value pairs
  const lines = yamlContent.split('\n')
  let currentKey: string | null = null
  let isInMultilineString = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()

    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith('#')) continue

    const colonIndex = trimmedLine.indexOf(':')

    // Check if this is a new key-value pair
    if (colonIndex !== -1 && !trimmedLine.startsWith('-')) {
      const key = trimmedLine.substring(0, colonIndex).trim()
      let value = trimmedLine.substring(colonIndex + 1).trim()

      // Save previous key if it exists
      if (currentKey && result[currentKey] === undefined) {
        result[currentKey] = ''
      }

      currentKey = key

      // Handle quoted strings
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        result[key] = value.slice(1, -1)
        currentKey = null
      } else if (value) {
        // Handle array values (comma-separated)
        if (value.includes(',')) {
          result[key] = value.split(',').map((v: string) => v.trim())
          currentKey = null
        } else {
          result[key] = value
          currentKey = null
        }
      } else {
        // Empty value, might be followed by multi-line content or array
        isInMultilineString = true
      }
    } else if (currentKey && isInMultilineString) {
      // Continuation of multi-line value
      const existingValue = result[currentKey] || ''
      const continuation = trimmedLine

      // Check if it's an array item
      if (continuation.startsWith('-')) {
        if (!Array.isArray(result[currentKey])) {
          result[currentKey] = []
        }
        const arrayItem = continuation.substring(1).trim()
        // Remove quotes if present
        if ((arrayItem.startsWith('"') && arrayItem.endsWith('"')) ||
            (arrayItem.startsWith("'") && arrayItem.endsWith("'"))) {
          result[currentKey].push(arrayItem.slice(1, -1))
        } else {
          result[currentKey].push(arrayItem)
        }
      } else {
        // Multi-line string continuation
        if (typeof result[currentKey] === 'string') {
          result[currentKey] += ' ' + continuation
        } else {
          result[currentKey] = continuation
        }
      }
    }
  }

  return result
}

// POST /api/workspaces/:id/native-agents/* — instalar agente nativo na equipe
// agentName can be: "plan-analyst" (looks in plan/, dev/, staging/ subdirs) or "plan/plan-analyst" (explicit path)
// Using wildcard (*) instead of :agentName to correctly capture paths with slashes (e.g., "dev/backend-dev.md")
router.post('/:id/native-agents/*', authenticateToken, (req, res) => {
  const id = getIdParam(req.params)
  const agentName = (Array.isArray(req.params[0]) ? req.params[0][0] : req.params[0]) || ''
  const workspace = listAllWorkspaces().find(ws => ws.id === id)

  if (!workspace) {
    return res.status(404).json({ data: null, error: 'Workspace not found' })
  }

  const nativeAgentsPath = path.join(__dirname, '../../../native-agents')

  // Determine source file: support both "plan-analyst" (auto-search) and "plan/plan-analyst" (explicit)
  // agentName may come with or without .md extension (relativePath from GET includes .md)
  let agentSourceFile: string | null = null
  const rawName = agentName.endsWith('.md') ? agentName.slice(0, -3) : agentName
  let agentFileName = rawName

  if (rawName.includes('/')) {
    // Explicit relative path provided (e.g., "plan/plan-analyst")
    agentSourceFile = path.join(nativeAgentsPath, `${rawName}.md`)
    agentFileName = rawName.split('/').pop()!
  } else {
    // Auto-search in team-type subdirectories first, then root
    const teamTypes = ['plan', 'dev', 'staging']
    for (const teamType of teamTypes) {
      const candidate = path.join(nativeAgentsPath, teamType, `${rawName}.md`)
      if (fs.existsSync(candidate)) {
        agentSourceFile = candidate
        break
      }
    }
    // Fallback to root directory
    if (!agentSourceFile) {
      const rootCandidate = path.join(nativeAgentsPath, `${rawName}.md`)
      if (fs.existsSync(rootCandidate)) {
        agentSourceFile = rootCandidate
      }
    }
  }

  if (!agentSourceFile || !fs.existsSync(agentSourceFile)) {
    return res.status(404).json({ data: null, error: 'Native agent not found' })
  }

  try {
    // Copy the agent file to the workspace's .claude/agents/ directory
    const agentsDir = path.join(workspace.path, '.claude', 'agents')
    if (!fs.existsSync(agentsDir)) {
      fs.mkdirSync(agentsDir, { recursive: true })
    }

    // Read the frontmatter to use its name as the destination filename
    // This ensures the installed filename matches the native agent's frontmatter name
    const sourceContent = fs.readFileSync(agentSourceFile, 'utf-8')
    const sourceFrontmatter = parseYamlFrontmatter(sourceContent)
    const destName = sourceFrontmatter?.name || agentFileName

    const agentDestFile = path.join(agentsDir, `${destName}.md`)

    // If the old filename (from directory path) differs from the frontmatter name,
    // remove the old file to avoid duplicates
    if (destName !== agentFileName) {
      const oldFile = path.join(agentsDir, `${agentFileName}.md`)
      if (fs.existsSync(oldFile)) {
        fs.unlinkSync(oldFile)
      }
    }

    fs.copyFileSync(agentSourceFile, agentDestFile)

    // Add 'Agent' to permissions.allow if not present
    const settingsPath = path.join(workspace.path, '.claude', 'settings.local.json')
    let settings: any = {}

    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
    } else {
      settings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        env: {},
        permissions: { allow: [], deny: [] }
      }
    }

    if (!settings.permissions) {
      settings.permissions = { allow: [], deny: [] }
    }

    if (!settings.permissions.allow) {
      settings.permissions.allow = []
    }

    if (!settings.permissions.allow.includes('Agent')) {
      settings.permissions.allow.push('Agent')
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
    }

    return res.status(201).json({
      data: {
        installed: true,
        agent: agentName,
        path: agentDestFile
      },
      error: null
    })
  } catch (error) {
    console.error('Error installing native agent:', error)
    return res.status(500).json({
      data: null,
      error: error instanceof Error ? error.message : 'Failed to install native agent'
    })
  }
})

// POST /api/workspaces/:id/improve-claude-md — melhorar CLAUDE.md com IA usando planner
router.post('/:id/improve-claude-md', authenticateToken, async (req, res) => {
  const id = getIdParam(req.params)
  const workspace = listAllWorkspaces().find(ws => ws.id === id)

  if (!workspace) {
    return res.status(404).json({ data: null, error: 'Workspace not found' })
  }

  const { currentContent } = req.body

  if (!currentContent || typeof currentContent !== 'string') {
    return res.status(400).json({ data: null, error: 'currentContent is required' })
  }

  try {
    // Get planner workspace for this project
    const plannerRow = db.prepare(`
      SELECT pa.workspace_path FROM project_agents pa
      LEFT JOIN team_roles wr ON wr.workspace_path = pa.workspace_path
      WHERE pa.project_id = ? AND COALESCE(wr.role, 'generic') = 'planner'
      LIMIT 1
    `).get(workspace.project_id) as any

    const plannerWorkspace = plannerRow?.workspace_path ||
      path.join(AGENTS_BASE_PATH, 'weave', 'agents', 'planner')

    // Read current CLAUDE.md if it exists to provide additional context
    let currentClaudeMdContent = ''
    const claudeMdPath = path.join(workspace.path, 'CLAUDE.md')
    if (fs.existsSync(claudeMdPath)) {
      currentClaudeMdContent = fs.readFileSync(claudeMdPath, 'utf-8')
    }

    // Create the plan first (so we can use planId and workflowPath in the prompt)
    const planId = uuidv4()
    const taskId = uuidv4()

    // Create workflow directory for this plan
    let projectName = 'unknown'
    if (workspace.project_id) {
      const project = db.prepare('SELECT name FROM projects WHERE id = ?').get(workspace.project_id) as any
      if (project) projectName = project.name
    }

    let workflowPath: string | null = null
    try {
      workflowPath = ensureWorkflowDir(projectName, planId)
      console.log(`[teams] Workflow directory created for improvement: ${workflowPath}`)
    } catch (dirError) {
      console.error(`[teams] Failed to create workflow directory for improvement plan ${planId}:`, dirError)
    }

    // Create improvement prompt
    const prompt = `You are an expert at writing clear, concise, and effective CLAUDE.md files for AI coding agents. Your task is to improve the following CLAUDE.md content while maintaining its core purpose and structure.

Context:
- This CLAUDE.md is for the "${workspace.name}" agent
- The agent workspace is located at: ${workspace.path}
- The agent role is: ${workspace.role || 'generic'}

Current CLAUDE.md file content (use as base reference):
${currentClaudeMdContent || '(No existing CLAUDE.md file)'}

User-provided content to improve:
${currentContent}

Guidelines for improvement:
1. Make instructions clearer and more specific
2. Improve organization and readability
3. Add missing important context if needed
4. Remove redundant or verbose content
5. Ensure the tone is professional and directive
6. Maintain the existing structure and format
7. Keep any project-specific information intact
8. Consider both the existing file (if any) and the user-provided content
9. Preserve valuable information from the existing file while incorporating improvements from the user content

## IMPORTANT: Output format — READ CAREFULLY

1. Write the improved CLAUDE.md content to the file: ${workflowPath}/team-improvement.json
   The file must contain a JSON object with the field "claudeMd" containing the full improved CLAUDE.md content.
   Example:
   { "claudeMd": "# Agent Name\\n\\nImproved CLAUDE.md content here..." }

2. Validate by running in the terminal: weave-validate team-improvement ${workflowPath}/team-improvement.json

3. If validation fails, read the error from the terminal and fix the JSON file accordingly. Do NOT finish until the validation command passes.`

    const tasks = [{
      id: taskId,
      name: 'Improve CLAUDE.md with AI',
      prompt,
      cwd: process.cwd(),
      workspace: plannerWorkspace,
      tools: ['Read', 'Write', 'Glob', 'Grep', 'Bash'],
      permission_mode: 'acceptEdits',
      depends_on: [],
    }]

    db.prepare(`
      INSERT INTO plans (id, name, tasks, status, project_id, type, team_id, workflow_path)
      VALUES (?, ?, ?, 'pending', ?, 'improve_claude_md', ?, ?)
    `).run(planId, `Improve CLAUDE.md for ${workspace.name}`, JSON.stringify(tasks), workspace.project_id, id, workflowPath)

    return res.status(201).json({
      data: {
        planId,
        taskId,
        message: 'CLAUDE.md improvement task created successfully'
      },
      error: null
    })
  } catch (error) {
    console.error('Error creating improve CLAUDE.md plan:', error)
    return res.status(500).json({
      data: null,
      error: error instanceof Error ? error.message : 'Failed to create improvement task'
    })
  }
})

// POST /api/workspaces/:id/improve-agent — melhorar agente com IA usando planner
router.post('/:id/improve-agent', authenticateToken, async (req, res) => {
  const id = getIdParam(req.params)
  const workspace = listAllWorkspaces().find(ws => ws.id === id)

  if (!workspace) {
    return res.status(404).json({ data: null, error: 'Workspace not found' })
  }

  const { agentName, currentContent } = req.body

  if (!agentName || typeof agentName !== 'string') {
    return res.status(400).json({ data: null, error: 'agentName is required' })
  }

  if (!currentContent || typeof currentContent !== 'string') {
    return res.status(400).json({ data: null, error: 'currentContent is required' })
  }

  try {
    // Get planner workspace for this project
    const plannerRow = db.prepare(`
      SELECT pa.workspace_path FROM project_agents pa
      LEFT JOIN team_roles wr ON wr.workspace_path = pa.workspace_path
      WHERE pa.project_id = ? AND COALESCE(wr.role, 'generic') = 'planner'
      LIMIT 1
    `).get(workspace.project_id) as any

    const plannerWorkspace = plannerRow?.workspace_path ||
      path.join(AGENTS_BASE_PATH, 'weave', 'agents', 'planner')

    // Read current CLAUDE.md if it exists to provide project context
    let claudeMdContent = ''
    const claudeMdPath = path.join(workspace.path, 'CLAUDE.md')
    if (fs.existsSync(claudeMdPath)) {
      claudeMdContent = fs.readFileSync(claudeMdPath, 'utf-8')
    }

    // Read all agent files to provide team context
    const agentsDir = path.join(workspace.path, '.claude', 'agents')
    let otherAgentsContext = ''
    if (fs.existsSync(agentsDir)) {
      const agentFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'))
      for (const af of agentFiles) {
        const agentContent = fs.readFileSync(path.join(agentsDir, af), 'utf-8')
        if (!af.startsWith(agentName)) {
          otherAgentsContext += `\n--- ${af} ---\n${agentContent.substring(0, 500)}\n`
        }
      }
    }

    // Create the plan first (so we can use planId and workflowPath in the prompt)
    const planId = uuidv4()
    const taskId = uuidv4()

    // Create workflow directory for this plan
    let projectName = 'unknown'
    if (workspace.project_id) {
      const project = db.prepare('SELECT name FROM projects WHERE id = ?').get(workspace.project_id) as any
      if (project) projectName = project.name
    }

    let workflowPath: string | null = null
    try {
      workflowPath = ensureWorkflowDir(projectName, planId)
      console.log(`[teams] Workflow directory created for improvement: ${workflowPath}`)
    } catch (dirError) {
      console.error(`[teams] Failed to create workflow directory for improvement plan ${planId}:`, dirError)
    }

    // Create improvement prompt
    const prompt = `You are an expert at writing clear, concise, and effective agent definitions for AI coding agents (Claude Code). Your task is to improve the following agent definition while maintaining its core purpose and structure.

Context:
- This agent is named "${agentName}" and belongs to the "${workspace.name}" team
- The team workspace is located at: ${workspace.path}
- The team role is: ${workspace.role || 'generic'}

Team CLAUDE.md (project context):
${claudeMdContent || '(No CLAUDE.md file found)'}

Other agents on this team (for coordination context):
${otherAgentsContext || '(No other agents on this team)'}

Current agent definition to improve:
${currentContent}

Guidelines for improvement:
1. Make the agent's purpose and triggers clearer and more specific
2. Improve YAML frontmatter (name, description, model, tools, color)
3. Add detailed instructions for when and how to invoke this agent
4. Improve organization, readability, and structure of the markdown content
5. Add missing important context or behavior guidelines
6. Remove redundant or verbose content
7. Ensure the tone is professional and directive
8. Consider the team's CLAUDE.md context and other agents for coordination
9. Optimize tool selection based on the agent's responsibilities
10. Keep any project-specific information and frontmatter structure intact

## IMPORTANT: Output format — READ CAREFULLY

1. Write the improved agent definition to the file: ${workflowPath}/agent-improvement.json
   The file must contain a JSON object with the field "agentContent" containing the FULL improved agent definition (including YAML frontmatter and all markdown content).
   Example:
   { "agentContent": "---\\nname: agent-name\\ndescription: \\"Improved description\\"\\n---\\n\\n# Agent Name\\n\\nImproved content here..." }

2. Validate by running in the terminal: weave-validate agent ${workflowPath}/agent-improvement.json

3. If validation fails, read the error from the terminal and fix the JSON file accordingly. Do NOT finish until the validation command passes.`

    const tasks = [{
      id: taskId,
      name: `Improve agent "${agentName}" with AI`,
      prompt,
      cwd: process.cwd(),
      workspace: plannerWorkspace,
      tools: ['Read', 'Write', 'Glob', 'Grep', 'Bash'],
      permission_mode: 'acceptEdits',
      depends_on: [],
    }]

    db.prepare(`
      INSERT INTO plans (id, name, tasks, status, project_id, type, team_id, workflow_path)
      VALUES (?, ?, ?, 'pending', ?, 'improve_agent', ?, ?)
    `).run(planId, `Improve agent "${agentName}" for ${workspace.name}`, JSON.stringify(tasks), workspace.project_id, id, workflowPath)

    return res.status(201).json({
      data: {
        planId,
        taskId,
        message: `Agent "${agentName}" improvement task created successfully`
      },
      error: null
    })
  } catch (error) {
    console.error('Error creating improve agent plan:', error)
    return res.status(500).json({
      data: null,
      error: error instanceof Error ? error.message : 'Failed to create improvement task'
    })
  }
})

export default router
