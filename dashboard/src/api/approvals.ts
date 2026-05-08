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
  denial_reason: string | null
  notes: string | null
  auto_approve: boolean
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
    mutationFn: ({ id, decision, denial_reason, notes, auto_approve }: {
      id: string
      decision: 'approved' | 'denied'
      denial_reason?: string
      notes?: string
      auto_approve?: boolean
    }) =>
      apiFetch<{ id: string; decision: string }>(
        `/api/approvals/${id}/respond`,
        { method: 'POST', body: JSON.stringify({ decision, denial_reason, notes, auto_approve }) }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approvals'] }),
  })
}
