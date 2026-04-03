import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router';
import { useGetPlan, useExecutePlan, useDeletePlan, useResumePlan, useApprovePlan, useEditPlan, useCheckCompletion, useReworkPlan } from '@/api/plans';
import { useSaveClaudeMd } from '@/api/workspaces';
import { useLogStream } from '../hooks/useLogStream';
import { cn } from '@/lib/utils';
import { Trash2, Download, StopCircle, RotateCcw, CheckCircle, Pencil, RefreshCw, GitBranch, Paperclip, Layers, Zap, ZoomIn } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ClaudeMdImprovementModal } from '@/components/ClaudeMdImprovementModal';
import { useToast } from '@/contexts/ToastContext';
import { useTranslation } from 'react-i18next';
import { getAttachmentUrl, type AttachmentResponse } from '@/api/uploads';
import { getApiUrl, getActiveToken } from '@/api/client';
import { ImageLightbox } from '@/components/ImageLightbox';

// Hook to fetch plan attachment details
function usePlanAttachments(planId: string | undefined, attachmentIds: string[] | undefined) {
  return useQuery({
    queryKey: ['plans', planId, 'attachment-details'],
    queryFn: async (): Promise<AttachmentResponse[]> => {
      if (!planId) return [];
      const token = getActiveToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${getApiUrl()}/api/plans/${planId}/attachments`, { headers });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data ?? [];
    },
    enabled: !!(planId && attachmentIds && attachmentIds.length > 0),
    staleTime: 5 * 60 * 1000,
  });
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  running: 'bg-blue-100 text-blue-800',
  success: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  awaiting_approval: 'bg-amber-100 text-amber-800',
};

const improvementStatusColors = {
  awaiting_approval: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
};

interface StatusBadgeProps {
  status: keyof typeof statusColors;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        statusColors[status]
      )}
    >
      {t(`status.${status}`)}
    </span>
  );
}

interface ImprovementStatusBadgeProps {
  status: 'awaiting_approval' | 'approved';
}

function ImprovementStatusBadge({ status }: ImprovementStatusBadgeProps) {
  const { t } = useTranslation();
  const colors = improvementStatusColors[status];
  const label = status === 'awaiting_approval' ? t('planDetail.improvementStatus.awaitingApproval') : t('planDetail.improvementStatus.approved');

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        colors
      )}
    >
      {label}
    </span>
  );
}

interface EditPlanModalProps {
  plan: any;
  onClose: () => void;
}

function EditPlanModal({ plan, onClose }: EditPlanModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(plan.name);
  const [tasks, setTasks] = useState<any[]>(
    Array.isArray(plan.tasks) ? plan.tasks : []
  );
  const editPlan = useEditPlan();

  const handleSave = async () => {
    await editPlan.mutateAsync({ id: plan.id, name, tasks });
    onClose();
  };

  const updateTask = (index: number, field: string, value: string) => {
    setTasks(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };

  const moveTask = (index: number, dir: 'up' | 'down') => {
    const next = [...tasks];
    const swap = dir === 'up' ? index - 1 : index + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    setTasks(next);
  };

  const removeTask = (index: number) => {
    setTasks(prev => prev.filter((_, i) => i !== index));
  };

  const addTask = () => {
    setTasks(prev => [...prev, {
      id: `task-${Date.now()}`,
      name: '',
      prompt: '',
      cwd: '',
      workspace: '',
      tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob'],
      permission_mode: 'acceptEdits',
      depends_on: [],
    }]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-lg border border-gray-200 p-6 max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-gray-900">{t('planDetail.editWorkflow')}</h3>

        {/* Nome */}
        <Input
          label={t('planDetail.planName')}
          value={name}
          onChange={e => setName(e.target.value)}
        />

        {/* Tasks */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {tasks.map((task, i) => (
            <div key={task.id || i} className="border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">{t('planDetail.taskNumber', { number: i + 1 })}</span>
                <div className="flex gap-1">
                  <button onClick={() => moveTask(i, 'up')} disabled={i === 0}
                    className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30">▲</button>
                  <button onClick={() => moveTask(i, 'down')} disabled={i === tasks.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30">▼</button>
                  <button onClick={() => removeTask(i)}
                    className="p-1 text-gray-400 hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <Input label={t('planDetail.name')} value={task.name}
                onChange={e => updateTask(i, 'name', e.target.value)} />
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">{t('planDetail.prompt')}</label>
                <textarea
                  value={task.prompt}
                  onChange={e => updateTask(i, 'prompt', e.target.value)}
                  rows={4}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <Input label={t('planDetail.cwd')} value={task.cwd}
                onChange={e => updateTask(i, 'cwd', e.target.value)} />
              <Input label={t('planDetail.workspace')} value={task.workspace}
                onChange={e => updateTask(i, 'workspace', e.target.value)} />
            </div>
          ))}
          <button onClick={addTask}
            className="w-full border border-dashed border-gray-300 rounded-lg p-2 text-xs text-gray-500 hover:border-gray-500 hover:text-gray-700 transition-colors">
            {t('planDetail.addTask')}
          </button>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
          <Button variant="secondary" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" size="sm" onClick={handleSave} loading={editPlan.isPending}>
            {t('planDetail.saveChanges')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PlanDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: plan, isLoading: planLoading, error: planError } = useGetPlan(id || '');
  const executeMutation = useExecutePlan();
  const deletePlan = useDeletePlan();
  const resumePlan = useResumePlan();
  const approvePlan = useApprovePlan();
  const checkCompletion = useCheckCompletion();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  // Initialize saveClaudeMd hook with workspace_id from plan
  const saveClaudeMd = useSaveClaudeMd(plan?.workspace_id || '');
  const forceStop = useMutation({
    mutationFn: (planId: string) =>
      apiFetch(`/api/plans/${planId}/force-stop`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      queryClient.invalidateQueries({ queryKey: ['plan', id] })
    },
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmForceStop, setConfirmForceStop] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImprovementModal, setShowImprovementModal] = useState(false);
  const [improvedContent, setImprovedContent] = useState('');
  const [hasShownImprovement, setHasShownImprovement] = useState(false);
  const reworkPlan = useReworkPlan();
  const { data: planAttachments = [] } = usePlanAttachments(id, plan?.attachments);
  const [showReworkModal, setShowReworkModal] = useState(false);
  const [reworkPrompt, setReworkPrompt] = useState('');
  const [reworkMode, setReworkMode] = useState<'full_workflow' | 'quick_action'>('full_workflow');
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Image lightbox state
  const [lightboxImage, setLightboxImage] = useState<{ src: string; fileName: string } | null>(null);

  // Determine back navigation from router state
  const backTo = location.state?.from || '/';
  const backLabel = location.state?.fromLabel || t('createPlan.plans');

  const handleExport = () => {
    if (!plan) return;
    const exportData = {
      name: plan.name,
      tasks: Array.isArray(plan.tasks) ? plan.tasks : JSON.parse(plan.tasks as string),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${plan.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Use SSE streaming for logs
  const { logs, streamStatus } = useLogStream(id || '', !!id);

  const isRunning = plan?.status === 'running';

  // Check if there are completion logs present
  const hasCompletionLogs = logs.some(log =>
    log.message.includes('✔ finished') ||
    log.message.includes('Task completed') ||
    log.level === 'success'
  );

  // Handle check completion button click
  const handleCheckCompletion = async () => {
    if (!id) return;

    try {
      const result = await checkCompletion.mutateAsync(id);

      if (result.auto_completed) {
        showToast('success', t('planDetail.autoCompleted'), result.message);
      } else if (result.completed_tasks > 0) {
        showToast(
          'info',
          t('planDetail.completionStatus'),
          `${result.completed_tasks} ${t('common.of')} ${result.total_tasks} ${t('common.tasks')}. ${t('planDetail.planStatus')}: ${result.plan_status}`
        );
      } else {
        showToast('info', t('planDetail.noCompletedTasks'), t('planDetail.noTaskCompletionPatterns'));
      }
    } catch (error) {
      console.error('Error checking completion:', error);
      showToast(
        'error',
        t('planDetail.failedToCheckCompletion'),
        error instanceof Error ? error.message : t('planDetail.unknownError')
      );
    }
  };

  const handleRework = async () => {
    if (!id || !reworkPrompt.trim()) return;
    try {
      const newPlan = await reworkPlan.mutateAsync({ id, rework_prompt: reworkPrompt.trim(), rework_mode: reworkMode });
      setShowReworkModal(false);
      setReworkPrompt('');
      setReworkMode('full_workflow');
      showToast('success', t('planDetail.reworkSuccess'));
      navigate(`/plans/${newPlan.id}`, { state: { from: `/plans/${id}`, fromLabel: plan?.name?.substring(0, 30) } });
    } catch (error) {
      console.error('Error reworking plan:', error);
      showToast('error', t('planDetail.reworkError'), error instanceof Error ? error.message : t('planDetail.unknownError'));
    }
  };

  // Auto-scroll to bottom when running or streaming
  useEffect(() => {
    if ((isRunning || streamStatus === 'streaming') && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isRunning, streamStatus]);

  // Show improvement modal when plan has improvedContent
  useEffect(() => {
    if (
      plan?.status === 'success' &&
      plan?.structured_output?.improvedContent &&
      !hasShownImprovement
    ) {
      setImprovedContent(plan.structured_output.improvedContent);
      setShowImprovementModal(true);
      setHasShownImprovement(true);
    }
  }, [plan, hasShownImprovement]);

  if (planLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">{t('planDetail.loading')}</div>
      </div>
    );
  }

  if (planError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">{t('planDetail.errorLoading')}: {(planError as Error).message}</div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">{t('planDetail.notFound')}</div>
      </div>
    );
  }

  const handleExecute = () => {
    if (id) {
      executeMutation.mutate(id);
    }
  };

  const handleApproveImprovement = async (content: string) => {
    // Check if we have a workspace_id
    if (!plan?.workspace_id) {
      showToast('error', t('planDetail.cannotSaveImprovements'), t('planDetail.workspaceIdNotFound'));
      console.error('Cannot save improvements: no workspace_id in plan', plan);
      return;
    }

    try {
      // Save the improved content to the workspace
      await saveClaudeMd.mutateAsync(content);

      // Update the plan's structured_output to mark the improvement as approved
      await apiFetch(`/api/plans/${plan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structured_output: {
            ...plan.structured_output,
            improvementApproved: true,
            improvementApprovedAt: new Date().toISOString(),
          }
        })
      });

      // Invalidate queries to refresh the plan data
      queryClient.invalidateQueries({ queryKey: ['plan', id] });

      // Show success message
      showToast('success', t('planDetail.claudeMdUpdated'), t('planDetail.improvementsSaved'));

      // Close the modal
      setShowImprovementModal(false);
    } catch (error) {
      console.error('Error saving improved CLAUDE.md:', error);
      showToast('error', t('planDetail.failedToSaveImprovements'), error instanceof Error ? error.message : t('planDetail.unknownError'));
    }
  };

  // Defensive parsing for tasks field
  const tasks = Array.isArray(plan.tasks)
    ? plan.tasks
    : JSON.parse(plan.tasks as string);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(backTo)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← {backLabel}
              </button>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{plan.name}</h1>
                {plan.parent_plan_id && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
                    <GitBranch className="h-3 w-3" />
                    {t('planDetail.reworkBadge')}
                    {plan.rework_mode === 'quick_action' && (
                      <Zap className="h-3 w-3 ml-1" />
                    )}
                  </span>
                )}
              </div>
            </div>
            <StatusBadge status={plan.status} />
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 border text-sm rounded hover:bg-gray-50"
              title={t('planDetail.exportTitle')}
            >
              <Download className="h-4 w-4" />
              {t('planDetail.export')}
            </button>
            {plan.status === 'pending' && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowEditModal(true)}
                  title={t('planDetail.editPlan')}
                >
                  <Pencil className="h-3.5 w-3.5" /> {t('planDetail.edit')}
                </Button>
                <button
                  disabled
                  className="rounded-md bg-gray-400 px-4 py-2 text-sm font-semibold text-white shadow-sm cursor-not-allowed"
                >
                  {t('planDetail.awaitingDaemon')}
                </button>
              </>
            )}
            {plan.status === 'awaiting_approval' && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowEditModal(true)}
                  title={t('planDetail.editPlan')}
                >
                  <Pencil className="h-3.5 w-3.5" /> {t('planDetail.edit')}
                </Button>
                <button
                  onClick={() => approvePlan.mutate(plan.id)}
                  disabled={approvePlan.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={t('planDetail.approveAndRunTitle')}
                >
                  <CheckCircle className="h-4 w-4" />
                  {approvePlan.isPending ? t('planDetail.approving') : t('planDetail.approveAndRun')}
                </button>
              </>
            )}
            {(plan.status === 'running' || plan.status === 'pending') && (
              <>
                {plan.status === 'running' && hasCompletionLogs && (
                  <button
                    onClick={handleCheckCompletion}
                    disabled={checkCompletion.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-orange-300 text-orange-600 text-sm rounded hover:bg-orange-50 disabled:opacity-50"
                    title={t('planDetail.recoverStuckTasksTitle')}
                  >
                    <RefreshCw className="h-4 w-4" />
                    {checkCompletion.isPending ? t('planDetail.checking') : t('planDetail.recoverStuckTasks')}
                  </button>
                )}
                <button
                  onClick={() => setConfirmForceStop(true)}
                  disabled={forceStop.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-red-300 text-red-600 text-sm rounded hover:bg-red-50 disabled:opacity-50"
                  title={t('planDetail.forceStopTitle')}
                >
                  <StopCircle className="h-4 w-4" />
                  {forceStop.isPending ? t('planDetail.stopping') : t('planDetail.forceStop')}
                </button>
              </>
            )}
            {(plan.status === 'failed' || plan.status === 'success') && (
              <>
                {plan.status === 'failed' && (
                  <button
                    onClick={() => resumePlan.mutate(plan.id)}
                    disabled={resumePlan.isPending}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 border border-green-300 text-green-600 text-sm rounded hover:bg-green-50',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                    title={t('planDetail.resumeTitle')}
                  >
                    <RotateCcw className="h-4 w-4" />
                    {resumePlan.isPending ? t('planDetail.resuming') : t('planDetail.resume')}
                  </button>
                )}
                {plan.structured_output?.improvedContent && !plan.structured_output?.improvementApproved && (
                  <button
                    onClick={() => {
                      if (plan.structured_output?.improvedContent) {
                        setImprovedContent(plan.structured_output.improvedContent);
                        setShowImprovementModal(true);
                      }
                    }}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 border border-amber-300 text-amber-600 text-sm rounded hover:bg-amber-50',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                    title={t('planDetail.reviewApproveTitle')}
                  >
                    <CheckCircle className="h-4 w-4" />
                    {t('planDetail.reviewApprove')}
                  </button>
                )}
                <button
                  onClick={() => setShowReworkModal(true)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 border border-purple-300 text-purple-600 text-sm rounded hover:bg-purple-50',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                  title={t('planDetail.reworkTitle')}
                >
                  <GitBranch className="h-4 w-4" />
                  {t('planDetail.rework')}
                </button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowEditModal(true)}
                  title={t('planDetail.editPlan')}
                >
                  <Pencil className="h-3.5 w-3.5" /> {t('planDetail.edit')}
                </Button>
                <button
                  onClick={handleExecute}
                  disabled={executeMutation.isPending}
                  className={cn(
                    'rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm',
                    'hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {executeMutation.isPending ? t('planDetail.requeueing') : t('planDetail.retryPlan')}
                </button>
              </>
            )}
            {plan.status !== 'running' && (
              confirmDelete ? (
                <span className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">{t('planDetail.confirmDelete')}</span>
                  <button
                    onClick={async () => {
                      await deletePlan.mutateAsync(plan.id);
                      navigate('/');
                    }}
                    className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                  >
                    {t('planDetail.delete')}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1.5 border text-sm rounded hover:bg-gray-50"
                  >
                    {t('planDetail.cancel')}
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 text-sm rounded hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  {t('planDetail.delete')}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Info Row */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h2 className="text-lg font-semibold leading-7 text-gray-900 mb-4">{t('planDetail.planInformation')}</h2>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('planDetail.clientId')}</dt>
              <dd className="mt-1 text-sm text-gray-900">{plan.client_id || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('planDetail.status')}</dt>
              <dd className="mt-1 text-sm text-gray-900">
                <StatusBadge status={plan.status} />
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('planDetail.created')}</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {plan.created_at ? new Date(plan.created_at).toLocaleString() : 'N/A'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('planDetail.started')}</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {plan.started_at ? new Date(plan.started_at).toLocaleString() : t('planDetail.notStarted')}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('planDetail.completed')}</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {plan.completed_at ? new Date(plan.completed_at).toLocaleString() : t('planDetail.notCompleted')}
              </dd>
            </div>
            {plan.parent_plan_id && (
              <div>
                <dt className="text-sm font-medium text-gray-500">{t('planDetail.parentPlan')}</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  <button
                    onClick={() => navigate(`/plans/${plan.parent_plan_id}`)}
                    className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                  >
                    {t('planDetail.viewParentPlan')} →
                  </button>
                </dd>
              </div>
            )}
            {plan.structured_output?.improvedContent && (
              <>
                <div>
                  <dt className="text-sm font-medium text-gray-500">{t('planDetail.improvementStatus')}</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <ImprovementStatusBadge
                      status={plan.structured_output?.improvementApproved ? 'approved' : 'awaiting_approval'}
                    />
                  </dd>
                </div>
                {plan.structured_output?.improvementApproved && plan.structured_output?.improvementApprovedAt && (
                  <>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">{t('planDetail.approvedAt')}</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {new Date(plan.structured_output.improvementApprovedAt).toLocaleString()}
                      </dd>
                    </div>
                    {plan.workspace_id && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">{t('planDetail.actions')}</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          <button
                            onClick={() => navigate(`/workspaces/${plan.workspace_id}`)}
                            className="text-orange-600 hover:text-orange-800 text-sm font-medium"
                          >
                            {t('planDetail.viewUpdatedClaudeMd')} →
                          </button>
                        </dd>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </dl>
        </div>
      </div>

      {/* Plan-level attachments (not linked to specific tasks) */}
      {planAttachments.length > 0 && (
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg font-semibold leading-7 text-gray-900 mb-4 flex items-center gap-2">
              <Paperclip className="h-5 w-5 text-gray-400" />
              {t('planDetail.attachments', 'Anexos')}
            </h2>
            {(() => {
              // Check if any task has task-level attachments
              const tasksWithAttachments = tasks.filter((t: any) => (t.attachment_ids || []).length > 0);
              // Plan-level attachments = all attachments minus those referenced by tasks
              const taskReferencedIds = tasksWithAttachments.flatMap((t: any) => t.attachment_ids || []);
              const planLevelAttachments = planAttachments.filter(a => !taskReferencedIds.includes(a.id));
              const planImageAttachments = planLevelAttachments.filter(a => a.file_type?.startsWith('image/'));
              const planOtherAttachments = planLevelAttachments.filter(a => !a.file_type?.startsWith('image/'));

              return (
                <>
                  {planImageAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-3">
                      {planImageAttachments.map(img => (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => setLightboxImage({ src: getAttachmentUrl(img.id), fileName: img.file_name })}
                          className="group/img relative block"
                          title={img.file_name}
                        >
                          <img
                            src={getAttachmentUrl(img.id)}
                            alt={img.file_name}
                            className="h-24 w-24 rounded-lg object-cover border border-gray-200 dark:border-gray-600 shadow-sm group-hover/img:opacity-80 group-hover/img:ring-2 group-hover/img:ring-blue-400 transition-all"
                          />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity bg-black/20 rounded-lg">
                            <ZoomIn className="h-5 w-5 text-white drop-shadow-md" />
                          </div>
                          <span className="block text-xs text-gray-500 mt-1 truncate max-w-[100px] text-center">{img.file_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {planOtherAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {planOtherAttachments.map(file => (
                        <a
                          key={file.id}
                          href={getAttachmentUrl(file.id)}
                          download={file.file_name}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          title={file.file_name}
                        >
                          <Download className="h-4 w-4" />
                          <span className="truncate max-w-[180px]">{file.file_name}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Tasks */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h2 className="text-lg font-semibold leading-7 text-gray-900 mb-4">{t('planDetail.tasks')}</h2>
          <dl className="space-y-4">
            {tasks.map((task: any, index: number) => {
              const taskAttachmentIds = task.attachment_ids || [];
              const hasAttachments = taskAttachmentIds.length > 0;
              const imageAttachments = planAttachments.filter(a =>
                taskAttachmentIds.includes(a.id) && a.file_type?.startsWith('image/')
              );
              const otherAttachments = planAttachments.filter(a =>
                taskAttachmentIds.includes(a.id) && !a.file_type?.startsWith('image/')
              );

              return (
              <div key={task.id} className="border-l-4 border-orange-500 pl-4 py-2">
                <div className="flex items-center justify-between mb-2">
                  <dt className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    {index + 1}. {task.name}
                    {hasAttachments && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                        <Paperclip className="h-3 w-3" />
                        {taskAttachmentIds.length}
                      </span>
                    )}
                  </dt>
                  <dd className="text-xs text-gray-500">{t('planDetail.taskId')}: {task.id}</dd>
                </div>
                {task.prompt && (
                  <dd className="text-sm text-gray-600 mb-2">{task.prompt}</dd>
                )}
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <span>{t('planDetail.cwd')}: {task.cwd}</span>
                  <span>{t('planDetail.workspace')}: {task.workspace}</span>
                </div>
                {/* Image previews */}
                {imageAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {imageAttachments.map(img => (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => setLightboxImage({ src: getAttachmentUrl(img.id), fileName: img.file_name })}
                        className="group/img relative block"
                        title={img.file_name}
                      >
                        <img
                          src={getAttachmentUrl(img.id)}
                          alt={img.file_name}
                          className="h-16 w-16 rounded-md object-cover border border-gray-200 dark:border-gray-600 group-hover/img:opacity-80 group-hover/img:ring-2 group-hover/img:ring-blue-400 transition-all"
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                          <ZoomIn className="h-4 w-4 text-white drop-shadow-md" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {/* Other file attachments */}
                {otherAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {otherAttachments.map(file => (
                      <a
                        key={file.id}
                        href={getAttachmentUrl(file.id)}
                        download={file.file_name}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title={file.file_name}
                      >
                        <Download className="h-3 w-3" />
                        <span className="truncate max-w-[120px]">{file.file_name}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
              );
            })}
          </dl>
        </div>
      </div>

      {/* Result */}
      {plan.result && (
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg font-semibold leading-7 text-gray-900 mb-4">{t('planDetail.result')}</h2>
            <div className="bg-gray-50 rounded-md p-4">
              <pre className="text-sm text-gray-900 whitespace-pre-wrap">{plan.result}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Review Result */}
      {plan.result_status && (() => {
        const isSuccess = plan.result_status === 'success';
        const isPartial = plan.result_status === 'partial';
        const bgClass = isSuccess ? 'bg-green-50 border-green-200' :
                        isPartial ? 'bg-amber-50 border-amber-200' :
                        'bg-red-50 border-red-200';
        const textClass = isSuccess ? 'text-green-900' :
                         isPartial ? 'text-amber-900' :
                         'text-red-900';
        const badgeClass = isSuccess ? 'bg-green-100 text-green-800' :
                           isPartial ? 'bg-amber-100 text-amber-800' :
                           'bg-red-100 text-red-800';
        const statusLabel = isSuccess ? t('planDetail.resultStatus.success') :
                            isPartial ? t('planDetail.resultStatus.partial') :
                            t('planDetail.resultStatus.needs_rework');

        return (
          <div className={`shadow sm:rounded-lg border ${bgClass}`}>
            <div className="px-4 py-5 sm:px-6">
              <h2 className={`text-lg font-semibold leading-7 mb-4 ${textClass}`}>
                {t('planDetail.reviewResult')}
              </h2>
              <div className="mb-3">
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${badgeClass}`}>
                  {statusLabel}
                </span>
              </div>
            {plan.result_notes && (
              <div className="mb-3">
                <h3 className="text-sm font-medium text-gray-700 mb-1">{t('planDetail.reviewNotes')}</h3>
                <p className="text-sm text-gray-900 bg-white bg-opacity-60 rounded-md p-3">
                  {plan.result_notes}
                </p>
              </div>
            )}
            {plan.structured_output?.issues && plan.structured_output.issues.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">{t('planDetail.issuesFound')}</h3>
                <div className="space-y-2">
                  {plan.structured_output.issues.map((issue: any, i: number) => (
                    <div key={i} className={`bg-white bg-opacity-60 rounded-md p-3 border-l-4 ${
                      issue.severity === 'critical' ? 'border-red-500' :
                      issue.severity === 'major' ? 'border-orange-500' :
                      'border-yellow-500'
                    }`}>
                      <div className="flex items-start gap-2">
                        <span className={`text-xs font-semibold uppercase rounded px-1.5 py-0.5 ${
                          issue.severity === 'critical' ? 'bg-red-100 text-red-700' :
                          issue.severity === 'major' ? 'bg-orange-100 text-orange-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {issue.severity}
                        </span>
                        <p className="text-sm text-gray-900 flex-1">{issue.description}</p>
                      </div>
                      {issue.location && (
                        <p className="text-xs text-gray-500 font-mono mt-1 ml-1">
                          📍 {issue.location}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {plan.structured_output?.next_steps && (
              <div className="mt-3">
                <h3 className="text-sm font-medium text-gray-700 mb-1">{t('planDetail.nextSteps')}</h3>
                <p className="text-sm text-gray-900 bg-white bg-opacity-60 rounded-md p-3">
                  {plan.structured_output.next_steps}
                </p>
              </div>
            )}
          </div>
        </div>
        );
      })()}

      {/* Logs */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold leading-7 text-gray-900">{t('planDetail.logs')}</h2>
            {streamStatus === 'streaming' && (
              <span className="flex items-center gap-1 text-xs text-green-500">
                <span className="animate-pulse">●</span> {t('planDetail.live')}
              </span>
            )}
            {streamStatus === 'done' && (
              <span className="text-xs text-gray-400">{t('planDetail.completed')}</span>
            )}
            {streamStatus === 'connecting' && (
              <span className="text-xs text-blue-500">{t('planDetail.connecting')}</span>
            )}
            {streamStatus === 'error' && (
              <span className="text-xs text-red-500">{t('planDetail.connectionError')}</span>
            )}
          </div>

          {logs.length === 0 ? (
            <div className="text-gray-500 text-sm">{t('planDetail.noLogsAvailable')}</div>
          ) : (
            <div className="bg-gray-900 rounded-md p-4 h-96 overflow-y-auto font-mono text-sm">
              {logs.map((log) => (
                <div key={log.id} className={`mb-1 ${
                  log.level === 'error' ? 'text-red-400' :
                  log.level === 'debug' ? 'text-gray-400' :
                  'text-gray-100'
                }`}>
                  <span className="text-gray-400 mr-2">
                    {new Date(log.created_at).toLocaleTimeString()}
                  </span>
                  <span className="text-blue-400 mr-2">[{log.task_id}]</span>
                  {log.message}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Force Stop Confirmation Dialog */}
      <ConfirmDialog
        open={confirmForceStop}
        title={t('planDetail.forceStopConfirmTitle')}
        description={t('planDetail.forceStopConfirmDescription')}
        confirmLabel={t('planDetail.forceStop')}
        variant="danger"
        onConfirm={() => {
          forceStop.mutate(plan.id);
          setConfirmForceStop(false);
        }}
        onCancel={() => setConfirmForceStop(false)}
        loading={forceStop.isPending}
      />

      {/* Edit Plan Modal */}
      {showEditModal && (
        <EditPlanModal
          plan={plan}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {/* AI Improvement Modal */}
      <ClaudeMdImprovementModal
        isOpen={showImprovementModal}
        improvedContent={improvedContent}
        onApprove={handleApproveImprovement}
        onDiscard={() => {
          setShowImprovementModal(false);
        }}
      />

      {/* Rework Modal */}
      {showReworkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => { setShowReworkModal(false); setReworkMode('full_workflow'); }} />
          <div className="relative bg-white rounded-lg border border-gray-200 p-6 max-w-lg w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('planDetail.reworkTitle')}</h3>
            <p className="text-sm text-gray-500 mb-4">{t('planDetail.reworkDescription')}</p>

            {/* Rework Mode Selector */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 block mb-2">{t('planDetail.reworkModeTitle')}</label>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setReworkMode('full_workflow')}
                  className={cn(
                    'w-full flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-colors',
                    reworkMode === 'full_workflow'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  )}
                >
                  <Layers className={cn(
                    'w-5 h-5 mt-0.5 flex-shrink-0',
                    reworkMode === 'full_workflow' ? 'text-purple-600' : 'text-gray-400'
                  )} />
                  <div className="min-w-0">
                    <div className={cn(
                      'text-sm font-medium',
                      reworkMode === 'full_workflow' ? 'text-purple-900' : 'text-gray-700'
                    )}>
                      {reworkMode === 'full_workflow' && (
                        <span className="inline-block w-2 h-2 rounded-full bg-purple-500 mr-2 align-middle" />
                      )}
                      {t('planDetail.reworkModeFullWorkflow')}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {t('planDetail.reworkModeFullWorkflowDesc')}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setReworkMode('quick_action')}
                  className={cn(
                    'w-full flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-colors',
                    reworkMode === 'quick_action'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  )}
                >
                  <Zap className={cn(
                    'w-5 h-5 mt-0.5 flex-shrink-0',
                    reworkMode === 'quick_action' ? 'text-purple-600' : 'text-gray-400'
                  )} />
                  <div className="min-w-0">
                    <div className={cn(
                      'text-sm font-medium',
                      reworkMode === 'quick_action' ? 'text-purple-900' : 'text-gray-700'
                    )}>
                      {reworkMode === 'quick_action' && (
                        <span className="inline-block w-2 h-2 rounded-full bg-purple-500 mr-2 align-middle" />
                      )}
                      {t('planDetail.reworkModeQuickAction')}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {t('planDetail.reworkModeQuickActionDesc')}
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 block mb-1">{t('planDetail.reworkPromptLabel')}</label>
              <textarea
                value={reworkPrompt}
                onChange={e => setReworkPrompt(e.target.value)}
                rows={4}
                placeholder={t('planDetail.reworkPromptPlaceholder')}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-purple-500"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
              <Button variant="secondary" size="sm" onClick={() => { setShowReworkModal(false); setReworkPrompt(''); setReworkMode('full_workflow'); }}>{t('planDetail.cancel')}</Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleRework}
                disabled={!reworkPrompt.trim() || reworkPlan.isPending}
                loading={reworkPlan.isPending}
              >
                {reworkPlan.isPending ? t('planDetail.reworking') : t('planDetail.reworkSubmit')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {lightboxImage && (
        <ImageLightbox
          src={lightboxImage.src}
          fileName={lightboxImage.fileName}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </div>
  );
}
