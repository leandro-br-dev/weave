import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { db } from '../db/index.js'
import { authenticateToken as requireAuth } from '../middleware/auth.js'

const router = Router()

// POST /api/approvals — daemon solicita aprovação e aguarda
// O daemon chama isso e faz long-polling no GET abaixo
router.post('/', requireAuth, (req, res) => {
  const { plan_id, task_id, tool, input, reason } = req.body
  if (!plan_id || !task_id || !tool || input === undefined) {
    return res.status(400).json({ data: null, error: 'plan_id, task_id, tool, input are required' })
  }

  const id = uuid()
  db.prepare(`
    INSERT INTO approvals (id, plan_id, task_id, tool, input, reason, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
  `).run(id, plan_id, task_id, tool, JSON.stringify(input), reason ?? null)

  return res.status(201).json({ data: { id }, error: null })
})

// GET /api/approvals/pending — dashboard lista aprovações pendentes
router.get('/pending', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT a.*, p.name as plan_name
    FROM approvals a
    LEFT JOIN plans p ON p.id = a.plan_id
    WHERE a.status = 'pending'
    ORDER BY a.created_at ASC
  `).all()
  return res.json({ data: rows, error: null })
})

// GET /api/approvals/:id — daemon polling para saber se foi respondido
router.get('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM approvals WHERE id = ?').get(req.params.id) as any
  if (!row) return res.status(404).json({ data: null, error: 'Approval not found' })
  return res.json({ data: row, error: null })
})

// POST /api/approvals/:id/respond — dashboard aprova ou nega
router.post('/:id/respond', requireAuth, (req, res) => {
  const { decision } = req.body  // 'approved' | 'denied'
  if (!['approved', 'denied'].includes(decision)) {
    return res.status(400).json({ data: null, error: 'decision must be approved or denied' })
  }

  const row = db.prepare('SELECT * FROM approvals WHERE id = ?').get(req.params.id) as any
  if (!row) return res.status(404).json({ data: null, error: 'Approval not found' })
  if (row.status !== 'pending') {
    return res.status(409).json({ data: null, error: `Already ${row.status}` })
  }

  db.prepare(`
    UPDATE approvals
    SET status = ?, responded_at = datetime('now')
    WHERE id = ?
  `).run(decision, req.params.id)

  return res.json({ data: { id: req.params.id, decision }, error: null })
})

// POST /api/approvals/timeout — chamado pelo cron interno da API
// Nega aprovações pendentes com mais de N minutos
router.post('/timeout', requireAuth, (req, res) => {
  const timeoutMinutes = Number(process.env.APPROVAL_TIMEOUT_MINUTES ?? 10)
  const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString()
  const result = db.prepare(`
    UPDATE approvals
    SET status = 'timeout', responded_at = datetime('now')
    WHERE status = 'pending' AND created_at < ?
  `).run(cutoff)
  return res.json({ data: { timed_out: result.changes }, error: null })
})

export default router
