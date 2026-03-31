import path from 'path'
import os from 'os'

/**
 * Resolve the user-specific data directory for the application.
 * Production:  ~/.local/share/weave/
 * Development: ~/.local/share/weave-dev/
 *
 * Can be overridden via DATA_DIR env var for custom installations.
 */
export function getDataDir(appEnv?: string): string {
  const env = appEnv || process.env.DATA_DIR_ENV || process.env.APP_ENV || 'prod'
  const suffix = env === 'dev' ? '-dev' : ''
  return path.join(os.homedir(), '.local', 'share', `weave${suffix}`)
}

/**
 * Resolve the database file path.
 * Production:  ~/.local/share/weave/database.db
 * Development: ~/.local/share/weave-dev/database.db
 */
export function getDatabasePath(appEnv?: string): string {
  return path.join(getDataDir(appEnv), 'database.db')
}

/**
 * Resolve the projects directory path.
 * Production:  ~/.local/share/weave/projects/
 * Development: ~/.local/share/weave-dev/projects/
 */
export function getProjectsDir(appEnv?: string): string {
  return path.join(getDataDir(appEnv), 'projects')
}

/**
 * Base path for agent workspaces.
 * Priority: DATA_DIR env > AGENTS_BASE_PATH env > default
 */
export const AGENTS_BASE_PATH = (() => {
  const dataDir = process.env.DATA_DIR
  if (dataDir) return path.join(dataDir, 'projects')
  const envPath = process.env.AGENTS_BASE_PATH
  if (envPath) {
    // Expand ~ if present
    return envPath.startsWith('~') ? path.join(os.homedir(), envPath.slice(1)) : envPath
  }
  return getProjectsDir()
})()

/**
 * Expand ~ in a file path to user's home directory
 */
export function expandPath(p: string): string {
  if (p.startsWith('~')) {
    return path.join(os.homedir(), p.slice(1))
  }
  return p
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Path for an agent workspace.
 * Structure: {basePath}/{projectSlug}/agents/{agentName}/
 */
export function agentWorkspacePath(
  basePath: string,
  projectSlug: string,
  agentName: string
): string {
  return path.join(basePath, slugify(projectSlug), 'agents', slugify(agentName))
}

/**
 * Path for an environment's auto-generated agent.
 * Structure: {basePath}/{projectSlug}/{envSlug}/agent-coder/
 * (environments keep the current structure — they are tied to a specific env)
 */
export function envAgentPath(
  basePath: string,
  projectSlug: string,
  envSlug: string
): string {
  return path.join(basePath, slugify(projectSlug), slugify(envSlug), 'agent-coder')
}

/**
 * Path for an environment's auto-generated planner agent.
 * Structure: {basePath}/{projectSlug}/{envSlug}/agent-planner/
 */
export function envAgentPlannerPath(
  basePath: string,
  projectSlug: string,
  envSlug: string
): string {
  return path.join(basePath, slugify(projectSlug), slugify(envSlug), 'agent-planner')
}
