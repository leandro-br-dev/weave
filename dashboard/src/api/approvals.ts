import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'

export type Approval = {
  id: string
  plan_id: string
  plan_name?: string
  task_id: string
  tool: string
  input: string
  reason: string | null
  status: 'pending' | 'approved' | 'denied' | 'timeout'
  created_at: string
  responded_at: string | null
}

export function useGetPendingApprovals() {
  return useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () => apiFetch<Approval[]>('/api/approvals/pending'),
    refetchInterval: 3000,
  })
}

export function useRespondApproval() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approved' | 'denied' }) =>
      apiFetch<{ id: string; decision: string }>(
        `/api/approvals/${id}/respond`,
        { method: 'POST', body: JSON.stringify({ decision }) }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approvals'] }),
  })
}
