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
      project_id
    } = req.body

    if (!title) {
      return res.status(400).json({ data: null, error: 'title is required' })
    }

    // If project_id is provided, verify project exists
    if (project_id) {
      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id)
      if (!project) {
        return res.status(404).json({ data: null, error: 'Project not found' })
      }
    }

    const id = randomUUID()
    db.prepare(`
      INSERT INTO kanban_templates (
        id, project_id, title, description, priority, recurrence, is_public
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, project_id || null, title, description, priority, recurrence, is_public ? 1 : 0)

    const template = db.prepare('SELECT * FROM kanban_templates WHERE id = ?').get(id)
    res.status(201).json({ data: template, error: null })
  } catch (err: any) {
    console.error('Error creating template:', err)
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
      is_public,
      project_id,
      next_run_at
    } = req.body

    // Check if template exists
    const existingTemplate = db.prepare('SELECT * FROM kanban_templates WHERE id = ?').get(req.params.id)
    if (!existingTemplate) {
      return res.status(404).json({ data: null, error: 'Template not found' })
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

    db.prepare(`
      UPDATE kanban_templates SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        priority = COALESCE(?, priority),
        recurrence = COALESCE(?, recurrence),
        is_public = COALESCE(?, is_public),
        project_id = COALESCE(?, project_id),
        next_run_at = COALESCE(?, next_run_at),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      title,
      description,
      priority,
      recurrence,
      isPublicSafe,
      project_id !== undefined ? project_id : null,
      next_run_at,
      req.params.id
    )

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

    // Get the highest order_index in the planning column for this project
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
