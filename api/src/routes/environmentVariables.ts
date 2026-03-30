import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { db } from '../db/index.js'
import { authenticateToken } from '../middleware/auth.js'

const router = Router()

// GET /api/environment-variables - List all environment variables
router.get('/', authenticateToken, (req, res) => {
  try {
    const envVars = db.prepare(`
      SELECT * FROM environment_variables
      ORDER BY category ASC, key ASC
    `).all()

    const formatted = envVars.map((ev: any) => ({
      ...ev,
      is_secret: Boolean(ev.is_secret)
    }))

    return res.json({ data: formatted, error: null })
  } catch (error: any) {
    console.error('Error fetching environment variables:', error)
    return res.status(500).json({ data: null, error: 'Failed to fetch environment variables' })
  }
})

// GET /api/environment-variables/categories - Get unique categories
router.get('/categories', authenticateToken, (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT DISTINCT category FROM environment_variables
      ORDER BY category ASC
    `).all()

    return res.json({
      data: categories.map((c: any) => c.category),
      error: null
    })
  } catch (error: any) {
    console.error('Error fetching categories:', error)
    return res.status(500).json({ data: null, error: 'Failed to fetch categories' })
  }
})

// GET /api/environment-variables/by-category/:category - Get variables by category
router.get('/by-category/:category', authenticateToken, (req, res) => {
  try {
    const envVars = db.prepare(`
      SELECT * FROM environment_variables
      WHERE category = ?
      ORDER BY key ASC
    `).all(req.params.category)

    const formatted = envVars.map((ev: any) => ({
      ...ev,
      is_secret: Boolean(ev.is_secret)
    }))

    return res.json({ data: formatted, error: null })
  } catch (error: any) {
    console.error('Error fetching environment variables by category:', error)
    return res.status(500).json({ data: null, error: 'Failed to fetch environment variables' })
  }
})

// GET /api/environment-variables/defaults - Get default environment variables for agent creation
router.get('/defaults', authenticateToken, (req, res) => {
  try {
    const envVars = db.prepare(`
      SELECT key, value, category, description
      FROM environment_variables
      ORDER BY category ASC, key ASC
    `).all()

    // Transform into key-value pairs for easy use
    const defaults: Record<string, string> = {}
    const categorized: Record<string, Record<string, { value: string; description: string }>> = {}

    for (const envVar of envVars as any[]) {
      defaults[envVar.key] = envVar.value

      if (!categorized[envVar.category]) {
        categorized[envVar.category] = {}
      }
      categorized[envVar.category][envVar.key] = {
        value: envVar.value,
        description: envVar.description || ''
      }
    }

    return res.json({
      data: {
        flat: defaults,
        categorized,
        keys: Object.keys(defaults)
      },
      error: null
    })
  } catch (error: any) {
    console.error('Error fetching default environment variables:', error)
    return res.status(500).json({ data: null, error: 'Failed to fetch default environment variables' })
  }
})

// GET /api/environment-variables/:id - Get a single environment variable
// NOTE: This route must come AFTER specific routes like /defaults, /categories, /by-category/:category
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const envVar = db.prepare('SELECT * FROM environment_variables WHERE id = ?').get(req.params.id) as any

    if (!envVar) {
      return res.status(404).json({ data: null, error: 'Environment variable not found' })
    }

    return res.json({
      data: {
        ...envVar,
        is_secret: Boolean(envVar.is_secret)
      },
      error: null
    })
  } catch (error: any) {
    console.error('Error fetching environment variable:', error)
    return res.status(500).json({ data: null, error: 'Failed to fetch environment variable' })
  }
})

// POST /api/environment-variables - Create a new environment variable
router.post('/', authenticateToken, (req, res) => {
  try {
    const { key, value, description, category, is_secret } = req.body

    if (!key || value === undefined) {
      return res.status(400).json({ data: null, error: 'key and value are required' })
    }

    // Check if key already exists
    const existing = db.prepare('SELECT id FROM environment_variables WHERE key = ?').get(key)
    if (existing) {
      return res.status(400).json({ data: null, error: 'Environment variable with this key already exists' })
    }

    const id = uuid()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO environment_variables (id, key, value, description, category, is_secret, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      key,
      value,
      description || '',
      category || 'general',
      is_secret ? 1 : 0,
      now,
      now
    )

    const newEnvVar = db.prepare('SELECT * FROM environment_variables WHERE id = ?').get(id) as any

    return res.status(201).json({
      data: {
        ...newEnvVar,
        is_secret: Boolean(newEnvVar.is_secret)
      },
      error: null
    })
  } catch (error: any) {
    console.error('Error creating environment variable:', error)
    return res.status(500).json({ data: null, error: 'Failed to create environment variable' })
  }
})

// PUT /api/environment-variables/:id - Update an environment variable
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { key, value, description, category, is_secret } = req.body

    if (!key || value === undefined) {
      return res.status(400).json({ data: null, error: 'key and value are required' })
    }

    // Check if environment variable exists
    const existing = db.prepare('SELECT id FROM environment_variables WHERE id = ?').get(req.params.id)
    if (!existing) {
      return res.status(404).json({ data: null, error: 'Environment variable not found' })
    }

    // Check if new key conflicts with another record
    const keyConflict = db.prepare('SELECT id FROM environment_variables WHERE key = ? AND id != ?').get(key, req.params.id)
    if (keyConflict) {
      return res.status(400).json({ data: null, error: 'Environment variable with this key already exists' })
    }

    const now = new Date().toISOString()

    db.prepare(`
      UPDATE environment_variables
      SET key = ?, value = ?, description = ?, category = ?, is_secret = ?, updated_at = ?
      WHERE id = ?
    `).run(
      key,
      value,
      description || '',
      category || 'general',
      is_secret ? 1 : 0,
      now,
      req.params.id
    )

    const updatedEnvVar = db.prepare('SELECT * FROM environment_variables WHERE id = ?').get(req.params.id) as any

    return res.json({
      data: {
        ...updatedEnvVar,
        is_secret: Boolean(updatedEnvVar.is_secret)
      },
      error: null
    })
  } catch (error: any) {
    console.error('Error updating environment variable:', error)
    return res.status(500).json({ data: null, error: 'Failed to update environment variable' })
  }
})

// DELETE /api/environment-variables/:id - Delete an environment variable
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    // Check if environment variable exists
    const existing = db.prepare('SELECT id FROM environment_variables WHERE id = ?').get(req.params.id)
    if (!existing) {
      return res.status(404).json({ data: null, error: 'Environment variable not found' })
    }

    db.prepare('DELETE FROM environment_variables WHERE id = ?').run(req.params.id)

    return res.json({ data: { id: req.params.id }, error: null })
  } catch (error: any) {
    console.error('Error deleting environment variable:', error)
    return res.status(500).json({ data: null, error: 'Failed to delete environment variable' })
  }
})

// POST /api/environment-variables/batch - Batch create/update environment variables
router.post('/batch', authenticateToken, (req, res) => {
  try {
    const { variables } = req.body

    if (!Array.isArray(variables)) {
      return res.status(400).json({ data: null, error: 'variables must be an array' })
    }

    const now = new Date().toISOString()
    const results: any[] = []

    for (const variable of variables) {
      const { key, value, description, category, is_secret } = variable

      if (!key || value === undefined) {
        results.push({ key, error: 'key and value are required' })
        continue
      }

      // Check if key already exists
      const existing = db.prepare('SELECT id FROM environment_variables WHERE key = ?').get(key) as any

      if (existing) {
        // Update existing
        db.prepare(`
          UPDATE environment_variables
          SET value = ?, description = ?, category = ?, is_secret = ?, updated_at = ?
          WHERE id = ?
        `).run(
          value,
          description || '',
          category || 'general',
          is_secret ? 1 : 0,
          now,
          existing.id
        )
        results.push({ key, id: existing.id, action: 'updated' })
      } else {
        // Create new
        const id = uuid()
        db.prepare(`
          INSERT INTO environment_variables (id, key, value, description, category, is_secret, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          key,
          value,
          description || '',
          category || 'general',
          is_secret ? 1 : 0,
          now,
          now
        )
        results.push({ key, id, action: 'created' })
      }
    }

    return res.json({ data: results, error: null })
  } catch (error: any) {
    console.error('Error batch processing environment variables:', error)
    return res.status(500).json({ data: null, error: 'Failed to process environment variables' })
  }
})

// POST /api/environment-variables/initialize-defaults - Initialize default environment variables
router.post('/initialize-defaults', authenticateToken, (req, res) => {
  try {
    const defaults = [
      {
        key: 'ANTHROPIC_BASE_URL',
        value: 'http://localhost:8083',
        description: 'Base URL for Anthropic API',
        category: 'anthropic',
        is_secret: false
      },
      {
        key: 'ANTHROPIC_API_URL',
        value: 'https://api.anthropic.com/v1/messages',
        description: 'API URL for Anthropic messages endpoint',
        category: 'anthropic',
        is_secret: false
      },
      {
        key: 'ANTHROPIC_VERSION',
        value: '2023-06-01',
        description: 'API version for Anthropic',
        category: 'anthropic',
        is_secret: false
      },
      {
        key: 'OPENAI_BASE_URL',
        value: 'https://api.openai.com/v1',
        description: 'Base URL for OpenAI API',
        category: 'openai',
        is_secret: false
      },
      {
        key: 'API_TIMEOUT_MS',
        value: '3000000',
        description: 'API timeout in milliseconds',
        category: 'general',
        is_secret: false
      },
      {
        key: 'MAX_TOKENS',
        value: '8192',
        description: 'Default maximum tokens for AI responses',
        category: 'general',
        is_secret: false
      },
      {
        key: 'TEMPERATURE',
        value: '0.7',
        description: 'Default temperature for AI responses',
        category: 'general',
        is_secret: false
      },
      {
        key: 'CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR',
        value: '1',
        description: 'Maintain project working directory in bash',
        category: 'general',
        is_secret: false
      }
    ]

    const now = new Date().toISOString()
    const created = []
    const skipped = []

    for (const envVar of defaults) {
      const existing = db.prepare('SELECT id FROM environment_variables WHERE key = ?').get(envVar.key) as any

      if (!existing) {
        const id = uuid()
        db.prepare(`
          INSERT INTO environment_variables (id, key, value, description, category, is_secret, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          envVar.key,
          envVar.value,
          envVar.description,
          envVar.category,
          envVar.is_secret ? 1 : 0,
          now,
          now
        )
        created.push(envVar.key)
      } else {
        skipped.push(envVar.key)
      }
    }

    return res.json({
      data: {
        message: 'Environment variables initialized',
        created,
        skipped,
        total: defaults.length
      },
      error: null
    })
  } catch (error: any) {
    console.error('Error initializing default environment variables:', error)
    return res.status(500).json({ data: null, error: 'Failed to initialize default environment variables' })
  }
})

export default router
