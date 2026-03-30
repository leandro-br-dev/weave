import express from 'express'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router()

// Get Cloudflare tunnel configuration
router.get('/tunnel', authenticateToken, (req, res) => {
  const enabled = process.env.CLOUDFLARE_TUNNEL_ENABLED === 'true'
  const subdomain = process.env.CLOUDFLARE_TUNNEL_SUBDOMAIN || 'weave'
  const domain = process.env.CLOUDFLARE_TUNNEL_DOMAIN || ''
  const fullDomain = process.env.CLOUDFLARE_FULL_DOMAIN || `${subdomain}.${domain}`

  res.json({
    enabled,
    subdomain,
    domain,
    fullDomain: enabled && domain ? fullDomain : undefined,
  })
})

// Toggle Cloudflare tunnel (requires restart to take effect)
router.post('/tunnel', authenticateToken, (req, res) => {
  const { enabled } = req.body

  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled must be a boolean' })
  }

  // This would need to update the .env file and trigger a restart
  // For now, we'll just return a message
  res.json({
    message: 'To enable/disable the tunnel, update CLOUDFLARE_TUNNEL_ENABLED in .env and restart',
    enabled,
    instructions: [
      '1. Edit the .env file in your project root',
      '2. Set CLOUDFLARE_TUNNEL_ENABLED=true or false',
      '3. Restart the application: bash start.sh'
    ]
  })
})

export default router
