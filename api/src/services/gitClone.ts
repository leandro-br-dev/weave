/**
 * Git Clone Service
 *
 * Provides utilities for cloning git repositories and creating
 * default environment directories for projects.
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { getProjectsDir } from '../utils/paths.js'
import { slugify } from '../utils/paths.js'

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

/**
 * Resolve the target directory for a project's environments.
 * Structure: {getProjectsDir()}/{projectSlug}/
 *
 * Each environment gets a subdirectory: {projectSlug}/plan, {projectSlug}/dev, etc.
 */
export function getProjectEnvsBaseDir(projectName: string): string {
  return path.join(getProjectsDir(), slugify(projectName))
}

/**
 * Get the path for a specific environment within a project.
 */
export function getEnvProjectPath(projectName: string, envName: string): string {
  return path.join(getProjectEnvsBaseDir(projectName), slugify(envName))
}

/**
 * Clone a git repository into a target directory.
 *
 * @param gitUrl  The git repository URL
 * @param targetDir  Where to clone
 * @param branch  Branch to checkout (null = default)
 * @param createBranch  If true, create a new branch from the default
 * @param newBranchName  Name of the new branch
 * @returns The branch that was checked out
 */
export function cloneRepository(
  gitUrl: string,
  targetDir: string,
  branch: string | null = null,
  createBranch: boolean = false,
  newBranchName?: string
): string {
  // Ensure parent directory exists
  fs.mkdirSync(path.dirname(targetDir), { recursive: true })

  // Clone with the specified branch or default
  let cloneCmd: string
  if (branch) {
    // Try cloning the specific branch; fall back to default if it doesn't exist
    cloneCmd = `git clone -b ${branch} --single-branch "${gitUrl}" "${targetDir}" --quiet 2>&1`
    try {
      execSync(cloneCmd, {
        encoding: 'utf-8',
        timeout: 120000,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    } catch {
      // Branch not found — clean up and clone with default branch
      try { fs.rmSync(targetDir, { recursive: true, force: true }) } catch {}
      cloneCmd = `git clone "${gitUrl}" "${targetDir}" --quiet 2>&1`
      execSync(cloneCmd, {
        encoding: 'utf-8',
        timeout: 120000,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    }
  } else {
    cloneCmd = `git clone "${gitUrl}" "${targetDir}" --quiet 2>&1`
    execSync(cloneCmd, {
      encoding: 'utf-8',
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
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
 * Create default environments for a project by cloning the git repository.
 *
 * @param gitUrl  The git repository URL
 * @param projectName  The project name (used for directory naming)
 * @returns Array of results for each environment
 */
export function createDefaultEnvironments(
  gitUrl: string,
  projectName: string
): CloneResult[] {
  const results: CloneResult[] = []

  for (const envConfig of DEFAULT_ENVIRONMENTS) {
    const targetDir = getEnvProjectPath(projectName, envConfig.name)

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

      const branch = cloneRepository(
        gitUrl,
        targetDir,
        envConfig.branch,
        envConfig.createBranch,
        envConfig.newBranchName
      )

      results.push({
        name: envConfig.name,
        project_path: targetDir,
        branch,
        success: true,
      })
    } catch (err: any) {
      results.push({
        name: envConfig.name,
        project_path: targetDir,
        branch: envConfig.newBranchName || envConfig.branch || 'unknown',
        success: false,
        error: err.message?.substring(0, 500) || 'Unknown error',
      })

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

  return results
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
