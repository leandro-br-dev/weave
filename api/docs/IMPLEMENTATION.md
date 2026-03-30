# API Implementation

Implementation details, patterns, and technical notes for the Weave API.

## Table of Contents

- [Implementation Patterns](#implementation-patterns)
- [Code Organization](#code-organization)
- [Utility Functions](#utility-functions)
- [Route Handler Patterns](#route-handler-patterns)
- [Database Operations](#database-operations)
- [File System Operations](#file-system-operations)
- [External API Integration](#external-api-integration)
- [Special Features](#special-features)
- [Performance Considerations](#performance-considerations)
- [Security Considerations](#security-considerations)
- [Testing](#testing)

---

## Implementation Patterns

### Consistent Response Format

All endpoints follow a consistent response format:

```typescript
// Success response
res.json({ data: result, error: null })

// Error response
res.status(400).json({ data: null, error: 'Error message' })
```

### Error Handling Pattern

```typescript
router.get('/:id', authenticateToken, (req: Request, res: Response) => {
  try {
    // Business logic
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id)
    if (!item) {
      return res.status(404).json({ data: null, error: 'Not found' })
    }
    res.json({ data: item, error: null })
  } catch (err: any) {
    console.error('Error description:', err)
    res.status(500).json({ data: null, error: err.message })
  }
})
```

### Authentication Pattern

All protected routes use the `authenticateToken` middleware:

```typescript
import { authenticateToken } from '../middleware/auth.js'

router.get('/', authenticateToken, (req, res) => {
  // Protected handler
})
```

### Validation Pattern

```typescript
router.post('/', authenticateToken, (req, res) => {
  const { name, value } = req.body

  // Validate required fields
  if (!name) {
    return res.status(400).json({ data: null, error: 'name is required' })
  }

  // Validate field values
  const validValues = ['option1', 'option2', 'option3']
  if (value && !validValues.includes(value)) {
    return res.status(400).json({
      data: null,
      error: `value must be one of: ${validValues.join(', ')}`
    })
  }

  // Continue with business logic
})
```

---

## Code Organization

### Route Structure

Routes are organized by resource:

```
src/routes/
├── plans.ts          # Plan management
├── workspaces.ts     # Workspace management
├── projects.ts       # Project management
├── approvals.ts      # Approval management
├── kanban.ts         # Kanban board
├── daemon.ts         # Daemon control
├── chatSessions.ts   # Chat sessions
├── nativeSkills.ts   # Native skills
├── marketplace.ts    # Marketplace integration
└── quickActions.ts   # Quick actions
```

### Utility Modules

```
src/utils/
├── paths.ts                # Path utilities
├── agentSettings.ts        # Agent settings management
└── claudeMdTemplates.ts    # CLAUDE.md templates
```

### Middleware

```
src/middleware/
└── auth.ts                 # Authentication middleware
```

---

## Utility Functions

### Path Utilities (src/utils/paths.ts)

```typescript
// Generate agent workspace path
export function agentWorkspacePath(
  basePath: string,
  projectName: string,
  agentName: string
): string {
  const projectSlug = slugify(projectName)
  const agentSlug = slugify(agentName)
  return path.join(basePath, projectSlug, 'agents', agentSlug)
}

// Generate environment agent path
export function envAgentPath(
  basePath: string,
  projectName: string,
  envName: string
): string {
  return path.join(basePath, slugify(projectName), envName, 'agent-coder')
}

// Slugify string
export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
```

### Agent Settings Utilities (src/utils/agentSettings.ts)

```typescript
// Update agent settings with additional directories
export function updateAgentSettings(
  workspacePath: string,
  additionalDirs: string[]
): void {
  const settingsPath = path.join(workspacePath, '.claude', 'settings.local.json')
  let settings = readJsonSafe(settingsPath) || { permissions: { additionalDirectories: [] } }

  if (!settings.permissions) {
    settings.permissions = {}
  }
  if (!settings.permissions.additionalDirectories) {
    settings.permissions.additionalDirectories = []
  }

  for (const dir of additionalDirs) {
    if (!settings.permissions.additionalDirectories.includes(dir)) {
      settings.permissions.additionalDirectories.push(dir)
    }
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
}

// Rebuild agent settings with new directories
export function rebuildAgentSettings(
  workspacePath: string,
  additionalDirs: string[]
): void {
  const settingsPath = path.join(workspacePath, '.claude', 'settings.local.json')
  let settings = readJsonSafe(settingsPath) || { permissions: {} }

  settings.permissions = settings.permissions || {}
  settings.permissions.additionalDirectories = additionalDirs

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
}
```

### CLAUDE.md Templates (src/utils/claudeMdTemplates.ts)

```typescript
export const AGENT_TEMPLATES = [
  {
    id: 'generic',
    label: 'Generic Agent',
    description: 'A versatile agent for general tasks',
    template: (params: TemplateParams) => `# ${params.agentName}\n\n...`
  },
  {
    id: 'frontend',
    label: 'Frontend Specialist',
    description: 'Specialized in frontend development',
    template: (params: TemplateParams) => `# ${params.agentName}\n\n...`
  },
  // ... more templates
]

export function renderTemplate(
  template: AgentTemplate,
  params: TemplateParams
): string {
  return template.template(params)
}
```

---

## Route Handler Patterns

### CRUD Operations

#### Create (POST)

```typescript
router.post('/', authenticateToken, (req, res) => {
  try {
    const { name, description } = req.body

    // Validate
    if (!name) {
      return res.status(400).json({ data: null, error: 'name is required' })
    }

    // Create
    const id = uuid()
    db.prepare('INSERT INTO items (id, name, description) VALUES (?, ?, ?)')
      .run(id, name, description ?? null)

    // Return created
    const created = db.prepare('SELECT * FROM items WHERE id = ?').get(id)
    return res.status(201).json({ data: created, error: null })
  } catch (err: any) {
    console.error('Error creating item:', err)
    return res.status(500).json({ data: null, error: 'Failed to create item' })
  }
})
```

#### Read (GET)

```typescript
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id)

    if (!item) {
      return res.status(404).json({ data: null, error: 'Not found' })
    }

    return res.json({ data: item, error: null })
  } catch (err: any) {
    console.error('Error fetching item:', err)
    return res.status(500).json({ data: null, error: 'Failed to fetch item' })
  }
})
```

#### Update (PUT)

```typescript
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { name, description } = req.body

    // Check existence
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id)
    if (!item) {
      return res.status(404).json({ data: null, error: 'Not found' })
    }

    // Update
    db.prepare(`
      UPDATE items SET
        name = COALESCE(?, name),
        description = COALESCE(?, description)
      WHERE id = ?
    `).run(name, description, req.params.id)

    // Return updated
    const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id)
    return res.json({ data: updated, error: null })
  } catch (err: any) {
    console.error('Error updating item:', err)
    return res.status(500).json({ data: null, error: 'Failed to update item' })
  }
})
```

#### Delete (DELETE)

```typescript
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    // Check existence
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id)
    if (!item) {
      return res.status(404).json({ data: null, error: 'Not found' })
    }

    // Delete
    db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id)

    return res.json({ data: { deleted: true }, error: null })
  } catch (err: any) {
    console.error('Error deleting item:', err)
    return res.status(500).json({ data: null, error: 'Failed to delete item' })
  }
})
```

---

## Database Operations

### Query Patterns

#### Single Record

```typescript
const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id)
```

#### Multiple Records

```typescript
const items = db.prepare('SELECT * FROM items WHERE project_id = ?').all(projectId)
```

#### Insert

```typescript
db.prepare('INSERT INTO items (id, name) VALUES (?, ?)').run(id, name)
```

#### Update

```typescript
db.prepare('UPDATE items SET name = ? WHERE id = ?').run(name, id)
```

#### Delete

```typescript
db.prepare('DELETE FROM items WHERE id = ?').run(id)
```

#### Transactions

```typescript
const insertMany = db.transaction((items: any[]) => {
  for (const item of items) {
    db.prepare('INSERT INTO items (name) VALUES (?)').run(item.name)
  }
})

insertMany(itemsArray)
```

### JSON Handling

#### Parse JSON from Database

```typescript
function parsePlan(row: any) {
  return {
    ...row,
    tasks: typeof row.tasks === 'string' ? JSON.parse(row.tasks) : row.tasks
  }
}

const plans = db.prepare('SELECT * FROM plans').all()
const parsedPlans = plans.map(parsePlan)
```

#### Store JSON in Database

```typescript
const tasksJson = JSON.stringify(tasks)
db.prepare('INSERT INTO plans (id, tasks) VALUES (?, ?)').run(id, tasksJson)
```

---

## File System Operations

### Safe File Reading

```typescript
function readFileSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

function readJsonSafe(filePath: string): any {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}
```

### Safe Directory Creation

```typescript
const dirPath = path.join(workspacePath, '.claude', 'skills')
fs.mkdirSync(dirPath, { recursive: true })
```

### Safe File Writing

```typescript
try {
  fs.writeFileSync(filePath, content, 'utf-8')
  return res.json({ data: { saved: true }, error: null })
} catch (err: any) {
  return res.status(500).json({ data: null, error: 'Failed to write file' })
}
```

---

## External API Integration

### GitHub API (marketplace.ts)

```typescript
// Search repositories
const response = await fetch(
  `https://api.github.com/search/repositories?q=${searchQuery}&sort=stars&per_page=20&page=${pageNum}`,
  {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'weave'
    },
    signal: AbortSignal.timeout(5000)
  }
)

if (response.ok) {
  const data = await response.json()
  // Process data
}
```

### SkillsMP.com (marketplace.ts)

```typescript
// Search skills
const response = await fetch(
  `https://skillsmp.com/api/skills?q=${encodeURIComponent(q)}&limit=50&offset=${(page-1)*50}`,
  {
    headers: {
      'User-Agent': 'weave/1.0',
      'Accept': 'application/json'
    },
    signal: AbortSignal.timeout(5000)
  }
)
```

### Error Handling

```typescript
try {
  const response = await fetch(url, options)
  if (response.ok) {
    const data = await response.json()
    return res.json({ data, error: null })
  }
} catch (err) {
  console.warn('External API failed:', err)
  // Continue with fallback or return error
}
```

---

## Special Features

### Workspace ID Encoding

Workspace IDs are base64url-encoded file paths:

```typescript
const id = Buffer.from(fullPath).toString('base64url')

// Decoding (if needed)
const path = Buffer.from(id, 'base64url').toString('utf-8')
```

### Dynamic JSON Updates

```typescript
// Parse existing settings
let settings = {}
try {
  settings = JSON.parse(project.settings || '{}')
} catch {}

// Merge with new settings
const newSettings = settings ? { ...settings, ...settingsUpdate } : settings

// Save back
db.prepare('UPDATE projects SET settings = ? WHERE id = ?')
  .run(JSON.stringify(newSettings), id)
```

### Conditional Updates

```typescript
db.prepare(`
  UPDATE items SET
    name = COALESCE(?, name),
    description = COALESCE(?, description),
    value = COALESCE(?, value)
  WHERE id = ?
`).run(name, description, value, id)
```

---

## Performance Considerations

### Database Indexing

Important fields should be indexed:

```sql
-- Create index (manual)
CREATE INDEX idx_plans_created_at ON plans(created_at DESC);
CREATE INDEX idx_plans_project_id ON plans(project_id);
```

### Query Optimization

```typescript
// Use specific fields instead of SELECT *
const item = db.prepare('SELECT id, name, status FROM items WHERE id = ?').get(id)

// Use LIMIT for large result sets
const items = db.prepare('SELECT * FROM items LIMIT 100').all()

// Use prepared statements for repeated queries
const stmt = db.prepare('SELECT * FROM items WHERE project_id = ?')
const items = stmt.all(projectId)
```

### Connection Pooling

better-sqlite3 is synchronous, so no connection pooling is needed. However, consider using WAL mode for better concurrency:

```typescript
db.pragma('journal_mode = WAL')
```

---

## Security Considerations

### SQL Injection Prevention

**Always use parameterized queries:**

```typescript
// ❌ BAD - SQL injection vulnerability
const item = db.prepare(`SELECT * FROM items WHERE id = '${id}'`).get()

// ✅ GOOD - Parameterized query
const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id)
```

### Path Traversal Prevention

```typescript
import path from 'path'

// Validate and sanitize paths
const safePath = path.normalize(userPath)
if (!safePath.startsWith(basePath)) {
  return res.status(400).json({ data: null, error: 'Invalid path' })
}
```

### Input Validation

```typescript
// Validate required fields
if (!name || typeof name !== 'string') {
  return res.status(400).json({ data: null, error: 'name is required and must be a string' })
}

// Validate field formats
if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
  return res.status(400).json({
    data: null,
    error: 'name must be alphanumeric (hyphens and underscores allowed)'
  })
}

// Validate against allowed values
const validRoles = ['planner', 'coder', 'reviewer', 'tester', 'debugger', 'devops', 'generic']
if (!validRoles.includes(role)) {
  return res.status(400).json({
    data: null,
    error: `role must be one of: ${validRoles.join(', ')}`
  })
}
```

### Authentication

```typescript
// Always use authentication middleware for protected routes
router.post('/sensitive', authenticateToken, (req, res) => {
  // Sensitive operation
})
```

### File System Security

```typescript
// Validate file paths are within allowed directories
const fullPath = path.join(basePath, userPath)
const normalizedPath = path.normalize(fullPath)
if (!normalizedPath.startsWith(basePath)) {
  return res.status(403).json({ data: null, error: 'Access denied' })
}
```

---

## Testing

### Manual Testing

```bash
# Health check
curl http://localhost:3000/api/health

# With authentication
curl -H "Authorization: Bearer dev-token-change-in-production" \
  http://localhost:3000/api/plans

# Create plan
curl -X POST http://localhost:3000/api/plans \
  -H "Authorization: Bearer dev-token-change-in-production" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Plan","tasks":[],"project_id":"uuid"}'
```

### Test Scripts

```bash
# Run plan tests
npm test -- plans.test.ts

# Run kanban tests
npm test -- kanban.test.ts
```

---

## PUT_WORKSPACE Implementation

The `PUT /api/workspaces/:id` endpoint allows updating multiple workspace properties in a single request.

### Features

1. **Role Update**
   - Validates against allowed roles
   - Persists to `workspace_roles` table

2. **Model Update**
   - Validates against allowed models
   - Updates `settings.local.json`
   - Persists to `workspace_models` table

### Implementation Details

```typescript
router.put('/:id', authenticateToken, (req, res) => {
  const { model, role } = req.body
  const updates: any = {}

  // Update role if provided
  if (role !== undefined && role !== null) {
    const validRoles = ['planner', 'coder', 'reviewer', 'tester', 'debugger', 'devops', 'generic']
    if (!validRoles.includes(role)) {
      return res.status(400).json({ data: null, error: `role must be one of: ${validRoles.join(', ')}` })
    }

    db.prepare(
      'INSERT OR REPLACE INTO workspace_roles (workspace_path, role) VALUES (?, ?)'
    ).run(workspace.path, role)

    updates.role = role
  }

  // Update model if provided
  if (model !== undefined && model !== null) {
    const validModels = ['default', 'claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001']
    if (!validModels.includes(model)) {
      return res.status(400).json({ data: null, error: `model must be one of: ${validModels.join(', ')}` })
    }

    // Update settings.local.json
    const settingsPath = path.join(workspace.path, '.claude', 'settings.local.json')
    let settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))

    if (!settings.env) {
      settings.env = {}
    }

    if (model && model !== 'default') {
      settings.env.ANTHROPIC_MODEL = model
    } else {
      delete settings.env.ANTHROPIC_MODEL
    }

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))

    // Store in database
    db.prepare(
      'INSERT OR REPLACE INTO workspace_models (workspace_path, model) VALUES (?, ?)'
    ).run(workspace.path, model)

    updates.model = model
  }

  return res.json({
    data: {
      id: id,
      workspace_path: workspace.path,
      role: roleRow?.role ?? 'coder',
      model: modelRow?.model ?? '',
      ...updates
    },
    error: null
  })
})
```

### Examples

```bash
# Update only role
curl -X PUT "http://localhost:3000/api/workspaces/<id>" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"role": "reviewer"}'

# Update only model
curl -X PUT "http://localhost:3000/api/workspaces/<id>" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-sonnet-4-6"}'

# Update both
curl -X PUT "http://localhost:3000/api/workspaces/<id>" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"role": "reviewer", "model": "claude-sonnet-4-6"}'
```

---

## Daemon Process Management

The daemon management endpoint handles Python daemon process lifecycle.

### Status Detection

```typescript
function getDaemonStatus(): 'running' | 'stopped' {
  // Check daemonProcess
  if (daemonProcess && daemonProcess.exitCode === null) {
    try {
      process.kill(daemonProcess.pid!, 0) // Signal 0 checks existence
      return 'running'
    } catch (err) {
      return 'stopped'
    }
  }

  // Fallback to PID file
  try {
    if (fs.existsSync(PID_FILE)) {
      const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim())
      process.kill(pid, 0)
      return 'running'
    }
  } catch (err) {
    // Clean up orphaned PID file
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE)
    }
    return 'stopped'
  }

  return 'stopped'
}
```

### Process Spawning

```typescript
daemonProcess = spawn(PYTHON, ['main.py', '--daemon'], {
  cwd: CLIENT_DIR,
  env: {
    ...process.env,
    WEAVE_URL: apiUrl,
    WEAVE_TOKEN: token,
  },
})

// Write PID file
fs.writeFileSync(PID_FILE, String(daemonProcess.pid!), 'utf-8')
```

---

For endpoint documentation, see [ENDPOINTS.md](./ENDPOINTS.md).
For architecture information, see [ARCHITECTURE.md](./ARCHITECTURE.md).
For testing information, see [TESTING.md](./TESTING.md).
