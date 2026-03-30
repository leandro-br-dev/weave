import fs from 'fs'
import path from 'path'

/**
 * Updates the settings.local.json file with additional directories.
 * Merges new directories with existing ones to avoid duplicates.
 */
export function updateAgentSettings(
  workspacePath: string,
  additionalDirectories: string[]
): void {
  const settingsPath = path.join(workspacePath, '.claude', 'settings.local.json')
  if (!fs.existsSync(settingsPath)) return

  const current = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
  current.permissions = current.permissions ?? {}
  current.permissions.additionalDirectories = [
    ...new Set([
      ...(current.permissions.additionalDirectories ?? []),
      ...additionalDirectories
    ])
  ]
  fs.writeFileSync(settingsPath, JSON.stringify(current, null, 2))
}

/**
 * Rebuilds the settings.local.json file with a fresh set of directories.
 * Replaces all existing additionalDirectories with the provided set.
 */
export function rebuildAgentSettings(
  workspacePath: string,
  allDirectories: string[]
): void {
  const settingsPath = path.join(workspacePath, '.claude', 'settings.local.json')
  if (!fs.existsSync(settingsPath)) return

  const current = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
  current.permissions = current.permissions ?? {}
  current.permissions.additionalDirectories = [...new Set(allDirectories)]
  fs.writeFileSync(settingsPath, JSON.stringify(current, null, 2))
}
