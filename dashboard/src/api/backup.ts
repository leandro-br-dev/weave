import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BackupInfo {
  projects: number
  environments: number
  plans: number
  plan_logs: number
  kanban_tasks: number
  kanban_templates: number
  chat_sessions: number
  chat_messages: number
  environment_variables: number
  approvals: number
  agent_workspaces: number
}

export interface BackupData {
  version: string
  exported_at: string
  metadata: {
    projects_count: number
    environments_count: number
    agents_count: number
    plans_count: number
    kanban_tasks_count: number
    kanban_templates_count: number
    chat_sessions_count: number
    chat_messages_count: number
    environment_variables_count: number
    approvals_count: number
  }
  projects: any[]
  environments: any[]
  project_agents: any[]
  agent_environments: any[]
  team_roles: any[]
  team_models: any[]
  plans: any[]
  plan_logs: any[]
  kanban_tasks: any[]
  kanban_templates: any[]
  chat_sessions: any[]
  chat_messages: any[]
  environment_variables: any[]
  approvals: any[]
  agent_workspaces: {
    relative_path: string
    claude_md: string | null
    settings: any
    skills: { name: string; content: string }[]
    agents: { name: string; content: string }[]
  }[]
}

export interface ImportResult {
  projects_imported: number
  environments_imported: number
  plans_imported: number
  plan_logs_imported: number
  kanban_tasks_imported: number
  kanban_templates_imported: number
  chat_sessions_imported: number
  chat_messages_imported: number
  env_vars_imported: number
  agents_restored: number
  version: string
  exported_at: string
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useBackupInfo() {
  return useQuery<BackupInfo>({
    queryKey: ['backup', 'info'],
    queryFn: () => apiFetch<BackupInfo>('/api/backup/info'),
  })
}

export function useExportBackup() {
  return useMutation<BackupData>({
    mutationFn: () =>
      apiFetch<BackupData>('/api/backup/export', { method: 'POST' }),
  })
}

export function useImportBackup() {
  const qc = useQueryClient()
  return useMutation<ImportResult, Error, BackupData>({
    mutationFn: (data: BackupData) =>
      apiFetch<ImportResult>('/api/backup/import', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      // Invalidate all caches since the entire DB has been modified
      qc.invalidateQueries()
    },
  })
}
