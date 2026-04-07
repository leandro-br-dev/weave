/**
 * Environment Team Bootstrap Service
 *
 * Automatically creates and links the appropriate team (Plan Team, Dev Team, or
 * Staging Team) when a new environment is created.  The newly-created team is
 * set as the "default team" for that environment so the orchestrator knows
 * which workspace to use.
 *
 * The mapping is:
 *   - "plan"    → Plan Team      (role: planner)
 *   - "dev"     → Dev Team       (role: coder)
 *   - "staging" → Staging Team   (role: reviewer)
 *
 * All other environment names fall back to Dev Team (role: coder).
 */

import fs from 'fs'
import path from 'path'
import { v4 as uuid } from 'uuid'
import { db } from '../db/index.js'
import {
  getTeamTemplateById,
  renderTeamClaudeMd,
  TEAM_TEMPLATES,
  type TeamTemplate,
} from '../utils/teamTemplates.js'
import { AGENTS_BASE_PATH, slugify } from '../utils/paths.js'
import { seedNativeAgentsForTeam, type SeedResult } from './nativeAgentsBootstrap.js'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface BootstrapResult {
  /** The environment name that was processed */
  envName: string
  /** Resolved team template ID (e.g. 'plan-team') */
  teamId: string
  /** Absolute path to the created workspace */
  workspacePath: string
  /** Whether the workspace + team were actually created (false if already existed) */
  created: boolean
  /** Summary of native agents that were seeded into the database */
  nativeAgents?: SeedResult
}

// ---------------------------------------------------------------------------
// Environment name → team template mapping
// ---------------------------------------------------------------------------

const ENV_TEAM_MAP: Record<string, string> = {
  plan: 'plan-team',
  dev: 'dev-team',
  staging: 'staging-team',
}

/**
 * Resolve the team template ID for a given environment name.
 */
export function resolveTeamIdForEnv(envName: string): string {
  const normalised = slugify(envName)
  return ENV_TEAM_MAP[normalised] ?? 'dev-team'
}

/**
 * Resolve the agent role for a given environment name.
 */
export function resolveRoleForEnv(envName: string): string {
  const team = getTeamTemplateById(resolveTeamIdForEnv(envName))
  return team?.role ?? 'coder'
}

// ---------------------------------------------------------------------------
// Core bootstrap function
// ---------------------------------------------------------------------------

/**
 * Create the default team workspace for an environment and persist the link
 * in the database.
 *
 * This function performs all operations — directory creation, file writes, and
 * DB inserts — inside a `better-sqlite3` transaction so that any failure
 * rolls back the database state.
 *
 * @param projectId    The project UUID.
 * @param envId        The environment UUID.
 * @param envName      The environment name (e.g. 'plan', 'dev', 'staging').
 * @param projectPath  The project's source-code directory.
 * @param projectName  The project's human-readable name.
 */
export function bootstrapTeamForEnvironment(
  projectId: string,
  envId: string,
  envName: string,
  projectPath: string,
  projectName: string,
): BootstrapResult {
  const teamId = resolveTeamIdForEnv(envName)
  const teamTemplate = getTeamTemplateById(teamId)
  if (!teamTemplate) {
    throw new Error(`Team template "${teamId}" not found for environment "${envName}"`)
  }

  const role = teamTemplate.role
  const agentName = `agent-${role === 'planner' ? 'planner' : role === 'reviewer' ? 'reviewer' : 'coder'}`
  const envSlug = slugify(envName)
  const projectSlug = slugify(projectName)
  const workspacePath = path.resolve(path.join(AGENTS_BASE_PATH, projectSlug, envSlug, agentName))

  // If the workspace directory already exists, just link it (idempotent).
  const alreadyExists = fs.existsSync(workspacePath)

  if (!alreadyExists) {
    // --- File-system operations (outside the DB transaction) ---
    // We create files first.  If they fail we throw — the caller can clean up
    // the partial directory tree if needed.

    const claudeDir = path.join(workspacePath, '.claude')
    fs.mkdirSync(claudeDir, { recursive: true })

    // .gitignore
    const gitignorePath = path.join(workspacePath, '.gitignore')
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, '.agent-docs/\n')
    }

    // CLAUDE.md
    const claudeMdPath = path.join(workspacePath, 'CLAUDE.md')
    const claudeMdContent = renderTeamClaudeMd(teamTemplate, {
      agentName,
      projectName,
      workspacePath,
    })
    fs.writeFileSync(claudeMdPath, claudeMdContent)

    // settings.local.json
    const settingsPath = path.join(claudeDir, 'settings.local.json')
    if (!fs.existsSync(settingsPath)) {
      const globalEnvVars = db
        .prepare('SELECT key, value FROM environment_variables')
        .all() as { key: string; value: string }[]

      const defaultEnv = globalEnvVars.reduce<Record<string, string>>(
        (acc, v) => {
          acc[v.key] = v.value
          return acc
        },
        {},
      )

      const settings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        env: {
          ANTHROPIC_BASE_URL: 'http://localhost:8083',
          API_TIMEOUT_MS: '3000000',
          ...defaultEnv,
        },
        permissions: {
          allow: teamTemplate.permissions.allow,
          deny: teamTemplate.permissions.deny,
          additionalDirectories: [projectPath],
        },
      }
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
    }
}

  // --- Database operations (wrapped in a transaction) ---
  const insertEnvTeam = db.transaction(() => {
    // 1. Link workspace to project
    db.prepare(
      'INSERT OR IGNORE INTO project_agents (project_id, workspace_path) VALUES (?, ?)',
    ).run(projectId, workspacePath)

    // 2. Save the role for this workspace
    db.prepare(
      'INSERT OR REPLACE INTO team_roles (workspace_path, role) VALUES (?, ?)',
    ).run(workspacePath, role)

    // 3. Link workspace to the specific environment
    db.prepare(
      'INSERT OR IGNORE INTO agent_environments (workspace_path, environment_id) VALUES (?, ?)',
    ).run(workspacePath, envId)

    // 4. Set this team as the default team for the environment
    db.prepare(
      'UPDATE environments SET default_team = ? WHERE id = ?',
    ).run(workspacePath, envId)

    // 5. If role is 'coder', also update agent_workspace so existing flows still work
    if (role === 'coder') {
      db.prepare(
        'UPDATE environments SET agent_workspace = ? WHERE id = ?',
      ).run(workspacePath, envId)
    }
  })

  insertEnvTeam()

  // --- Seed native agents for this team type ---
  let nativeAgents: SeedResult | undefined
  try {
    nativeAgents = seedNativeAgentsForTeam(workspacePath, envName)
  } catch (err) {
    // Non-fatal: log but don't block team creation
    console.error(
      `[environmentTeamBootstrap] Failed to seed native agents for ${envName}:`,
      err,
    )
  }

  return {
    envName,
    teamId,
    workspacePath,
    created: !alreadyExists,
    nativeAgents,
  }
}

/**
 * Bootstrap teams for all standard environments at once.
 * Returns an array of results — one per environment.
 */
export function bootstrapTeamsForEnvironments(
  projectId: string,
  environments: { id: string; name: string; project_path: string }[],
  projectName: string,
): BootstrapResult[] {
  return environments.map((env) =>
    bootstrapTeamForEnvironment(
      projectId,
      env.id,
      env.name,
      env.project_path,
      projectName,
    ),
  )
}
