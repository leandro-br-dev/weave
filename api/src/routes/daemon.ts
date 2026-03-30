import { Router } from 'express'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { authenticateToken } from '../middleware/auth'
import fs from 'fs'

const router = Router()

// Estado global do processo daemon
let daemonProcess: ChildProcess | null = null
let daemonLogs: string[] = []
const MAX_LOGS = 200
const PID_FILE = '/tmp/weave-daemon.pid'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CLIENT_DIR = path.join(__dirname, '../../..', 'client')
const PYTHON = path.join(CLIENT_DIR, 'venv', 'bin', 'python')
const MAIN = path.join(CLIENT_DIR, 'main.py')

function getDaemonStatus(): 'running' | 'stopped' {
  // First check if daemonProcess is set (current behavior)
  if (daemonProcess && daemonProcess.exitCode === null) {
    try {
      process.kill(daemonProcess.pid!, 0) // Signal 0 just checks existence
      return 'running'
    } catch (err) {
      // Process died or doesn't exist
      daemonLogs.push(`[status] Daemon process check failed: ${err}`)
      return 'stopped'
    }
  }

  // If daemonProcess is not set, check the PID file
  try {
    if (fs.existsSync(PID_FILE)) {
      const pidContent = fs.readFileSync(PID_FILE, 'utf-8').trim()
      const pid = parseInt(pidContent, 10)

      if (!isNaN(pid) && pid > 0) {
        // Verify the process is running using process.kill(pid, 0)
        // Signal 0 only checks if process exists, does NOT kill it
        process.kill(pid, 0)
        daemonLogs.push(`[status] Daemon running via PID file: ${pid}`)
        return 'running'
      }
    }
  } catch (err) {
    // PID file doesn't exist, can't be read, or process is not running
    daemonLogs.push(`[status] PID file check failed: ${err}`)
    // Clean up orphaned PID file
    try {
      if (fs.existsSync(PID_FILE)) {
        fs.unlinkSync(PID_FILE)
        daemonLogs.push(`[status] Cleaned up orphaned PID file`)
      }
    } catch {
      // Ignore cleanup errors
    }
    return 'stopped'
  }

  return 'stopped'
}

// GET /api/daemon/status
router.get('/status', authenticateToken, (req, res) => {
  const status = getDaemonStatus()
  let pid: number | null = null

  if (status === 'running') {
    // Try to get PID from daemonProcess first
    if (daemonProcess?.pid) {
      pid = daemonProcess.pid
    } else {
      // Fallback to reading from PID file
      try {
        if (fs.existsSync(PID_FILE)) {
          const pidContent = fs.readFileSync(PID_FILE, 'utf-8').trim()
          const parsedPid = parseInt(pidContent, 10)
          if (!isNaN(parsedPid)) {
            pid = parsedPid
          }
        }
      } catch {
        // PID file doesn't exist or can't be read
        pid = null
      }
    }
  }

  return res.json({
    data: {
      status,
      pid,
      logs: daemonLogs.slice(-50),
    },
    error: null,
  })
})

// POST /api/daemon/start
router.post('/start', authenticateToken, (req, res) => {
  if (getDaemonStatus() === 'running') {
    return res.status(409).json({ data: null, error: 'Daemon is already running' })
  }

  const token = process.env.API_BEARER_TOKEN || process.env.WEAVE_TOKEN || 'dev-token-change-in-production'
  const apiUrl = `http://localhost:${process.env.PORT ?? 3000}`

  daemonLogs = []
  daemonProcess = spawn(PYTHON, ['main.py', '--daemon'], {
    cwd: CLIENT_DIR,
    env: {
      ...process.env,
      WEAVE_URL: apiUrl,
      WEAVE_TOKEN: token,
    },
  })

  daemonProcess.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean)
    daemonLogs.push(...lines)
    if (daemonLogs.length > MAX_LOGS) daemonLogs = daemonLogs.slice(-MAX_LOGS)
  })

  daemonProcess.stderr?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean)
    daemonLogs.push(...lines.map(l => `[stderr] ${l}`))
    if (daemonLogs.length > MAX_LOGS) daemonLogs = daemonLogs.slice(-MAX_LOGS)
  })

  daemonProcess.on('exit', (code) => {
    daemonLogs.push(`[daemon] Process exited with code ${code}`)
    // Clean up PID file when process exits
    try {
      if (fs.existsSync(PID_FILE)) {
        fs.unlinkSync(PID_FILE)
      }
    } catch {
      // Ignore cleanup errors
    }
  })

  // Write PID file for status detection across API restarts
  try {
    fs.writeFileSync(PID_FILE, String(daemonProcess.pid!), 'utf-8')
  } catch (error) {
    daemonLogs.push(`[daemon] Warning: Failed to write PID file: ${error}`)
  }

  return res.json({ data: { started: true, pid: daemonProcess.pid }, error: null })
})

// POST /api/daemon/stop
router.post('/stop', authenticateToken, (req, res) => {
  daemonLogs.push(`[stop] Stop endpoint called`)

  if (getDaemonStatus() !== 'running') {
    daemonLogs.push(`[stop] Daemon not running, ignoring stop request`)
    return res.status(409).json({ data: null, error: 'Daemon is not running' })
  }

  // Try to kill daemonProcess if it exists
  if (daemonProcess) {
    daemonLogs.push(`[stop] Killing daemon process ${daemonProcess.pid} via daemonProcess.kill()`)
    daemonProcess.kill('SIGTERM')
  } else {
    // If daemonProcess is null, try to read PID from file and kill that process
    try {
      if (fs.existsSync(PID_FILE)) {
        const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim())
        daemonLogs.push(`[stop] Killing daemon process ${pid} via process.kill()`)
        process.kill(pid, 'SIGTERM')
      }
    } catch (error) {
      daemonLogs.push(`[stop] Failed to kill daemon: ${error}`)
      return res.status(500).json({ data: null, error: 'Failed to stop daemon process' })
    }
  }

  // Remove PID file when daemon is stopped via API
  try {
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE)
      daemonLogs.push(`[stop] Removed PID file`)
    }
  } catch {
    // Ignore cleanup errors
  }

  daemonLogs.push(`[stop] Daemon stop command sent successfully`)
  return res.json({ data: { stopped: true }, error: null })
})

export default router
