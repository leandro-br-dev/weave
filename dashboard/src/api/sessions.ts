import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'

export function useGetSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: () => apiFetch<any[]>('/api/sessions'),
    refetchInterval: 10000, // 10 seconds = 6 requests/minute (session list changes infrequently)
  })
}

export function useGetSession(id: string) {
  return useQuery({
    queryKey: ['session', id],
    queryFn: () => apiFetch<any>(`/api/sessions/${id}`),
    enabled: !!id,
    refetchInterval: 5000, // 5 seconds = 12 requests/minute (balance between freshness and performance)
  })
}

export function useCreateSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      name?: string
      project_id?: string
      workspace_path: string
      environment_id?: string
    }) => apiFetch('/api/sessions', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  })
}

export function useUpdateSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiFetch(`/api/sessions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
      qc.invalidateQueries({ queryKey: ['session', vars.id] })
    },
  })
}

export function useSendMessage(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { content: string; attachment_ids?: string[] }) =>
      apiFetch(`/api/sessions/${sessionId}/message`, {
        method: 'POST',
        body: JSON.stringify({
          content: data.content,
          ...(data.attachment_ids?.length ? { attachment_ids: data.attachment_ids } : {}),
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session', sessionId] }),
  })
}

export function useDeleteSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/sessions/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  })
}

export function useDeleteMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sessionId, messageId }: { sessionId: string; messageId: string }) =>
      apiFetch(`/api/sessions/${sessionId}/messages/${messageId}`, { method: 'DELETE' }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['session', vars.sessionId] }),
  })
}

export function useClearHistory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch(`/api/sessions/${sessionId}/messages`, { method: 'DELETE' }),
    onSuccess: (_, sessionId) => qc.invalidateQueries({ queryKey: ['session', sessionId] }),
  })
}
