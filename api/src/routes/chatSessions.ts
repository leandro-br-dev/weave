import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db/index.js'

const router = Router()

// GET /api/sessions — listar sessões
router.get('/', authenticateToken, (req, res) => {
  const sessions = db.prepare(
    'SELECT * FROM chat_sessions ORDER BY updated_at DESC'
  ).all()
  return res.json({ data: sessions, error: null })
})

// POST /api/sessions — criar nova sessão
router.post('/', authenticateToken, (req, res) => {
  const { name, project_id, workspace_path, environment_id } = req.body
  if (!workspace_path) {
    return res.status(400).json({ data: null, error: 'workspace_path required' })
  }
  const id = uuidv4()
  db.prepare(`
    INSERT INTO chat_sessions (id, name, project_id, workspace_path, environment_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name ?? 'New Chat', project_id ?? null, workspace_path, environment_id ?? null)

  return res.status(201).json({ data: { id, name, workspace_path }, error: null })
})

// GET /api/sessions/unread-count — count assistant messages not yet read
router.get('/unread-count', authenticateToken, (_req, res) => {
  const count = db.prepare(
    "SELECT COUNT(*) as cnt FROM chat_messages m " +
    "JOIN chat_sessions s ON s.id = m.session_id " +
    "WHERE m.role = 'assistant' " +
    "AND (s.last_read_at IS NULL OR m.created_at > s.last_read_at)"
  ).get() as { cnt: number }

  return res.json({ data: { count: count.cnt }, error: null })
})

// PATCH /api/sessions/mark-read — mark all messages as read up to now
router.patch('/mark-read', authenticateToken, (_req, res) => {
  db.prepare(
    "UPDATE chat_sessions SET last_read_at = datetime('now') WHERE last_read_at IS NULL OR last_read_at < datetime('now')"
  ).run()
  return res.json({ data: { success: true }, error: null })
})

// GET /api/sessions/pending — daemon polling (sessões running sem sdk_session_id, ou running com)
router.get('/pending', authenticateToken, (_req, res) => {
  const sessions = db.prepare(
    "SELECT s.*, m.content as last_user_message, m.attachments as last_user_message_attachment_ids, e.project_path as env_project_path " +
    "FROM chat_sessions s " +
    "JOIN chat_messages m ON m.id = (" +
    "  SELECT id FROM chat_messages WHERE session_id = s.id AND role = 'user' ORDER BY created_at DESC LIMIT 1" +
    ") " +
    "LEFT JOIN environments e ON e.id = s.environment_id " +
    "WHERE s.status = 'running' LIMIT 5"
  ).all() as any[]

  // Enrich each session with attachment metadata for the last user message
  const enriched = sessions.map((session) => {
    let attachments: any[] = []
    try {
      const ids = typeof session.last_user_message_attachment_ids === 'string'
        ? JSON.parse(session.last_user_message_attachment_ids)
        : session.last_user_message_attachment_ids || []

      if (Array.isArray(ids) && ids.length > 0) {
        const placeholders = ids.map(() => '?').join(', ')
        const rows = db.prepare(
          `SELECT id, file_name, file_type, file_size, storage_path
           FROM message_attachments WHERE id IN (${placeholders})`
        ).all(...ids) as any[]

        attachments = rows.map((row) => ({
          ...row,
          download_url: `/api/uploads/${row.id}`,
        }))
      }
    } catch {
      // If attachment IDs can't be parsed, skip attachments
    }

    return {
      ...session,
      last_user_message_attachments: attachments,
    }
  })

  return res.json({ data: enriched, error: null })
})

// DELETE /api/sessions/:id/messages/:msgId — deletar mensagem individual
router.delete('/:id/messages/:msgId', authenticateToken, (req, res) => {
  const { id, msgId } = req.params

  // Verify session exists
  const session = db.prepare('SELECT id FROM chat_sessions WHERE id = ?').get(id)
  if (!session) {
    return res.status(404).json({ data: null, error: 'Session not found' })
  }

  // Verificar que a mensagem pertence à sessão
  const msg = db.prepare(
    'SELECT * FROM chat_messages WHERE id = ? AND session_id = ?'
  ).get(msgId, id)

  if (!msg) {
    return res.status(404).json({ data: null, error: 'Message not found' })
  }

  db.prepare('DELETE FROM chat_messages WHERE id = ?').run(msgId)

  return res.json({ data: { deleted: true }, error: null })
})

// DELETE /api/sessions/:id/messages — limpar todo o histórico
router.delete('/:id/messages', authenticateToken, (req, res) => {
  const { id } = req.params

  // Verify session exists
  let session = db.prepare('SELECT id, status FROM chat_sessions WHERE id = ?').get(id) as any
  if (!session) {
    return res.status(404).json({ data: null, error: 'Session not found' })
  }

  const result = db.prepare('DELETE FROM chat_messages WHERE session_id = ?').run(id)

  // Resetar sdk_session_id pois o contexto foi perdido
  db.prepare(
    "UPDATE chat_sessions SET sdk_session_id = NULL, status = 'idle', updated_at = datetime('now') WHERE id = ?"
  ).run(id)

  return res.json({
    data: { deleted: result.changes, context_reset: true },
    error: null
  })
})

// GET /api/sessions/:id — detalhes + mensagens
router.get('/:id', authenticateToken, (req, res) => {
  const session = db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(req.params.id) as any
  if (!session) return res.status(404).json({ data: null, error: 'Not found' })

  const messages = db.prepare(
    'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC'
  ).all(req.params.id) as any[]

  // Enrich messages with attachment metadata
  const allAttachmentIds: string[] = []
  for (const msg of messages) {
    try {
      const ids = typeof msg.attachments === 'string'
        ? JSON.parse(msg.attachments)
        : msg.attachments || []
      if (Array.isArray(ids)) {
        allAttachmentIds.push(...ids)
      }
    } catch {
      // skip malformed
    }
  }

  const attachmentMap = new Map<string, any>()
  if (allAttachmentIds.length > 0) {
    const uniqueIds = [...new Set(allAttachmentIds)]
    const placeholders = uniqueIds.map(() => '?').join(', ')
    const rows = db.prepare(
      `SELECT id, file_name, file_type, file_size, storage_path
       FROM message_attachments WHERE id IN (${placeholders})`
    ).all(...uniqueIds) as any[]
    for (const row of rows) {
      attachmentMap.set(row.id, row)
    }
  }

  const enrichedMessages = messages.map((msg) => {
    let parsedAttachments: any[] = []
    try {
      const ids = typeof msg.attachments === 'string'
        ? JSON.parse(msg.attachments)
        : msg.attachments || []
      if (Array.isArray(ids)) {
        parsedAttachments = ids
          .map((id: string) => {
            const att = attachmentMap.get(id)
            return att ? { ...att, download_url: `/api/uploads/${att.id}` } : null
          })
          .filter(Boolean)
      }
    } catch {
      // skip
    }
    return { ...msg, attachment_data: parsedAttachments }
  })

  return res.json({ data: { ...session as any, messages: enrichedMessages }, error: null })
})

// PATCH /api/sessions/:id — atualizar nome da sessão
router.patch('/:id', authenticateToken, (req, res) => {
  const { id } = req.params
  const { name } = req.body

  // Validar que o nome não está vazio
  if (!name?.trim()) {
    return res.status(400).json({ data: null, error: 'Name cannot be empty' })
  }

  // Verificar que a sessão existe
  const session = db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(id) as any
  if (!session) {
    return res.status(404).json({ data: null, error: 'Session not found' })
  }

  // Atualizar o nome e o timestamp
  db.prepare(
    "UPDATE chat_sessions SET name = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(name.trim(), id)

  // Buscar a sessão atualizada para retornar
  const updatedSession = db.prepare(
    'SELECT id, name, updated_at FROM chat_sessions WHERE id = ?'
  ).get(id)

  return res.json({ data: updatedSession, error: null })
})

// DELETE /api/sessions/:id — deletar sessão e todas as mensagens (cascade)
router.delete('/:id', authenticateToken, (req, res) => {
  const { id } = req.params

  // Verificar que a sessão existe
  const session = db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(id) as any
  if (!session) {
    return res.status(404).json({ data: null, error: 'Session not found' })
  }

  // Não permitir deletar sessões que estão rodando
  if (session.status === 'running') {
    return res.status(409).json({ data: null, error: 'Cannot delete a running session. Wait for it to complete.' })
  }

  // Deletar sessão (messages serão deletadas em cascade pelo banco)
  db.prepare('DELETE FROM chat_sessions WHERE id = ?').run(id)

  return res.json({ data: { deleted: true, id }, error: null })
})

// POST /api/sessions/:id/message — enviar mensagem (inicia execução no daemon)
router.post('/:id/message', authenticateToken, (req, res) => {
  const session = db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(req.params.id) as any
  if (!session) return res.status(404).json({ data: null, error: 'Not found' })
  if (session.status === 'running') {
    return res.status(409).json({ data: null, error: 'Session is already running' })
  }

  const { content, attachment_ids } = req.body
  if (!content?.trim()) return res.status(400).json({ data: null, error: 'content required' })

  // Validate attachment_ids if provided
  let validAttachmentIds: string[] = []
  if (Array.isArray(attachment_ids) && attachment_ids.length > 0) {
    const placeholders = attachment_ids.map(() => '?').join(', ')
    const existing = db.prepare(
      `SELECT id FROM message_attachments WHERE id IN (${placeholders})`
    ).all(...attachment_ids) as any[]
    validAttachmentIds = existing.map((row) => row.id)
  }

  // Salvar mensagem do usuário
  const msgId = uuidv4()
  db.prepare(
    'INSERT INTO chat_messages (id, session_id, role, content, attachments) VALUES (?, ?, ?, ?, ?)'
  ).run(msgId, req.params.id, 'user', content.trim(), JSON.stringify(validAttachmentIds))

  // Link attachments to this message
  if (validAttachmentIds.length > 0) {
    const insertStmt = db.prepare(
      'UPDATE message_attachments SET message_id = ?, message_type = ? WHERE id = ?'
    )
    for (const attId of validAttachmentIds) {
      insertStmt.run(msgId, 'chat', attId)
    }
  }

  // Marcar como running — o daemon vai pegar via polling
  db.prepare(
    "UPDATE chat_sessions SET status = 'running', updated_at = datetime('now') WHERE id = ?"
  ).run(req.params.id)

  return res.status(201).json({ data: { message_id: msgId, session_id: req.params.id }, error: null })
})

// POST /api/sessions/:id/sdk-session — daemon registra o sdk_session_id após primeira execução
router.post('/:id/sdk-session', authenticateToken, (req, res) => {
  const { sdk_session_id } = req.body

  // Verify session exists (daemon/system user can update any session)
  const session = db.prepare('SELECT id FROM chat_sessions WHERE id = ?').get(req.params.id)
  if (!session) return res.status(404).json({ data: null, error: 'Not found' })
  db.prepare(
    "UPDATE chat_sessions SET sdk_session_id = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(sdk_session_id, req.params.id)
  return res.json({ data: { saved: true }, error: null })
})

// POST /api/sessions/:id/assistant-message — daemon envia resposta do assistente
router.post('/:id/assistant-message', authenticateToken, (req, res) => {
  const { content, structured_output } = req.body

  // Verify session exists (daemon/system user can update any session)
  const session = db.prepare('SELECT id FROM chat_sessions WHERE id = ?').get(req.params.id)
  if (!session) return res.status(404).json({ data: null, error: 'Not found' })
  const msgId = uuidv4()
  db.prepare(
    'INSERT INTO chat_messages (id, session_id, role, content) VALUES (?, ?, ?, ?)'
  ).run(msgId, req.params.id, 'assistant', content ?? '')

  const updates: any = { status: 'idle', updated_at: 'datetime("now")' }

  if (structured_output) {
    // Salvar structured output na mensagem
    db.prepare(
      'UPDATE chat_messages SET content = ? WHERE id = ?'
    ).run(JSON.stringify({ text: content, structured_output }), msgId)
  }

  db.prepare(
    "UPDATE chat_sessions SET status = 'idle', updated_at = datetime('now') WHERE id = ?"
  ).run(req.params.id)

  return res.status(201).json({ data: { message_id: msgId }, error: null })
})

// GET /api/sessions/:id/attachments — list all attachments for a session's messages
router.get('/:id/attachments', authenticateToken, (req, res) => {
  const { id } = req.params

  // Verify session exists
  const session = db.prepare('SELECT id FROM chat_sessions WHERE id = ?').get(id)
  if (!session) {
    return res.status(404).json({ data: null, error: 'Session not found' })
  }

  // Get all attachment IDs from messages in this session
  const messages = db.prepare(
    "SELECT attachments FROM chat_messages WHERE session_id = ? AND role = 'user'"
  ).all(id) as any[]

  const allAttachmentIds: string[] = []
  for (const msg of messages) {
    try {
      const ids = typeof msg.attachments === 'string'
        ? JSON.parse(msg.attachments)
        : msg.attachments || []
      if (Array.isArray(ids)) {
        allAttachmentIds.push(...ids)
      }
    } catch {
      // Skip malformed attachment arrays
    }
  }

  if (allAttachmentIds.length === 0) {
    return res.json({ data: [], error: null })
  }

  // Deduplicate IDs
  const uniqueIds = [...new Set(allAttachmentIds)]
  const placeholders = uniqueIds.map(() => '?').join(', ')

  const attachments = db.prepare(
    `SELECT id, message_type, message_id, file_name, file_type, file_size, storage_path, created_at
     FROM message_attachments WHERE id IN (${placeholders})`
  ).all(...uniqueIds) as any[]

  const enriched = attachments.map((att) => ({
    ...att,
    download_url: `/api/uploads/${att.id}`,
  }))

  return res.json({ data: enriched, error: null })
})

// GET /api/sessions/:id/stream — SSE para novas mensagens em tempo real
router.get('/:id/stream', authenticateToken, (req, res) => {
  // Verify session exists
  const session = db.prepare('SELECT id FROM chat_sessions WHERE id = ?').get(req.params.id)
  if (!session) return res.status(404).json({ data: null, error: 'Not found' })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const sessionId = req.params.id
  let lastMessageId = ''

  const interval = setInterval(() => {
    const newMessages = db.prepare(
      'SELECT * FROM chat_messages WHERE session_id = ? AND id > ? ORDER BY created_at ASC'
    ).all(sessionId, lastMessageId) as any[]

    for (const msg of newMessages) {
      res.write(`data: ${JSON.stringify(msg)}\n\n`)
      lastMessageId = msg.id
    }

    // Também enviar status da sessão
    const session = db.prepare('SELECT status FROM chat_sessions WHERE id = ?').get(sessionId) as any
    if (session) {
      res.write(`event: status\ndata: ${JSON.stringify({ status: session.status })}\n\n`)
    }
  }, 500)

  req.on('close', () => clearInterval(interval))
})

export default router
