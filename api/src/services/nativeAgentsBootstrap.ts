/**
 * Native Agents Bootstrap Service
 *
 * After a team workspace is created (via environmentTeamBootstrap or the
 * default-agents route), this service reads the corresponding native-agent
 * `.md` files from /native-agents/{teamType}/ and persists each one as a
 * row in the `team_native_agents` table.
 *
 * The system_prompt column stores the full markdown body (everything after
 * frontmatter), and the model column stores the resolved Claude model
 * identifier (e.g. `claude-haiku-4-5-20251001`).
 *
 * This is idempotent: running it multiple times for the same workspace_path
 * will INSERT OR REPLACE existing rows (keyed on workspace_path + slug).
 */

import { v4 as uuid } from 'uuid'
import { db } from '../db/index.js'
import {
  loadNativeAgents,
  resolveModelName,
  teamTypeForEnv,
  type NativeAgentDefinition,
} from '../utils/nativeAgentsLoader.js'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SeededNativeAgent {
  id: string
  slug: string
  name: string
  model: string
  tools: string
  color: string
}

export interface SeedResult {
  /** Number of native agents that were persisted (or updated). */
  seeded: number
  /** The agents that were seeded. */
  agents: SeededNativeAgent[]
}

// ---------------------------------------------------------------------------
// Core seed function
// ---------------------------------------------------------------------------

/**
 * Read native-agent `.md` files for the given team type and persist them
 * into `team_native_agents`, linked to the specified team workspace.
 *
 * @param teamWorkspacePath  The absolute path of the team workspace that
 *                           was just created (e.g. `~/.local/.../myproject/dev/team-coder`).
 * @param envName            The environment name used to resolve the team type
 *                           (`plan` → plan, `staging` → staging, anything else → dev).
 * @returns                  Summary of how many agents were seeded and their identifiers.
 */
export function seedNativeAgentsForTeam(
  teamWorkspacePath: string,
  envName: string,
): SeedResult {
  const teamType = teamTypeForEnv(envName)
  const definitions = loadNativeAgents(teamType)

  if (definitions.length === 0) {
    return { seeded: 0, agents: [] }
  }

  const seeded: SeededNativeAgent[] = []

  const insertAgents = db.transaction(() => {
    for (const def of definitions) {
      const id = uuid()
      const resolvedModel = resolveModelName(def.model)

      db.prepare(`
        INSERT INTO team_native_agents (
          id, team_workspace_path, slug, name, description,
          model, tools, color, system_prompt, team_type, source_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(team_workspace_path, slug) DO UPDATE SET
          name        = excluded.name,
          description = excluded.description,
          model       = excluded.model,
          tools       = excluded.tools,
          color       = excluded.color,
          system_prompt = excluded.system_prompt,
          team_type   = excluded.team_type,
          source_path = excluded.source_path
      `).run(
        id,
        teamWorkspacePath,
        def.slug,
        def.name,
        def.description,
        resolvedModel,
        def.tools,
        def.color,
        def.systemPrompt,
        def.teamType,
        def.sourcePath,
      )

      // Also upsert the model preference for this sub-agent in team_models.
      // The key is the agent slug scoped under the team workspace, so that
      // the orchestrator can look up the correct model for each sub-agent.
      const modelKey = `${teamWorkspacePath}::${def.slug}`
      db.prepare(`
        INSERT OR REPLACE INTO team_models (workspace_path, model)
        VALUES (?, ?)
      `).run(modelKey, resolvedModel)

      seeded.push({
        id,
        slug: def.slug,
        name: def.name,
        model: resolvedModel,
        tools: def.tools,
        color: def.color,
      })
    }
  })

  insertAgents()

  return { seeded: seeded.length, agents: seeded }
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/**
 * Retrieve all native agents associated with a team workspace, ordered by slug.
 */
export function getNativeAgentsForTeam(teamWorkspacePath: string): NativeAgentDefinition[] {
  const rows = db.prepare(`
    SELECT * FROM team_native_agents
    WHERE team_workspace_path = ?
    ORDER BY slug
  `).all(teamWorkspacePath) as any[]

  return rows.map((row) => ({
    name: row.name,
    description: row.description,
    model: row.model,
    tools: row.tools,
    color: row.color,
    teamType: row.team_type,
    slug: row.slug,
    systemPrompt: row.system_prompt,
    sourcePath: row.source_path,
  }))
}

/**
 * Retrieve a single native agent by its workspace path and slug.
 */
export function getNativeAgent(teamWorkspacePath: string, slug: string): NativeAgentDefinition | undefined {
  const row = db.prepare(`
    SELECT * FROM team_native_agents
    WHERE team_workspace_path = ? AND slug = ?
  `).get(teamWorkspacePath, slug) as any

  if (!row) return undefined

  return {
    name: row.name,
    description: row.description,
    model: row.model,
    tools: row.tools,
    color: row.color,
    teamType: row.team_type,
    slug: row.slug,
    systemPrompt: row.system_prompt,
    sourcePath: row.source_path,
  }
}

/**
 * Get the resolved model name for a specific sub-agent within a team.
 * Looks up the `team_models` table using the scoped key.
 */
export function getModelForSubAgent(teamWorkspacePath: string, slug: string): string {
  const modelKey = `${teamWorkspacePath}::${slug}`
  const row = db.prepare('SELECT model FROM team_models WHERE workspace_path = ?')
    .get(modelKey) as { model: string } | undefined
  return row?.model ?? 'claude-haiku-4-5-20251001'
}
