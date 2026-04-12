import { Router, Request, Response } from 'express'
import fs from 'fs'
import { db } from '../db/index.js'
import { authenticateToken } from '../middleware/auth.js'
import { randomUUID } from 'crypto'
import { ensureWorkflowDir, writePlanJson } from '../services/workflowDir.js'

const router = Router()

// ───────────────────────────────────────────────────────────
// POST /api/plans/prepare-workflow
// Pre-create a workflow directory and return its path.
// Called by the orchestrator BEFORE the planning agent runs,
// so the agent can save plan.json directly to the blackboard.
// ───────────────────────────────────────────────────────────
router.post('/prepare-workflow', authenticateToken, (req: Request, res: Response) => {
  try {
    const { project_id, project_name } = req.body

    if (!project_id) {
      return res.status(400).json({ data: null, error: 'project_id is required' })
    }

    const workflowUuid = randomUUID()
    const name = project_name || 'unknown'

    let workflowPath: string | null = null
    try {
      workflowPath = ensureWorkflowDir(name, workflowUuid)
      console.log(`[plans] Workflow directory pre-created: ${workflowPath}`)
    } catch (dirError) {
      console.error(`[plans] Failed to pre-create workflow directory:`, dirError)
      return res.status(500).json({ data: null, error: 'Failed to create workflow directory' })
    }

    // Store a placeholder so the UUID is reserved
    db.prepare(`
      INSERT INTO plans (id, name, tasks, status, project_id, workflow_path, created_at)
      VALUES (?, '', '[]', 'draft', ?, ?, ?)
    `).run(workflowUuid, project_id, workflowPath, new Date().toISOString())

    res.json({ data: { id: workflowUuid, workflow_path: workflowPath }, error: null })
  } catch (error) {
    console.error('Error preparing workflow:', error)
    res.status(500).json({ data: null, error: 'Failed to prepare workflow' })
  }
})

// Helper function to parse tasks JSON string from SQLite
function parsePlan(row: any) {
  const tasks = typeof row.tasks === 'string' ? JSON.parse(row.tasks) : row.tasks
  // Sanitize tasks: ensure cwd and workspace are always strings (not objects)
  // The AI planner may occasionally return these as objects instead of path strings
  if (Array.isArray(tasks)) {
    for (const task of tasks) {
      if (task.cwd !== undefined && typeof task.cwd !== 'string') {
        task.cwd = typeof task.cwd === 'object' ? (task.cwd.path || task.cwd.workspace_path || JSON.stringify(task.cwd)) : String(task.cwd)
      }
      if (task.workspace !== undefined && typeof task.workspace !== 'string') {
        task.workspace = typeof task.workspace === 'object' ? (task.workspace.path || task.workspace.workspace_path || JSON.stringify(task.workspace)) : String(task.workspace)
      }
    }
  }
  return {
    ...row,
    tasks,
    attachments: typeof row.attachments === 'string' ? JSON.parse(row.attachments) : (row.attachments || []),
  }
}

// Types for request bodies
interface CreatePlanBody {
  name: string
  tasks: any[] | string
  project_id?: string
  team_id?: string
}

interface StartPlanBody {
  client_id: string
}

interface CompletePlanBody {
  status: 'success' | 'failed'
  result: string
  result_status?: 'success' | 'partial' | 'needs_rework'
  result_notes?: string
  structured_output?: any
  daemon_completed_at?: string // ISO timestamp from daemon when completing
}

interface LogEntry {
  task_id: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
}

// GET /api/plans - List all plans
router.get('/', authenticateToken, (req: Request, res: Response) => {
  try {
    const { project_id, status } = req.query

    // Build WHERE clause and parameters based on provided filters
    let whereClause = ''
    const params: any[] = []

    if (project_id && status) {
      whereClause += whereClause ? ' AND project_id = ? AND status = ?' : 'WHERE project_id = ? AND status = ?'
      params.push(project_id, status)
    } else if (project_id) {
      whereClause += whereClause ? ' AND project_id = ?' : 'WHERE project_id = ?'
      params.push(project_id)
    } else if (status) {
      whereClause += whereClause ? ' AND status = ?' : 'WHERE status = ?'
      params.push(status)
    }

    const query = `
      SELECT
        id,
        name,
        tasks,
        status,
        client_id,
        result,
        started_at,
        completed_at,
        created_at,
        project_id,
        parent_plan_id,
        rework_prompt,
        rework_mode,
        attachments
      FROM plans
      ${whereClause}
      ORDER BY created_at DESC
    `

    const plans = params.length > 0
      ? db.prepare(query).all(...params)
      : db.prepare(query).all()

    res.json({ data: plans.map(parsePlan), error: null })
  } catch (error) {
    console.error('Error fetching plans:', error)
    res.status(500).json({ data: null, error: 'Failed to fetch plans' })
  }
})

// POST /api/plans - Create a new plan
// If workflow_id is provided, reuses the pre-created workflow directory (Blackboard pattern).
router.post('/', authenticateToken, (req: Request, res: Response) => {
  try {
    const { name, tasks, project_id, status: requestedStatus, workflow_id, team_id: requestTeamId }: CreatePlanBody & { status?: string; workflow_id?: string } = req.body

    console.log(`[plans] Creating plan: name="${name}", project_id=${project_id}, tasks_count=${Array.isArray(tasks) ? tasks.length : 'parsed'}, workflow_id=${workflow_id || 'none'}`)

    if (!name || !tasks) {
      console.error(`[plans] Missing required fields: name=${!!name}, tasks=${!!tasks}`)
      return res.status(400).json({ data: null, error: 'name and tasks are required' })
    }

    // Parse tasks if it's a string
    let parsedTasks: any[]
    try {
      parsedTasks = typeof tasks === 'string' ? JSON.parse(tasks) : tasks
    } catch (parseError) {
      console.error(`[plans] Failed to parse tasks JSON: ${parseError}`)
      return res.status(400).json({ data: null, error: 'Invalid tasks JSON format' })
    }

    // Sanitize tasks to ensure each task has an id
    const sanitizedTasks = (parsedTasks || []).map((task: any, index: number) => ({
      ...task,
      id: task.id || `task-${index + 1}`,
    }))

    // Collect all attachment_ids from tasks into the plan-level attachments column
    const allAttachmentIds: string[] = []
    for (const task of sanitizedTasks) {
      if (Array.isArray(task.attachment_ids)) {
        allAttachmentIds.push(...task.attachment_ids)
      }
    }

    // Validate and set status (default to 'pending')
    const allowedStatuses = ['pending', 'awaiting_approval']
    const status = requestedStatus && allowedStatuses.includes(requestedStatus) ? requestedStatus : 'pending'

    let id: string
    let workflowPath: string | null = null
    const now = new Date().toISOString()

    if (workflow_id) {
      // ── Blackboard pattern: reuse pre-created workflow directory ──
      id = workflow_id
      console.log(`[plans] Reusing pre-created workflow: id=${id}`)

      // Look up the existing draft plan to get workflow_path
      const draft = db.prepare('SELECT workflow_path FROM plans WHERE id = ? AND status = ?').get(id, 'draft') as any
      if (!draft) {
        console.error(`[plans] Pre-created workflow ${id} not found or not in 'draft' status`)
        return res.status(400).json({ data: null, error: 'Invalid or already consumed workflow_id' })
      }
      workflowPath = draft.workflow_path

      // Update the draft plan with actual content
      db.prepare(`
        UPDATE plans SET name = ?, tasks = ?, status = ?, project_id = ?, attachments = ?, workflow_path = ?, team_id = ?
        WHERE id = ? AND status = 'draft'
      `).run(name, JSON.stringify(sanitizedTasks), status, project_id ?? null, JSON.stringify(allAttachmentIds), workflowPath, requestTeamId || null, id)
    } else {
      // ── Legacy path: create new plan with new workflow directory ──
      id = randomUUID()
      console.log(`[plans] Inserting plan: id=${id}, status=${status}`)

      // Resolve project name for workflow directory
      let projectName = 'unknown'
      if (project_id) {
        const project = db.prepare('SELECT name FROM projects WHERE id = ?').get(project_id) as any
        if (project) projectName = project.name
      }

      // Create per-workflow directory with standard files
      try {
        workflowPath = ensureWorkflowDir(projectName, id)
        console.log(`[plans] Workflow directory created: ${workflowPath}`)
      } catch (dirError) {
        console.error(`[plans] Failed to create workflow directory for plan ${id}:`, dirError)
        // Non-fatal: the plan is still created, directory creation is best-effort
      }

      db.prepare(`
        INSERT INTO plans (id, name, tasks, status, project_id, attachments, created_at, workflow_path, team_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, name, JSON.stringify(sanitizedTasks), status, project_id ?? null, JSON.stringify(allAttachmentIds), now, workflowPath, requestTeamId || null)
    }

    const plan = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(id) as any

    if (!plan) {
      console.error(`[plans] Failed to retrieve created plan ${id}`)
      return res.status(500).json({ data: null, error: 'Failed to retrieve created plan' })
    }

    // Write plan.json to the workflow directory so executor agents can read it
    if (workflowPath) {
      writePlanJson(workflowPath, { name, tasks: sanitizedTasks, id, status })
    }

    console.log(`[plans] Plan created successfully: id=${id}`)
    res.status(201).json({ data: parsePlan(plan), error: null })
  } catch (error) {
    console.error('Error creating plan:', error)
    res.status(500).json({ data: null, error: 'Failed to create plan' })
  }
})

// GET /api/plans/pending - Get pending plans (for client polling)
router.get('/pending', authenticateToken, (req: Request, res: Response) => {
  try {
    // All pending plans (DB is isolated per OS user)
    const plans = db
      .prepare(`
        SELECT
          id,
          name,
          tasks,
          status,
          client_id,
          result,
          started_at,
          completed_at,
          created_at,
          project_id,
          attachments,
          workflow_path,
          sdk_session_id
        FROM plans
        WHERE status = 'pending'
        ORDER BY created_at DESC
      `)
      .all() as any[]

    // Enrich each plan with full attachment metadata
    const enriched = plans.map((plan) => {
      const parsed = parsePlan(plan)
      let attachmentMetadata: any[] = []

      const ids: string[] = parsed.attachments || []
      if (Array.isArray(ids) && ids.length > 0) {
        try {
          const uniqueIds = [...new Set(ids)]
          const placeholders = uniqueIds.map(() => '?').join(', ')
          const rows = db.prepare(
            `SELECT id, file_name, file_type, file_size, storage_path
             FROM message_attachments WHERE id IN (${placeholders})`
          ).all(...uniqueIds) as any[]

          attachmentMetadata = rows.map((row) => ({
            ...row,
            download_url: `/api/uploads/${row.id}`,
          }))
        } catch {
          // Skip if attachment lookup fails
        }
      }

      return {
        ...parsed,
        attachment_metadata: attachmentMetadata,
      }
    })

    res.json({ data: enriched, error: null })
  } catch (error) {
    console.error('Error fetching pending plans:', error)
    res.status(500).json({ data: null, error: 'Failed to fetch pending plans' })
  }
})

// GET /api/plans/metrics - Get global plan statistics
router.get('/metrics', authenticateToken, (req: Request, res: Response) => {
  try {
    // Total plans
    const totalResult = db
      .prepare(`SELECT COUNT(*) as n FROM plans`)
      .get() as { n: number }
    const total = totalResult.n

    // Plans grouped by status
    const byStatusRows = db
      .prepare(`SELECT status, COUNT(*) as count FROM plans GROUP BY status`)
      .all() as { status: string; count: number }[]

    const by_status: Record<string, number> = {
      pending: 0,
      running: 0,
      success: 0,
      failed: 0,
    }

    for (const row of byStatusRows) {
      by_status[row.status] = row.count
    }

    // Success rate (successful / completed plans)
    const completedCount = (by_status.success || 0) + (by_status.failed || 0)
    const success_rate = completedCount > 0
      ? ((by_status.success || 0) / completedCount) * 100
      : 0

    // Average execution duration in seconds
    const avgDurationResult = db
      .prepare(`
        SELECT AVG((julianday(completed_at) - julianday(started_at)) * 86400) as avg_seconds
        FROM plans
        WHERE completed_at IS NOT NULL AND started_at IS NOT NULL
      `)
      .get() as { avg_seconds: number | null }
    const avg_duration_seconds = avgDurationResult.avg_seconds || 0

    // Last 7 days metrics
    const last7DaysSuccess = db
      .prepare(`SELECT COUNT(*) as n FROM plans WHERE status = ? AND created_at > datetime('now', '-7 days')`)
      .get('success') as { n: number }
    const last7DaysFailed = db
      .prepare(`SELECT COUNT(*) as n FROM plans WHERE status = ? AND created_at > datetime('now', '-7 days')`)
      .get('failed') as { n: number }

    // Recovery metrics - plans recovered from timeout in last 24 hours
    const recoveredPlansResult = db.prepare(`
      SELECT COUNT(*) as count
      FROM plans
      WHERE result LIKE '%Plan timed out%' AND completed_at > datetime('now', '-24 hours')
    `).get() as { count: number }

    res.json({
      data: {
        total,
        by_status,
        success_rate: Math.round(success_rate * 100) / 100,
        avg_duration_seconds: Math.round(avg_duration_seconds * 100) / 100,
        last_7_days: {
          success: last7DaysSuccess.n,
          failed: last7DaysFailed.n,
        },
        recovered_last_24h: recoveredPlansResult.count,
      },
      error: null,
    })
  } catch (error) {
    console.error('Error fetching metrics:', error)
    res.status(500).json({ data: null, error: 'Failed to fetch metrics' })
  }
})

// GET /api/plans/approaching-timeout - Get plans nearing timeout
router.get('/approaching-timeout', authenticateToken, (req: Request, res: Response) => {
  try {
    const timeoutMinutes = Number(process.env.PLAN_TIMEOUT_MINUTES ?? 120)
    const warningThreshold = timeoutMinutes * 0.8 // 80% of timeout
    const warningCutoff = new Date(Date.now() - warningThreshold * 60 * 1000).toISOString()

    const plans = db.prepare(`
      SELECT id, name, status, started_at, last_heartbeat_at,
             (julianday('now') - julianday(started_at)) * 1440 as minutes_running
      FROM plans
      WHERE status = 'running'
      AND started_at < ?
      ORDER BY started_at ASC
    `).all(warningCutoff) as any[]

    res.json({
      data: {
        count: plans.length,
        plans: plans.map(p => ({
          ...p,
          timeout_in_minutes: Math.round(timeoutMinutes - p.minutes_running)
        }))
      },
      error: null
    })
  } catch (error) {
    console.error('Error fetching approaching timeout plans:', error)
    res.status(500).json({ data: null, error: 'Failed to fetch plans' })
  }
})

// POST /api/plans/reconcile - Reconcile orphaned plans on daemon startup
router.post('/reconcile', authenticateToken, (req: Request, res: Response) => {
  try {
    const { active_plan_ids = [], grace_period_seconds = 120 } = req.body

    // Calculate cutoff time for grace period
    const graceCutoff = new Date(Date.now() - grace_period_seconds * 1000).toISOString()

    // Find all running plans with their started_at timestamp
    const running = db.prepare(
      "SELECT id, name, started_at FROM plans WHERE status = 'running'"
    ).all() as any[]

    // Separate plans into orphaned (no active daemon) and recently-started (within grace period)
    const orphaned: any[] = []
    const skipped: any[] = []

    for (const plan of running) {
      if (active_plan_ids.includes(plan.id)) {
        // Daemon confirmed it's processing this plan
        continue
      }

      // Check if plan was started within grace period
      if (plan.started_at) {
        const startedAt = new Date(plan.started_at)
        if (startedAt > new Date(graceCutoff)) {
          // Plan was recently started, skip it
          skipped.push(plan)
          console.log(`[reconcile] Skipping recently-started plan ${plan.id} (started: ${plan.started_at})`)
          continue
        }
      }

      // Plan is orphaned and outside grace period
      orphaned.push(plan)
    }

    // Reset orphaned plans to failed
    for (const plan of orphaned) {
      console.log(`[reconcile] Marking orphaned plan ${plan.id} as failed`)
      db.prepare(`
        UPDATE plans SET
          status = 'failed',
          completed_at = datetime('now'),
          result = 'Marked as failed: daemon restarted while plan was running'
        WHERE id = ?
      `).run(plan.id)
    }

    res.json({
      data: {
        running_count: running.length,
        orphaned_count: orphaned.length,
        orphaned_ids: orphaned.map(p => p.id),
        skipped_count: skipped.length,
        skipped_ids: skipped.map(p => p.id),
      },
      error: null,
    })
  } catch (err: any) {
    console.error('Error reconciling plans:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})

// PUT /api/plans/:id - Edit a plan (only pending or awaiting_approval)
router.put('/:id', authenticateToken, (req: Request, res: Response) => {
  try {
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id) as any
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' })
    }

    // Permite editar planos de qualquer status exceto 'running'
    // Planos com sucesso podem ser reeditados e reexecutados
    if (plan.status === 'running') {
      return res.status(400).json({
        error: `Cannot edit plan with status '${plan.status}'. Please wait for the plan to complete.`
      })
    }

    const { name, tasks } = req.body

    db.prepare(`
      UPDATE plans SET
        name = COALESCE(?, name),
        tasks = COALESCE(?, tasks)
      WHERE id = ?
    `).run(
      name || null,
      tasks ? JSON.stringify(tasks) : null,
      req.params.id
    )

    const updated = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id) as any
    if (updated.tasks && typeof updated.tasks === 'string') {
      try { updated.tasks = JSON.parse(updated.tasks) } catch {}
    }
    res.json({ data: updated, error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/plans/:id/approve - Approve a plan (awaiting_approval → pending)
router.post('/:id/approve', authenticateToken, (req: Request, res: Response) => {
  try {
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id) as any
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' })
    }
    if (plan.status !== 'awaiting_approval') {
      return res.status(400).json({ error: `Plan status is '${plan.status}', not 'awaiting_approval'` })
    }
    db.prepare("UPDATE plans SET status = 'pending' WHERE id = ?").run(req.params.id)

    // Atualiza kanban task vinculada para in_dev
    db.prepare(`
      UPDATE kanban_tasks
      SET "column" = 'in_dev',
          pipeline_status = 'running',
          updated_at = datetime('now')
      WHERE workflow_id = ?
    `).run(req.params.id)

    const updated = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id)
    res.json({ data: updated, error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/plans/:id/attachments - Get all attachments associated with a plan
router.get('/:id/attachments', authenticateToken, (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // Verify plan exists
    const plan = db.prepare('SELECT id, attachments FROM plans WHERE id = ?').get(id) as any
    if (!plan) {
      return res.status(404).json({ data: null, error: 'Plan not found' })
    }

    // Parse attachment IDs from the plan's attachments column
    let attachmentIds: string[] = []
    try {
      const parsed = typeof plan.attachments === 'string'
        ? JSON.parse(plan.attachments)
        : plan.attachments || []
      if (Array.isArray(parsed)) {
        attachmentIds = parsed
      }
    } catch {
      // Malformed JSON, treat as empty
    }

    if (attachmentIds.length === 0) {
      return res.json({ data: [], error: null })
    }

    // Deduplicate IDs
    const uniqueIds = [...new Set(attachmentIds)]
    const placeholders = uniqueIds.map(() => '?').join(', ')

    const attachments = db.prepare(
      `SELECT id, message_type, message_id, file_name, file_type, file_size, storage_path, created_at
       FROM message_attachments WHERE id IN (${placeholders})`
    ).all(...uniqueIds) as any[]

    const enriched = attachments.map((att) => ({
      ...att,
      download_url: `/api/uploads/${att.id}`,
    }))

    res.json({ data: enriched, error: null })
  } catch (error) {
    console.error('Error fetching plan attachments:', error)
    res.status(500).json({ data: null, error: 'Failed to fetch plan attachments' })
  }
})

// GET /api/plans/:id/workflow-files - Read workflow blackboard files (state.md, plan.json, errors.log)
router.get('/:id/workflow-files', authenticateToken, (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // Look up the plan and its workflow_path
    const plan = db
      .prepare('SELECT id, workflow_path FROM plans WHERE id = ?')
      .get(id) as any

    if (!plan) {
      return res.status(404).json({ data: null, error: 'Plan not found' })
    }

    if (!plan.workflow_path) {
      // No workflow directory — return empty files gracefully
      return res.json({
        data: {
          state: null,
          plan_json: null,
          errors: null,
        },
        error: null,
      })
    }

    const readFileSafe = (filePath: string): string | null => {
      try {
        if (!fs.existsSync(filePath)) return null
        const content = fs.readFileSync(filePath, 'utf-8').trim()
        return content.length > 0 ? content : null
      } catch {
        return null
      }
    }

    const state = readFileSafe(`${plan.workflow_path}/state.md`)
    const planJsonRaw = readFileSafe(`${plan.workflow_path}/plan.json`)
    const errors = readFileSafe(`${plan.workflow_path}/errors.log`)

    // Parse plan.json if present
    let plan_json: any = null
    if (planJsonRaw) {
      try {
        plan_json = JSON.parse(planJsonRaw)
      } catch {
        plan_json = planJsonRaw // return raw string if parsing fails
      }
    }

    res.json({
      data: { state, plan_json, errors },
      error: null,
    })
  } catch (error) {
    console.error('Error reading workflow files:', error)
    res.status(500).json({ data: null, error: 'Failed to read workflow files' })
  }
})

// GET /api/plans/:id - Get plan detail with log count
router.get('/:id', authenticateToken, (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const plan = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(id) as any

    if (!plan) {
      console.log(`[plans] GET /plans/${id} - Plan not found`)
      return res.status(404).json({
        data: null,
        error: `Plan not found: ${id}. The plan may have been deleted or never created.`
      })
    }

    // Get log count
    const logCount = db
      .prepare('SELECT COUNT(*) as count FROM plan_logs WHERE plan_id = ?')
      .get(id) as { count: number }

    const planWithLogCount = {
      ...parsePlan(plan),
      log_count: logCount.count,
    }

    // Parse structured_output if present
    if (plan.structured_output) {
      try {
        planWithLogCount.structured_output = JSON.parse(plan.structured_output)
      } catch (e) {
        // Invalid JSON, leave as is
        console.warn('Failed to parse structured_output for plan', id)
      }
    }

    res.json({ data: planWithLogCount, error: null })
  } catch (error) {
    console.error('Error fetching plan:', error)
    res.status(500).json({ data: null, error: 'Failed to fetch plan' })
  }
})

// POST /api/plans/:id/start - Start a plan
router.post('/:id/start', authenticateToken, (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { client_id }: StartPlanBody = req.body

    if (!client_id) {
      return res.status(400).json({ data: null, error: 'client_id is required' })
    }

    const plan = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(id) as any

    if (!plan) {
      return res.status(404).json({ data: null, error: 'Plan not found' })
    }

    if (plan.status !== 'pending') {
      return res.status(400).json({ data: null, error: 'Plan is not in pending status' })
    }

    const now = new Date().toISOString()

    db.prepare(`
      UPDATE plans
      SET status = 'running',
          client_id = ?,
          started_at = ?
      WHERE id = ?
    `).run(client_id, now, id)

    const updatedPlan = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(id) as any

    res.json({ data: parsePlan(updatedPlan), error: null })
  } catch (error) {
    console.error('Error starting plan:', error)
    res.status(500).json({ data: null, error: 'Failed to start plan' })
  }
})

// POST /api/plans/:id/heartbeat - Update heartbeat timestamp for a running plan
router.post('/:id/heartbeat', authenticateToken, (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const plan = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(id) as any

    if (!plan) {
      return res.status(404).json({ data: null, error: 'Plan not found' })
    }

    if (plan.status !== 'running') {
      return res.status(400).json({ data: null, error: 'Plan is not running' })
    }

    const now = new Date().toISOString()
    db.prepare('UPDATE plans SET last_heartbeat_at = ? WHERE id = ?').run(now, id)

    res.json({ data: { heartbeat_at: now }, error: null })
  } catch (error) {
    console.error('Error updating heartbeat:', error)
    res.status(500).json({ data: null, error: 'Failed to update heartbeat' })
  }
})

// POST /api/plans/:id/sdk-session - Save SDK session ID for a plan (enables resume with context)
router.post('/:id/sdk-session', authenticateToken, (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { sdk_session_id }: { sdk_session_id: string } = req.body

    if (!sdk_session_id) {
      return res.status(400).json({ data: null, error: 'sdk_session_id is required' })
    }

    const plan = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(id) as any

    if (!plan) {
      return res.status(404).json({ data: null, error: 'Plan not found' })
    }

    db.prepare(
      "UPDATE plans SET sdk_session_id = ? WHERE id = ?"
    ).run(sdk_session_id, id)

    console.log(`[plans] SDK session ID saved for plan ${id}: ${sdk_session_id.substring(0, 12)}...`)

    res.json({ data: { saved: true }, error: null })
  } catch (error) {
    console.error('Error saving SDK session ID:', error)
    res.status(500).json({ data: null, error: 'Failed to save SDK session ID' })
  }
})

// POST /api/plans/:id/complete - Complete a plan
router.post('/:id/complete', authenticateToken, (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { status, result, result_status, result_notes, structured_output, daemon_completed_at }: CompletePlanBody = req.body

    console.log(`[complete] Attempting to complete plan ${id}: status=${status}${daemon_completed_at ? `, daemon_completed_at=${daemon_completed_at}` : ''}`)

    if (!status || !result) {
      console.error(`[complete] Missing required fields for plan ${id}: status=${!!status}, result=${!!result}`)
      return res.status(400).json({ data: null, error: 'status and result are required' })
    }

    if (status !== 'success' && status !== 'failed') {
      console.error(`[complete] Invalid status for plan ${id}: ${status}`)
      return res.status(400).json({ data: null, error: 'status must be success or failed' })
    }

    const plan = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(id) as any

    if (!plan) {
      console.error(`[complete] Plan not found: ${id}`)
      return res.status(404).json({ data: null, error: 'Plan not found' })
    }

    console.log(`[complete] Plan ${id} found: current status=${plan.status}`)

    // Allow completion if status is 'running', 'failed', or 'completing'
    // This handles the race condition where recoverStuckPlans marked a plan as failed
    // due to timeout, but the daemon is actually completing it successfully
    if (plan.status !== 'running' && plan.status !== 'failed' && plan.status !== 'completing') {
      console.error(`[complete] Plan ${id} is not in a completable status (current: ${plan.status})`)
      return res.status(400).json({
        data: null,
        error: `Plan is not in a completable status (current: ${plan.status})`
      })
    }

    // Log when a plan transitions from failed to a terminal state
    // This indicates the daemon recovered after a timeout
    if (plan.status === 'failed') {
      console.log(`[complete] Plan ${id} transitioning from failed to ${status} - daemon recovered after timeout`)
    }

    // Log when a plan transitions from completing to a terminal state
    if (plan.status === 'completing') {
      console.log(`[complete] Plan ${id} transitioning from completing to ${status}`)
    }

    const now = new Date().toISOString()

    // Only update structured_output if explicitly provided — never overwrite
    // previously saved structured output (e.g. from per-task save_structured_output)
    // with NULL. Use COALESCE so a missing value preserves what's already in the DB.
    const structured_output_json = structured_output ? JSON.stringify(structured_output) : null

    db.prepare(`
      UPDATE plans
      SET status = ?,
          result = ?,
          completed_at = ?,
          result_status = COALESCE(?, result_status),
          result_notes = COALESCE(?, result_notes),
          structured_output = COALESCE(?, structured_output)
      WHERE id = ?
    `).run(
      status,
      result,
      now,
      result_status || null,
      result_notes || null,
      structured_output_json,
      id
    )

    console.log(`[complete] Plan ${id} marked as ${status} successfully`)

    const updatedPlan = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(id) as any

    res.json({ data: parsePlan(updatedPlan), error: null })
  } catch (error) {
    console.error('Error completing plan:', error)
    res.status(500).json({ data: null, error: 'Failed to complete plan' })
  }
})

// POST /api/plans/:id/logs - Append log entries
router.post('/:id/logs', authenticateToken, (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const logs: LogEntry[] = req.body

    if (!Array.isArray(logs) || logs.length === 0) {
      return res.status(400).json({ data: null, error: 'logs must be a non-empty array' })
    }

    const plan = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(id) as any

    if (!plan) {
      return res.status(404).json({ data: null, error: 'Plan not found' })
    }

    const now = new Date().toISOString()
    const insertLog = db.prepare(`
      INSERT INTO plan_logs (plan_id, task_id, level, message, created_at)
      VALUES (?, ?, ?, ?, ?)
    `)

    const insertMany = db.transaction((logs: LogEntry[]) => {
      for (const log of logs) {
        insertLog.run(id, log.task_id, log.level, log.message, now)
      }
    })

    insertMany(logs)

    res.json({ data: { inserted: logs.length }, error: null })
  } catch (error) {
    console.error('Error appending logs:', error)
    res.status(500).json({ data: null, error: 'Failed to append logs' })
  }
})

// GET /api/plans/:id/logs - Get all log entries for a plan
router.get('/:id/logs', authenticateToken, (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const plan = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(id) as any

    if (!plan) {
      return res.status(404).json({ data: null, error: 'Plan not found' })
    }

    const logs = db
      .prepare(`
        SELECT
          id,
          plan_id,
          task_id,
          level,
          message,
          created_at
        FROM plan_logs
        WHERE plan_id = ?
        ORDER BY created_at ASC
      `)
      .all(id)

    res.json({ data: logs, error: null })
  } catch (error) {
    console.error('Error fetching logs:', error)
    res.status(500).json({ data: null, error: 'Failed to fetch logs' })
  }
})

// POST /api/plans/:id/execute - Re-queue any completed or failed plan for execution
router.post('/:id/execute', authenticateToken, (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const plan = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(id) as any

    if (!plan) {
      return res.status(404).json({ data: null, error: 'Plan not found' })
    }

    if (plan.status === 'running') {
      return res.status(409).json({ data: null, error: 'Plan is already running' })
    }

    // Add log indicating re-execution
    const logMessage = plan.status === 'success'
      ? '↻ Plan re-executed - was previously successful'
      : '↻ Plan re-executed'

    // Delete old logs so tasks run from scratch (not skip completed ones)
    db.prepare(`
      DELETE FROM plan_logs
      WHERE plan_id = ?
    `).run(id)

    // Clear sdk_session_id on full re-execute so a fresh Claude Code session is created
    db.prepare(`
      UPDATE plans
      SET status = 'pending',
          client_id = NULL,
          started_at = NULL,
          completed_at = NULL,
          result = NULL,
          sdk_session_id = NULL
      WHERE id = ?
    `).run(id)

    // Add log entry
    db.prepare(`
      INSERT INTO plan_logs (plan_id, task_id, level, message, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(id, 'system', 'info', logMessage)

    const updated = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(id) as any

    res.json({ data: parsePlan(updated), error: null })
  } catch (error) {
    console.error('Error executing plan:', error)
    res.status(500).json({ data: null, error: 'Failed to execute plan' })
  }
})

// POST /api/plans/:id/force-stop — força plano para 'failed' independente do status atual
router.post('/:id/force-stop', authenticateToken, (req, res) => {
  try {
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id) as any
    if (!plan) return res.status(404).json({ data: null, error: 'Plan not found' })
    if (plan.status !== 'running' && plan.status !== 'pending') {
      return res.status(409).json({ data: null, error: `Plan is not running or pending (status: ${plan.status})` })
    }

    db.prepare(`
      UPDATE plans
      SET status = 'failed',
          completed_at = datetime('now'),
          result = 'Manually stopped by user'
      WHERE id = ?
    `).run(req.params.id)

    // Atualiza kanban task vinculada se existir
    db.prepare(`
      UPDATE kanban_tasks
      SET pipeline_status = 'failed',
          error_message = 'Force stopped by user',
          updated_at = datetime('now')
      WHERE workflow_id = ?
    `).run(req.params.id)

    // Adicionar log de parada manual
    db.prepare(`
      INSERT INTO plan_logs (plan_id, task_id, level, message, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(req.params.id, 'system', 'warn', '⛔ Plan manually stopped by user')

    return res.json({ data: { stopped: true }, error: null })
  } catch (err: any) {
    console.error('Error force stopping plan:', err)
    return res.status(500).json({ data: null, error: err.message || 'Failed to force stop plan' })
  }
})

// POST /api/plans/:id/resume — Resume any completed plan from where it left off
router.post('/:id/resume', authenticateToken, (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const plan = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(id) as any

    if (!plan) {
      return res.status(404).json({ data: null, error: 'Plan not found' })
    }

    if (plan.status === 'running') {
      return res.status(400).json({ data: null, error: 'Plan is already running' })
    }

    // Set status back to pending so daemon picks it up
    // Keep started_at to maintain execution history
    // Clear completed_at and result to allow re-execution
    // Keep sdk_session_id to preserve Claude Code session context on resume
    const logMessage = plan.status === 'success'
      ? '↻ Plan resumed - re-executing successful plan'
      : '↻ Plan resumed - will skip completed tasks'

    db.prepare(`
      UPDATE plans
      SET status = 'pending',
          completed_at = NULL,
          result = NULL
      WHERE id = ?
    `).run(id)

    // Add log indicating resume
    db.prepare(`
      INSERT INTO plan_logs (plan_id, task_id, level, message, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(id, 'system', 'info', logMessage)

    const updated = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(id) as any

    res.json({ data: parsePlan(updated), error: null })
  } catch (error) {
    console.error('Error resuming plan:', error)
    res.status(500).json({ data: null, error: 'Failed to resume plan' })
  }
})

// POST /api/plans/:id/reset — Reset a running plan back to pending (for daemon recovery)
router.post('/:id/reset', authenticateToken, (req: Request, res: Response) => {
  try {
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id) as any
    if (!plan) return res.status(404).json({ data: null, error: 'Plan not found' })

    // Only reset running plans that are stuck
    if (plan.status !== 'running') {
      return res.status(400).json({ data: null, error: `Plan is not running (status: ${plan.status})` })
    }

    // Reset to pending state and clear started_at
    db.prepare(`
      UPDATE plans
      SET status = 'pending',
          started_at = NULL,
          client_id = NULL
      WHERE id = ?
    `).run(req.params.id)

    // Add log indicating reset
    db.prepare(`
      INSERT INTO plan_logs (plan_id, task_id, level, message, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(req.params.id, 'system', 'warn', '↺ Plan reset to pending - daemon recovery')

    return res.json({ data: { reset: true }, error: null })
  } catch (err: any) {
    console.error('Error resetting plan:', err)
    return res.status(500).json({ data: null, error: err.message || 'Failed to reset plan' })
  }
})

// POST /api/plans/:id/rework - Create a rework plan from a completed/failed plan
router.post('/:id/rework', authenticateToken, (req: Request, res: Response) => {
  try {
    const { id: sourceId } = req.params
    const { rework_prompt, rework_mode = 'full_workflow' } = req.body

    // Validate rework_prompt
    if (!rework_prompt || typeof rework_prompt !== 'string') {
      return res.status(400).json({ data: null, error: 'rework_prompt is required' })
    }

    // Validate rework_mode
    const validModes = ['full_workflow', 'quick_action'] as const
    if (!validModes.includes(rework_mode)) {
      return res.status(400).json({ data: null, error: 'rework_mode must be one of: full_workflow, quick_action' })
    }

    // Fetch source plan
    const sourcePlan = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(sourceId) as any

    if (!sourcePlan) {
      return res.status(404).json({ data: null, error: 'Plan not found' })
    }

    // Only allow rework from terminal statuses
    if (sourcePlan.status !== 'success' && sourcePlan.status !== 'failed') {
      return res.status(400).json({ data: null, error: 'Plan must have a terminal status (success or failed) to rework' })
    }

    // Parse source tasks
    const sourceTasks = typeof sourcePlan.tasks === 'string'
      ? JSON.parse(sourcePlan.tasks) as any[]
      : sourcePlan.tasks

    // Fetch execution logs, excluding debug level
    const logs = db
      .prepare('SELECT task_id, level, message FROM plan_logs WHERE plan_id = ? AND level != ? ORDER BY id ASC')
      .all(sourceId, 'debug') as any[]

    // Group logs by task_id, take last 5 per task, truncate each message to 500 chars
    const groupedByTask = new Map<string, any[]>()
    for (const log of logs) {
      if (!groupedByTask.has(log.task_id)) {
        groupedByTask.set(log.task_id, [])
      }
      const group = groupedByTask.get(log.task_id)!
      if (group.length < 5) {
        group.push(log)
      } else {
        // Keep only last 5: shift first, push new
        group.shift()
        group.push(log)
      }
    }

    // Build log summary string
    let logSummary = ''
    const taskIds = Array.from(groupedByTask.keys())
    for (let i = 0; i < taskIds.length; i++) {
      const taskId = taskIds[i]
      const group = groupedByTask.get(taskId)!
      const entry = `[Task: ${taskId}]\n${group.map(l => l.message.substring(0, 500)).join('\n')}\n`

      if (logSummary.length + entry.length > 8000 && i > 0) {
        logSummary += entry.substring(0, 8000 - logSummary.length)
        logSummary += '\n... [truncated]'
        break
      }
      logSummary += entry
    }

    // Truncate log summary to 8000 chars
    if (logSummary.length > 8000) {
      logSummary = logSummary.substring(0, 8000) + '\n... [truncated]'
    }

    // Truncate result to 2000 chars
    const resultText = (sourcePlan.result || '').substring(0, 2000)

    // Extract original user prompt (first task's prompt)
    const originalPrompt = sourceTasks[0]?.prompt || ''

    // Build common context block shared by both modes
    const commonContext = `## Context from Previous Workflow

This is a rework of a previous workflow. Below is the context you need:

### Original Request
${originalPrompt}

### Execution Summary
${logSummary}

### Previous Result Status
Status: ${sourcePlan.status}
Result: ${resultText}${sourcePlan.result_status ? `\nResult Evaluation: ${sourcePlan.result_status} - ${sourcePlan.result_notes || ''}` : ''}

### New Modification Request
${rework_prompt}`

    // ── Mode-specific logic ──────────────────────────────────────────────

    let newTasks: any[]
    let planName: string
    let planType: string

    if (rework_mode === 'full_workflow') {
      // ── FULL WORKFLOW: Use the project's planner agent ──────────────

      // Find planner workspace for this project
      const plannerRow = db.prepare(`
        SELECT pa.workspace_path
        FROM project_agents pa
        LEFT JOIN team_roles wr ON wr.workspace_path = pa.workspace_path
        WHERE pa.project_id = ? AND COALESCE(wr.role, 'generic') = 'planner'
        LIMIT 1
      `).get(sourcePlan.project_id) as any

      if (!plannerRow?.workspace_path) {
        return res.status(400).json({
          data: null,
          error: 'No planner agent found for this project. A planner is required for full_workflow rework mode.',
        })
      }

      // Fetch all project teams with their roles for the planner prompt
      const projectAgents = db.prepare(`
        SELECT
          pa.workspace_path,
          COALESCE(wr.role, 'generic') as role
        FROM project_agents pa
        LEFT JOIN team_roles wr ON wr.workspace_path = pa.workspace_path
        WHERE pa.project_id = ?
      `).all(sourcePlan.project_id) as any[]

      // Fetch project environments for additional context
      const environments = db.prepare(`
        SELECT slug, name, project_path FROM environments WHERE project_id = ?
      `).all(sourcePlan.project_id) as any[]

      const teamsList = projectAgents.length > 0
        ? projectAgents.map(a => `- ${a.role}: ${a.workspace_path}`).join('\n')
        : 'No teams configured.'

      const envsList = environments.length > 0
        ? environments.map(e => `- ${e.name} (${e.slug}): ${e.project_path || 'N/A'}`).join('\n')
        : 'No environments configured.'

      const plannerPrompt = `${commonContext}

---

IMPORTANT: You are acting as a **planner** for a rework. Your job is to analyze the context above and generate a **new execution plan** that addresses the modification request.

## Available Teams
${teamsList}

> **Note:** These are TEAMS (workspaces), not individual agents. Each team has its own agents defined in its .claude/agents/ directory. When assigning tasks, specify the team workspace path. The agents within each team are orchestrated by the team itself.

## Project Environments
${envsList}

## Instructions
1. Analyze what was previously attempted and why it needs modification
2. Design a new plan that addresses the "New Modification Request"
3. Generate the plan using the <plan>...</plan> format
4. Assign each task to the appropriate team based on its role
5. Keep the plan focused on only what needs to change — avoid duplicating work that succeeded previously

Output your plan enclosed in <plan>...</plan> tags.`

      const taskId = randomUUID()
      newTasks = [{
        id: taskId,
        name: 'Replan workflow for rework',
        prompt: plannerPrompt,
        cwd: environments[0]?.project_path || sourcePlan.team_id || '/root/projects/weave',
        workspace: plannerRow.workspace_path,
        tools: ['Read', 'Write', 'Bash', 'Glob', 'Edit', 'Grep', 'WebFetch', 'Skill'],
        permission_mode: 'acceptEdits',
        depends_on: [],
      }]
      planName = `Rework: ${sourcePlan.name}`
      planType = 'workflow'

    } else {
      // ── QUICK ACTION: Use the project's coder agent ─────────────────

      // Find coder workspace for this project
      const coderRow = db.prepare(`
        SELECT pa.workspace_path
        FROM project_agents pa
        LEFT JOIN team_roles wr ON wr.workspace_path = pa.workspace_path
        WHERE pa.project_id = ? AND COALESCE(wr.role, 'generic') = 'coder'
        LIMIT 1
      `).get(sourcePlan.project_id) as any

      const coderWorkspace = coderRow?.workspace_path || sourcePlan.team_id || '/root/projects/weave'

      const contextPrompt = `${commonContext}

---

IMPORTANT: Use the context above to understand what was previously attempted and what needs to change. The "New Modification Request" section describes the specific changes needed. Apply the changes directly and efficiently.`

      const taskId = randomUUID()
      newTasks = [{
        id: taskId,
        name: 'Quick fix: ' + rework_prompt.substring(0, 80),
        prompt: contextPrompt,
        cwd: coderWorkspace,
        workspace: coderWorkspace,
        tools: ['Read', 'Write', 'Bash', 'Glob', 'Edit', 'Grep'],
        permission_mode: 'acceptEdits',
        depends_on: [],
      }]
      planName = `Quick Fix: ${sourcePlan.name}`
      planType = 'quick_action'
    }

    // ── Create the rework plan ──────────────────────────────────────────

    const newId = randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO plans (id, name, tasks, status, type, project_id, team_id, parent_plan_id, rework_prompt, rework_mode, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newId,
      planName,
      JSON.stringify(newTasks),
      'pending',
      planType,
      sourcePlan.project_id,
      sourcePlan.team_id || null,
      sourceId,
      rework_prompt,
      rework_mode,
      now
    )

    console.log(`[rework] Creating ${rework_mode} rework plan from ${sourceId} - new plan: ${newId}`)

    // Fetch and return the newly created plan
    const newPlan = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(newId) as any

    res.json({ data: parsePlan(newPlan), error: null })
  } catch (error) {
    console.error('Error creating rework plan:', error)
    res.status(500).json({ data: null, error: 'Failed to create rework plan' })
  }
})

// DELETE /api/plans/:id - Delete a plan
router.delete('/:id', authenticateToken, (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const plan = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(id) as any

    if (!plan) {
      return res.status(404).json({ data: null, error: 'Plan not found' })
    }

    // Don't allow deleting running plans
    if (plan.status === 'running') {
      return res.status(409).json({ data: null, error: 'Cannot delete a running plan' })
    }

    // Delete associated logs and then the plan
    db.prepare('DELETE FROM plan_logs WHERE plan_id = ?').run(id)
    db.prepare('DELETE FROM plans WHERE id = ?').run(id)

    res.json({ data: { deleted: true }, error: null })
  } catch (error) {
    console.error('Error deleting plan:', error)
    res.status(500).json({ data: null, error: 'Failed to delete plan' })
  }
})

// GET /api/plans/:id/logs/stream - SSE endpoint for real-time log streaming
router.get('/:id/logs/stream', authenticateToken, (req: Request, res: Response) => {
  const { id } = req.params

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // disable nginx buffering
  res.flushHeaders()

  // Send initial batch of existing logs
  const existing = db
    .prepare('SELECT * FROM plan_logs WHERE plan_id = ? ORDER BY created_at ASC')
    .all(id) as any[]

  let lastId = 0
  for (const log of existing) {
    res.write(`data: ${JSON.stringify(log)}\n\n`)
    if (log.id > lastId) lastId = log.id
  }

  // Poll for new logs every 500ms
  const interval = setInterval(() => {
    // Check if plan still exists
    const plan = db.prepare('SELECT status FROM plans WHERE id = ?').get(id) as any
    if (!plan) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Plan not found' })}\n\n`)
      clearInterval(interval)
      res.end()
      return
    }

    // Fetch new logs since lastId
    const newLogs = db
      .prepare('SELECT * FROM plan_logs WHERE plan_id = ? AND id > ? ORDER BY id ASC')
      .all(id, lastId) as any[]

    for (const log of newLogs) {
      res.write(`data: ${JSON.stringify(log)}\n\n`)
      if (log.id > lastId) lastId = log.id
    }

    // Send plan status update
    res.write(`event: status\ndata: ${JSON.stringify({ status: plan.status })}\n\n`)

    // Close stream when plan is terminal
    if (plan.status === 'success' || plan.status === 'failed') {
      res.write(`event: done\ndata: ${JSON.stringify({ status: plan.status })}\n\n`)
      clearInterval(interval)
      res.end()
    }
  }, 500)

  // Cleanup on client disconnect
  req.on('close', () => {
    clearInterval(interval)
  })
})

// Recover stuck plans on startup (running → failed if older than timeout)
// IMPORTANT: This timeout MUST match the client's PLAN_TIMEOUT_SECONDS to avoid
// marking long-running plans as failed before they actually complete.
export function recoverStuckPlans(db: any) {
  const timeoutMinutes = Number(process.env.PLAN_TIMEOUT_MINUTES ?? 120)  // Default: 2 hours
  const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString()

  // Get plans before updating for logging
  const stuckPlans = db.prepare(`
    SELECT id, name, started_at,
           (julianday('now') - julianday(started_at)) * 1440 as minutes_running
    FROM plans
    WHERE status = 'running'
    AND (
      (last_heartbeat_at IS NOT NULL AND last_heartbeat_at < ?) OR
      (last_heartbeat_at IS NULL AND started_at < ?)
    )
  `).all(cutoff, cutoff) as any[]

  // Use last_heartbeat_at if available, otherwise fall back to started_at
  // Only mark as failed if no heartbeat for timeout period
  const result = db.prepare(`
    UPDATE plans
    SET status = 'failed',
        result = 'Plan timed out - daemon may have crashed',
        completed_at = datetime('now')
    WHERE status = 'running'
    AND (
      (last_heartbeat_at IS NOT NULL AND last_heartbeat_at < ?) OR
      (last_heartbeat_at IS NULL AND started_at < ?)
    )
  `).run(cutoff, cutoff)

  if (result.changes > 0) {
    console.log(`[recovery] Marked ${result.changes} stuck plan(s) as failed`)
    // Log details for monitoring
    for (const plan of stuckPlans) {
      const shortId = plan.id.substring(0, 8)
      console.log(`[recovery] - Plan ${shortId} (${plan.name}): running for ${plan.minutes_running.toFixed(1)} minutes`)
    }
  }

  return { recovered: result.changes, plans: stuckPlans }
}

// POST /api/plans/:id/structured-output - Save structured output from quick actions
router.post('/:id/structured-output', authenticateToken, (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { output } = req.body

    if (!output) {
      return res.status(400).json({ data: null, error: 'output is required' })
    }

    const plan = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(id) as any

    if (!plan) {
      return res.status(404).json({ data: null, error: 'Plan not found' })
    }

    // Save structured output
    const normalizedOutput = output

    db.prepare(
      'UPDATE plans SET structured_output = ? WHERE id = ?'
    ).run(JSON.stringify(normalizedOutput), id)

    console.log(`[structured-output] Saved structured output for plan ${id}:`, {
      type: output.type,
    })

    return res.json({ data: { saved: true }, error: null })
  } catch (error) {
    console.error('Error saving structured output:', error)
    res.status(500).json({ data: null, error: 'Failed to save structured output' })
  }
})

// POST /api/plans/:id/check-completion - Check if all tasks in a plan have completed
router.post('/:id/check-completion', authenticateToken, (req: Request, res: Response) => {
  try {
    const { id } = req.params

    console.log(`[check-completion] Checking completion status for plan ${id}`)

    // Get the plan
    const plan = db
      .prepare('SELECT * FROM plans WHERE id = ?')
      .get(id) as any

    if (!plan) {
      console.log(`[check-completion] Plan not found: ${id}`)
      return res.status(404).json({ data: null, error: 'Plan not found' })
    }

    // Parse tasks to get all task IDs
    const tasks = typeof plan.tasks === 'string' ? JSON.parse(plan.tasks) : plan.tasks
    const taskIds = tasks.map((t: any) => t.id).filter(Boolean)

    if (taskIds.length === 0) {
      console.log(`[check-completion] Plan ${id} has no tasks`)
      return res.json({
        data: {
          completed: false,
          total_tasks: 0,
          completed_tasks: 0,
          message: 'Plan has no tasks'
        },
        error: null
      })
    }

    console.log(`[check-completion] Plan ${id} has ${taskIds.length} tasks:`, taskIds)

    // Query logs for completion indicators
    // Look for logs where message starts with '✔ finished' or 'Task completed' or level is 'success'
    const logs = db.prepare(`
      SELECT task_id, level, message
      FROM plan_logs
      WHERE plan_id = ?
      AND (message LIKE '✔ finished%' OR message LIKE 'Task completed%' OR level = 'success')
      ORDER BY created_at DESC
    `).all(id) as { task_id: string; level: string; message: string }[]

    // Track which tasks have completion logs
    const completedTaskIds = new Set<string>()

    for (const log of logs) {
      if (taskIds.includes(log.task_id)) {
        completedTaskIds.add(log.task_id)
      }
    }

    const completedTasks = completedTaskIds.size
    const totalTasks = taskIds.length
    const allCompleted = completedTasks === totalTasks

    console.log(`[check-completion] Plan ${id} completion status:`, {
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      all_completed: allCompleted,
      current_status: plan.status
    })

    // If all tasks completed and plan is still running, mark as success
    let updatedPlan = plan
    if (allCompleted && plan.status === 'running') {
      console.log(`[check-completion] All tasks completed for plan ${id}, marking as success`)

      const now = new Date().toISOString()

      db.prepare(`
        UPDATE plans
        SET status = 'success',
            result = 'All tasks completed successfully',
            completed_at = ?
        WHERE id = ?
      `).run(now, id)

      // Add a log entry for auto-completion
      db.prepare(`
        INSERT INTO plan_logs (plan_id, task_id, level, message, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, 'system', 'info', '✓ All tasks completed - automatically marked as success', now)

      // Fetch the updated plan
      updatedPlan = db
        .prepare('SELECT * FROM plans WHERE id = ?')
        .get(id) as any

      console.log(`[check-completion] Plan ${id} marked as success`)
    }

    return res.json({
      data: {
        completed: allCompleted,
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        pending_tasks: totalTasks - completedTasks,
        plan_status: updatedPlan.status,
        auto_completed: allCompleted && plan.status === 'running',
        completed_task_ids: Array.from(completedTaskIds)
      },
      error: null
    })
  } catch (error) {
    console.error('Error checking plan completion:', error)
    res.status(500).json({ data: null, error: 'Failed to check plan completion' })
  }
})

// POST /api/plans/:id/convert-to-chat — Convert a completed workflow into a chat session
// The new chat session inherits the plan's sdk_session_id so the Claude Code session
// continues with full context. Plan logs are seeded as the initial conversation history.
router.post('/:id/convert-to-chat', authenticateToken, (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // Fetch the plan
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as any
    if (!plan) {
      return res.status(404).json({ data: null, error: 'Plan not found' })
    }

    // Only allow conversion for completed (success or failed) plans
    if (!['success', 'failed'].includes(plan.status)) {
      return res.status(400).json({
        data: null,
        error: 'Only completed workflows (success or failed) can be converted to chat',
      })
    }

    // Check if a chat session already exists for this plan
    const existing = db.prepare(
      'SELECT id, name FROM chat_sessions WHERE plan_id = ? AND source_type = ?'
    ).get(id, 'workflow') as any

    if (existing) {
      return res.json({
        data: { id: existing.id, name: existing.name, converted: false },
        error: null,
      })
    }

    // Determine the workspace_path for the new chat session.
    // The workspace_path must point to a valid team workspace directory
    // (under .../teams/team-*) for settings.local.json discovery to work.
    //
    // Resolution order:
    // 1. plan.team_id (set when plan was created from team_trigger)
    // 2. First task's workspace (if it points to a valid team directory)
    // 3. Resolve from project's environment default_team (project_id → environments → default_team)
    let workspacePath = plan.team_id || ''
    if (!workspacePath || !fs.existsSync(workspacePath)) {
      // Try first task's workspace
      try {
        const tasks = typeof plan.tasks === 'string' ? JSON.parse(plan.tasks) : plan.tasks
        if (Array.isArray(tasks) && tasks.length > 0 && tasks[0].workspace) {
          if (fs.existsSync(tasks[0].workspace)) {
            workspacePath = tasks[0].workspace
          }
        }
      } catch {
        // ignore parse errors
      }
    }

    // If still not resolved or path doesn't exist, try environment's default_team
    if (!workspacePath || !fs.existsSync(workspacePath)) {
      if (plan.project_id) {
        const env = db.prepare(
          `SELECT e.default_team, e.id as env_id
           FROM environments e
           WHERE e.project_id = ?
           ORDER BY e.env_type = 'dev' DESC, e.created_at ASC
           LIMIT 1`
        ).get(plan.project_id) as any
        if (env?.default_team && fs.existsSync(env.default_team)) {
          workspacePath = env.default_team
        }
      }
    }

    if (!workspacePath || !fs.existsSync(workspacePath)) {
      return res.status(400).json({
        data: null,
        error: 'Cannot determine a valid workspace for this workflow',
      })
    }

    // Resolve environment_id from the workspace_path
    let environmentId: string | null = null
    const envMatch = db.prepare(
      'SELECT e.id FROM environments e WHERE e.default_team = ? LIMIT 1'
    ).get(workspacePath) as any
    if (envMatch) environmentId = envMatch.id

    // Build a summary of the workflow to seed as the first assistant message
    const tasks = typeof plan.tasks === 'string' ? JSON.parse(plan.tasks) : (plan.tasks || [])
    const taskNames = Array.isArray(tasks)
      ? tasks.map((t: any, i: number) => `${i + 1}. ${t.name || t.prompt?.slice(0, 60) || 'Task'}`).join('\n')
      : ''

    const resultStatus = plan.result_status || plan.status
    const resultNotes = plan.result_notes || ''

    // Fetch key log entries (info level, one per task, to give context)
    const logEntries = db.prepare(
      `SELECT task_id, level, message FROM plan_logs WHERE plan_id = ? AND level != 'debug' ORDER BY id ASC`
    ).all(id) as any[]

    // Group logs by task and take the first meaningful message per task
    const taskLogSummaries: string[] = []
    const seenTasks = new Set<string>()
    for (const log of logEntries) {
      const taskId = log.task_id || 'unknown'
      if (!seenTasks.has(taskId) && log.level !== 'debug') {
        seenTasks.add(taskId)
        const taskName = Array.isArray(tasks)
          ? tasks.find((t: any) => t.id === taskId)?.name || taskId
          : taskId
        taskLogSummaries.push(`**${taskName}**: ${log.message}`)
      }
    }

    // Create the chat session
    const sessionId = randomUUID()
    const sessionName = plan.name || 'Workflow Chat'

    db.prepare(`
      INSERT INTO chat_sessions (id, name, project_id, workspace_path, environment_id, sdk_session_id, status, source_type, plan_id)
      VALUES (?, ?, ?, ?, ?, ?, 'idle', 'workflow', ?)
    `).run(
      sessionId,
      sessionName,
      plan.project_id || null,
      workspacePath,
      environmentId,
      plan.sdk_session_id || null,
      id,
    )

    // Seed an assistant message with the workflow summary
    const summaryText = [
      `## Workflow Concluído: ${sessionName}`,
      '',
      `**Status**: ${resultStatus}${resultNotes ? ` — ${resultNotes}` : ''}`,
      '',
      '**Tarefas executadas:**',
      taskNames || 'Nenhuma tarefa registrada',
      '',
      taskLogSummaries.length > 0 ? '**Resumo por tarefa:**\n' + taskLogSummaries.slice(0, 10).join('\n') : '',
      '',
      '---',
      '*Esta sessão de chat continua o contexto do workflow acima. Você pode fazer perguntas, solicitar ajustes ou dar nova direção.*',
    ].filter(Boolean).join('\n')

    const summaryMsgId = randomUUID()
    db.prepare(
      'INSERT INTO chat_messages (id, session_id, role, content) VALUES (?, ?, ?, ?)'
    ).run(summaryMsgId, sessionId, 'assistant', summaryText)

    console.log(`[plans] Converted workflow ${id} to chat session ${sessionId}`)

    return res.status(201).json({
      data: { id: sessionId, name: sessionName, converted: true },
      error: null,
    })
  } catch (error) {
    console.error('Error converting plan to chat:', error)
    res.status(500).json({ data: null, error: 'Failed to convert workflow to chat' })
  }
})

export default router
