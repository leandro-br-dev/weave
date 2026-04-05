/**
 * Native Agents Loader
 *
 * Reads native-agent definition files from /native-agents/{teamType}/,
 * parses their YAML frontmatter, and provides the structured data needed
 * to seed the `team_native_agents` table when a team is bootstrapped.
 *
 * Each `.md` file has the shape:
 *   ---
 *   name: staging-build-validator
 *   description: "..."
 *   model: haiku | sonnet | opus
 *   tools: Read, Write, ...
 *   color: red
 *   ---
 *   # Markdown body (used as system_prompt)
 */

import fs from 'fs'
import path from 'path'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface NativeAgentDefinition {
  /** Slug from frontmatter, e.g. "staging-build-validator" */
  name: string
  /** Human-readable description from frontmatter */
  description: string
  /** Raw model token from frontmatter: "haiku" | "sonnet" | "opus" */
  model: string
  /** Comma-separated tool list from frontmatter */
  tools: string
  /** Color tag from frontmatter */
  color: string
  /** The team type directory this was loaded from: "plan" | "dev" | "staging" */
  teamType: string
  /** The filename without extension, e.g. "build-validator" */
  slug: string
  /** Full markdown body (everything after frontmatter) — used as system_prompt */
  systemPrompt: string
  /** Absolute path to the source `.md` file */
  sourcePath: string
}

// ---------------------------------------------------------------------------
// Model resolution
// ---------------------------------------------------------------------------

/**
 * Maps the short frontmatter model token to a Claude model identifier.
 *
 * Cost-optimised defaults:
 *  - haiku → claude-haiku-4-5-20251001
 *  - sonnet → claude-sonnet-4-6
 *  - opus → claude-opus-4-0
 */
const MODEL_MAP: Record<string, string> = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-0',
}

/**
 * Resolve a frontmatter model token to a full Claude model identifier.
 * Falls back to haiku (cheapest) when the token is unrecognised.
 */
export function resolveModelName(raw: string): string {
  return MODEL_MAP[raw.trim().toLowerCase()] ?? 'claude-haiku-4-5-20251001'
}

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the absolute path to the `/native-agents/` directory at the
 * repository root.  Works whether the code is running from `src/` (ts-node /
 * tsx) or from `dist/` (compiled JS).
 */
function getNativeAgentsDir(): string {
  // Current file location: api/src/utils/nativeAgentsLoader.ts
  // Compiled location: api/dist/utils/nativeAgentsLoader.js
  // Repository root: dev/ → one level up from api/
  const currentFile = new URL(import.meta.url).pathname
  // Go up 3 levels from utils → src → api → dev
  return path.join(path.dirname(path.dirname(path.dirname(path.dirname(currentFile)))), 'native-agents')
}

// ---------------------------------------------------------------------------
// Frontmatter parser
// ---------------------------------------------------------------------------

interface ParsedFrontmatter {
  name: string
  description: string
  model: string
  tools: string
  color: string
  bodyStartIndex: number
}

/**
 * Minimal YAML-like frontmatter parser.  Only handles the flat key: value
 * pairs that native-agent files use.  Returns `null` when no frontmatter
 * block is found.
 */
function parseFrontmatter(content: string): ParsedFrontmatter | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/)
  if (!match) return null

  const fields: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const value = line.slice(colonIdx + 1).trim()
    // Strip surrounding quotes
    fields[key] = value.replace(/^["']|["']$/g, '')
  }

  return {
    name: fields.name ?? '',
    description: fields.description ?? '',
    model: fields.model ?? 'haiku',
    tools: fields.tools ?? '',
    color: fields.color ?? 'blue',
    bodyStartIndex: match[0].length,
  }
}

// ---------------------------------------------------------------------------
// Core loader
// ---------------------------------------------------------------------------

/**
 * Load all native-agent `.md` definitions for a given team type.
 *
 * @param teamType  One of `"plan"`, `"dev"`, or `"staging"`.
 * @returns         Array of parsed agent definitions, sorted by filename.
 * @throws          If the directory does not exist.
 */
export function loadNativeAgents(teamType: string): NativeAgentDefinition[] {
  const baseDir = getNativeAgentsDir()
  const typeDir = path.join(baseDir, teamType)

  if (!fs.existsSync(typeDir)) {
    return []
  }

  const files = fs
    .readdirSync(typeDir)
    .filter((f) => f.endsWith('.md'))
    .sort()

  const agents: NativeAgentDefinition[] = []

  for (const file of files) {
    const filePath = path.join(typeDir, file)
    const content = fs.readFileSync(filePath, 'utf-8')
    const frontmatter = parseFrontmatter(content)

    if (!frontmatter) {
      console.warn(`[nativeAgentsLoader] Skipping ${filePath}: no frontmatter found`)
      continue
    }

    const slug = file.replace(/\.md$/, '')

    agents.push({
      name: frontmatter.name || `${teamType}-${slug}`,
      description: frontmatter.description,
      model: frontmatter.model,
      tools: frontmatter.tools,
      color: frontmatter.color,
      teamType,
      slug,
      systemPrompt: content.slice(frontmatter.bodyStartIndex).trim(),
      sourcePath: filePath,
    })
  }

  return agents
}

/**
 * Load native agents for all team types at once.
 */
export function loadAllNativeAgents(): Record<string, NativeAgentDefinition[]> {
  return {
    plan: loadNativeAgents('plan'),
    dev: loadNativeAgents('dev'),
    staging: loadNativeAgents('staging'),
  }
}

/**
 * Map environment name → native-agents directory name.
 *   "plan" → "plan"
 *   "dev"  → "dev"
 *   "staging" → "staging"
 *   anything else → "dev"
 */
export function teamTypeForEnv(envName: string): string {
  const n = envName.toLowerCase().trim()
  if (n === 'plan' || n === 'staging') return n
  return 'dev'
}
