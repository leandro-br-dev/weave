import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'

export type Environment = {
  id: string
  project_id: string
  name: string
  type: 'local-wsl' | 'local-windows' | 'ssh'
  project_path: string
  agent_workspace: string
  ssh_config?: string | null
  env_vars?: string | null
  created_at: string
}

export type ProjectSettings = {
  auto_approve_workflows: boolean
  auto_move_enabled: boolean
  planning_agent_workspace?: string
  max_concurrent_active_tasks?: number
  max_concurrent_workflows?: number    // 0 = unlimited (global max running workflows)
  max_planning_tasks?: number            // 0 = unlimited (per-project planning column limit, default 1)
  max_in_progress_tasks?: number         // 0 = unlimited (per-project in_progress column limit, default 1)
}

export type Project = {
  id: string
  name: string
  description: string | null
  color?: string
  git_url?: string | null
  created_at: string
  environments: Environment[]
  agent_paths?: string[]
  settings: ProjectSettings
}

export function useGetProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => apiFetch<Project[]>('/api/projects'),
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      name: string
      description?: string
      color?: string
      git_url?: string
      create_default_envs?: boolean
    }) =>
      apiFetch<{ id: string; environments?: any[] }>('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/projects/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useUpdateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Project> & { id: string }) =>
      apiFetch<Project>(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useCreateEnvironment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: Partial<Environment> }) =>
      apiFetch<{ id: string }>(`/api/projects/${projectId}/environments`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useUpdateEnvironment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, envId, data }: { projectId: string; envId: string; data: Partial<Environment> }) =>
      apiFetch(`/api/projects/${projectId}/environments/${envId}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useDeleteEnvironment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, envId }: { projectId: string; envId: string }) =>
      apiFetch(`/api/projects/${projectId}/environments/${envId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useGetAllEnvironments() {
  return useQuery({
    queryKey: ['projects', 'all-environments'],
    queryFn: async () => {
      const projects = await apiFetch<Project[]>('/api/projects')
      return projects.flatMap(p =>
        p.environments.map(e => ({ ...e, project_name: p.name }))
      ) as (Environment & { project_name: string })[]
    },
  })
}

export function useLinkAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, workspace_path }: { projectId: string; workspace_path: string }) =>
      apiFetch(`/api/projects/${projectId}/agents`, {
        method: 'POST',
        body: JSON.stringify({ workspace_path })
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useUnlinkAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, workspace_path }: { projectId: string; workspace_path: string }) =>
      apiFetch(`/api/projects/${projectId}/agents`, {
        method: 'DELETE',
        body: JSON.stringify({ workspace_path })
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useGenerateAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      projectId: string
      name: string
      role: string
      description?: string
    }) => {
      return apiFetch(
        `/api/projects/${data.projectId}/generate-agent`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: data.name,
            role: data.role,
            description: data.description
          })
        }
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] })
      qc.invalidateQueries({ queryKey: ['plans'] })
    },
  })
}

export type ProjectContext = {
  structure: string
  git_info: {
    branch: string
    last_commit: string
    remote: string
  }
  stats: {
    total_files: number
    total_dirs: number
    languages: Record<string, number>
  }
}

export function useGenerateContext() {
  return useMutation({
    mutationFn: ({ projectId, envId }: { projectId: string; envId: string }) =>
      apiFetch<ProjectContext>(`/api/projects/${projectId}/environments/${envId}/generate-context`, {
        method: 'POST',
      }),
  })
}

export type DefaultAgentResult = {
  type: 'coder' | 'planner'
  workspace_path: string
}

export function useCreateDefaultAgents() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      projectId: string
      environmentId: string
      create_coder: boolean
      create_planner: boolean
    }) =>
      apiFetch<DefaultAgentResult[]>(
        `/api/projects/${data.projectId}/default-agents`,
        {
          method: 'POST',
          body: JSON.stringify({
            environment_id: data.environmentId,
            create_coder: data.create_coder,
            create_planner: data.create_planner,
          }),
        }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['teams'] })
    },
  })
}
