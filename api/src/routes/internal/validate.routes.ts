import { Router, Request, Response } from 'express'
import { ZodError } from 'zod'
import {
  planSchema,
  teamSchema,
  teamTemplateSchema,
  teamImprovementSchema,
  agentClaudeMdSchema,
  agentSettingsSchema,
  agentUpdateSchema,
  agentImprovementSchema,
} from './validation.schemas.js'
import { requireLocalhost } from '../../middleware/auth.js'

const router = Router()

// ───────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────

/**
 * Formats Zod validation errors into clear, LLM-readable plain-text.
 *
 * Example output:
 * ```
 * 2 erros de validação encontrados:
 *
 * 1. Campo 'name': é obrigatório e não pode ser vazio.
 * 2. Campo 'tasks[0].id': é obrigatório e não pode ser vazio.
 * ```
 */
function formatZodErrors(error: ZodError): string {
  const issues = error.issues
  const lines: string[] = []

  if (issues.length === 1) {
    lines.push(`1 erro de validação encontrado:`)
  } else {
    lines.push(`${issues.length} erros de validação encontrados:`)
  }
  lines.push('')

  issues.forEach((issue, idx) => {
    // Build a human-readable field path from Zod's issue.path
    const fieldPath = issue.path
      .map((segment) => (typeof segment === 'number' ? `[${segment}]` : segment))
      .join('.')

    lines.push(`${idx + 1}. Campo '${fieldPath}': ${issue.message}`)
  })

  return lines.join('\n')
}

// ───────────────────────────────────────────────────────────
// POST /internal/validate/plan
// ───────────────────────────────────────────────────────────

router.post('/plan', (req: Request, res: Response) => {
  try {
    const result = planSchema.safeParse(req.body)

    if (!result.success) {
      return res
        .status(400)
        .type('text/plain; charset=utf-8')
        .send(formatZodErrors(result.error))
    }

    return res.status(200).json({ status: 'ok' })
  } catch (err) {
    console.error('[internal/validate/plan] Unexpected error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ───────────────────────────────────────────────────────────
// POST /internal/validate/team
// ───────────────────────────────────────────────────────────

router.post('/team', (req: Request, res: Response) => {
  try {
    // Accept both a simple team update and a full team template payload.
    // Try the simpler team schema first; fall back to teamTemplateSchema
    // when it has fields like 'label', 'subAgents', or 'claudeMd'.
    const isTemplatePayload =
      'label' in req.body || 'subAgents' in req.body || 'claudeMd' in req.body

    const result = isTemplatePayload
      ? teamTemplateSchema.safeParse(req.body)
      : teamSchema.safeParse(req.body)

    if (!result.success) {
      return res
        .status(400)
        .type('text/plain; charset=utf-8')
        .send(formatZodErrors(result.error))
    }

    return res.status(200).json({ status: 'ok' })
  } catch (err) {
    console.error('[internal/validate/team] Unexpected error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ───────────────────────────────────────────────────────────
// POST /internal/validate/agent
// ───────────────────────────────────────────────────────────

router.post('/agent', (req: Request, res: Response) => {
  try {
    // Detect payload type by keys and validate against the appropriate schema.
    // This avoids z.union's poor error messages.
    let result

    if ('agentContent' in req.body) {
      result = agentImprovementSchema.safeParse(req.body)
    } else if ('settings' in req.body) {
      result = agentSettingsSchema.safeParse(req.body)
    } else if ('model' in req.body || 'role' in req.body) {
      result = agentUpdateSchema.safeParse(req.body)
    } else {
      result = agentClaudeMdSchema.safeParse(req.body)
    }

    if (!result.success) {
      return res
        .status(400)
        .type('text/plain; charset=utf-8')
        .send(formatZodErrors(result.error))
    }

    return res.status(200).json({ status: 'ok' })
  } catch (err) {
    console.error('[internal/validate/agent] Unexpected error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ───────────────────────────────────────────────────────────
// POST /internal/validate/team-improvement
// ───────────────────────────────────────────────────────────

router.post('/team-improvement', (req: Request, res: Response) => {
  try {
    const result = teamImprovementSchema.safeParse(req.body)

    if (!result.success) {
      return res
        .status(400)
        .type('text/plain; charset=utf-8')
        .send(formatZodErrors(result.error))
    }

    return res.status(200).json({ status: 'ok' })
  } catch (err) {
    console.error('[internal/validate/team-improvement] Unexpected error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
