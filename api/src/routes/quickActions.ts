import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { db } from '../db/index.js'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { fileURLToPath } from 'url'
import { AGENTS_BASE_PATH, teamsBaseDir } from '../utils/paths.js'
import { ensureWorkflowDir } from '../services/workflowDir.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = Router()

// Helper function to list all workspaces
function listAllWorkspaces(): any[] {
  if (!fs.existsSync(AGENTS_BASE_PATH)) {
    return []
  }

  const results: any[] = []

  // Read all project directories
  const projectDirs = fs.readdirSync(AGENTS_BASE_PATH, { withFileTypes: true })
    .filter(d => d.isDirectory())

  for (const projectDir of projectDirs) {
    const projectPath = path.join(AGENTS_BASE_PATH, projectDir.name)

    // NEW structure: {project}/teams/{team-name}/
    const teamsDirPath = path.join(projectPath, 'teams')
    if (fs.existsSync(teamsDirPath)) {
      try {
        const teamDirs = fs.readdirSync(teamsDirPath, { withFileTypes: true })
          .filter(d => d.isDirectory())

        for (const teamDir of teamDirs) {
          const fullPath = path.resolve(path.join(teamsDirPath, teamDir.name))
          results.push({
            id: Buffer.from(fullPath).toString('base64url'),
            name: teamDir.name,
            path: fullPath,
            type: teamDir.name.startsWith('team-') ? 'env-agent' : 'agent'
          })
        }
      } catch (err) {
        console.error(`[quick-actions] Error scanning teams dir ${teamsDirPath}:`, err)
      }
    }

    // LEGACY structure: {project}/agents/{agent-name}/
    const legacyAgentsDir = path.join(projectPath, 'agents')
    if (fs.existsSync(legacyAgentsDir)) {
      try {
        const agentDirs = fs.readdirSync(legacyAgentsDir, { withFileTypes: true })
          .filter(d => d.isDirectory())

        for (const agentDir of agentDirs) {
          const fullPath = path.resolve(path.join(legacyAgentsDir, agentDir.name))
          if (results.some(r => r.path === fullPath)) continue
          results.push({
            id: Buffer.from(fullPath).toString('base64url'),
            name: agentDir.name,
            path: fullPath,
            type: 'legacy'
          })
        }
      } catch (err) {
        console.error(`[quick-actions] Error scanning legacy agents dir ${legacyAgentsDir}:`, err)
      }
    }

    // LEGACY structure: {project}/{env}/team-{role}/ (env-nested teams)
    try {
      const subDirs = fs.readdirSync(projectPath, { withFileTypes: true })
        .filter(d => d.isDirectory() && !['agents', 'teams', 'env', 'workflows'].includes(d.name))

      for (const subDir of subDirs) {
        const subDirPath = path.join(projectPath, subDir.name)
        try {
          const teamSubDirs = fs.readdirSync(subDirPath, { withFileTypes: true })
            .filter(d => d.isDirectory() && (d.name.startsWith('team-') || d.name.startsWith('agent-')))

          for (const teamSubDir of teamSubDirs) {
            const teamPath = path.resolve(path.join(subDirPath, teamSubDir.name))
            if (results.some(r => r.path === teamPath)) continue
            const dirRole = teamSubDir.name.replace(/^team-|^agent-/, '')
            results.push({
              id: Buffer.from(teamPath).toString('base64url'),
              name: teamSubDir.name,
              path: teamPath,
              type: 'legacy'
            })
          }
        } catch {
          // Not an env dir, skip
        }
      }
    } catch {
      // Ignore scan errors
    }

    // LEGACY structure: {project}/team-coder/ (direct child)
    const legacyTeamCoderPath = path.resolve(path.join(projectPath, 'team-coder'))
    if (fs.existsSync(legacyTeamCoderPath) && !results.some(r => r.path === legacyTeamCoderPath)) {
      results.push({
        id: Buffer.from(legacyTeamCoderPath).toString('base64url'),
        name: projectDir.name,
        path: legacyTeamCoderPath,
        type: 'legacy'
      })
    }
  }

  return results
}

// POST /api/quick-actions
router.post('/', authenticateToken, (req, res) => {
  const {
    name,
    message,           // o que o usuário quer
    team_id,           // qual agente
    environment_id,    // qual ambiente (para cwd)
    project_id,
    native_skill,      // 'planning' | 'reviewer' | 'debugger' | null
    attachment_ids,    // array of uploaded attachment IDs
  } = req.body

  if (!message || !team_id) {
    return res.status(400).json({ data: null, error: 'message and team_id are required' })
  }

  // Resolver workspace path a partir do ID
  const allWs = listAllWorkspaces()
  const ws = allWs.find((w: any) => w.id === team_id)
  if (!ws) {
    return res.status(404).json({ data: null, error: 'Workspace not found' })
  }

  // Resolver cwd a partir do ambiente (se fornecido)
  let cwd = ws.path
  let env_context = ''
  if (environment_id) {
    const env = db.prepare('SELECT * FROM environments WHERE id = ?').get(environment_id) as any
    if (env) {
      cwd = env.project_path ?? ws.path
      env_context = `${env.name} (${env.type})\nProject path: ${env.project_path}`
    }
  }

  const planId = uuidv4()
  const taskId = uuidv4()

  // Resolve project name for workflow directory
  let projectName = 'unknown'
  if (project_id) {
    const project = db.prepare('SELECT name FROM projects WHERE id = ?').get(project_id) as any
    if (project) projectName = project.name
  }

  // Create per-workflow directory with standard files (Blackboard)
  let workflowPath: string | null = null
  try {
    workflowPath = ensureWorkflowDir(projectName, planId)
  } catch (dirError) {
    console.error(`[quick-actions] Failed to create workflow directory for plan ${planId}:`, dirError)
  }

  // Montar prompt com skill nativa se selecionada
  let prompt = message
  if (native_skill) {
    const nativeSkillsPath = path.join(__dirname, '../../../native-skills')
    const skillPath = path.join(nativeSkillsPath, native_skill, 'SKILL.md')
    if (fs.existsSync(skillPath)) {
      let skillContent = fs.readFileSync(skillPath, 'utf-8')
      // Substitute [WORKFLOW_DIR] placeholder with the actual workflow directory
      if (workflowPath) {
        skillContent = skillContent.replace(/\[WORKFLOW_DIR\]/g, workflowPath)
      }
      prompt = `${skillContent}\n\n---\n\nUser request:\n${message}`
    }
  }

  const task = {
    id: taskId,
    name: name ?? 'Quick Action',
    prompt,
    cwd,
    workspace: ws.path,
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Skill'],
    permission_mode: 'acceptEdits',
    depends_on: [],
    env_context: env_context || undefined,
  }

  // Build attachments JSON if attachment_ids were provided
  const attachmentsJson = JSON.stringify(attachment_ids ?? [])

  // Generate a human-readable plan name with datetime
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const datetime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
  const planName = name
    ? `Quick Action - ${projectName} - ${datetime}`
    : `Quick Action - ${projectName} - ${datetime} — ${message.slice(0, 60)}`

  db.prepare(`
    INSERT INTO plans (id, name, tasks, status, project_id, type, attachments, workflow_path)
    VALUES (?, ?, ?, 'pending', ?, 'quick_action', ?, ?)
  `).run(planId, planName, JSON.stringify([task]), project_id ?? null, attachmentsJson, workflowPath)

  return res.status(201).json({
    data: { id: planId, task_id: taskId },
    error: null
  })
})

export default router
