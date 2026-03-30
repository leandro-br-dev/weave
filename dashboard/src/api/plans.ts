import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

export type PlanStatus = 'pending' | 'running' | 'success' | 'failed' | 'awaiting_approval';

export interface Task {
  id: string;
  name: string;
  prompt: string;
  cwd: string;
  workspace: string;
  env_context?: string;
}

export interface Plan {
  id: string;
  name: string;
  status: PlanStatus;
  tasks: Task[];
  client_id?: string;
  project_id?: string;
  workspace_id?: string;
  parent_plan_id?: string;
  rework_prompt?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  updated_at: string;
  result?: string;
  result_status?: 'success' | 'partial' | 'needs_rework';
  result_notes?: string;
  structured_output?: {
    type: string;
    content: any;
    result_status?: string;
    result_notes?: string;
    issues?: Array<{ severity: string; description: string; location?: string }>;
    next_steps?: string;
    improvedContent?: string;
    improvementApproved?: boolean;
    improvementApprovedAt?: string;
  };
}

export interface PlanLog {
  id: string;
  plan_id: string;
  task_id: string;
  message: string;
  created_at: string;
}

export interface CreatePlanRequest {
  name: string;
  tasks: Omit<Task, 'id'>[];
  project_id?: string;
}

export const useGetPlans = (filters?: { project_id?: string }) => {
  const queryString = filters?.project_id
    ? `?project_id=${encodeURIComponent(filters.project_id)}`
    : '';

  return useQuery({
    queryKey: ['plans', filters],
    queryFn: () => apiClient.get<Plan[]>(`/api/plans${queryString}`),
    refetchInterval: (query) => {
      const plans = query.state.data as Plan[] | undefined;
      // Poll every 2s if there are active plans, every 30s otherwise
      const hasActive = plans?.some(
        p => p.status === 'running' || p.status === 'pending'
      );
      return hasActive ? 2000 : 30000;
    },
    refetchIntervalInBackground: false, // pause when tab is not focused
  });
};

export const useGetPlan = (id: string) => {
  return useQuery({
    queryKey: ['plans', id],
    queryFn: () => apiClient.get<Plan>(`/api/plans/${id}`),
    enabled: !!id,
  });
};

export const useGetPlanLogs = (planId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['plans', planId, 'logs'],
    queryFn: () => apiClient.get<PlanLog[]>(`/api/plans/${planId}/logs`),
    enabled: enabled && !!planId,
    refetchInterval: (query) => {
      // Poll every 2 seconds while the plan is running
      const plan = query.state.data as Plan | undefined;
      return plan?.status === 'running' ? 2000 : false;
    },
  });
};

export const useCreatePlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePlanRequest) =>
      apiClient.post<Plan>('/api/plans', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
};

export const useDeletePlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete<{ success: boolean }>(`/api/plans/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
};

export const useExecutePlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<Plan>(`/api/plans/${id}/execute`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['plans', data.id] });
    },
  });
};

export const useResumePlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ success: boolean; message: string }>(`/api/plans/${id}/resume`),
    onSuccess: (_, planId) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['plans', planId] });
    },
  });
};

export const useApprovePlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planId: string) =>
      apiClient.post<Plan>(`/api/plans/${planId}/approve`, {}),
    onSuccess: (_, planId) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['plans', planId] });
    },
  });
};

export interface PlanMetrics {
  total: number;
  success_rate: number;
  avg_duration_seconds: number;
  last_7_days: {
    success: number;
    failed: number;
  };
  by_status: {
    pending: number;
    running: number;
    success: number;
    failed: number;
  };
}

export const useGetMetrics = () => {
  return useQuery({
    queryKey: ['plans', 'metrics'],
    queryFn: () => apiClient.get<PlanMetrics>('/api/plans/metrics'),
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchIntervalInBackground: false,
  });
};

export interface EditPlanRequest {
  name?: string;
  tasks?: Array<{
    id: string;
    name: string;
    prompt: string;
    cwd: string;
    workspace: string;
    tools?: string[];
    permission_mode?: string;
    depends_on?: string[];
  }>;
}

export function useEditPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: EditPlanRequest & { id: string }) =>
      apiClient.put(`/api/plans/${id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['plan', vars.id] });
      qc.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export interface CheckCompletionResponse {
  total_tasks: number;
  completed_tasks: number;
  completed_task_ids: string[];
  plan_status: string;
  auto_completed: boolean;
  message: string;
}

export const useCheckCompletion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planId: string) =>
      apiClient.post<CheckCompletionResponse>(`/api/plans/${planId}/check-completion`),
    onSuccess: (_, planId) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['plans', planId] });
    },
  });
};

export interface ReworkPlanRequest {
  rework_prompt: string;
}

export const useReworkPlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: ReworkPlanRequest & { id: string }) =>
      apiClient.post<Plan>(`/api/plans/${id}/rework`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
};
