import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'

export interface QuickActionPayload {
  name?: string
  message: string
  workspace_id: string
  environment_id?: string
  project_id?: string
  native_skill?: string
}

export interface QuickActionResponse {
  id: string
  task_id: string
}

export function useCreateQuickAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: QuickActionPayload) =>
      apiFetch<QuickActionResponse>('/api/quick-actions', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  })
}
