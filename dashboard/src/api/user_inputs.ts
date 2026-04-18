import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'

export type UserInput = {
  id: string
  plan_id: string
  plan_name?: string
  task_id: string
  question: string
  context: string | null
  response: string | null
  status: 'pending' | 'answered' | 'timeout'
  created_at: string
  responded_at: string | null
}

export function useGetPendingUserInputs() {
  return useQuery({
    queryKey: ['user-inputs', 'pending'],
    queryFn: () => apiFetch<UserInput[]>('/api/user-inputs/pending'),
    refetchInterval: 3000,
  })
}

export function useRespondUserInput() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, response }: { id: string; response: string }) =>
      apiFetch<{ id: string; response: string }>(
        `/api/user-inputs/${id}/respond`,
        { method: 'POST', body: JSON.stringify({ response }) }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-inputs'] }),
  })
}
