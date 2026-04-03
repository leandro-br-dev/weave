import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { db } from '../db/index.js'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { fileURLToPath } from 'url'
import { AGENTS_BASE_PATH } from '../utils/paths.js'

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
    const agentsDirPath = path.join(projectPath, 'agents')

    // New structure: {project}/agents/{agent-name}/
    if (fs.existsSync(agentsDirPath)) {
      const agentDirs = fs.readdirSync(agentsDirPath, { withFileTypes: true })
        .filter(d => d.isDirectory())

      for (const agentDir of agentDirs) {
        const fullPath = path.join(agentsDirPath, agentDir.name)
        results.push({
          id: Buffer.from(fullPath).toString('base64url'),
          name: agentDir.name,
          path: fullPath,
          type: 'agent'
        })
      }
    }

    // Environment agents: {project}/{env}/agent-coder/
    const envDirs = fs.readdirSync(projectPath, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name !== 'agents')

    for (const envDir of envDirs) {
      const agentCoderPath = path.join(projectPath, envDir.name, 'agent-coder')
      if (fs.existsSync(agentCoderPath)) {
        results.push({
          id: Buffer.from(agentCoderPath).toString('base64url'),
          name: `${projectDir.name}/${envDir.name}`,
          path: agentCoderPath,
          type: 'env-agent'
        })
      }
    }

    // Legacy structure: {project}/agent-coder/
    const legacyAgentCoderPath = path.join(projectPath, 'agent-coder')
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
    workspace_id,      // qual agente
    environment_id,    // qual ambiente (para cwd)
    project_id,
    native_skill,      // 'planning' | 'reviewer' | 'debugger' | null
    attachment_ids,    // array of uploaded attachment IDs
  } = req.body

  if (!message || !workspace_id) {
    return res.status(400).json({ data: null, error: 'message and workspace_id are required' })
  }

  // Resolver workspace path a partir do ID
  const allWs = listAllWorkspaces()
  const ws = allWs.find((w: any) => w.id === workspace_id)
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

  // Montar prompt com skill nativa se selecionada
  let prompt = message
  if (native_skill) {
    const nativeSkillsPath = path.join(__dirname, '../../../native-skills')
    const skillPath = path.join(nativeSkillsPath, native_skill, 'SKILL.md')
    if (fs.existsSync(skillPath)) {
      const skillContent = fs.readFileSync(skillPath, 'utf-8')
      prompt = `${skillContent}\n\n---\n\nUser request:\n${message}`
    }
  }

  const planId = uuidv4()
  const taskId = uuidv4()

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
    INSERT INTO plans (id, name, tasks, status, project_id, type, attachments)
    VALUES (?, ?, ?, 'pending', ?, 'quick_action', ?)
  `).run(planId, name ?? `Quick: ${message.slice(0, 60)}`, JSON.stringify([task]), project_id ?? null, attachmentsJson)

  return res.status(201).json({
    data: { id: planId, task_id: taskId },
    error: null
  })
})

export default router
