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
 * Resolve the uploads directory path.
 * Production:  ~/.local/share/weave/uploads/
 * Development: ~/.local/share/weave-dev/uploads/
 *
 * Files are organised as:  uploads/{year}/{month}/{uuid}.{ext}
 */
export function getUploadsDir(appEnv?: string): string {
  return path.join(getDataDir(appEnv), 'uploads')
}

/**
 * Base path for team workspaces.
 * Priority: DATA_DIR env > TEAMS_BASE_PATH env > AGENTS_BASE_PATH env (legacy) > default
 */
export const TEAMS_BASE_PATH = (() => {
  const dataDir = process.env.DATA_DIR
  if (dataDir) return path.join(dataDir, 'projects')
  const envPath = process.env.TEAMS_BASE_PATH || process.env.AGENTS_BASE_PATH
  if (envPath) {
    // Expand ~ if present
    return envPath.startsWith('~') ? path.join(os.homedir(), envPath.slice(1)) : envPath
  }
  return getProjectsDir()
})()

/** @deprecated Use TEAMS_BASE_PATH instead */
export const AGENTS_BASE_PATH = TEAMS_BASE_PATH

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

// ---------------------------------------------------------------------------
// NEW directory structure (v2)
// ---------------------------------------------------------------------------
//
// Each project is now organised as:
//
//   {base}/{projectSlug}/
//   ├── env/                  ← environment source-code directories
//   │   ├── dev/
//   │   ├── plan/
//   │   └── staging/
//   ├── teams/                ← all team workspaces for this project
//   │   ├── team-coder/
//   │   ├── team-planner/
//   │   ├── team-reviewer/
//   │   └── {custom-team}/
//   └── workflows/            ← per-plan workflow directories
//       └── {uuid}/
//
// Teams belong to the project, not to a specific environment. They are
// peers with env/ and workflows/, which prevents naming collisions (e.g.
// an environment named "teams") and makes the hierarchy explicit.
// ---------------------------------------------------------------------------

/**
 * Path for an environment's source-code directory.
 * Structure: {basePath}/{projectSlug}/env/{envSlug}/
 */
export function envDirPath(
  basePath: string,
  projectSlug: string,
  envSlug: string,
): string {
  return path.resolve(path.join(basePath, slugify(projectSlug), 'env', slugify(envSlug)))
}

/**
 * Path for a team workspace.
 * Structure: {basePath}/{projectSlug}/teams/{teamName}/
 *
 * Teams are project-level entities — they sit alongside env/ and workflows/
 * rather than inside a specific environment directory.
 */
export function teamWorkspacePath(
  basePath: string,
  projectSlug: string,
  teamName: string,
): string {
  return path.resolve(path.join(basePath, slugify(projectSlug), 'teams', slugify(teamName)))
}

/**
 * @deprecated Use teamWorkspacePath instead.
 * Kept for backward compatibility — resolves to the NEW teams/ structure.
 */
export function agentWorkspacePath(
  basePath: string,
  projectSlug: string,
  agentName: string,
): string {
  return teamWorkspacePath(basePath, projectSlug, agentName)
}

/**
 * Path for an environment's auto-generated default team workspace.
 * Structure: {basePath}/{projectSlug}/teams/team-coder/
 *
 * The team name is derived from the environment type:
 *   - plan    → team-planner
 *   - dev     → team-coder
 *   - staging → team-reviewer
 *
 * @deprecated Use teamWorkspacePath with the appropriate team name.
 */
export function envTeamPath(
  basePath: string,
  projectSlug: string,
  _envSlug: string,
): string {
  return teamWorkspacePath(basePath, projectSlug, 'team-coder')
}

/** @deprecated Use teamWorkspacePath instead */
export function envAgentPath(
  basePath: string,
  projectSlug: string,
  envSlug: string,
): string {
  return envTeamPath(basePath, projectSlug, envSlug)
}

/**
 * Path for an environment's auto-generated planner team workspace.
 * Structure: {basePath}/{projectSlug}/teams/team-planner/
 *
 * @deprecated Use teamWorkspacePath(basePath, projectSlug, 'team-planner') instead.
 */
export function envTeamPlannerPath(
  basePath: string,
  projectSlug: string,
  _envSlug: string,
): string {
  return teamWorkspacePath(basePath, projectSlug, 'team-planner')
}

/** @deprecated Use teamWorkspacePath instead */
export function envAgentPlannerPath(
  basePath: string,
  projectSlug: string,
  envSlug: string,
): string {
  return envTeamPlannerPath(basePath, projectSlug, envSlug)
}

/**
 * Base directory for all teams within a project.
 * Structure: {basePath}/{projectSlug}/teams/
 */
export function teamsBaseDir(
  basePath: string,
  projectSlug: string,
): string {
  return path.resolve(path.join(basePath, slugify(projectSlug), 'teams'))
}

/**
 * Base directory for all environments within a project.
 * Structure: {basePath}/{projectSlug}/env/
 */
export function envsBaseDir(
  basePath: string,
  projectSlug: string,
): string {
  return path.resolve(path.join(basePath, slugify(projectSlug), 'env'))
}

/**
 * Resolve a project's base directory.
 * Structure: {basePath}/{projectSlug}/
 */
export function projectBaseDir(
  basePath: string,
  projectSlug: string,
): string {
  return path.resolve(path.join(basePath, slugify(projectSlug)))
}

/**
 * Path for a workflow's dedicated directory.
 * Structure: {dataDir}/projects/{projectSlug}/workflows/{workflowUuid}/
 *
 * Each workflow (plan) gets an isolated directory containing:
 * - plan.json: output of the Plan Team
 * - state.md: the general blackboard / diary
 * - errors.log: build / test failure dump
 */
export function workflowDirPath(
  projectSlug: string,
  workflowUuid: string,
  appEnv?: string
): string {
  return path.join(getProjectsDir(appEnv), slugify(projectSlug), 'workflows', workflowUuid)
}

/**
 * Resolve a project slug from a project name.
 * Simply delegates to slugify().
 */
export function projectSlugFromName(name: string): string {
  return slugify(name)
}
