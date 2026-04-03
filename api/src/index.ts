import dotenv from 'dotenv'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables from multiple .env files
dotenv.config({ path: path.join(__dirname, '../../.env') })  // Root .env with APP_ENV
dotenv.config()  // API specific .env (will override root values if needed)
import cors from 'cors'
import { authenticateToken } from './middleware/auth.js'
import authRouter from './routes/auth.js'
import { getUserCount } from './services/userService.js'
import plansRouter, { recoverStuckPlans } from './routes/plans.js'
import teamsRouter from './routes/teams.js'
import approvalsRouter from './routes/approvals.js'
import daemonRouter from './routes/daemon.js'
import projectsRouter from './routes/projects.js'
import nativeSkillsRouter from './routes/nativeSkills.js'
import quickActionsRouter from './routes/quickActions.js'
import chatSessionsRouter from './routes/chatSessions.js'
import kanbanRouter from './routes/kanban.js'
import marketplaceRouter from './routes/marketplace.js'
import templatesRouter from './routes/templates.js'
import environmentVariablesRouter from './routes/environmentVariables.js'
import cloudflareRouter from './routes/cloudflare.js'
import backupRouter from './routes/backup.js'
import uploadsRouter from './routes/uploads.js'
import { db } from './db/index.js'

const app = express()

// Trust proxy headers when behind cloudflared or other reverse proxies.
// Without this, req.ip returns the proxy's IP instead of the real client IP,
// and CORS errors from rejected origins get swallowed as generic 500 errors.
app.set('trust proxy', true)

const PORT = process.env.PORT || 3000

// Recover stuck plans on startup
recoverStuckPlans(db)

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sem origin (curl, Postman, daemon, server-side)
    if (!origin) return callback(null, true)
    // Permitir qualquer localhost independente da porta (http e https)
    if (origin.match(/^https?:\/\/localhost:\d+$/)) {
      return callback(null, true)
    }
    // Em produção, adicionar domínios permitidos via env var
    const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean)
    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }
    // Allow the cloudflare tunnel domain if configured
    const cfDomain = process.env.CLOUDFLARE_FULL_DOMAIN
    if (cfDomain && origin === `https://${cfDomain}`) {
      return callback(null, true)
    }
    callback(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// Health check endpoint (no auth required)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Weave API is running' })
})

// Auth routes (public — no global auth middleware)
app.use('/api/auth', authRouter)

// Block all protected API routes until initial user setup is complete
app.use('/api', (req, res, next) => {
  // Skip auth routes, health check
  if (req.path.startsWith('/auth') || req.path === '/health') return next()
  const userCount = getUserCount()
  if (userCount === 0) {
    return res.status(403).json({ error: 'Initial setup required. Please create the first user.', code: 'SETUP_REQUIRED' })
  }
  next()
})

// Protected routes
app.get('/api/agents', authenticateToken, (req, res) => {
  res.json({ agents: [] })
})

app.get('/api/workflows', authenticateToken, (req, res) => {
  res.json({ workflows: [] })
})

app.get('/api/executions', authenticateToken, (req, res) => {
  res.json({ executions: [] })
})

// Plans routes
app.use('/api/plans', plansRouter)

// Teams routes
app.use('/api/teams', teamsRouter)

// Approvals routes
app.use('/api/approvals', approvalsRouter)

// Daemon routes
app.use('/api/daemon', daemonRouter)

// Projects routes
app.use('/api/projects', projectsRouter)

// Native skills routes
app.use('/api/native-skills', nativeSkillsRouter)

// Quick actions routes
app.use('/api/quick-actions', quickActionsRouter)

// Chat sessions routes
app.use('/api/sessions', chatSessionsRouter)

// Kanban routes
app.use('/api/kanban', kanbanRouter)

// Marketplace routes
app.use('/api/marketplace', marketplaceRouter)

// Templates routes
app.use('/api/templates', templatesRouter)

// Environment variables routes
app.use('/api/environment-variables', environmentVariablesRouter)

// Cloudflare routes
app.use('/api/cloudflare', cloudflareRouter)

// Backup routes
app.use('/api/backup', backupRouter)

// Upload routes
app.use('/api/uploads', uploadsRouter)

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Something went wrong!' })
})

const server = app.listen(PORT, () => {
  console.log(`[api] Server running on port ${PORT}`)
  recoverStuckPlans(db)
})

// Run approval timeout check every minute
setInterval(() => {
  const timeoutMinutes = Number(process.env.APPROVAL_TIMEOUT_MINUTES ?? 10)
  const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString()
  const result = db.prepare(`
    UPDATE approvals SET status = 'timeout', responded_at = datetime('now')
    WHERE status = 'pending' AND created_at < ?
  `).run(cutoff)
  if (result.changes > 0) {
    console.log(`[approvals] Timed out ${result.changes} pending approval(s)`)
  }
}, 60_000)

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[api] Port ${PORT} is already in use.`)
    console.error(`[api] Run: pkill -f 'tsx.*index.ts' to kill existing process`)
    process.exit(1)
  } else {
    throw err
  }
})
