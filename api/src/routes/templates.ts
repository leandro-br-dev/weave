import { Router, Request, Response } from 'express'
import { db } from '../db/index.js'
import { authenticateToken } from '../middleware/auth.js'
import { randomUUID } from 'crypto'

const router = Router()

// GET /api/templates - List all templates (both public and project-specific)
router.get('/', authenticateToken, (req: Request, res: Response) => {
  try {
    const templates = db.prepare(`
      SELECT t.*,
             p.name as project_name,
             p.description as project_description
      FROM kanban_templates t
      LEFT JOIN projects p ON p.id = t.project_id
      ORDER BY t.created_at DESC
    `).all()
    res.json({ data: templates, error: null })
  } catch (err: any) {
    console.error('Error fetching templates:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})

// GET /api/templates/workflow - List only workflow templates
// IMPORTANT: This must be before /:id to avoid Express matching 'workflow' as an ID
router.get('/workflow', authenticateToken, (req: Request, res: Response) => {
  try {
    const templates = db.prepare(`
      SELECT t.*,
             p.name as project_name,
             p.description as project_description
      FROM kanban_templates t
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.template_type = 'workflow'
      ORDER BY t.created_at DESC
    `).all()
    res.json({ data: templates, error: null })
  } catch (err: any) {
    console.error('Error fetching workflow templates:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})

// GET /api/templates/:id - Get a single template by ID
router.get('/:id', authenticateToken, (req: Request, res: Response) => {
  try {
    const template = db.prepare(`
      SELECT t.*,
             p.name as project_name,
             p.description as project_description
      FROM kanban_templates t
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.id = ?
    `).get(req.params.id)

    if (!template) {
      return res.status(404).json({ data: null, error: 'Template not found' })
    }

    res.json({ data: template, error: null })
  } catch (err: any) {
    console.error('Error fetching template:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})

// GET /api/templates/project/:projectId - Get templates for a specific project (includes public templates)
router.get('/project/:projectId', authenticateToken, (req: Request, res: Response) => {
  try {
    // Verify project exists
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId)
    if (!project) {
      return res.status(404).json({ data: null, error: 'Project not found' })
    }

    const templates = db.prepare(`
      SELECT t.*,
             p.name as project_name,
             p.description as project_description
      FROM kanban_templates t
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.project_id = ? OR t.is_public = 1
      ORDER BY t.created_at DESC
    `).all(req.params.projectId)

    res.json({ data: templates, error: null })
  } catch (err: any) {
    console.error('Error fetching project templates:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})

// POST /api/templates - Create a new template
router.post('/', authenticateToken, (req: Request, res: Response) => {
  try {
    const {
      title,
      description = '',
      priority = 3,
      recurrence = '',
      is_public = 1,
      project_id,
      // Workflow template fields
      template_type,
      plan_data,
      skip_planning,
      environment_id,
      team_id,
      source_plan_id,
      schedule_time
    } = req.body

    if (!title) {
      return res.status(400).json({ data: null, error: 'title is required' })
    }

    // Validate template_type if provided
    if (template_type && !['kanban', 'workflow'].includes(template_type)) {
      return res.status(400).json({ data: null, error: 'template_type must be "kanban" or "workflow"' })
    }

    // If project_id is provided, verify project exists
    if (project_id) {
      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id)
      if (!project) {
        return res.status(404).json({ data: null, error: 'Project not found' })
      }
    }

    const id = randomUUID()
    const resolvedType = template_type || 'kanban'

    // Only include plan_data for workflow templates
    const resolvedPlanData = resolvedType === 'workflow' && plan_data
      ? (typeof plan_data === 'string' ? plan_data : JSON.stringify(plan_data))
      : null

    db.prepare(`
      INSERT INTO kanban_templates (
        id, project_id, title, description, priority, recurrence, is_public,
        template_type, plan_data, skip_planning, environment_id, team_id, source_plan_id,
        schedule_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      project_id || null,
      title,
      description,
      priority,
      recurrence,
      is_public ? 1 : 0,
      resolvedType,
      resolvedPlanData,
      skip_planning ? 1 : 0,
      environment_id || null,
      team_id || null,
      source_plan_id || null,
      schedule_time || null
    )

    const template = db.prepare('SELECT * FROM kanban_templates WHERE id = ?').get(id)
    res.status(201).json({ data: template, error: null })
  } catch (err: any) {
    console.error('Error creating template:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})

// POST /api/templates/save-from-plan/:planId - Save a completed workflow plan as a reusable template
router.post('/save-from-plan/:planId', authenticateToken, (req: Request, res: Response) => {
  try {
    const { planId } = req.params
    const {
      title,
      description = '',
      recurrence = '',
      schedule_time = null,
      is_public = 1,
      project_id
    } = req.body

    // Look up the plan
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId) as any
    if (!plan) {
      return res.status(404).json({ data: null, error: 'Plan not found' })
    }

    // Verify plan is in a terminal state
    // Check plan.status (execution status: success/failed) — result_status is only set after review validation
    const planStatus = plan.status
    const planResultStatus = plan.result_status
    const isTerminal = planStatus === 'success' || planStatus === 'failed'
      || planResultStatus === 'success' || planResultStatus === 'failed'
      || planResultStatus === 'partial' || planResultStatus === 'needs_rework'
    if (!isTerminal) {
      return res.status(400).json({ data: null, error: 'Plan must be in a terminal state (success or failed) to save as template' })
    }

    // Parse the plan's tasks JSON
    let parsedTasks: any[]
    try {
      parsedTasks = typeof plan.tasks === 'string' ? JSON.parse(plan.tasks) : plan.tasks
    } catch {
      return res.status(400).json({ data: null, error: 'Failed to parse plan tasks JSON' })
    }

    // Build plan_data object
    const planData = JSON.stringify({
      name: plan.name,
      summary: '',
      tasks: parsedTasks
    })

    const id = randomUUID()
    const resolvedProjectId = project_id || plan.project_id || null
    const templateTitle = title || plan.name

    // Verify project exists if provided
    if (resolvedProjectId) {
      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(resolvedProjectId)
      if (!project) {
        return res.status(404).json({ data: null, error: 'Project not found' })
      }
    }

    // Create a backing plan record with status='template' — this is the real editable plan
    const templatePlanId = randomUUID()
    // Generate new task IDs for the template plan (independent from source)
    const taskIdMapping: Record<string, string> = {}
    const templatePlanTasks = parsedTasks.map((task: any) => {
      const newTaskId = randomUUID()
      taskIdMapping[task.id] = newTaskId
      return { ...task, id: newTaskId }
    })
    // Remap depends_on
    const finalTemplateTasks = templatePlanTasks.map((task: any) => ({
      ...task,
      depends_on: Array.isArray(task.depends_on)
        ? task.depends_on.map((depId: string) => taskIdMapping[depId] || depId)
        : task.depends_on
    }))

    db.prepare(`
      INSERT INTO plans (
        id, name, tasks, status, project_id, team_id
      ) VALUES (?, ?, ?, 'template', ?, ?)
    `).run(
      templatePlanId,
      templateTitle,
      JSON.stringify(finalTemplateTasks),
      resolvedProjectId,
      plan.team_id || null
    )

    // Create the template linking to the backing plan
    db.prepare(`
      INSERT INTO kanban_templates (
        id, project_id, title, description, priority, recurrence, is_public,
        template_type, plan_data, skip_planning, environment_id, team_id, source_plan_id,
        template_plan_id, schedule_time
      ) VALUES (?, ?, ?, ?, 3, ?, ?, 'workflow', ?, 1, NULL, ?, ?, ?, ?)
    `).run(
      id,
      resolvedProjectId,
      templateTitle,
      description,
      recurrence,
      is_public ? 1 : 0,
      planData,
      plan.team_id || null,
      planId,
      templatePlanId,
      schedule_time || null
    )

    const template = db.prepare('SELECT * FROM kanban_templates WHERE id = ?').get(id)
    res.status(201).json({ data: template, error: null })
  } catch (err: any) {
    console.error('Error saving plan as template:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})

// PUT /api/templates/:id - Update a template
router.put('/:id', authenticateToken, (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      priority,
      recurrence,
      schedule_time,
      is_public,
      project_id,
      next_run_at,
      // Workflow template fields
      template_type,
      plan_data,
      skip_planning,
      environment_id,
      team_id,
      source_plan_id
    } = req.body

    // Check if template exists
    const existingTemplate = db.prepare('SELECT * FROM kanban_templates WHERE id = ?').get(req.params.id) as any
    if (!existingTemplate) {
      return res.status(404).json({ data: null, error: 'Template not found' })
    }

    // Validate template_type if provided
    if (template_type && !['kanban', 'workflow'].includes(template_type)) {
      return res.status(400).json({ data: null, error: 'template_type must be "kanban" or "workflow"' })
    }

    // If project_id is being updated, verify project exists
    if (project_id !== undefined && project_id !== null) {
      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id)
      if (!project) {
        return res.status(404).json({ data: null, error: 'Project not found' })
      }
    }

    // Convert boolean to integer for SQLite
    const isPublicSafe = is_public !== undefined ? (is_public ? 1 : 0) : undefined

    // Handle plan_data: only store for workflow templates
    const resolvedType = template_type || existingTemplate.template_type || 'kanban'
    let resolvedPlanData: string | null | undefined = undefined
    if (plan_data !== undefined) {
      if (resolvedType === 'workflow') {
        resolvedPlanData = typeof plan_data === 'string' ? plan_data : JSON.stringify(plan_data)
      } else {
        resolvedPlanData = null
      }
    }

    db.prepare(`
      UPDATE kanban_templates SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        priority = COALESCE(?, priority),
        recurrence = COALESCE(?, recurrence),
        schedule_time = COALESCE(?, schedule_time),
        is_public = COALESCE(?, is_public),
        project_id = COALESCE(?, project_id),
        next_run_at = ?,
        template_type = COALESCE(?, template_type),
        plan_data = COALESCE(?, plan_data),
        skip_planning = COALESCE(?, skip_planning),
        environment_id = COALESCE(?, environment_id),
        team_id = COALESCE(?, team_id),
        source_plan_id = COALESCE(?, source_plan_id),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      title,
      description,
      priority,
      recurrence,
      schedule_time !== undefined ? schedule_time : null,
      isPublicSafe,
      project_id !== undefined ? project_id : null,
      next_run_at !== undefined ? next_run_at : null,
      template_type || null,
      resolvedPlanData !== undefined ? resolvedPlanData : null,
      skip_planning !== undefined ? (skip_planning ? 1 : 0) : null,
      environment_id !== undefined ? environment_id : null,
      team_id !== undefined ? team_id : null,
      source_plan_id !== undefined ? source_plan_id : null,
      req.params.id
    )

    // Sync title with the backing template plan
    if (title && existingTemplate.template_plan_id) {
      db.prepare('UPDATE plans SET name = ? WHERE id = ? AND status = ?').run(
        title,
        existingTemplate.template_plan_id,
        'template'
      )
    }

    const updated = db.prepare('SELECT * FROM kanban_templates WHERE id = ?').get(req.params.id)
    res.json({ data: updated, error: null })
  } catch (err: any) {
    console.error('Error updating template:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})

// DELETE /api/templates/:id - Delete a template
router.delete('/:id', authenticateToken, (req: Request, res: Response) => {
  try {
    const result = db.prepare('DELETE FROM kanban_templates WHERE id = ?').run(req.params.id)
    if (result.changes === 0) {
      return res.status(404).json({ data: null, error: 'Template not found' })
    }
    res.json({ data: { success: true }, error: null })
  } catch (err: any) {
    console.error('Error deleting template:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})

// POST /api/templates/:id/use - Create a task from a template in a specific project
// Supports both kanban templates (creates task in 'planning') and workflow templates
// with skip_planning (creates task in 'in_dev' with a pre-created plan)
router.post('/:id/use', authenticateToken, (req: Request, res: Response) => {
  try {
    const { projectId } = req.body

    if (!projectId) {
      return res.status(400).json({ data: null, error: 'projectId is required in request body' })
    }

    // Get template
    const template = db.prepare('SELECT * FROM kanban_templates WHERE id = ?').get(req.params.id) as any
    if (!template) {
      return res.status(404).json({ data: null, error: 'Template not found' })
    }

    // Verify target project exists
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId)
    if (!project) {
      return res.status(404).json({ data: null, error: 'Target project not found' })
    }

    // Workflow template with skip_planning: create task in 'in_dev' with pre-created plan
    if (template.template_type === 'workflow' && template.skip_planning === 1) {
      let planTasks: any[]

      // Prefer reading tasks from the backing template plan (status='template')
      if (template.template_plan_id) {
        const templatePlan = db.prepare('SELECT * FROM plans WHERE id = ? AND status = ?').get(template.template_plan_id, 'template') as any
        if (templatePlan) {
          try {
            planTasks = typeof templatePlan.tasks === 'string' ? JSON.parse(templatePlan.tasks) : templatePlan.tasks
          } catch {
            return res.status(400).json({ data: null, error: 'Failed to parse template plan tasks' })
          }
        }
      }

      // Fallback to plan_data if no backing plan or it was deleted
      if (!planTasks) {
        try {
          const planDataObj = typeof template.plan_data === 'string'
            ? JSON.parse(template.plan_data)
            : template.plan_data
          planTasks = planDataObj.tasks || []
        } catch {
          return res.status(400).json({ data: null, error: 'Failed to parse template plan_data' })
        }
      }

      // Generate new plan ID and new task IDs for all tasks
      const newPlanId = randomUUID()
      const taskIdMapping: Record<string, string> = {}
      const remappedTasks = planTasks.map((task: any) => {
        const newTaskId = randomUUID()
        taskIdMapping[task.id] = newTaskId
        return {
          ...task,
          id: newTaskId
        }
      })

      // Remap depends_on references to use new task IDs
      const finalTasks = remappedTasks.map((task: any) => ({
        ...task,
        depends_on: Array.isArray(task.depends_on)
          ? task.depends_on.map((depId: string) => taskIdMapping[depId] || depId)
          : task.depends_on
      }))

      // Get the highest order_index in the in_dev column for this project
      const maxOrderResult = db.prepare(`
        SELECT COALESCE(MAX(order_index), -1) as max_order
        FROM kanban_tasks
        WHERE project_id = ? AND column = 'in_dev'
      `).get(projectId) as { max_order: number }

      const nextOrderIndex = maxOrderResult.max_order + 1

      // Insert into plans table FIRST (before kanban_tasks, due to FK constraint)
      db.prepare(`
        INSERT INTO plans (
          id, name, tasks, status, project_id, team_id
        ) VALUES (?, ?, ?, 'pending', ?, ?)
      `).run(
        newPlanId,
        template.title,
        JSON.stringify(finalTasks),
        projectId,
        template.team_id || null
      )

      // Create kanban task in 'in_dev' column (NOT 'planning')
      const newTaskId = randomUUID()
      db.prepare(`
        INSERT INTO kanban_tasks (
          id, project_id, title, description, column, priority,
          order_index, pipeline_status, workflow_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'in_dev', ?, ?, 'idle', ?, datetime('now'), datetime('now'))
      `).run(
        newTaskId,
        projectId,
        template.title,
        template.description,
        template.priority,
        nextOrderIndex,
        newPlanId
      )

      // Update template's last_run_at
      db.prepare(`
        UPDATE kanban_templates
        SET last_run_at = datetime('now')
        WHERE id = ?
      `).run(req.params.id)

      const createdTask = db.prepare('SELECT * FROM kanban_tasks WHERE id = ?').get(newTaskId)
      return res.status(201).json({ data: createdTask, error: null })
    }

    // Default: existing kanban template behavior — create task in 'planning'
    const maxOrderResult = db.prepare(`
      SELECT COALESCE(MAX(order_index), -1) as max_order
      FROM kanban_tasks
      WHERE project_id = ? AND column = 'planning'
    `).get(projectId) as { max_order: number }

    const nextOrderIndex = maxOrderResult.max_order + 1

    // Create task from template
    const newTaskId = randomUUID()
    db.prepare(`
      INSERT INTO kanban_tasks (
        id, project_id, title, description, column, priority,
        order_index, pipeline_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'planning', ?, ?, 'idle', datetime('now'), datetime('now'))
    `).run(
      newTaskId,
      projectId,
      template.title,
      template.description,
      template.priority,
      nextOrderIndex
    )

    // Update template's last_run_at
    db.prepare(`
      UPDATE kanban_templates
      SET last_run_at = datetime('now')
      WHERE id = ?
    `).run(req.params.id)

    const createdTask = db.prepare('SELECT * FROM kanban_tasks WHERE id = ?').get(newTaskId)
    res.status(201).json({ data: createdTask, error: null })
  } catch (err: any) {
    console.error('Error using template:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})

export default router
