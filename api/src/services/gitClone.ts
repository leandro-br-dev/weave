/**
 * Git Clone Service
 *
 * Provides utilities for cloning git repositories and creating
 * default environment directories for projects.
 *
 * Supports two modes:
 *   1. With a git URL — clones the repository into each environment directory.
 *   2. Without a git URL — creates fresh directories and initialises a local
 *      git repo (with an initial commit on main).  This allows starting a
 *      project from scratch.
 *
 * Authentication:
 *   - If an SSH URL is provided and `gh` CLI is available with HTTPS auth,
 *     the URL is automatically converted to HTTPS so the `gh` credential
 *     helper can handle authentication.
 *   - A personal access token (PAT) can be supplied to clone private repos
 *     over HTTPS.  The token is embedded directly in the URL for `git clone`
 *     and stripped again afterwards (`git remote set-url`).
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { getProjectsDir, envDirPath, slugify } from '../utils/paths.js'

export interface DefaultEnvironment {
  name: string
  /** Branch to checkout. null = default (main/master) */
  branch: string | null
  /** For dev/staging: if true, creates a new branch from main */
  createBranch: boolean
  /** Name of the new branch to create (only used if createBranch=true) */
  newBranchName?: string
}

/**
 * Default environment templates.
 *
 * - plan:   clone on main (read-only reference)
 * - dev:    clone on a new branch `dev` from main
 * - staging: clone on a new branch `staging` from main
 */
export const DEFAULT_ENVIRONMENTS: DefaultEnvironment[] = [
  {
    name: 'plan',
    branch: 'main',
    createBranch: false,
  },
  {
    name: 'dev',
    branch: null,
    createBranch: true,
    newBranchName: 'dev',
  },
  {
    name: 'staging',
    branch: null,
    createBranch: true,
    newBranchName: 'staging',
  },
]

export interface CloneResult {
  name: string
  project_path: string
  branch: string
  success: boolean
  error?: string
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

/**
 * Check whether `gh` CLI is available and authenticated for HTTPS operations.
 */
function isGhAvailable(): boolean {
  try {
    const status = execSync('gh auth status 2>&1', {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return status.includes('Logged in')
  } catch {
    return false
  }
}

/**
 * Convert an SSH git URL to the equivalent HTTPS URL.
 *
 *   git@github.com:user/repo.git  →  https://github.com/user/repo.git
 *   git@gitlab.com:user/repo.git  →  https://gitlab.com/user/repo.git
 */
function sshToHttps(sshUrl: string): string {
  const match = /^git@([^:]+):(.+?)(?:\.git)?$/.exec(sshUrl.trim())
  if (!match) return sshUrl
  const [, host, repoPath] = match
  return `https://${host}/${repoPath}.git`
}

/**
 * Detect whether a URL is an SSH-style git URL.
 */
function isSshUrl(url: string): boolean {
  return /^git@[^:]+:.+/i.test(url.trim())
}

/**
 * Embed a personal access token into an HTTPS git URL.
 *
 *   https://github.com/user/repo.git
 *   → https://x-access-token:<TOKEN>@github.com/user/repo.git
 *
 * We use `x-access-token` as the username (GitHub convention for PATs).
 */
function embedToken(httpsUrl: string, token: string): string {
  const match = /^(https?:\/\/)([^/]+)(\/.*)$/.exec(httpsUrl.trim())
  if (!match) return httpsUrl
  const [, protocol, host, repoPath] = match
  return `${protocol}x-access-token:${token}@${host}${repoPath}`
}

/**
 * Resolve the effective clone URL.
 *
 * Strategy:
 *  1. If a token is provided and the URL is HTTPS (or can be converted to HTTPS),
 *     embed the token.
 *  2. If the URL is SSH and `gh` CLI is available, auto-convert to HTTPS
 *     so the `gh` credential helper kicks in.
 *  3. Otherwise use the URL as-is.
 *
 * Returns { cloneUrl, originalUrl, usedToken } so the caller can sanitise
 * the remote after cloning.
 */
function resolveCloneUrl(
  originalUrl: string,
  token?: string | null,
): { cloneUrl: string; originalUrl: string; usedToken: boolean } {
  let url = originalUrl.trim()

  // If a token is provided, prefer HTTPS
  if (token && token.trim()) {
    let httpsUrl = isSshUrl(url) ? sshToHttps(url) : url
    return {
      cloneUrl: embedToken(httpsUrl, token.trim()),
      originalUrl: url,
      usedToken: true,
    }
  }

  // Auto-convert SSH → HTTPS when gh CLI is available
  if (isSshUrl(url) && isGhAvailable()) {
    return {
      cloneUrl: sshToHttps(url),
      originalUrl: url,
      usedToken: false,
    }
  }

  return { cloneUrl: url, originalUrl: url, usedToken: false }
}

/**
 * Sanitise the git remote URL after cloning so tokens don't persist in `.git/config`.
 *
 * Sets the `origin` remote to the original URL (without embedded token).
 */
function sanitiseRemote(targetDir: string, originalUrl: string): void {
  try {
    execSync(`git remote set-url origin "${originalUrl}"`, {
      cwd: targetDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch {
    // Non-critical — the repo is still functional
  }
}

// ---------------------------------------------------------------------------
// Core operations
// ---------------------------------------------------------------------------

/**
 * Resolve the target directory for a project's environments.
 * Structure: {baseDir}/{projectSlug}/env/
 *
 * Each environment gets a subdirectory under env/: env/plan, env/dev, etc.
 */
export function getProjectEnvsBaseDir(projectName: string, baseDir?: string): string {
  const root = baseDir || getProjectsDir()
  return path.join(root, slugify(projectName), 'env')
}

/**
 * Get the path for a specific environment within a project.
 * Structure: {baseDir}/{projectSlug}/env/{envSlug}/
 */
export function getEnvProjectPath(projectName: string, envName: string, baseDir?: string): string {
  const root = baseDir || getProjectsDir()
  return envDirPath(root, projectName, envName)
}

/**
 * Clone a git repository into a target directory.
 *
 * @param gitUrl  The git repository URL
 * @param targetDir  Where to clone
 * @param branch  Branch to checkout (null = default)
 * @param createBranch  If true, create a new branch from the default
 * @param newBranchName  Name of the new branch
 * @param token  Optional personal access token for private repos
 * @returns The branch that was checked out
 */
export function cloneRepository(
  gitUrl: string,
  targetDir: string,
  branch: string | null = null,
  createBranch: boolean = false,
  newBranchName?: string,
  token?: string | null,
): string {
  // Ensure parent directory exists
  fs.mkdirSync(path.dirname(targetDir), { recursive: true })

  const { cloneUrl, originalUrl, usedToken } = resolveCloneUrl(gitUrl, token)

  // Clone with the specified branch or default
  let cloneCmd: string
  if (branch) {
    // Try cloning the specific branch; fall back to default if it doesn't exist
    cloneCmd = `git clone -b ${branch} --single-branch "${cloneUrl}" "${targetDir}" --quiet 2>&1`
    try {
      execSync(cloneCmd, {
        encoding: 'utf-8',
        timeout: 120000,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    } catch (branchErr: any) {
      // Branch not found — clean up and clone with default branch
      try { fs.rmSync(targetDir, { recursive: true, force: true }) } catch {}
      cloneCmd = `git clone "${cloneUrl}" "${targetDir}" --quiet 2>&1`
      try {
        execSync(cloneCmd, {
          encoding: 'utf-8',
          timeout: 120000,
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      } catch (fallbackErr: any) {
        throw new Error(buildCloneError(gitUrl, originalUrl, cloneUrl, usedToken, branchErr, fallbackErr))
      }
    }
  } else {
    cloneCmd = `git clone "${cloneUrl}" "${targetDir}" --quiet 2>&1`
    try {
      execSync(cloneCmd, {
        encoding: 'utf-8',
        timeout: 120000,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    } catch (cloneErr: any) {
      throw new Error(buildCloneError(gitUrl, originalUrl, cloneUrl, usedToken, cloneErr))
    }
  }

  // Sanitise the remote URL so tokens don't persist on disk
  if (usedToken || cloneUrl !== originalUrl) {
    sanitiseRemote(targetDir, originalUrl)
  }

  // Determine the actual branch we're on
  let currentBranch = branch || 'main'
  try {
    currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: targetDir,
      encoding: 'utf-8',
    }).trim()
  } catch {
    // Default branch is already set
  }

  // If we need to create a new branch
  if (createBranch && newBranchName) {
    execSync(`git checkout -b ${newBranchName}`, {
      cwd: targetDir,
      encoding: 'utf-8',
    })
    currentBranch = newBranchName
  }

  return currentBranch
}

/**
 * Build a descriptive error message for a failed clone operation.
 */
function buildCloneError(
  originalUrl: string,
  resolvedOriginalUrl: string,
  cloneUrl: string,
  usedToken: boolean,
  primaryError: any,
  fallbackError?: any,
): string {
  const stderr = (fallbackError || primaryError)?.stderr || ''
    || (fallbackError || primaryError)?.message || ''
    || (fallbackError || primaryError)?.toString() || 'Unknown error'

  const lines: string[] = []
  lines.push(`git clone failed for "${originalUrl}".`)
  lines.push(`  Command output: ${stderr.substring(0, 300)}`)

  if (isSshUrl(originalUrl)) {
    if (cloneUrl !== originalUrl) {
      lines.push('  Auto-converted SSH → HTTPS (gh CLI detected), but clone still failed.')
    } else {
      lines.push('  Hint: SSH authentication failed. Solutions:')
      lines.push('    1. Add your SSH key to ~/.ssh/ and register it on the host.')
      lines.push('    2. Use an HTTPS URL instead — the system will use `gh` credentials if available.')
      lines.push('    3. Provide a personal access token when creating the project.')
    }
  }

  if (!usedToken && /authentication|permission|denied|401|403/i.test(stderr)) {
    lines.push('  This appears to be a private repository. Try providing a personal access token.')
  }

  return lines.join('\n')
}

/**
 * Create a fresh local git repository in the target directory.
 *
 * This is used when no git_url is provided — the user wants to start a
 * project from scratch.
 *
 * @param targetDir  Where to create the repo
 * @param branch     Branch to create (defaults to 'main')
 * @returns The branch that was created
 */
export function createLocalRepository(
  targetDir: string,
  branch: string = 'main',
): string {
  // Ensure parent directory exists
  fs.mkdirSync(targetDir, { recursive: true })

  // Initialise a bare git repo
  execSync('git init -b main', {
    cwd: targetDir,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  // Create an initial commit so branches can be created from it
  const readmePath = path.join(targetDir, 'README.md')
  fs.writeFileSync(readmePath, `# ${path.basename(targetDir)}\n`)
  execSync('git add README.md && git -c user.email="weave@local" -c user.name="Weave" commit -m "Initial commit"', {
    cwd: targetDir,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  return branch
}

/**
 * Known environment type names.
 */
export const ENV_TYPE_NAMES = ['plan', 'dev', 'staging'] as const
export type EnvTypeName = (typeof ENV_TYPE_NAMES)[number]

/**
 * Create default environments for a project.
 *
 * When `gitUrl` is provided, each environment is created by cloning the
 * repository.  When `gitUrl` is omitted (or empty), fresh directories are
 * created with an initialised local git repo — this allows starting a
 * project from scratch.
 *
 * @param gitUrl       The git repository URL (optional).
 * @param projectName  The project name (used for directory naming).
 * @param baseDir      Optional base directory for storing project files.
 *                     Defaults to the application's projects directory.
 * @param envTypes     Optional array of environment types to create.
 *                     Defaults to all three (plan, dev, staging).
 * @param gitToken     Optional personal access token for private repos.
 * @returns Object containing results array and optional warnings array.
 */
export function createDefaultEnvironments(
  gitUrl: string | null | undefined,
  projectName: string,
  baseDir?: string,
  envTypes?: string[],
  gitToken?: string | null,
): { results: CloneResult[]; warnings: string[] } {
  const results: CloneResult[] = []
  const warnings: string[] = []

  // Resolve token: explicit param > GIT_TOKEN env var
  const resolvedToken = (gitToken && gitToken.trim()) ? gitToken.trim() : (process.env.GIT_TOKEN || null)

  // Filter environments based on envTypes selection
  const envsToCreate = DEFAULT_ENVIRONMENTS.filter((env) =>
    envTypes ? envTypes.includes(env.name) : true,
  )

  if (envTypes && envTypes.length > 0) {
    const unknown = envTypes.filter((t) => !ENV_TYPE_NAMES.includes(t as EnvTypeName))
    if (unknown.length > 0) {
      warnings.push(`Unknown environment types ignored: ${unknown.join(', ')}`)
    }
  }

  // Ensure the project base directory exists
  const projectBaseDir = getProjectEnvsBaseDir(projectName, baseDir)
  fs.mkdirSync(projectBaseDir, { recursive: true })

  for (const envConfig of envsToCreate) {
    const targetDir = getEnvProjectPath(projectName, envConfig.name, baseDir)

    try {
      // Skip if directory already exists
      if (fs.existsSync(targetDir)) {
        results.push({
          name: envConfig.name,
          project_path: targetDir,
          branch: envConfig.newBranchName || envConfig.branch || 'unknown',
          success: true,
          error: 'Directory already exists, skipped',
        })
        continue
      }

      // Ensure the target directory's parent exists before cloning/init
      fs.mkdirSync(path.dirname(targetDir), { recursive: true })

      let branch: string

      if (gitUrl) {
        // Clone from the remote repository
        branch = cloneRepository(
          gitUrl,
          targetDir,
          envConfig.branch,
          envConfig.createBranch,
          envConfig.newBranchName,
          resolvedToken,
        )
      } else {
        // Create a fresh local git repository (no remote)
        const mainBranch = createLocalRepository(targetDir, envConfig.branch || 'main')

        // For dev/staging, create a new branch
        if (envConfig.createBranch && envConfig.newBranchName) {
          execSync(`git checkout -b ${envConfig.newBranchName}`, {
            cwd: targetDir,
            encoding: 'utf-8',
          })
          branch = envConfig.newBranchName
        } else {
          branch = mainBranch
        }
      }

      results.push({
        name: envConfig.name,
        project_path: targetDir,
        branch,
        success: true,
      })
    } catch (err: any) {
      const errorMsg = err.message?.substring(0, 500) || 'Unknown error'
      results.push({
        name: envConfig.name,
        project_path: targetDir,
        branch: envConfig.newBranchName || envConfig.branch || 'unknown',
        success: false,
        error: errorMsg,
      })
      warnings.push(`Failed to create "${envConfig.name}" environment: ${errorMsg}`)

      // Clean up partial clone
      try {
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true })
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  return { results, warnings }
}

/**
 * Validate a git URL format (basic check).
 */
export function isValidGitUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  const trimmed = url.trim()
  // HTTPS or SSH or git://
  return /^https?:\/\/.+/i.test(trimmed) || /^git@.+:.+/.test(trimmed) || /^git:\/\/.+/i.test(trimmed)
}
