import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const router = Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const NATIVE_SKILLS_PATH = path.join(__dirname, '../../../native-skills')

// GET /api/native-skills — listar skills nativas disponíveis
router.get('/', authenticateToken, (_req, res) => {
  if (!fs.existsSync(NATIVE_SKILLS_PATH)) {
    return res.json({ data: [], error: null })
  }
  const skills = fs.readdirSync(NATIVE_SKILLS_PATH, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => {
      const skillMd = path.join(NATIVE_SKILLS_PATH, d.name, 'SKILL.md')
      const content = fs.existsSync(skillMd) ? fs.readFileSync(skillMd, 'utf-8') : ''
      const firstLine = content.split('\n').find(l => l.startsWith('# '))
      return {
        id: d.name,
        name: firstLine?.replace('# ', '') ?? d.name,
        description: content.split('\n').slice(2, 4).join(' ').trim(),
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
