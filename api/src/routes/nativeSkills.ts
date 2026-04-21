import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const router = Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const NATIVE_SKILLS_PATH = path.join(__dirname, '../../../native-skills')

// Skills injected directly by the pipeline/runner — NOT user-installable.
// Exposing them in the UI causes false dependencies.
const PIPELINE_ONLY_SKILLS = new Set(['planning', 'workflow-handoff'])

/** Parse YAML frontmatter from SKILL.md content. Returns { name?, description?, body } */
function parseSkillMd(raw: string) {
  const trimmed = raw.trimStart()
  // Check for YAML frontmatter: first line must be exactly "---"
  const hasFrontmatter = trimmed.startsWith('---')
  if (!hasFrontmatter) {
    // Legacy format: extract name from first heading, description from next lines
    const lines = raw.split('\n')
    const headingLine = lines.find(l => l.startsWith('# '))
    const headingIdx = lines.indexOf(headingLine!)
    const name = headingLine?.replace(/^#+\s+/, '') ?? ''
    const description = lines.slice(headingIdx + 1, headingIdx + 3).join(' ').trim()
    return { name, description, body: raw }
  }

  // Strip opening "---"
  let rest = trimmed.slice(3)
  // Strip leading newline
  if (rest.startsWith('\n')) rest = rest.slice(1)

  // Find closing "---"
  const closingIdx = rest.indexOf('\n---')
  if (closingIdx === -1) {
    // Malformed frontmatter, fall back to legacy parsing
    const lines = raw.split('\n')
    const headingLine = lines.find(l => l.startsWith('# '))
    const name = headingLine?.replace(/^#+\s+/, '') ?? ''
    return { name, description: '', body: raw }
  }

  const yamlBlock = rest.slice(0, closingIdx)
  const body = rest.slice(closingIdx + 4).trimStart()

  // Simple YAML parser — handles plain scalars and folded scalars (>)
  const meta: Record<string, string> = {}
  const ylines = yamlBlock.split('\n')
  for (let i = 0; i < ylines.length; i++) {
    const line = ylines[i]
    const m = line.match(/^(\w+)\s*:\s*(.*)/)
    if (m) {
      let val = m[2].trim()
      // Handle YAML folded scalar (>) — value continues on indented lines
      if (val === '>' || val === '>+') {
        const folded: string[] = []
        for (let j = i + 1; j < ylines.length; j++) {
          const next = ylines[j]
          // Indented continuation line
          if (next.startsWith('  ') || next.startsWith('\t')) {
            folded.push(next.trim())
          } else {
            break
          }
        }
        val = folded.join(' ')
        i += folded.length
      }
      // Strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      meta[m[1]] = val
    }
  }

  return {
    name: meta.name ?? '',
    description: meta.description ?? '',
    body
  }
}

// GET /api/native-skills — listar skills nativas disponíveis
router.get('/', authenticateToken, (_req, res) => {
  if (!fs.existsSync(NATIVE_SKILLS_PATH)) {
    return res.json({ data: [], error: null })
  }
  const skills = fs.readdirSync(NATIVE_SKILLS_PATH, { withFileTypes: true })
    .filter(d => d.isDirectory() && !PIPELINE_ONLY_SKILLS.has(d.name))
    .map(d => {
      const skillMd = path.join(NATIVE_SKILLS_PATH, d.name, 'SKILL.md')
      const content = fs.existsSync(skillMd) ? fs.readFileSync(skillMd, 'utf-8') : ''
      const parsed = parseSkillMd(content)
      return {
        id: d.name,
        name: parsed.name || d.name,
        description: parsed.description || content.split('\n').slice(0, 2).join(' ').trim(),
        path: path.join(NATIVE_SKILLS_PATH, d.name)
      }
    })
  return res.json({ data: skills, error: null })
})

// GET /api/native-skills/:id — conteúdo da skill
router.get('/:id', authenticateToken, (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  const skillPath = path.join(NATIVE_SKILLS_PATH, id, 'SKILL.md')
  if (!fs.existsSync(skillPath)) {
    return res.status(404).json({ data: null, error: 'Skill not found' })
  }
  return res.json({ data: { content: fs.readFileSync(skillPath, 'utf-8') }, error: null })
})

export default router
