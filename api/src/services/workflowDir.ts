/**
 * Workflow Directory Service
 *
 * Creates and manages per-workflow directories on disk.
 *
 * Structure:
 *   {dataDir}/projects/{projectSlug}/workflows/{workflowUuid}/
 *     ├── plan.json     — output of the Plan Team
 *     ├── state.md      — general blackboard / diary
 *     └── errors.log    — build / test failure dump
 */

import fs from 'fs'
import { workflowDirPath, projectSlugFromName } from '../utils/paths.js'

/** Standard files created inside every workflow directory */
export const WORKFLOW_FILES = ['plan.json', 'state.md', 'errors.log'] as const

export type WorkflowFileName = (typeof WORKFLOW_FILES)[number]

/**
 * Ensure the workflow directory exists on disk and contains the three
 * standard empty files. Returns the absolute path to the directory.
 *
 * If the directory (or any file) already exists the operation is idempotent.
 */
export function ensureWorkflowDir(
  projectName: string,
  workflowUuid: string
): string {
  const dir = workflowDirPath(projectSlugFromName(projectName), workflowUuid)

  // Create directory tree (recursive, no-op if already exists)
  fs.mkdirSync(dir, { recursive: true })

  // Create each standard file if it doesn't exist
  for (const file of WORKFLOW_FILES) {
    const filePath = `${dir}/${file}`
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '', 'utf-8')
    }
  }

  return dir
}

/**
 * Write the plan JSON into the workflow directory's plan.json file.
 *
 * This is called after a plan is created in the database so that executor
 * agents can read the plan from the filesystem (via the handoff skill).
 *
 * If the workflow directory does not exist, the write is silently skipped.
 */
export function writePlanJson(
  workflowPath: string,
  planData: { name: string; tasks: unknown[]; [key: string]: unknown }
): void {
  try {
    if (!workflowPath) return
    const filePath = `${workflowPath}/plan.json`
    fs.writeFileSync(filePath, JSON.stringify(planData, null, 2) + '\n', 'utf-8')
  } catch (err) {
    console.error(`[workflowDir] Failed to write plan.json to ${workflowPath}:`, err)
  }
}
