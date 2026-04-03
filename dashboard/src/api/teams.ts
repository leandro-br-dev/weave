import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient, apiFetch } from './client'

export type TeamRole = 'planner' | 'coder' | 'reviewer' | 'tester' | 'debugger' | 'devops' | 'generic'

export type Team = {
  id: string
  name: string
  path: string
  exists: boolean
  hasSettings: boolean
  hasClaude: boolean
  baseUrl: string | null
  project_id: string | null
  role: TeamRole
  model?: string
}

export type TeamDetail = {
  id: string
  name: string
  path: string
  claudeMd: string | null
  settings: any
  skills: Array<{ name: string; hasSkillMd: boolean }>
  agents: Array<{ name: string; file: string }>
  project_id: string | null
}

export const teamKeys = {
  list: () => ['teams'] as const,
  detail: (id: string) => ['teams', id] as const,
}

/** @deprecated Use TeamRole instead */
export type WorkspaceRole = TeamRole

/** @deprecated Use Team instead */
export type Workspace = Team

/** @deprecated Use TeamDetail instead */
export type WorkspaceDetail = Team

export function useGetTeams(params?: { project_id?: string }) {
  return useQuery({
    queryKey: ['teams', params],
    queryFn: () => {
      const queryString = params?.project_id
        ? `?project_id=${encodeURIComponent(params.project_id)}`
        : '';
      return apiClient.get<Team[]>(`/api/teams${queryString}`);
    },
  })
}

/** @deprecated Use useGetTeams instead */
export const useGetWorkspaces = useGetTeams

export function useGetTeam(id: string) {
  return useQuery({
    queryKey: teamKeys.detail(id),
    queryFn: () => apiClient.get<TeamDetail>(`/api/teams/${id}`),
    enabled: !!id,
  })
}

/** @deprecated Use useGetTeam instead */
export const useGetWorkspace = useGetTeam

export function useCreateTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      name: string;
      project_path?: string;
      anthropic_base_url?: string;
      project_id?: string;
      template_id?: string;
      role?: TeamRole;
      model?: string;
      environment_variables?: Record<string, string>
    }) =>
      apiClient.post<{ id: string; path: string }>('/api/teams', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.list() })
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

/** @deprecated Use useCreateTeam instead */
export const useCreateWorkspace = useCreateTeam

export function useGetAgentTemplates() {
  return useQuery({
    queryKey: ['agent-templates'],
    queryFn: () => apiClient.get<Array<{ id: string; label: string; description: string }>>('/api/teams/templates'),
  })
}

export function useDeleteTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete<{ deleted: boolean }>(`/api/teams/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.list() })
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

/** @deprecated Use useDeleteTeam instead */
export const useDeleteWorkspace = useDeleteTeam

export function useUpdateTeamRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: TeamRole }) =>
      apiClient.put<{ updated: boolean }>(`/api/teams/${id}`, { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.list() })
    },
  })
}

/** @deprecated Use useUpdateTeamRole instead */
export const useUpdateWorkspaceRole = useUpdateTeamRole

export function useUpdateTeamProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, project_id }: { id: string; project_id: string }) =>
      apiClient.put<{ updated: boolean }>(`/api/teams/${id}/project`, { project_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.list() })
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

/** @deprecated Use useUpdateTeamProject instead */
export const useUpdateWorkspaceProject = useUpdateTeamProject

export function useSaveClaudeMd(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (content: string) =>
      apiClient.put<{ saved: boolean }>(`/api/teams/${id}/claude-md`, { content }),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKeys.detail(id) }),
  })
}

export function useSaveSettings(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (settings: any) =>
      apiClient.put<{ saved: boolean }>(`/api/teams/${id}/settings`, { settings }),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKeys.detail(id) }),
  })
}

export function useGetSkill(teamId: string, skillName: string) {
  return useQuery({
    queryKey: ['teams', teamId, 'skills', skillName] as const,
    queryFn: () => apiClient.get<{ name: string; content: string }>(
      `/api/teams/${teamId}/skills/${skillName}`
    ),
    enabled: !!teamId && !!skillName,
  })
}

export function useInstallSkill(teamId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, content }: { name: string; content: string }) =>
      apiClient.post<{ name: string; installed: boolean }>(
        `/api/teams/${teamId}/skills`,
        { name, content }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKeys.detail(teamId) }),
  })
}

export function useDeleteSkill(teamId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (skillName: string) =>
      apiClient.delete<{ deleted: boolean }>(
        `/api/teams/${teamId}/skills/${skillName}`
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKeys.detail(teamId) }),
  })
}

export function useGetAgent(teamId: string, agentName: string) {
  return useQuery({
    queryKey: ['teams', teamId, 'agents', agentName] as const,
    queryFn: () => apiClient.get<{ name: string; content: string }>(
      `/api/teams/${teamId}/agents/${agentName}`
    ),
    enabled: !!teamId && !!agentName,
  })
}

export function useSaveAgent(teamId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, content }: { name: string; content: string }) =>
      apiClient.put<{ saved: boolean }>(
        `/api/teams/${teamId}/agents/${name}`,
        { content }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKeys.detail(teamId) }),
  })
}

export function useDeleteAgent(teamId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (agentName: string) =>
      apiClient.delete<{ deleted: boolean }>(
        `/api/teams/${teamId}/agents/${agentName}`
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKeys.detail(teamId) }),
  })
}

export function useRenameAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiClient.put<{ old_path: string; new_path: string }>(
        `/api/teams/${id}/rename`,
        { name }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKeys.list() }),
  })
}

export function useGetTeamEnvironments(teamId: string) {
  return useQuery({
    queryKey: ['team-environments', teamId],
    queryFn: () => apiClient.get<{ id: string; name: string; type: string; project_path: string }[]>(`/api/teams/${teamId}/environments`),
    enabled: !!teamId,
  })
}

/** @deprecated Use useGetTeamEnvironments instead */
export const useGetWorkspaceEnvironments = useGetTeamEnvironments

export function useLinkEnvironment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ teamId, environment_id }: { teamId: string; environment_id: string }) =>
      apiClient.post<{ linked: boolean }>(`/api/teams/${teamId}/environments`, {
        environment_id
      }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['team-environments', vars.teamId] }),
  })
}

export function useUnlinkEnvironment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ teamId, environment_id }: { teamId: string; environment_id: string }) =>
      apiFetch<{ unlinked: boolean }>(`/api/teams/${teamId}/environments`, {
        method: 'DELETE',
        body: JSON.stringify({ environment_id })
      }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['team-environments', vars.teamId] }),
  })
}

export function useGetNativeSkills() {
  return useQuery({
    queryKey: ['native-skills'] as const,
    queryFn: () => apiClient.get<Array<{ id: string; name: string; description: string; path: string }>>('/api/native-skills'),
  })
}

export function useInstallNativeSkill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ teamId, skillId }: { teamId: string; skillId: string }) =>
      apiClient.post<{ installed: boolean; path: string }>(
        `/api/teams/${teamId}/native-skills/${skillId}`
      ),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: teamKeys.detail(vars.teamId) }),
  })
}

export function useImportCustomSkill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ teamId, skillName, content }: { teamId: string; skillName: string; content: string }) =>
      apiClient.post<{ created: boolean; path: string }>(
        `/api/teams/${teamId}/skills`,
        { name: skillName, content }
      ),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: teamKeys.detail(vars.teamId) }),
  })
}

export interface AgentModel {
  id: string;
  label: string;
  description: string;
}

export function useGetAgentModels() {
  return useQuery({
    queryKey: ['agent-models'],
    queryFn: () => apiClient.get<AgentModel[]>('/api/marketplace/models'),
    staleTime: Infinity, // doesn't change
  })
}

export function useUpdateTeamModel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, model }: { id: string; model: string }) =>
      apiClient.put(`/api/teams/${id}`, { model }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  })
}

/** @deprecated Use useUpdateTeamModel instead */
export const useUpdateWorkspaceModel = useUpdateTeamModel

export function useImproveClaudeMd() {
  return useMutation({
    mutationFn: ({ teamId, currentContent }: { teamId: string; currentContent: string }) =>
      apiClient.post<{ planId: string; taskId: string; message: string }>(
        `/api/teams/${teamId}/improve-claude-md`,
        { currentContent }
      ),
  })
}

export function useGetNativeAgents() {
  return useQuery({
    queryKey: ['native-agents'] as const,
    queryFn: () => apiClient.get<Array<{ name: string; description: string; model: string; tools: string[]; color: string; file: string }>>('/api/teams/native-agents'),
  })
}

export function useInstallNativeAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ teamId, agentName }: { teamId: string; agentName: string }) =>
      apiClient.post<{ installed: boolean }>(
        `/api/teams/${teamId}/native-agents/${agentName}`
      ),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: teamKeys.detail(vars.teamId) }),
  })
}

export type PlanStatus = 'pending' | 'running' | 'success' | 'error' | 'cancelled'

export type Plan = {
  id: string
  status: PlanStatus
  structured_output?: {
    improvedContent?: string
  }
  error?: string
}

interface UseImprovementStatusResult {
  improvedContent: string | null
  isImproving: boolean
  error: string | null
}

export function useImprovementStatus(
  planId: string | null,
  enabled: boolean = true
): UseImprovementStatusResult {
  const [improvedContent, setImprovedContent] = React.useState<string | null>(null)
  const [isImproving, setIsImproving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    // Don't poll if not enabled or no planId
    if (!enabled || !planId) {
      return
    }

    // Helper function for consistent logging format
    const log = (message: string, data?: any) => {
      const timestamp = new Date().toISOString()
      console.log(`[${timestamp}] [useImprovementStatus] ${message}`, data || '')
    }

    const logWarn = (message: string, data?: any) => {
      const timestamp = new Date().toISOString()
      console.warn(`[${timestamp}] [useImprovementStatus] ${message}`, data || '')
    }

    const logError = (message: string, data?: any) => {
      const timestamp = new Date().toISOString()
      console.error(`[${timestamp}] [useImprovementStatus] ${message}`, data || '')
    }

    // Log when polling starts
    log(`🚀 Starting improvement status polling`, {
      planId,
      enabled,
      maxPollAttempts: 60,
      pollInterval: '2s',
      maxWaitTime: '2.5 minutes'
    })

    setIsImproving(true)
    setError(null)
    setImprovedContent(null)

    let cancelled = false
    let pollingCount = 0
    let successStatusReachedAt: number | null = null
    const MAX_POLL_ATTEMPTS = 60 // Maximum 2 minutes (60 * 2 seconds)
    const SUCCESS_STATUS_POLL_TIMEOUT = 15 // Additional 30 seconds (15 * 2 seconds) after status='success' to wait for structured_output

    const intervalId = setInterval(async () => {
      try {
        pollingCount++
        const plan = await apiClient.get<Plan>(`/api/plans/${planId}`)

        if (cancelled) {
          log('🛑 Polling cancelled')
          return
        }

        // Detailed logging of each poll attempt
        log(`📡 Poll attempt ${pollingCount}/${MAX_POLL_ATTEMPTS + SUCCESS_STATUS_POLL_TIMEOUT}`, {
          planId,
          status: plan.status,
          hasStructuredOutput: !!plan.structured_output,
          hasImprovedContent: !!plan.structured_output?.improvedContent,
          elapsedTime: `${pollingCount * 2}s`,
          successStatusReached: successStatusReachedAt !== null
        })

        // Handle terminal states
        if (plan.status === 'error' || plan.status === 'cancelled') {
          logError(`❌ Plan reached terminal state: ${plan.status}`, {
            planId,
            error: plan.error,
            totalPollAttempts: pollingCount,
            elapsedTime: `${pollingCount * 2}s`
          })
          clearInterval(intervalId)
          setIsImproving(false)
          setError(plan.error || `Plan ${plan.status}`)
          return
        }

        // Handle success state - check if structured_output is present
        if (plan.status === 'success') {
          // Track when we first reach success status
          if (successStatusReachedAt === null) {
            successStatusReachedAt = pollingCount
            log(`✅ Plan status changed to 'success'`, {
              planId,
              pollAttempt: pollingCount,
              hasStructuredOutput: !!plan.structured_output,
              hasImprovedContent: !!plan.structured_output?.improvedContent
            })
          }

          // Check if we have the structured_output with improvedContent
          if (plan.structured_output?.improvedContent) {
            // Success! We have both status='success' AND structured_output
            const contentLength = plan.structured_output.improvedContent.length
            log(`🎉 Improvement complete!`, {
              planId,
              totalPollAttempts: pollingCount,
              elapsedTime: `${pollingCount * 2}s`,
              timeSinceSuccess: successStatusReachedAt ? `${(pollingCount - successStatusReachedAt) * 2}s` : '0s',
              improvedContentLength: contentLength,
              structuredOutputPresent: true
            })
            clearInterval(intervalId)
            setIsImproving(false)
            setImprovedContent(plan.structured_output.improvedContent)
            return
          }

          // Status is 'success' but structured_output is missing
          // This is the race condition we're fixing - continue polling
          const timeSinceSuccess = successStatusReachedAt ? (pollingCount - successStatusReachedAt) * 2 : 0
          logWarn(`⚠️ Status is 'success' but structured_output is missing. Continuing to poll...`, {
            planId,
            timeSinceSuccess: `${timeSinceSuccess}s`,
            pollAttempt: pollingCount,
            remainingTimeout: `${(MAX_POLL_ATTEMPTS + SUCCESS_STATUS_POLL_TIMEOUT - pollingCount) * 2}s`
          })

          // Check if we've exceeded the timeout for waiting after success
          if (pollingCount > MAX_POLL_ATTEMPTS + SUCCESS_STATUS_POLL_TIMEOUT) {
            logError(`⏰ Timeout waiting for structured_output after success`, {
              planId,
              totalPollAttempts: pollingCount,
              elapsedTime: `${pollingCount * 2}s`,
              timeSinceSuccess: `${timeSinceSuccess}s`
            })

            // Try one last direct fetch before giving up
            try {
              log(`🔄 Attempting one last direct fetch before giving up...`)
              const finalPlan = await apiClient.get<{ structured_output?: { improvedContent?: string } }>(`/api/plans/${planId}`)
              if (finalPlan.structured_output?.improvedContent) {
                log(`✅ Found structured_output in final fetch!`)
                clearInterval(intervalId)
                setIsImproving(false)
                setImprovedContent(finalPlan.structured_output.improvedContent)
                return
              }
            } catch (err) {
              logWarn(`⚠️ Final fetch attempt failed:`, err)
            }

            clearInterval(intervalId)
            setIsImproving(false)
            setError('The improvement completed but the result could not be retrieved. The agent may not have saved the output.')
            return
          }

          // Continue polling - structured_output might arrive shortly
          return
        }

        // For 'pending' or 'running' status, continue polling
        // But check if we've exceeded maximum polling time
        if (pollingCount > MAX_POLL_ATTEMPTS + SUCCESS_STATUS_POLL_TIMEOUT) {
          logError(`⏰ Maximum polling time exceeded`, {
            planId,
            totalPollAttempts: pollingCount,
            elapsedTime: `${pollingCount * 2}s`,
            maxAllowedTime: `${(MAX_POLL_ATTEMPTS + SUCCESS_STATUS_POLL_TIMEOUT) * 2}s`
          })

          // Try one last direct fetch before giving up
          try {
            log(`🔄 Attempting one last direct fetch before giving up...`)
            const finalPlan = await apiClient.get<{ structured_output?: { improvedContent?: string } }>(`/api/plans/${planId}`)
            if (finalPlan.structured_output?.improvedContent) {
              log(`✅ Found structured_output in final fetch!`)
              clearInterval(intervalId)
              setIsImproving(false)
              setImprovedContent(finalPlan.structured_output.improvedContent)
              return
            }
          } catch (err) {
            logWarn(`⚠️ Final fetch attempt failed:`, err)
          }

          clearInterval(intervalId)
          setIsImproving(false)
          setError('Plan status polling timed out. The agent may still be running - check the Plans page for details.')
          return
        }

      } catch (err) {
        if (cancelled) {
          log('🛑 Error after cancellation - ignoring')
          return
        }
        logError(`❌ Error fetching plan status`, {
          planId,
          error: err instanceof Error ? err.message : String(err),
          totalPollAttempts: pollingCount,
          elapsedTime: `${pollingCount * 2}s`
        })
        clearInterval(intervalId)
        setIsImproving(false)
        setError(err instanceof Error ? err.message : 'Failed to fetch plan status')
      }
    }, 2000) // Poll every 2 seconds

    // Cleanup function
    return () => {
      if (!cancelled) {
        log(`🧹 Cleaning up polling interval`, {
          planId,
          totalPollAttempts: pollingCount,
          elapsedTime: `${pollingCount * 2}s`
        })
      }
      cancelled = true
      clearInterval(intervalId)
    }
  }, [planId, enabled])

  return { improvedContent, isImproving, error }
}
