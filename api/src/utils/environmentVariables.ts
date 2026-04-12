import { db } from '../db/index.js'

/**
 * Get all environment variables as a flat key-value object
 * Useful for merging with user-provided environment variables
 */
export function getDefaultEnvironmentVariables(): Record<string, string> {
  try {
    const envVars = db.prepare(`
      SELECT key, value
      FROM environment_variables
      ORDER BY category ASC, key ASC
    `).all() as any[]

    const defaults: Record<string, string> = {}
    for (const envVar of envVars) {
      defaults[envVar.key] = envVar.value
    }

    return defaults
  } catch (error) {
    console.error('Error fetching default environment variables:', error)
    return {}
  }
}

/**
 * Get environment variables by category
 */
export function getEnvironmentVariablesByCategory(category: string): Record<string, string> {
  try {
    const envVars = db.prepare(`
      SELECT key, value
      FROM environment_variables
      WHERE category = ?
      ORDER BY key ASC
    `).all(category) as any[]

    const defaults: Record<string, string> = {}
    for (const envVar of envVars) {
      defaults[envVar.key] = envVar.value
    }

    return defaults
  } catch (error) {
    console.error(`Error fetching environment variables for category ${category}:`, error)
    return {}
  }
}

/**
 * Merge default environment variables with user-provided ones
 * User-provided variables take precedence
 */
export function mergeEnvironmentVariables(
  userEnv: Record<string, string> = {},
  defaults: Record<string, string> = {}
): Record<string, string> {
  return {
    ...defaults,
    ...userEnv
  }
}

/**
 * Get environment variables formatted for API response
 * Returns both flat and categorized formats
 */
export function getEnvironmentVariablesFormatted(): {
  flat: Record<string, string>
  categorized: Record<string, Record<string, { value: string; description: string }>>
  keys: string[]
} {
  try {
    const envVars = db.prepare(`
      SELECT key, value, category, description
      FROM environment_variables
      ORDER BY category ASC, key ASC
    `).all() as any[]

    const flat: Record<string, string> = {}
    const categorized: Record<string, Record<string, { value: string; description: string }>> = {}
    const keys: string[] = []

    for (const envVar of envVars) {
      flat[envVar.key] = envVar.value
      keys.push(envVar.key)

      if (!categorized[envVar.category]) {
        categorized[envVar.category] = {}
      }
      categorized[envVar.category][envVar.key] = {
        value: envVar.value,
        description: envVar.description || ''
      }
    }

    return { flat, categorized, keys }
  } catch (error) {
    console.error('Error fetching formatted environment variables:', error)
    return { flat: {}, categorized: {}, keys: [] }
  }
}

/**
 * Get a specific environment variable value by key
 */
export function getEnvironmentVariableValue(key: string): string | null {
  try {
    const result = db.prepare('SELECT value FROM environment_variables WHERE key = ?').get(key) as any
    return result?.value || null
  } catch (error) {
    console.error(`Error fetching environment variable ${key}:`, error)
    return null
  }
}

/**
 * Check if an environment variable exists
 */
export function environmentVariableExists(key: string): boolean {
  try {
    const result = db.prepare('SELECT COUNT(*) as count FROM environment_variables WHERE key = ?').get(key) as any
    return result.count > 0
  } catch (error) {
    console.error(`Error checking environment variable ${key}:`, error)
    return false
  }
}

/**
 * Create or update an environment variable
 */
export function setEnvironmentVariable(
  key: string,
  value: string,
  options: {
    description?: string
    category?: string
    is_secret?: boolean
  } = {}
): boolean {
  try {
    const now = new Date().toISOString()
    const existing = db.prepare('SELECT id FROM environment_variables WHERE key = ?').get(key) as any

    if (existing) {
      // Update existing
      db.prepare(`
        UPDATE environment_variables
        SET value = ?, description = ?, category = ?, is_secret = ?, updated_at = ?
        WHERE key = ?
      `).run(
        value,
        options.description || '',
        options.category || 'general',
        options.is_secret ? 1 : 0,
        now,
        key
      )
    } else {
      // Create new
      const id = `env_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      db.prepare(`
        INSERT INTO environment_variables (id, key, value, description, category, is_secret, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        key,
        value,
        options.description || '',
        options.category || 'general',
        options.is_secret ? 1 : 0,
        now,
        now
      )
    }

    return true
  } catch (error) {
    console.error(`Error setting environment variable ${key}:`, error)
    return false
  }
}

/**
 * Initialize default environment variables if they don't exist
 */
export function initializeDefaultEnvironmentVariables(): {
  created: string[]
  skipped: string[]
  total: number
} {
  const defaults = [
    {
      key: 'ANTHROPIC_BASE_URL',
      value: 'http://localhost:8083',
      description: 'Base URL for Anthropic API',
      category: 'anthropic',
      is_secret: false
    },
    {
      key: 'ANTHROPIC_API_KEY',
      value: '',
      description: 'API key for Anthropic (used by Claude CLI for authentication)',
      category: 'anthropic',
      is_secret: true
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

  const created: string[] = []
  const skipped: string[] = []

  for (const envVar of defaults) {
    if (!environmentVariableExists(envVar.key)) {
      setEnvironmentVariable(envVar.key, envVar.value, {
        description: envVar.description,
        category: envVar.category,
        is_secret: envVar.is_secret
      })
      created.push(envVar.key)
    } else {
      skipped.push(envVar.key)
    }
  }

  return { created, skipped, total: defaults.length }
}
