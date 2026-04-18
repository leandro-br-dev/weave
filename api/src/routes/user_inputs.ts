import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { db } from '../db/index.js'
import { authenticateToken as requireAuth } from '../middleware/auth.js'

const router = Router()

// POST /api/user-inputs — daemon solicita input textual do usuário e aguarda
// O daemon chama isso e faz long-polling no GET abaixo
router.post('/', requireAuth, (req, res) => {
  const { plan_id, task_id, question, context } = req.body
  if (!plan_id || !task_id || !question) {
    return res.status(400).json({ data: null, error: 'plan_id, task_id, question are required' })
  }

  const id = uuid()
  db.prepare(`
    INSERT INTO user_inputs (id, plan_id, task_id, question, context, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))
  `).run(id, plan_id, task_id, question, context !== undefined ? JSON.stringify(context) : null)

  return res.status(201).json({ data: { id }, error: null })
})

// GET /api/user-inputs/pending — dashboard lista inputs pendentes
router.get('/pending', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT ui.*, p.name as plan_name
    FROM user_inputs ui
    LEFT JOIN plans p ON p.id = ui.plan_id
    WHERE ui.status = 'pending'
    ORDER BY ui.created_at ASC
  `).all()
  return res.json({ data: rows, error: null })
})

// GET /api/user-inputs/:id — daemon polling para saber se foi respondido
router.get('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM user_inputs WHERE id = ?').get(req.params.id) as any
  if (!row) return res.status(404).json({ data: null, error: 'User input not found' })
  return res.json({ data: row, error: null })
})

// POST /api/user-inputs/:id/respond — dashboard responde com a resposta do usuário
router.post('/:id/respond', requireAuth, (req, res) => {
  const { response } = req.body
  if (response === undefined || response === '') {
    return res.status(400).json({ data: null, error: 'response is required' })
  }

  const row = db.prepare('SELECT * FROM user_inputs WHERE id = ?').get(req.params.id) as any
  if (!row) return res.status(404).json({ data: null, error: 'User input not found' })
  if (row.status !== 'pending') {
    return res.status(409).json({ data: null, error: `Already ${row.status}` })
  }

  db.prepare(`
    UPDATE user_inputs
    SET status = 'answered', response = ?, responded_at = datetime('now')
    WHERE id = ?
  `).run(response, req.params.id)

  return res.json({ data: { id: req.params.id, response }, error: null })
})

// POST /api/user-inputs/timeout — chamado pelo cron interno da API
// Marca inputs pendentes com mais de N minutos como 'timeout'
router.post('/timeout', requireAuth, (req, res) => {
  const timeoutMinutes = Number(process.env.USER_INPUT_TIMEOUT_MINUTES ?? 60)
  const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString()
  const result = db.prepare(`
    UPDATE user_inputs
    SET status = 'timeout', responded_at = datetime('now')
    WHERE status = 'pending' AND created_at < ?
  `).run(cutoff)
  return res.json({ data: { timed_out: result.changes }, error: null })
})

export default router
