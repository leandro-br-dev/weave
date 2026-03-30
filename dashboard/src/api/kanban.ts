import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, apiFetch } from './client';

export interface KanbanTask {
  id: string;
  project_id: string;
  project_name?: string;
  project_description?: string;
  project_settings?: Record<string, any>;
  title: string;
  description: string;
  column: 'backlog' | 'planning' | 'in_progress' | 'done';
  priority: 1 | 2 | 3 | 4 | 5;
  order_index: number;
  workflow_id: string | null;
  result_status: 'success' | 'partial' | 'needs_rework' | null;
  result_notes: string;
  pipeline_status: 'idle' | 'planning' | 'awaiting_approval' | 'running' | 'done' | 'failed';
  planning_started_at: string | null;
  error_message: string;
  workflow_status?: string;
  workflow_name?: string;
  created_at: string;
  updated_at: string;
  /** @deprecated Use KanbanTemplate interface instead - templates are now stored in kanban_templates table */
  is_template: boolean;
  /** @deprecated Use KanbanTemplate interface instead - templates are now stored in kanban_templates table */
  recurrence: string;
  /** @deprecated Use KanbanTemplate interface instead - templates are now stored in kanban_templates table */
  next_run_at: string | null;
  /** @deprecated Use KanbanTemplate interface instead - templates are now stored in kanban_templates table */
  last_run_at: string | null;
}

/**
 * Template interface for the new kanban_templates table
 * Templates are now separate from tasks and can be reused across projects
 */
export interface KanbanTemplate {
  id: string;
  title: string;
  description: string;
  priority: 1 | 2 | 3 | 4 | 5;
  recurrence: '' | 'hourly' | 'daily' | 'weekly_monday' | 'weekly_friday' | 'monthly';
  is_public: boolean;
  project_id: string | null;
  project_name?: string;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export const COLUMNS = [
  { id: 'templates', label: 'Templates' },
  { id: 'backlog', label: 'Backlog' },
  { id: 'planning', label: 'Planning' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'done', label: 'Done' },
] as const;

export const PRIORITY_LABELS: Record<number, string> = {
  1: 'Critical',
  2: 'High',
  3: 'Medium',
  4: 'Low',
  5: 'Minimal'
};

export const PRIORITY_COLORS: Record<number, string> = {
  1: 'bg-red-100 text-red-700 border-red-200',
  2: 'bg-orange-100 text-orange-700 border-orange-200',
  3: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  4: 'bg-blue-100 text-blue-700 border-blue-200',
  5: 'bg-gray-100 text-gray-700 border-gray-200',
};

export const RESULT_STATUS_COLORS: Record<string, string> = {
  success: 'bg-green-100 text-green-700 border-green-200',
  partial: 'bg-amber-100 text-amber-700 border-amber-200',
  needs_rework: 'bg-red-100 text-red-700 border-red-200',
};

export const PIPELINE_STATUS_CONFIG: Record<string, { label: string; className: string; animated?: boolean }> = {
  idle:               { label: '', className: '' },
  planning:           { label: '🤔 Planning...', className: 'text-purple-600', animated: true },
  awaiting_approval:  { label: '⏳ Awaiting approval', className: 'text-amber-600' },
  running:            { label: '⚡ Running', className: 'text-blue-600', animated: true },
  done:               { label: '✓ Done', className: 'text-green-600' },
  failed:             { label: '✗ Failed', className: 'text-red-600' },
};

export const RECURRENCE_PRESETS = [
  { value: '',               label: 'No recurrence' },
  { value: 'hourly',         label: 'Every hour' },
  { value: 'daily',          label: 'Daily at 09:00' },
  { value: 'weekly_monday',  label: 'Every Monday at 09:00' },
  { value: 'weekly_friday',  label: 'Every Friday at 21:00' },
  { value: 'monthly',        label: 'Monthly on the 1st' },
] as const;

export const RECURRENCE_LABELS: Record<string, string> = {
  'hourly': 'Every hour',
  'daily': 'Daily at 09:00',
  'weekly_monday': 'Every Monday',
  'weekly_friday': 'Every Friday at 21:00',
  'monthly': 'Monthly on the 1st',
};

// Hex color values for projects - these are stored in the database
const HEX_COLORS = [
  '#3b82f6',   // blue
  '#22c55e',   // green
  '#a855f7',   // purple
  '#ec4899',   // pink
  '#6366f1',   // indigo
  '#14b8a6',   // teal
  '#f97316',   // orange
  '#ef4444',   // red
  '#06b6d4',   // cyan
  '#10b981',   // emerald
  '#f59e0b',   // amber
  '#84cc16',   // lime
];

/**
 * Generates a deterministic color from a project ID.
 *
 * This function is used as a fallback when a project doesn't have a stored color.
 * It hashes the project ID and maps it to one of 12 predefined colors, ensuring
 * the same project ID always gets the same color.
 *
 * This provides automatic color assignment for projects without requiring user
 * intervention, while still allowing users to override the color by setting
 * project.color in the database.
 *
 * @param projectId - The project ID to generate a color from
 * @returns A hex color code from the HEX_COLORS array
 */
export function getProjectColor(projectId: string): string {
  let hash = 0;
  for (let i = 0; i < projectId.length; i++) {
    hash = ((hash << 5) - hash) + projectId.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return HEX_COLORS[Math.abs(hash) % HEX_COLORS.length];
}

export function useGetKanbanTasks(projectId: string) {
  return useQuery({
    queryKey: ['kanban', projectId],
    queryFn: () => apiClient.get<KanbanTask[]>(`/api/kanban/${projectId}`),
    enabled: !!projectId,
    refetchInterval: 10000,
  });
}

export function useGetAllKanbanTasks() {
  return useQuery({
    queryKey: ['kanban', 'all'],
    queryFn: () => apiClient.get<KanbanTask[]>(`/api/kanban`),
    refetchInterval: 10000,
  });
}

export function useCreateKanbanTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<KanbanTask>) =>
      apiClient.post<KanbanTask>(`/api/kanban/${projectId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban', projectId] });
      qc.invalidateQueries({ queryKey: ['kanban', 'all'] });
    },
  });
}

export function useUpdateKanbanTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<KanbanTask> & { id: string }) =>
      apiClient.put<KanbanTask>(`/api/kanban/${projectId}/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban', projectId] });
      qc.invalidateQueries({ queryKey: ['kanban', 'all'] });
    },
  });
}

export function useDeleteKanbanTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      apiClient.delete(`/api/kanban/${projectId}/${taskId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban', projectId] });
      qc.invalidateQueries({ queryKey: ['kanban', 'all'] });
    },
  });
}

export function useUpdateKanbanPipeline(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: { pipeline_status?: string; workflow_id?: string | null; error_message?: string } }) =>
      apiClient.patch<KanbanTask>(`/api/kanban/${projectId}/${taskId}/pipeline`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban', projectId] });
      qc.invalidateQueries({ queryKey: ['kanban', 'all'] });
    },
  });
}

// Project-agnostic hooks for multi-project views
export function useCreateKanbanTaskAny() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: Partial<KanbanTask> }) =>
      apiClient.post<KanbanTask>(`/api/kanban/${projectId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kanban'] }),
  });
}

export function useUpdateKanbanTaskAny() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, id, ...data }: { projectId: string; id: string } & Partial<KanbanTask>) =>
      apiClient.put<KanbanTask>(`/api/kanban/${projectId}/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kanban'] }),
  });
}

export function useDeleteKanbanTaskAny() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, taskId }: { projectId: string; taskId: string }) =>
      apiClient.delete(`/api/kanban/${projectId}/${taskId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kanban'] }),
  });
}

export function useUpdateKanbanPipelineAny() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, taskId, data }: { projectId: string; taskId: string; data: { pipeline_status?: string; workflow_id?: string | null; error_message?: string } }) =>
      apiClient.patch<KanbanTask>(`/api/kanban/${projectId}/${taskId}/pipeline`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kanban'] }),
  });
}

// Auto-move feature types and hooks
export interface AutoMoveResult {
  moved_tasks: Array<{
    task: KanbanTask;
    from_column: string;
    to_column: string;
  }>;
  reasons: string[];
}

export function useAutoMoveKanban(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient.post<AutoMoveResult>(`/api/kanban/${projectId}/auto-move`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban', projectId] });
      qc.invalidateQueries({ queryKey: ['kanban', 'all'] });
    },
  });
}

export function useAutoMoveKanbanAny() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) =>
      apiClient.post<AutoMoveResult>(`/api/kanban/${projectId}/auto-move`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kanban'] }),
  });
}

// ============================================================================
// TEMPLATE HOOKS - New kanban_templates table
// ============================================================================

/**
 * Get all templates (both public and project-specific)
 */
export function useGetTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: () => apiClient.get<KanbanTemplate[]>(`/api/templates`),
    refetchInterval: 30000,
  });
}

/**
 * Get templates for a specific project (includes project templates + public templates)
 */
export function useGetProjectTemplates(projectId: string) {
  return useQuery({
    queryKey: ['templates', 'project', projectId],
    queryFn: () => apiClient.get<KanbanTemplate[]>(`/api/templates/project/${projectId}`),
    enabled: !!projectId,
    refetchInterval: 30000,
  });
}

/**
 * Create a new template
 */
export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<KanbanTemplate>) =>
      apiClient.post<KanbanTemplate>(`/api/templates`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

/**
 * Update an existing template
 */
export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<KanbanTemplate> & { id: string }) =>
      apiClient.put<KanbanTemplate>(`/api/templates/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

/**
 * Delete a template
 */
export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) =>
      apiClient.delete(`/api/templates/${templateId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useCanAdvance(projectId: string | undefined) {
  return useQuery({
    queryKey: ['kanban', 'can-advance', projectId],
    queryFn: () => apiFetch<{ can_advance: boolean; reason: string; current_counts: { running_workflows: number; planning_tasks: number; in_progress_tasks: number }; limits: { max_concurrent_workflows: number; max_planning_tasks: number; max_in_progress_tasks: number } }>(`/api/kanban/${projectId}/can-advance`),
    enabled: !!projectId,
    refetchInterval: 15000,
  })
}

/**
 * Create a task from a template in a specific project
 */
export function useUseTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, projectId }: { templateId: string; projectId: string }) =>
      apiClient.post<KanbanTask>(`/api/templates/${templateId}/use`, { projectId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban'] });
      qc.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}
