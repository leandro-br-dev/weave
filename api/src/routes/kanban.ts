import { Router, Request, Response } from 'express'
import { db } from '../db/index.js'
import { authenticateToken } from '../middleware/auth.js'
import { randomUUID } from 'crypto'

const router = Router()

// GET /api/kanban — listar todas as tasks de todos os projetos
router.get('/', authenticateToken, (req: Request, res: Response) => {
  try {
    const tasks = db.prepare(`
      SELECT kt.*,
             p.name as project_name,
             p.description as project_description,
             p.settings as project_settings,
             w.status as workflow_status,
             w.name as workflow_name
      FROM kanban_tasks kt
      JOIN projects p ON p.id = kt.project_id
      LEFT JOIN plans w ON w.id = kt.workflow_id
      ORDER BY kt.column, kt.priority ASC, kt.order_index ASC
    `).all()
    res.json({ data: tasks, error: null })
  } catch (err: any) {
    console.error('Error fetching all kanban tasks:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})

// GET /api/kanban/scheduled — retorna templates com recorrência prontos para executar
// IMPORTANTE: deve vir antes de /:projectId para não conflitar
router.get('/scheduled', authenticateToken, (req: Request, res: Response) => {
  try {
    const templates = db.prepare(`
      SELECT
        kt.id,
        kt.project_id,
        kt.title,
        kt.description,
        kt.priority,
        kt.recurrence,
        kt.next_run_at,
        kt.last_run_at,
        kt.is_public,
        kt.created_at,
        kt.updated_at,
        p.settings as project_settings
      FROM kanban_templates kt
      LEFT JOIN projects p ON p.id = kt.project_id
      WHERE kt.recurrence != ''
        AND kt.recurrence IS NOT NULL
        AND (kt.next_run_at IS NULL OR kt.next_run_at <= datetime('now'))
    `).all()

    const result = templates.map((t: any) => ({
      ...t,
      project_settings: (() => {
        try {
          return JSON.parse(t.project_settings || '{}')
        } catch {
          return {}
        }
      })()
    }))

    res.json({ data: result, error: null })
  } catch (err: any) {
    console.error('Error fetching scheduled templates:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})

// GET /api/kanban/:projectId — listar todas as tasks do projeto
router.get('/:projectId', authenticateToken, (req: Request, res: Response) => {
  try {
    // Verify project exists
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.projectId)
    if (!project) {
      return res.status(404).json({ data: null, error: 'Project not found' })
    }

    const tasks = db.prepare(`
      SELECT kt.*, p.status as workflow_status, p.name as workflow_name
      FROM kanban_tasks kt
      LEFT JOIN plans p ON p.id = kt.workflow_id
      WHERE kt.project_id = ?
      ORDER BY kt.column, kt.priority ASC, kt.order_index ASC
    `).all(req.params.projectId)
    res.json({ data: tasks, error: null })
  } catch (err: any) {
    console.error('Error fetching kanban tasks:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})


// POST /api/kanban/:projectId — criar task
router.post('/:projectId', authenticateToken, (req: Request, res: Response) => {
  try {
    const { title, description = '', column = 'backlog', priority = 3, attachment_ids } = req.body
    if (!title) {
      return res.status(400).json({ data: null, error: 'title is required' })
    }

    // Verify project exists
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId)
    if (!project) {
      return res.status(404).json({ data: null, error: 'Project not found' })
    }

    const attachmentsJson = Array.isArray(attachment_ids) ? JSON.stringify(attachment_ids) : '[]'
    const id = randomUUID()
    db.prepare(
      'INSERT INTO kanban_tasks (id, project_id, title, description, column, priority, attachments) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, req.params.projectId, title, description, column, priority, attachmentsJson)
    const task = db.prepare('SELECT * FROM kanban_tasks WHERE id = ?').get(id)
    res.status(201).json({ data: task, error: null })
  } catch (err: any) {
    console.error('Error creating kanban task:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})

// PUT /api/kanban/:projectId/:taskId — atualizar task
router.put('/:projectId/:taskId', authenticateToken, (req: Request, res: Response) => {
  try {
    const { title, description, column, priority, order_index, workflow_id, result_status, result_notes, pipeline_status, attachment_ids } = req.body
    // Verify project exists
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.projectId)
    if (!project) {
      return res.status(404).json({ data: null, error: 'Project not found' })
    }
    const task = db.prepare('SELECT * FROM kanban_tasks WHERE id = ? AND project_id = ?').get(req.params.taskId, req.params.projectId) as any
    if (!task) {
      return res.status(404).json({ data: null, error: 'Task not found' })
    }

    const attachmentsJson = attachment_ids !== undefined
      ? (Array.isArray(attachment_ids) ? JSON.stringify(attachment_ids) : JSON.stringify(task.attachments || []))
      : null

    db.prepare(`
      UPDATE kanban_tasks SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        column = COALESCE(?, column),
        priority = COALESCE(?, priority),
        order_index = COALESCE(?, order_index),
        workflow_id = COALESCE(?, workflow_id),
        result_status = COALESCE(?, result_status),
        result_notes = COALESCE(?, result_notes),
        pipeline_status = COALESCE(?, pipeline_status),
        attachments = COALESCE(?, attachments),
        updated_at = datetime('now')
      WHERE id = ? AND project_id = ?
    `).run(title, description, column, priority, order_index, workflow_id, result_status, result_notes, pipeline_status ?? null, attachmentsJson, req.params.taskId, req.params.projectId)

    const updated = db.prepare('SELECT * FROM kanban_tasks WHERE id = ?').get(req.params.taskId)
    res.json({ data: updated, error: null })
  } catch (err: any) {
    console.error('Error updating kanban task:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})

// DELETE /api/kanban/:projectId/:taskId
router.delete('/:projectId/:taskId', authenticateToken, (req: Request, res: Response) => {
  try {
    // Verify project exists
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.projectId)
    if (!project) {
      return res.status(404).json({ data: null, error: 'Project not found' })
    }
    const result = db.prepare('DELETE FROM kanban_tasks WHERE id = ? AND project_id = ?').run(req.params.taskId, req.params.projectId)
    if (result.changes === 0) {
      return res.status(404).json({ data: null, error: 'Task not found' })
    }
    res.json({ data: { success: true }, error: null })
  } catch (err: any) {
    console.error('Error deleting kanban task:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})

// GET /api/kanban/:projectId/pending-pipeline — retorna tasks em planning sem workflow
router.get('/:projectId/pending-pipeline', authenticateToken, (req: Request, res: Response) => {
  try {
    // Verify project exists (daemon can access any project)
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.projectId)
    if (!project) {
      return res.status(404).json({ data: null, error: 'Project not found' })
    }

    const tasks = db.prepare(`
      SELECT kt.*, p.settings as project_settings
      FROM kanban_tasks kt
      JOIN projects p ON p.id = kt.project_id
      WHERE kt.project_id = ?
        AND kt.column = 'planning'
        AND (kt.workflow_id IS NULL OR kt.workflow_id = '')
        AND kt.pipeline_status = 'idle'
      ORDER BY kt.priority ASC, kt.created_at ASC
      LIMIT 5
    `).all(req.params.projectId)

    const result = tasks.map((t: any) => ({
      ...t,
      project_settings: JSON.parse(t.project_settings || '{}')
    }))
    res.json({ data: result, error: null })
  } catch (err: any) {
    console.error('Error fetching pending pipeline tasks:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})

// PATCH /api/kanban/:projectId/:taskId/pipeline — atualiza pipeline_status
router.patch('/:projectId/:taskId/pipeline', authenticateToken, (req: Request, res: Response) => {
  try {
    // Verify project exists (daemon can update pipeline for any project)
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.projectId)
    if (!project) {
      return res.status(404).json({ data: null, error: 'Project not found' })
    }

    const { pipeline_status, workflow_id, error_message, column, result_status, result_notes } = req.body
    db.prepare(`
      UPDATE kanban_tasks SET
        pipeline_status = COALESCE(?, pipeline_status),
        workflow_id = COALESCE(?, workflow_id),
        error_message = COALESCE(?, error_message),
        column = COALESCE(?, column),
        result_status = COALESCE(?, result_status),
        result_notes = COALESCE(?, result_notes),
        planning_started_at = CASE WHEN ? = 'planning' THEN datetime('now') ELSE planning_started_at END,
        updated_at = datetime('now')
      WHERE id = ? AND project_id = ?
    `).run(pipeline_status, workflow_id, error_message, column, result_status, result_notes, pipeline_status, req.params.taskId, req.params.projectId)

    const updated = db.prepare('SELECT * FROM kanban_tasks WHERE id = ?').get(req.params.taskId)
    res.json({ data: updated, error: null })
  } catch (err: any) {
    console.error('Error updating pipeline status:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})

// GET /api/kanban/:projectId/can-advance — check if a task can advance based on current limits
router.get('/:projectId/can-advance', authenticateToken, (req: Request, res: Response) => {
  try {
    // Verify project exists
    const projectData = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId) as any
    if (!projectData) {
      return res.status(404).json({ data: null, error: 'Project not found' })
    }

    // Parse project settings to get limits
    let settings = {}
    try {
      settings = JSON.parse(projectData.settings || '{}')
    } catch (err) {
      console.error('Error parsing project settings:', err)
      settings = {}
    }

    // Type settings with known properties
    const typedSettings = settings as Record<string, unknown>

    // Get workflow limits from settings (fallback to database columns from migration v27)
    const maxConcurrentWorkflows = (typedSettings.max_concurrent_workflows as number) ?? (projectData.max_concurrent_workflows as number) ?? 0 // 0 = unlimited
    const maxPlanningTasks = (typedSettings.max_planning_tasks as number) ?? (projectData.max_planning_tasks as number) ?? 1
    const maxInProgressTasks = (typedSettings.max_in_progress_tasks as number) ?? (projectData.max_in_progress_tasks as number) ?? 1

    // Count current workflows in 'running' status across all projects (global limit)
    const runningWorkflowsCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM plans
      WHERE status = 'running'
    `).get() as { count: number }

    // Count tasks in 'planning' column for the specific project
    const planningTasksCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM kanban_tasks
      WHERE project_id = ? AND column = 'planning'
    `).get(req.params.projectId) as { count: number }

    // Count tasks in 'in_dev' column for the specific project
    const inDevTasksCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM kanban_tasks
      WHERE project_id = ? AND column = 'in_dev'
    `).get(req.params.projectId) as { count: number }

    // Count tasks in 'validation' column for the specific project
    const validationTasksCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM kanban_tasks
      WHERE project_id = ? AND column = 'validation'
    `).get(req.params.projectId) as { count: number }

    // Parse auto-advance gate settings (from project settings JSON)
    const gates = typedSettings as Record<string, unknown>
    const autoAdvancePlanToDev = gates.auto_advance_plan_to_dev !== false // default true
    const autoAdvanceDevToStaging = gates.auto_advance_dev_to_staging !== false // default true
    const autoAdvanceStagingToDone = gates.auto_advance_staging_to_done === true // default false

    // Determine if task can advance and the reason
    let canAdvance = true
    let reason = 'Task can advance'

    // Check global concurrent workflows limit
    if (maxConcurrentWorkflows > 0 && runningWorkflowsCount.count >= maxConcurrentWorkflows) {
      canAdvance = false
      reason = `Maximum concurrent workflows limit reached (${runningWorkflowsCount.count}/${maxConcurrentWorkflows})`
    }
    // Check planning tasks limit
    else if (planningTasksCount.count >= maxPlanningTasks) {
      canAdvance = false
      reason = `Maximum planning tasks limit reached (${planningTasksCount.count}/${maxPlanningTasks})`
    }
    // Check in-dev tasks limit
    else if (inDevTasksCount.count >= maxInProgressTasks) {
      canAdvance = false
      reason = `Maximum in-dev tasks limit reached (${inDevTasksCount.count}/${maxInProgressTasks})`
    }

    // Return response with all counts and gate settings
    res.json({
      data: {
        can_advance: canAdvance,
        reason,
        current_counts: {
          running_workflows: runningWorkflowsCount.count,
          planning_tasks: planningTasksCount.count,
          in_dev_tasks: inDevTasksCount.count,
          validation_tasks: validationTasksCount.count,
        },
        limits: {
          max_concurrent_workflows: maxConcurrentWorkflows,
          max_planning_tasks: maxPlanningTasks,
          max_in_progress_tasks: maxInProgressTasks,
        },
        gates: {
          auto_advance_plan_to_dev: autoAdvancePlanToDev,
          auto_advance_dev_to_staging: autoAdvanceDevToStaging,
          auto_advance_staging_to_done: autoAdvanceStagingToDone,
        },
      },
      error: null
    })
  } catch (err: any) {
    console.error('Error checking if task can advance:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})

// POST /api/kanban/:projectId/auto-move — move tasks automatically based on business rules
router.post('/:projectId/auto-move', authenticateToken, (req: Request, res: Response) => {
  const movedTasks: Array<{
    task: any,
    oldColumn: string,
    newColumn: string
  }> = []
  const reasons: string[] = []

  try {
    // Verify project exists
    const finalProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId) as any
    if (!finalProject) {
      return res.status(404).json({ moved_tasks: [], reasons: [], error: 'Project not found' })
    }

    // Parse project settings to get limits
    let settings = {}
    try {
      settings = JSON.parse(finalProject.settings || '{}')
    } catch (err) {
      settings = {}
    }
    const typedSettings = settings as Record<string, unknown>
    const maxPlanningTasks = (typedSettings.max_planning_tasks as number) ?? (finalProject.max_planning_tasks as number) ?? 1
    const maxInProgressTasks = (typedSettings.max_in_progress_tasks as number) ?? (finalProject.max_in_progress_tasks as number) ?? 1
    const maxConcurrentWorkflows = (typedSettings.max_concurrent_workflows as number) ?? (finalProject.max_concurrent_workflows as number) ?? 0

    // Parse auto-advance gate settings (from project settings JSON)
    const autoAdvancePlanToDev = typedSettings.auto_advance_plan_to_dev !== false // default true
    const autoAdvanceDevToStaging = typedSettings.auto_advance_dev_to_staging !== false // default true
    const autoAdvanceStagingToDone = typedSettings.auto_advance_staging_to_done === true // default false

    // Use transaction for atomic updates
    db.transaction(() => {
      // Check global concurrent workflows limit
      if (maxConcurrentWorkflows > 0) {
        const runningWorkflowsCount = db.prepare(`
          SELECT COUNT(*) as count FROM plans WHERE status = 'running'
        `).get() as { count: number }

        if (runningWorkflowsCount.count >= maxConcurrentWorkflows) {
          reasons.push(`Global workflow limit reached (${runningWorkflowsCount.count}/${maxConcurrentWorkflows})`)
          // Still return success but with no moves and reason
          return
        }
      }

      // Rule 1: Backlog → Planning
      // Check if planning column is empty
      const planningCount = db.prepare(`
        SELECT COUNT(*) as count
        FROM kanban_tasks
        WHERE project_id = ? AND column = 'planning'
      `).get(req.params.projectId) as { count: number }

      console.log(`[Auto-move] Planning column count: ${planningCount.count}, limit: ${maxPlanningTasks}`)

      const effectivePlanningLimit = maxPlanningTasks === 0 ? Infinity : maxPlanningTasks
      if (planningCount.count < effectivePlanningLimit) {
        // Find highest priority task from backlog (priority ASC = 1 is highest/critical)
        const backlogTask = db.prepare(`
          SELECT *
          FROM kanban_tasks
          WHERE project_id = ? AND column = 'backlog'
          ORDER BY priority ASC, created_at ASC
          LIMIT 1
        `).get(req.params.projectId) as any

        if (backlogTask) {
          console.log(`[Auto-move] Found backlog task to move: ${backlogTask.id} - ${backlogTask.title} (priority: ${backlogTask.priority})`)

          // Move task to planning
          db.prepare(`
            UPDATE kanban_tasks
            SET column = 'planning', updated_at = datetime('now')
            WHERE id = ?
          `).run(backlogTask.id)

          // Fetch updated task
          const updatedTask = db.prepare('SELECT * FROM kanban_tasks WHERE id = ?').get(backlogTask.id)

          movedTasks.push({
            task: updatedTask,
            oldColumn: 'backlog',
            newColumn: 'planning'
          })

          reasons.push(`Moved "${backlogTask.title}" from backlog to planning (highest priority: ${backlogTask.priority})`)
          console.log(`[Auto-move] ✓ Moved task ${backlogTask.id} from backlog to planning`)
        } else {
          console.log(`[Auto-move] No backlog tasks found to move`)
        }
      }

      // Rule 2: Planning → In Dev (respects auto_advance_plan_to_dev gate)
      // Check if in_dev column has capacity
      const inDevCount = db.prepare(`
        SELECT COUNT(*) as count
        FROM kanban_tasks
        WHERE project_id = ? AND column = 'in_dev'
      `).get(req.params.projectId) as { count: number }

      console.log(`[Auto-move] In Dev column count: ${inDevCount.count}, limit: ${maxInProgressTasks}, gate: ${autoAdvancePlanToDev}`)

      const effectiveInProgressLimit = maxInProgressTasks === 0 ? Infinity : maxInProgressTasks
      if (autoAdvancePlanToDev && inDevCount.count < effectiveInProgressLimit) {
        // Find task in planning that has a workflow_id set
        const planningTask = db.prepare(`
          SELECT *
          FROM kanban_tasks
          WHERE project_id = ?
            AND column = 'planning'
            AND workflow_id IS NOT NULL
            AND workflow_id != ''
          ORDER BY priority ASC, created_at ASC
          LIMIT 1
        `).get(req.params.projectId) as any

        if (planningTask) {
          console.log(`[Auto-move] Found planning task with workflow_id: ${planningTask.id} - ${planningTask.title} (workflow_id: ${planningTask.workflow_id})`)

          // Move task to in_dev
          db.prepare(`
            UPDATE kanban_tasks
            SET column = 'in_dev', updated_at = datetime('now')
            WHERE id = ?
          `).run(planningTask.id)

          // Fetch updated task
          const updatedTask = db.prepare('SELECT * FROM kanban_tasks WHERE id = ?').get(planningTask.id)

          movedTasks.push({
            task: updatedTask,
            oldColumn: 'planning',
            newColumn: 'in_dev'
          })

          reasons.push(`Moved "${planningTask.title}" from planning to in_dev (has workflow_id: ${planningTask.workflow_id})`)
          console.log(`[Auto-move] ✓ Moved task ${planningTask.id} from planning to in_dev`)
        } else {
          console.log(`[Auto-move] No planning tasks with workflow_id found to move`)
        }
      } else if (!autoAdvancePlanToDev) {
        console.log(`[Auto-move] Gate blocked: planning → in_dev (auto_advance_plan_to_dev is false)`)
      }

      // Rule 3: In Dev → Validation (respects auto_advance_dev_to_staging gate)
      if (autoAdvanceDevToStaging) {
        // Find in_dev tasks whose workflow has completed (status = 'success')
        const completedInDevTasks = db.prepare(`
          SELECT kt.*
          FROM kanban_tasks kt
          JOIN plans p ON p.id = kt.workflow_id
          WHERE kt.project_id = ?
            AND kt.column = 'in_dev'
            AND kt.workflow_id IS NOT NULL
            AND kt.workflow_id != ''
            AND p.status = 'success'
            AND (p.result_status IS NULL OR p.result_status != 'needs_rework')
          ORDER BY kt.priority ASC, kt.created_at ASC
          LIMIT 1
        `).get(req.params.projectId) as any

        if (completedInDevTasks) {
          console.log(`[Auto-move] Moving task to validation: ${completedInDevTasks.id} - ${completedInDevTasks.title}`)

          db.prepare(`
            UPDATE kanban_tasks
            SET column = 'validation', updated_at = datetime('now')
            WHERE id = ?
          `).run(completedInDevTasks.id)

          const updatedTask = db.prepare('SELECT * FROM kanban_tasks WHERE id = ?').get(completedInDevTasks.id)

          movedTasks.push({
            task: updatedTask,
            oldColumn: 'in_dev',
            newColumn: 'validation'
          })

          reasons.push(`Moved "${completedInDevTasks.title}" from in_dev to validation (workflow completed)`)
          console.log(`[Auto-move] ✓ Moved task ${completedInDevTasks.id} from in_dev to validation`)
        }
      } else {
        console.log(`[Auto-move] Gate blocked: in_dev → validation (auto_advance_dev_to_staging is false)`)
      }

      // Rule 4: Validation → Done (respects auto_advance_staging_to_done gate)
      if (autoAdvanceStagingToDone) {
        // Find validation tasks that have been in validation for a while
        // For now, move any validation task (the gate being true means auto-advance)
        // Future: could add time-in-column check
        const validationTasks = db.prepare(`
          SELECT *
          FROM kanban_tasks
          WHERE project_id = ?
            AND column = 'validation'
          ORDER BY priority ASC, created_at ASC
          LIMIT 1
        `).get(req.params.projectId) as any

        if (validationTasks) {
          console.log(`[Auto-move] Moving task to done: ${validationTasks.id} - ${validationTasks.title}`)

          db.prepare(`
            UPDATE kanban_tasks
            SET column = 'done', pipeline_status = 'done', updated_at = datetime('now')
            WHERE id = ?
          `).run(validationTasks.id)

          const updatedTask = db.prepare('SELECT * FROM kanban_tasks WHERE id = ?').get(validationTasks.id)

          movedTasks.push({
            task: updatedTask,
            oldColumn: 'validation',
            newColumn: 'done'
          })

          reasons.push(`Moved "${validationTasks.title}" from validation to done`)
          console.log(`[Auto-move] ✓ Moved task ${validationTasks.id} from validation to done`)
        }
      } else {
        console.log(`[Auto-move] Gate blocked: validation → done (auto_advance_staging_to_done is false)`)
      }
    })()

    console.log(`[Auto-move] Completed. Moved ${movedTasks.length} task(s). Reasons: ${reasons.join('; ')}`)

    res.json({
      moved_tasks: movedTasks,
      reasons: reasons,
      error: null
    })
  } catch (err: any) {
    console.error('[Auto-move] Error:', err)
    res.status(500).json({
      moved_tasks: [],
      reasons: [],
      error: err.message
    })
  }
})

export default router
