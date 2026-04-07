import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { db } from '../db/index.js'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { fileURLToPath } from 'url'
import { AGENTS_BASE_PATH } from '../utils/paths.js'
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

    // New structure: {project}/agents/{agent-name}/
    const agentsDirPath = path.join(projectPath, 'agents')
    if (fs.existsSync(agentsDirPath)) {
      try {
        const agentDirs = fs.readdirSync(agentsDirPath, { withFileTypes: true })
          .filter(d => d.isDirectory())

        for (const agentDir of agentDirs) {
          const fullPath = path.resolve(path.join(agentsDirPath, agentDir.name))
          results.push({
            id: Buffer.from(fullPath).toString('base64url'),
            name: agentDir.name,
            path: fullPath,
            type: 'agent'
          })
        }
      } catch (err) {
        console.error(`[quick-actions] Error scanning agents dir ${agentsDirPath}:`, err)
      }
    }

    // Environment agents: {project}/{env}/agent-coder/, agent-planner/, etc.
    try {
      const envDirs = fs.readdirSync(projectPath, { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name !== 'agents')

      for (const envDir of envDirs) {
        const envDirPath = path.join(projectPath, envDir.name)
        try {
          // Scan for all agent subdirectories (agent-coder, agent-planner, etc.)
          const agentSubDirs = fs.readdirSync(envDirPath, { withFileTypes: true })
            .filter(d => d.isDirectory() && d.name.startsWith('agent-'))

          for (const agentSubDir of agentSubDirs) {
            const agentPath = path.resolve(path.join(envDirPath, agentSubDir.name))
            const dirRole = agentSubDir.name.replace('agent-', '')
            results.push({
              id: Buffer.from(agentPath).toString('base64url'),
              name: `${projectDir.name}/${envDir.name}/${dirRole}`,
              path: agentPath,
              type: 'env-agent'
            })
          }
        } catch (err) {
          console.error(`[quick-actions] Error scanning env dir ${envDirPath}:`, err)
        }
      }
    } catch (err) {
      console.error(`[quick-actions] Error scanning project dir ${projectPath}:`, err)
    }

    // Legacy structure: {project}/agent-coder/
    const legacyAgentCoderPath = path.resolve(path.join(projectPath, 'agent-coder'))
    if (fs.existsSync(legacyAgentCoderPath)) {
      results.push({
        id: Buffer.from(legacyAgentCoderPath).toString('base64url'),
        name: projectDir.name,
        path: legacyAgentCoderPath,
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

  db.prepare(`
    INSERT INTO plans (id, name, tasks, status, project_id, type, attachments, workflow_path)
    VALUES (?, ?, ?, 'pending', ?, 'quick_action', ?, ?)
  `).run(planId, name ?? `Quick: ${message.slice(0, 60)}`, JSON.stringify([task]), project_id ?? null, attachmentsJson, workflowPath)

  return res.status(201).json({
    data: { id: planId, task_id: taskId },
    error: null
  })
})

export default router
