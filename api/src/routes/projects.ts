import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { db } from '../db/index.js'
import { authenticateToken } from '../middleware/auth.js'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { envAgentPath, envAgentPlannerPath, AGENTS_BASE_PATH } from '../utils/paths.js'
import { getTeamTemplateById, renderTeamClaudeMd } from '../utils/teamTemplates.js'
import { createDefaultEnvironments, isValidGitUrl, ENV_TYPE_NAMES } from '../services/gitClone.js'
import { bootstrapTeamsForEnvironments, bootstrapTeamForEnvironment, resolveTeamIdForEnv } from '../services/environmentTeamBootstrap.js'
import { seedNativeAgentsForTeam } from '../services/nativeAgentsBootstrap.js'
import { getProjectsDir, slugify } from '../utils/paths.js'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const router = Router()

// Validation helper for workflow limit settings
function validateWorkflowLimits(settings: any): { valid: boolean; error: string | null } {
  if (!settings || typeof settings !== 'object') {
    return { valid: true, error: null }
  }

  // Validate max_concurrent_workflows
  if ('max_concurrent_workflows' in settings) {
    const value = settings.max_concurrent_workflows
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      return {
        valid: false,
        error: 'max_concurrent_workflows must be a non-negative integer'
      }
    }
  }

  // Validate max_planning_tasks
  if ('max_planning_tasks' in settings) {
    const value = settings.max_planning_tasks
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      return {
        valid: false,
        error: 'max_planning_tasks must be a non-negative integer'
      }
    }
  }

  // Validate max_in_progress_tasks
  if ('max_in_progress_tasks' in settings) {
    const value = settings.max_in_progress_tasks
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      return {
        valid: false,
        error: 'max_in_progress_tasks must be a non-negative integer'
      }
    }
  }

  return { valid: true, error: null }
}

// GET /api/projects
router.get('/', authenticateToken, (req, res) => {
  const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all()
  const withEnvs = projects.map((p: any) => {
    const environments = db.prepare('SELECT * FROM environments WHERE project_id = ? ORDER BY created_at ASC').all(p.id)
    const agents = db.prepare('SELECT workspace_path FROM project_agents WHERE project_id = ?').all(p.id) as any[]
    return {
      ...p,
      settings: JSON.parse(p.settings || '{}'),
      environments,
      agent_paths: agents.map(a => a.workspace_path)
    }
  })
  return res.json({ data: withEnvs, error: null })
})

// POST /api/projects
router.post('/', authenticateToken, (req, res) => {
  const { name, description, settings, color, git_url, create_default_envs, base_path, env_types, git_token } = req.body
  if (!name) return res.status(400).json({ data: null, error: 'name is required' })

  // Validate workflow limits if provided in settings
  if (settings) {
    const validation = validateWorkflowLimits(settings)
    if (!validation.valid) {
      return res.status(400).json({ data: null, error: validation.error })
    }
  }

  // If create_default_envs is true, base_path is required so the user knows where envs will live
  if (create_default_envs && !base_path) {
    return res.status(400).json({ data: null, error: 'base_path is required when create_default_envs is true' })
  }

  // Validate env_types if provided
  if (env_types && !Array.isArray(env_types)) {
    return res.status(400).json({ data: null, error: 'env_types must be an array' })
  }
  if (env_types && env_types.length > 0) {
    const invalidTypes = env_types.filter((t: string) => !(ENV_TYPE_NAMES as readonly string[]).includes(t))
    if (invalidTypes.length > 0) {
      return res.status(400).json({ data: null, error: `Invalid environment types: ${invalidTypes.join(', ')}. Valid types are: ${ENV_TYPE_NAMES.join(', ')}` })
    }
  }

  // Validate git_url format if provided
  if (git_url && !isValidGitUrl(git_url)) {
    return res.status(400).json({ data: null, error: 'git_url must be a valid git URL (HTTPS, SSH, or git://)' })
  }

  // Ensure base_path exists on disk
  if (base_path) {
    fs.mkdirSync(base_path, { recursive: true })
  }

  const id = uuid()
  const settingsJson = JSON.stringify(settings || {})
  db.prepare('INSERT INTO projects (id, name, description, settings, color, git_url) VALUES (?, ?, ?, ?, ?, ?)').run(id, name, description ?? null, settingsJson, color ?? '', git_url ?? null)

  // Auto-create default environments if requested
  let environments: any[] = []
  let envWarnings: string[] = []
  if (create_default_envs) {
    try {
      const { results: cloneResults, warnings } = createDefaultEnvironments(
        git_url || null,
        name,
        base_path || undefined,
        env_types && env_types.length > 0 ? env_types : undefined,
        git_token || null,
      )
      envWarnings = warnings

      // Insert environment records into the database
      const envRecords: { id: string; name: string; project_path: string }[] = []
      for (const result of cloneResults) {
        if (result.success) {
          const envId = uuid()
          db.prepare(`
            INSERT INTO environments (id, project_id, name, type, env_type, project_path, agent_workspace, ssh_config, env_vars)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            envId,
            id,
            result.name,
            'local-wsl',
            result.name, // env_type matches the semantic name (plan, dev, staging)
            result.project_path,
            '', // agent_workspace is set by bootstrapTeamForEnvironment
            null,
            null
          )
          envRecords.push({ id: envId, name: result.name, project_path: result.project_path })
          environments.push({
            id: envId,
            name: result.name,
            type: 'local-wsl',
            env_type: result.name,
            project_path: result.project_path,
            agent_workspace: '',
            branch: result.branch,
          })
        }
      }

      // Auto-bootstrap teams for all created environments
      // Each env gets its default team (plan→Plan Team, dev→Dev Team, staging→Staging Team)
      if (envRecords.length > 0) {
        try {
          const bootstrapResults = bootstrapTeamsForEnvironments(id, envRecords, name)
          // Update the returned environments with the actual workspace paths
          for (const env of environments) {
            const boot = bootstrapResults.find((b) => b.envName === env.name)
            if (boot) {
              env.agent_workspace = boot.workspacePath
              env.default_team = boot.workspacePath
              env.team_id = boot.teamId
            }
          }
        } catch (teamErr: any) {
          console.error('[POST /api/projects] Error bootstrapping teams:', teamErr.message)
          // Don't fail — environments are still valid, teams can be created later
        }
      }
    } catch (err: any) {
      console.error('[POST /api/projects] Error creating default environments:', err.message)
      envWarnings.push(`Failed to create environments: ${err.message?.substring(0, 500) || 'Unknown error'}`)
      // Don't fail the project creation — return project without environments
      // The user can still create environments manually
    }
  }

  return res.status(201).json({
    data: {
      id,
      name,
      description,
      settings: settings || {},
      color: color ?? '',
      git_url: git_url ?? null,
      environments,
      warnings: envWarnings.length > 0 ? envWarnings : undefined,
    },
    error: null,
  })
})

// POST /api/projects/:id/environments
router.post('/:id/environments', authenticateToken, (req, res) => {
  const { name, type, env_type, project_path, ssh_config, env_vars } = req.body
  if (!name || !project_path) {
    return res.status(400).json({ data: null, error: 'name and project_path are required' })
  }
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as any
  if (!project) return res.status(404).json({ data: null, error: 'Project not found' })

  // Validate env_type if provided
  const validEnvTypes = ['plan', 'dev', 'staging']
  const resolvedEnvType = env_type && validEnvTypes.includes(env_type) ? env_type : 'dev'

  // Agent workspace is created only when the user confirms via the /default-agents endpoint (modal).
  // Leave empty until then so no directory is implied or auto-populated.
  const agent_workspace = ''

  const id = uuid()
  db.prepare(`
    INSERT INTO environments (id, project_id, name, type, env_type, project_path, agent_workspace, ssh_config, env_vars)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, req.params.id, name,
    type ?? 'local-wsl',
    resolvedEnvType,
    project_path,
    agent_workspace,
    ssh_config ? JSON.stringify(ssh_config) : null,
    env_vars ? JSON.stringify(env_vars) : null
  )

  // Auto-bootstrap the default team for this environment
  let defaultTeam: string | null = null
  let teamId: string | null = null
  try {
    const bootResult = bootstrapTeamForEnvironment(
      req.params.id as string,
      id,
      name,
      project_path,
      project.name,
    )
    defaultTeam = bootResult.workspacePath
    teamId = bootResult.teamId
  } catch (teamErr: any) {
    console.error('[POST /api/projects/:id/environments] Error bootstrapping team:', teamErr.message)
    // Don't fail — environment is still valid, team can be created later
  }

  return res.status(201).json({
    data: {
      id,
      name,
      type: type ?? 'local-wsl',
      env_type: resolvedEnvType,
      project_path,
      agent_workspace: defaultTeam ?? agent_workspace,
      default_team: defaultTeam,
      team_id: teamId,
    },
    error: null,
  })
})

// PUT /api/projects/:projectId/environments/:envId
router.put('/:projectId/environments/:envId', authenticateToken, (req, res) => {
  const { name, type, env_type, project_path, ssh_config, env_vars } = req.body
  // Verify project exists
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId)
  if (!project) return res.status(404).json({ data: null, error: 'Project not found' })
  // Note: agent_workspace is auto-generated and cannot be updated
  const currentEnv = db.prepare('SELECT agent_workspace FROM environments WHERE id=? AND project_id=?').get(req.params.envId, req.params.projectId) as any
  if (!currentEnv) {
    return res.status(404).json({ data: null, error: 'Environment not found' })
  }

  // Validate env_type if provided
  const validEnvTypes = ['plan', 'dev', 'staging']
  const resolvedEnvType = env_type && validEnvTypes.includes(env_type) ? env_type : undefined

  db.prepare(`
    UPDATE environments SET name=?, type=?, env_type=COALESCE(?, env_type), project_path=?, ssh_config=?, env_vars=?
    WHERE id=? AND project_id=?
  `).run(
    name, type, resolvedEnvType, project_path,
    ssh_config ? JSON.stringify(ssh_config) : null,
    env_vars ? JSON.stringify(env_vars) : null,
    req.params.envId, req.params.projectId
  )
  return res.json({ data: { updated: true }, error: null })
})

// DELETE /api/projects/:projectId/environments/:envId
router.delete('/:projectId/environments/:envId', authenticateToken, (req, res) => {
  // Verify project exists
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId)
  if (!project) return res.status(404).json({ data: null, error: 'Project not found' })
  db.prepare('DELETE FROM environments WHERE id=? AND project_id=?').run(req.params.envId, req.params.projectId)
  return res.json({ data: { deleted: true }, error: null })
})

// POST /api/projects/:projectId/repair-teams — backfill missing environments & default teams
// This endpoint is designed to fix projects that were created before Phase 2
// (i.e. they are missing plan/staging environments or their environments lack default teams).
router.post('/:projectId/repair-teams', authenticateToken, (req, res) => {
  try {
    const projectId = req.params.projectId as string
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any
    if (!project) return res.status(404).json({ data: null, error: 'Project not found' })

    const results: { action: string; envName: string; teamPath: string; created: boolean; error?: string }[] = []

    // Step 1: Ensure all 3 standard environments exist
    const existingEnvs = db
      .prepare('SELECT * FROM environments WHERE project_id = ?')
      .all(projectId) as any[]

    const existingEnvTypes = new Set(
      existingEnvs.map((e) => (e.env_type || 'dev').toLowerCase()),
    )

    const requiredEnvTypes = ['plan', 'dev', 'staging'] as const

    // Find a base_path from the first environment, or use the projects dir
    const firstEnvPath = existingEnvs[0]?.project_path
    let baseDir: string | undefined
    if (firstEnvPath) {
      // Derive base_dir: e.g. /root/projects/investing from /root/projects/investing/dev
      const envSlug = existingEnvs[0]?.name?.toLowerCase()
      if (envSlug && firstEnvPath.endsWith(envSlug)) {
        baseDir = firstEnvPath.slice(0, -envSlug.length - 1)
      } else {
        baseDir = path.dirname(firstEnvPath)
      }
    }

    const createdEnvRecords: { id: string; name: string; project_path: string }[] = []

    for (const envType of requiredEnvTypes) {
      if (!existingEnvTypes.has(envType)) {
        // Determine project_path for the new environment
        const envProjectPath = baseDir
          ? path.join(baseDir, envType)
          : path.join(getProjectsDir(), slugify(project.name), envType)

        // Create the directory if it doesn't exist
        if (!fs.existsSync(envProjectPath)) {
          fs.mkdirSync(envProjectPath, { recursive: true })
          // If the base env has a git repo, clone/copy into the new env
          if (baseDir && firstEnvPath) {
            try {
              // Try git clone from the existing repo or init
              const gitDir = path.join(envProjectPath, '.git')
              if (!fs.existsSync(gitDir)) {
                execSync('git init -b main', {
                  cwd: envProjectPath,
                  encoding: 'utf-8',
                  stdio: ['pipe', 'pipe', 'pipe'],
                })
                // If there's a git remote on the project, try to add it
                const gitUrl = project.git_url
                if (gitUrl) {
                  try {
                    execSync(`git remote add origin "${gitUrl}"`, {
                      cwd: envProjectPath,
                      encoding: 'utf-8',
                      stdio: ['pipe', 'pipe', 'pipe'],
                    })
                  } catch {
                    // Remote add may fail, not critical
                  }
                }
              }
            } catch {
              // Git init may fail, not critical — directory exists
            }
          }
        }

        // Create the branch name
        const branchName = envType === 'plan' ? 'main'
          : envType === 'dev' ? 'dev'
          : 'staging'

        // Insert environment record
        const envId = uuid()
        db.prepare(`
          INSERT INTO environments (id, project_id, name, type, env_type, project_path, agent_workspace, ssh_config, env_vars)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          envId, projectId, envType, 'local-wsl', envType,
          envProjectPath, '', null, null,
        )

        createdEnvRecords.push({ id: envId, name: envType, project_path: envProjectPath })
        results.push({ action: 'environment_created', envName: envType, teamPath: '', created: true })
      }
    }

    // Step 2: Bootstrap teams for ALL environments (both existing and newly created)
    const allEnvs = db
      .prepare('SELECT * FROM environments WHERE project_id = ?')
      .all(projectId) as any[]

    for (const env of allEnvs) {
      const envName = (env.env_type || env.name || 'dev').toLowerCase()
      const teamId = resolveTeamIdForEnv(envName)

      // Check if this environment already has a default team
      if (env.default_team && fs.existsSync(env.default_team)) {
        results.push({
          action: 'already_has_team',
          envName,
          teamPath: env.default_team,
          created: false,
        })
        continue
      }

      try {
        const bootResult = bootstrapTeamForEnvironment(
          projectId,
          env.id,
          envName,
          env.project_path,
          project.name,
        )
        results.push({
          action: bootResult.created ? 'team_created' : 'team_linked',
          envName,
          teamPath: bootResult.workspacePath,
          created: bootResult.created,
        })
      } catch (teamErr: any) {
        results.push({
          action: 'team_error',
          envName,
          teamPath: '',
          created: false,
          error: teamErr.message?.substring(0, 200),
        })
      }
    }

    return res.json({ data: { results }, error: null })
  } catch (err: any) {
    console.error('[POST /api/projects/:projectId/repair-teams] Error:', err.message)
    return res.status(500).json({ data: null, error: err.message })
  }
})

// POST /api/projects/:id/agents — vincular equipe ao projeto
router.post('/:id/agents', authenticateToken, (req, res) => {
  const { workspace_path } = req.body
  if (!workspace_path) return res.status(400).json({ data: null, error: 'workspace_path required' })
  // Verify project exists
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
  if (!project) return res.status(404).json({ data: null, error: 'Project not found' })
  try {
    db.prepare(
      'INSERT OR IGNORE INTO project_agents (project_id, workspace_path) VALUES (?, ?)'
    ).run(req.params.id, workspace_path)
    return res.status(201).json({ data: { linked: true }, error: null })
  } catch (e: any) {
    return res.status(400).json({ data: null, error: e.message })
  }
})

// DELETE /api/projects/:id/agents — desvincular equipe
router.delete('/:id/agents', authenticateToken, (req, res) => {
  const { workspace_path } = req.body

  // Validate that workspace_path is provided
  if (!workspace_path) {
    console.error('[DELETE /api/projects/:id/agents] Missing workspace_path in request body')
    console.error('[DELETE /api/projects/:id/agents] Request body:', req.body)
    return res.status(400).json({ data: null, error: 'workspace_path required' })
  }

  // Verify project exists
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
  if (!project) return res.status(404).json({ data: null, error: 'Project not found' })

  // Log the deletion for debugging
  console.log(`[DELETE /api/projects/:id/agents] Unlinking agent: project_id=${req.params.id}, workspace_path=${workspace_path}`)

  // Ensure both conditions are present to prevent deleting all agents from a project
  const result = db.prepare(
    'DELETE FROM project_agents WHERE project_id = ? AND workspace_path = ?'
  ).run(req.params.id, workspace_path)

  console.log(`[DELETE /api/projects/:id/agents] Deleted ${result.changes} row(s)`)

  return res.json({ data: { unlinked: true }, error: null })
})

// DELETE /api/projects/:id

// DELETE /api/projects/:id
router.delete('/:id', authenticateToken, (req, res) => {
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id)
  if (result.changes === 0) return res.status(404).json({ data: null, error: 'Project not found' })
  return res.json({ data: { deleted: true }, error: null })
})

// PUT /api/projects/:id
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { name, description, settings, color, git_url } = req.body
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as any
    if (!project) return res.status(404).json({ data: null, error: 'Project not found' })

    // Validate workflow limits if provided in settings
    if (settings) {
      const validation = validateWorkflowLimits(settings)
      if (!validation.valid) {
        return res.status(400).json({ data: null, error: validation.error })
      }
    }

    const currentSettings = JSON.parse(project.settings || '{}')
    const newSettings = settings ? { ...currentSettings, ...settings } : currentSettings

    db.prepare('UPDATE projects SET name = COALESCE(?, name), description = COALESCE(?, description), settings = ?, color = COALESCE(?, color), git_url = COALESCE(?, git_url) WHERE id = ?')
      .run(name, description, JSON.stringify(newSettings), color, git_url, req.params.id)

    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as any
    updated.settings = JSON.parse(updated.settings || '{}')
    return res.json({ data: updated, error: null })
  } catch (err: any) {
    return res.status(500).json({ data: null, error: err.message })
  }
})

// GET /api/projects/:id/agents-context — retorna agentes disponíveis para injeção no contexto do planejador (agentes dentro de equipes)
router.get('/:id/agents-context', authenticateToken, (req, res) => {
  try {
    // Verify project exists
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
    if (!project) return res.status(404).json({ data: null, error: 'Project not found' })

    // Fetch agents linked to the project with their roles
    const agents = db.prepare(`
      SELECT
        pa.workspace_path,
        wr.role,
        pa.created_at
      FROM project_agents pa
      LEFT JOIN team_roles wr ON wr.workspace_path = pa.workspace_path
      WHERE pa.project_id = ?
      ORDER BY pa.created_at ASC
    `).all(req.params.id) as any[]

    // Format each agent for the planner context
    const formattedAgents = agents.map((agent) => {
      const workspacePath = agent.workspace_path
      const role = agent.role || 'generic'

      // Extract name from workspace path
      // Expected format: /root/projects/weave/projects/{project}/agents/{agent-name}/
      const pathParts = workspacePath.split(path.sep).filter(Boolean)
      let name = 'unknown'

      // Try to extract agent name from path structure
      if (pathParts.length >= 5 && pathParts[3] === 'agents') {
        // Structure: .../projects/{project}/agents/{agent-name}
        name = pathParts[4]
      } else if (pathParts.length >= 4) {
        // Fallback: use last directory component
        name = pathParts[pathParts.length - 1]
      }

      return {
        name,
        role,
        workspace_path: workspacePath,
        cwd: null, // CWD will be set by the task/environment configuration
      }
    })

    return res.json({ data: formattedAgents, error: null })
  } catch (e: any) {
    console.error('Error fetching agents context:', e)
    return res.status(500).json({ data: null, error: e.message })
  }
})

// GET /api/projects/:id/planning-context — retorna contexto completo para a equipe planejadora
router.get('/:id/planning-context', authenticateToken, async (req, res) => {
  console.log('[GET /api/projects/:id/planning-context] Called with id:', req.params.id)
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as any
    console.log('[GET /api/projects/:id/planning-context] Project found:', !!project)
    if (!project) {
      return res.status(404).json({ data: null, error: 'Project not found' })
    }

    // Parse settings
    let settings = {}
    try {
      settings = JSON.parse(project.settings || '{}')
    } catch {}

    // Fetch environments
    const environments = db.prepare(`
      SELECT id, name, type, project_path, agent_workspace
      FROM environments
      WHERE project_id = ?
      ORDER BY created_at ASC
    `).all(req.params.id) as any[]

    // Caminho do script Python
    const scriptPath = path.join(__dirname, '../../scripts/generate_project_context.py')

    // Gera contexto para cada environment
    const environmentsWithContext = await Promise.all(
      environments.map(async (env: any) => {
        let context = null

        // Tenta gerar contexto apenas se o script existir e o caminho for válido
        if (fs.existsSync(scriptPath) && env.project_path && fs.existsSync(env.project_path)) {
          try {
            const stats = fs.statSync(env.project_path)
            if (stats.isDirectory()) {
              const output = execSync(
                `python3 "${scriptPath}" "${env.project_path}" --output json`,
                {
                  encoding: 'utf-8',
                  maxBuffer: 10 * 1024 * 1024, // 10MB buffer
                  timeout: 30000 // 30 seconds timeout
                }
              )

              const contextData = JSON.parse(output)

              // Formata o contexto de forma sucinta
              context = {
                structure: summarizeStructure(contextData.structure || {}),
                git_info: {
                  branch: contextData.git_info?.branch || 'unknown',
                  last_commit: contextData.git_info?.last_commit?.hash || contextData.git_info?.last_commit?.substring?.(0, 8) || 'unknown',
                  remote: contextData.git_info?.remote_url || null,
                },
                stats: {
                  total_files: contextData.stats?.total_files || 0,
                  total_dirs: contextData.stats?.total_dirs || 0,
                  languages: contextData.stats?.languages || {},
                },
              }
            }
          } catch (execError: any) {
            // Se falhar, apenas loga e continua sem contexto
            console.warn(`[planning-context] Failed to generate context for env ${env.id}:`, execError.message?.substring(0, 200))
          }
        }

        return {
          ...env,
          context,
        }
      })
    )

    // Fetch agents with roles
    const agents = db.prepare(`
      SELECT
        pa.workspace_path,
        COALESCE(wr.role, 'generic') as role
      FROM project_agents pa
      LEFT JOIN team_roles wr ON wr.workspace_path = pa.workspace_path
      WHERE pa.project_id = ?
    `).all(req.params.id) as any[]

    // Format agents with names
    const agentsWithNames = agents.map((a: any) => {
      const workspacePath = a.workspace_path
      const role = a.role

      // Extract name from workspace path
      // Expected format: /root/projects/weave/projects/{project}/agents/{agent-name}/
      const pathParts = workspacePath.split(path.sep).filter(Boolean)
      let name = 'unknown'

      if (pathParts.length >= 5 && pathParts[3] === 'agents') {
        name = pathParts[4]
      } else if (pathParts.length >= 4) {
        name = pathParts[pathParts.length - 1]
      }

      return {
        name,
        role,
        workspace_path: workspacePath,
      }
    })

    // Build lightweight workflow context from first environment
    const firstEnvWithContext = environmentsWithContext.find((e: any) => e.context)
    let workflow_context = ''
    if (firstEnvWithContext?.context) {
      workflow_context = buildWorkflowContext(firstEnvWithContext.context)
    }

    return res.json({
      data: {
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          settings,
          color: project.color || '',
        },
        environments: environmentsWithContext,
        agents: agentsWithNames,
        workflow_context,
      },
      error: null,
    })
  } catch (err: any) {
    console.error('Error fetching planning context:', err)
    return res.status(500).json({ data: null, error: err.message })
  }
})

// Função auxiliar para construir árvore de diretórios apenas (sem arquivos)
function buildDirectoryOnlyTree(structure: any, maxLines: number = 50): string {
  if (!structure || typeof structure !== 'object') {
    return ''
  }

  const lines: string[] = []
  let count = 0

  function traverse(node: any, prefix: string = '', isLast: boolean = true) {
    if (count >= maxLines) return

    if (!node || typeof node !== 'object') {
      return
    }

    const type = node.type
    const name = node.name || 'Unknown'
    const children = node.children || []

    if (type === 'directory') {
      lines.push(`${prefix}${isLast ? '└── ' : '├── '}📁 ${name}/`)
      count++
      const newPrefix = prefix + (isLast ? '    ' : '│   ')

      for (let i = 0; i < children.length; i++) {
        if (count >= maxLines) break
        const isLastChild = i === children.length - 1
        traverse(children[i], newPrefix, isLastChild)
      }
    }
    // Skip non-directory nodes entirely
  }

  traverse(structure)

  if (count >= maxLines) {
    lines.push(`... (${maxLines}+ directories, output truncated)`)
  }

  return lines.length > 0 ? lines.join('\n') : ''
}

// Função auxiliar para construir o contexto leve do workflow como texto markdown
function buildWorkflowContext(context: any): string {
  if (!context) return ''

  try {
    const sections: string[] = []

    // Directory Structure (from the summarized structure string which contains dirs + files)
    // We need to rebuild from the raw structure — but context only has the summarized string.
    // Since the summarized structure is already a string, we can't rebuild a directory-only tree from it.
    // Instead, we work with what we have: extract directory lines from the summarized structure.
    const structureStr = context.structure || ''
    if (structureStr && structureStr !== '(empty structure)' && structureStr !== '{}') {
      const dirLines = structureStr
        .split('\n')
        .filter((line: string) => line.includes('📁'))
        .slice(0, 50)

      if (dirLines.length > 0) {
        sections.push('### Directory Structure')
        sections.push(dirLines.join('\n'))
      }

      if (dirLines.length >= 50) {
        sections[sections.length - 1] += '\n... (truncated)'
      }
    }

    // Git Information
    const gitInfo = context.git_info
    if (gitInfo) {
      sections.push('### Git Information')
      const gitLines: string[] = []
      if (gitInfo.branch && gitInfo.branch !== 'unknown') {
        gitLines.push(`- **Branch:** ${gitInfo.branch}`)
      }
      if (gitInfo.last_commit && gitInfo.last_commit !== 'unknown') {
        gitLines.push(`- **Last Commit:** ${gitInfo.last_commit}`)
      }
      if (gitInfo.remote) {
        gitLines.push(`- **Remote:** ${gitInfo.remote}`)
      }
      // Working tree status — derive from context data if available
      if (context.stats) {
        const stats = context.stats
        const totalFiles = stats.total_files || 0
        const totalDirs = stats.total_dirs || 0
        gitLines.push(`- **Working Tree:** ${totalFiles} files in ${totalDirs} directories`)
        if (stats.languages && typeof stats.languages === 'object') {
          const langEntries = Object.entries(stats.languages)
            .sort(([, a]: any, [, b]: any) => b - a)
            .slice(0, 5)
          if (langEntries.length > 0) {
            gitLines.push(`- **Languages:** ${langEntries.map(([lang, count]: any) => `${lang} (${count})`).join(', ')}`)
          }
        }
      }
      if (gitLines.length > 0) {
        sections.push(gitLines.join('\n'))
      }
    }

    return sections.join('\n\n')
  } catch {
    return ''
  }
}

// Função auxiliar para resumir a estrutura de arquivos (máx 100 linhas)
function summarizeStructure(structure: any, maxLines = 100): string {
  if (!structure || typeof structure !== 'object') {
    return '{}'
  }

  const lines: string[] = []
  let count = 0

  function traverse(node: any, prefix: string = '', isLast: boolean = true) {
    if (count >= maxLines) return

    if (!node || typeof node !== 'object') {
      return
    }

    const type = node.type
    const name = node.name || 'Unknown'
    const children = node.children || []

    if (type === 'directory') {
      lines.push(`${prefix}${isLast ? '└── ' : '├── '}📁 ${name}/`)
      count++
      const newPrefix = prefix + (isLast ? '    ' : '│   ')

      for (let i = 0; i < children.length; i++) {
        if (count >= maxLines) break
        const isLastChild = i === children.length - 1
        traverse(children[i], newPrefix, isLastChild)
      }
    } else if (type === 'file') {
      // Get icon based on extension
      const ext = node.extension || ''
      let icon = '📄'
      if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
        icon = '📜'
      } else if (ext === '.py') {
        icon = '🐍'
      } else if (ext === '.json') {
        icon = '📋'
      } else if (ext === '.md') {
        icon = '📝'
      } else if (['.yaml', '.yml'].includes(ext)) {
        icon = '⚙️'
      } else if (['.css', '.scss', '.sass', '.less'].includes(ext)) {
        icon = '🎨'
      } else if (['.html', '.htm'].includes(ext)) {
        icon = '🌐'
      } else if (['.sh', '.bash'].includes(ext)) {
        icon = '⚡'
      }

      lines.push(`${prefix}${isLast ? '└── ' : '├── '}${icon} ${name}`)
      count++
    }
  }

  traverse(structure)

  // Se ultrapassar o limite, adiciona indicador
  if (count >= maxLines) {
    lines.push(`... (${maxLines}+ items, output truncated)`)
  }

  return lines.length > 0 ? lines.join('\n') : '(empty structure)'
}

// GET /api/projects/:id — must be AFTER more specific routes like /:id/agents-context
router.get('/:id', authenticateToken, (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as any
  if (!project) return res.status(404).json({ data: null, error: 'Not found' })
  project.settings = JSON.parse(project.settings || '{}')
  project.environments = db.prepare('SELECT * FROM environments WHERE project_id = ? ORDER BY created_at ASC').all(project.id)
  const agents = db.prepare('SELECT workspace_path FROM project_agents WHERE project_id = ?').all(project.id) as any[]
  project.agent_paths = agents.map(a => a.workspace_path)
  return res.json({ data: project, error: null })
})

// POST /api/projects/:id/generate-agent — gera uma nova equipe usando Claude Code e a agent-creator skill
router.post('/:id/generate-agent', authenticateToken, async (req, res) => {
  try {
    const { role = 'coder', name, description = '', environment_id } = req.body

    if (!name) {
      return res.status(400).json({ data: null, error: 'name is required' })
    }

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as any
    if (!project) {
      return res.status(404).json({ data: null, error: 'Project not found' })
    }

    // Get environment if specified
    let env: any = null
    if (environment_id) {
      env = db.prepare('SELECT * FROM environments WHERE id = ? AND project_id = ?')
        .get(environment_id, req.params.id) as any
      if (!env) {
        return res.status(404).json({ data: null, error: 'Environment not found' })
      }
    }

    // Slugify
    const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const agentSlug = slugify(name)
    const projectSlug = slugify(project.name)

    // Paths
    const workspacePath = env
      ? path.join(env.agent_workspace, 'agents', agentSlug)
      : path.join(AGENTS_BASE_PATH, projectSlug, 'agents', agentSlug)

    // Planner workspace — usa o planner do projeto ou o padrão
    const plannerRow = db.prepare(`
      SELECT pa.workspace_path FROM project_agents pa
      LEFT JOIN team_roles wr ON wr.workspace_path = pa.workspace_path
      WHERE pa.project_id = ? AND COALESCE(wr.role, 'generic') = 'planner'
      LIMIT 1
    `).get(req.params.id) as any

    const plannerWorkspace = plannerRow?.workspace_path ||
      path.join(AGENTS_BASE_PATH, 'weave', 'agents', 'planner')

    // Project path from environment or default
    const projectPath = env?.project_path || ''

    // Monta o prompt como texto puro — sem JSON inline para evitar escaping problems
    const lines = [
      'Use the agent-creator skill to create a new agent workspace.',
      '',
      '## Parameters',
      'Agent name: ' + agentSlug,
      'Role: ' + role,
      'Description: ' + (description || 'No description provided'),
      'Workspace path: ' + workspacePath,
      'Project ID: ' + req.params.id,
      'Project name: ' + project.name,
      'Project path: ' + projectPath,
      '',
      '## Instructions',
      '1. Analyze the project at: ' + projectPath,
      '2. Create the full agent workspace at: ' + workspacePath,
      '3. Register the agent using the API endpoints described in the skill',
      '4. Output the <agent> block at the end',
    ]
    const prompt = lines.join('\n')

    // Cria o quick_action plan
    const planId = uuid()
    const taskId = uuid()

    const tasks = JSON.stringify([{
      id: taskId,
      name: 'Create ' + role + ' agent: ' + agentSlug,
      prompt,
      cwd: projectPath || '/root/projects/weave',
      workspace: plannerWorkspace,
      tools: ['Read', 'Write', 'Bash', 'Glob', 'Edit', 'Skill'],
      permission_mode: 'acceptEdits',
      depends_on: [],
    }])

    db.prepare(`
      INSERT INTO plans (id, name, tasks, status, type, project_id)
      VALUES (?, ?, ?, 'pending', 'quick_action', ?)
    `).run(
      planId,
      'Generate agent: ' + agentSlug,
      tasks,
      req.params.id
    )

    return res.status(201).json({
      data: {
        plan_id: planId,
        workspace_path: workspacePath,
        agent_name: agentSlug,
        role,
        planner_workspace: plannerWorkspace,
      },
      error: null,
    })
  } catch (err: any) {
    console.error('generate-agent error:', err)
    return res.status(500).json({ data: null, error: err.message })
  }
})

// POST /api/projects/:projectId/environments/:envId/generate-context — gera contexto do projeto
router.post('/:projectId/environments/:envId/generate-context', authenticateToken, async (req, res) => {
  try {
    const { projectId, envId } = req.params

    // Verify project exists
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any
    if (!project) {
      return res.status(404).json({ data: null, error: 'Project not found' })
    }

    // Busca o environment no banco
    const environment = db.prepare(
      'SELECT * FROM environments WHERE id = ? AND project_id = ?'
    ).get(envId, projectId) as any

    if (!environment) {
      return res.status(404).json({ data: null, error: 'Environment not found' })
    }

    const projectPath = environment.project_path

    // Verifica se o caminho existe
    if (!fs.existsSync(projectPath)) {
      return res.status(400).json({ data: null, error: `Project path does not exist: ${projectPath}` })
    }

    // Verifica se é um diretório
    const stats = fs.statSync(projectPath)
    if (!stats.isDirectory()) {
      return res.status(400).json({ data: null, error: `Project path is not a directory: ${projectPath}` })
    }

    // Caminho do script Python
    const scriptPath = path.join(__dirname, '../../scripts/generate_project_context.py')

    // Verifica se o script existe
    if (!fs.existsSync(scriptPath)) {
      return res.status(500).json({ data: null, error: 'Context generation script not found' })
    }

    // Executa o script Python

    try {
      const output = execSync(
        `python3 "${scriptPath}" "${projectPath}" --output json`,
        {
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          timeout: 30000 // 30 seconds timeout
        }
      )

      // Parse o JSON output
      const contextData = JSON.parse(output)

      // Formata o contexto similar ao planning-context
      const formattedContext = {
        environment_id: envId,
        project_path: projectPath,
        structure: summarizeStructure(contextData.structure || {}),
        git_info: {
          branch: contextData.git_info?.branch || 'unknown',
          last_commit: contextData.git_info?.last_commit?.hash || contextData.git_info?.last_commit?.substring?.(0, 8) || 'unknown',
          remote: contextData.git_info?.remote_url || null,
        },
        stats: {
          total_files: contextData.stats?.total_files || 0,
          total_dirs: contextData.stats?.total_dirs || 0,
          languages: contextData.stats?.languages || {},
        },
      }

      return res.status(200).json({
        data: formattedContext,
        error: null,
      })
    } catch (execError: any) {
      console.error('Error executing context generation script:', execError)

      // Se o script falhar, retorna erro detalhado
      const errorMessage = execError.stderr || execError.stdout || execError.message

      return res.status(500).json({
        data: null,
        error: `Failed to generate context: ${errorMessage}`
      })
    }
  } catch (err: any) {
    console.error('generate-context error:', err)
    return res.status(500).json({ data: null, error: err.message })
  }
})

// POST /api/projects/:projectId/default-agents — criar equipes padrão (coder e/ou planner) para um ambiente
router.post('/:projectId/default-agents', authenticateToken, (req, res) => {
  try {
    const { environment_id, create_coder = true, create_planner = true } = req.body
    const { projectId } = req.params

    if (!environment_id) {
      return res.status(400).json({ data: null, error: 'environment_id is required' })
    }

    if (!create_coder && !create_planner) {
      return res.status(400).json({ data: null, error: 'At least one of create_coder or create_planner must be true' })
    }

    // Verify project exists
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any
    if (!project) {
      return res.status(404).json({ data: null, error: 'Project not found' })
    }

    // Get environment
    const env = db.prepare('SELECT * FROM environments WHERE id = ? AND project_id = ?')
      .get(environment_id, projectId) as any
    if (!env) {
      return res.status(404).json({ data: null, error: 'Environment not found' })
    }

    const created: { type: string; workspace_path: string }[] = []

    // Helper to create an agent workspace with basic structure
    const createAgentWorkspace = (
      workspacePath: string,
      agentName: string,
      role: string,
      projectPath: string,
      installPlanningSkill: boolean = false
    ) => {
      if (fs.existsSync(workspacePath)) {
        // Already exists, just link it
        db.prepare(
          'INSERT OR IGNORE INTO project_agents (project_id, workspace_path) VALUES (?, ?)'
        ).run(projectId, workspacePath)
        db.prepare(
          'INSERT OR REPLACE INTO team_roles (workspace_path, role) VALUES (?, ?)'
        ).run(workspacePath, role)
        return
      }

      // Create directory structure
      const claudeDir = path.join(workspacePath, '.claude')
      fs.mkdirSync(path.join(claudeDir, 'skills'), { recursive: true })

      // Create .gitignore
      const gitignorePath = path.join(workspacePath, '.gitignore')
      if (!fs.existsSync(gitignorePath)) {
        fs.writeFileSync(gitignorePath, '.agent-docs/\n')
      }

      // Resolve team template by role for CLAUDE.md and permissions
      const teamIdByRole = role === 'planner' ? 'plan-team'
        : role === 'reviewer' ? 'staging-team'
        : role === 'coder' ? 'dev-team'
        : null
      const teamTemplate = teamIdByRole ? getTeamTemplateById(teamIdByRole) : null

      // Create CLAUDE.md
      const claudeMdPath = path.join(workspacePath, 'CLAUDE.md')
      if (!fs.existsSync(claudeMdPath)) {
        let content: string

        if (teamTemplate) {
          // Use the team template CLAUDE.md with variable substitution
          content = renderTeamClaudeMd(teamTemplate, {
            agentName,
            projectName: project.name,
            workspacePath,
          })
        } else {
          // Fallback: simple default CLAUDE.md for unrecognized roles
          content = `# ${agentName} — ${role}

You are an agent for the **${project.name}** project.

## Context
- Project: ${project.name}
- Environment: ${env.name}
- Type: ${env.type ?? 'local-wsl'}
- Project path: ${projectPath}

## Responsibilities
- Read relevant files before making changes
- Follow existing patterns and conventions
- Run builds and tests after code changes
- Commit with clear, descriptive messages
`
        }
        fs.writeFileSync(claudeMdPath, content)
      }

      // Create settings.local.json
      const settingsPath = path.join(claudeDir, 'settings.local.json')
      if (!fs.existsSync(settingsPath)) {
        const globalEnvVars = db.prepare('SELECT key, value FROM environment_variables').all() as any[]
        const defaultEnv = globalEnvVars.reduce((acc: any, envVar: any) => {
          acc[envVar.key] = envVar.value
          return acc
        }, {})

        const settings = {
          env: {
            ANTHROPIC_BASE_URL: 'http://localhost:8083',
            API_TIMEOUT_MS: '3000000',
            ...defaultEnv
          },
          permissions: {
            allow: teamTemplate?.permissions.allow ?? ['Read', 'Edit', 'Write', 'Bash', 'Glob'],
            deny: teamTemplate?.permissions.deny ?? [],
            additionalDirectories: [projectPath]
          }
        }
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
      }

      // Install planning skill for planner agents
      if (installPlanningSkill) {
        const nativeSkillsPath = path.join(__dirname, '../../../native-skills')
        const planningSkillSrc = path.join(nativeSkillsPath, 'planning', 'SKILL.md')
        const planningSkillDest = path.join(claudeDir, 'skills', 'planning')

        if (fs.existsSync(planningSkillSrc)) {
          fs.mkdirSync(planningSkillDest, { recursive: true })
          fs.copyFileSync(planningSkillSrc, path.join(planningSkillDest, 'SKILL.md'))
        }
      }

      // Link to project
      db.prepare(
        'INSERT OR IGNORE INTO project_agents (project_id, workspace_path) VALUES (?, ?)'
      ).run(projectId, workspacePath)

      // Save role
      db.prepare(
        'INSERT OR REPLACE INTO team_roles (workspace_path, role) VALUES (?, ?)'
      ).run(workspacePath, role)
    }

    // Create Coder agent
    if (create_coder) {
      const coderPath = envAgentPath(AGENTS_BASE_PATH, project.name, env.name)
      createAgentWorkspace(coderPath, 'agent-coder', 'coder', env.project_path, false)
      // Update the environment's agent_workspace now that the user has confirmed creation
      db.prepare('UPDATE environments SET agent_workspace = ? WHERE id = ?').run(coderPath, environment_id)
      // Seed native agents for this team type
      try {
        seedNativeAgentsForTeam(coderPath, env.name)
      } catch (err) {
        console.error('[default-agents] Failed to seed native agents for coder:', err)
      }
      created.push({ type: 'coder', workspace_path: coderPath })
    }

    // Create Planner agent
    if (create_planner) {
      const plannerPath = envAgentPlannerPath(AGENTS_BASE_PATH, project.name, env.name)
      createAgentWorkspace(plannerPath, 'agent-planner', 'planner', env.project_path, true)
      // Seed native agents for this team type
      try {
        seedNativeAgentsForTeam(plannerPath, env.name)
      } catch (err) {
        console.error('[default-agents] Failed to seed native agents for planner:', err)
      }
      created.push({ type: 'planner', workspace_path: plannerPath })
    }

    return res.status(201).json({ data: { created }, error: null })
  } catch (err: any) {
    console.error('default-agents error:', err)
    return res.status(500).json({ data: null, error: err.message })
  }
})

export default router
