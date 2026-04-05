import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Link2, LayoutGrid, CheckCircle, Zap, Play, Bookmark, BookmarkCheck, RefreshCw, Paperclip, ArrowRight } from 'lucide-react';
import { PageHeader, Button, Select, EmptyState, ConfirmDialog, Switch, ProjectIcon, ProjectSelectDropdown, FileAttachmentInput } from '@/components';
import { type FileAttachment } from '@/components';
import { useUploadFiles, getAttachmentUrl } from '@/api/uploads';
import { kanbanColors, darkModeKanbanColors } from '@/lib/colors';
import { useGetProjects, useUpdateProject } from '@/api/projects';
import { useApprovePlan } from '@/api/plans';
import { useToast } from '@/contexts/ToastContext';
import {
  useGetAllKanbanTasks,
  useCreateKanbanTaskAny,
  useUpdateKanbanTaskAny,
  useDeleteKanbanTaskAny,
  useUpdateKanbanPipelineAny,
  useAutoMoveKanbanAny,
  useGetTemplates,
  useUseTemplate,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useCanAdvance,
  getProjectColor,
  COLUMNS,
  PRIORITY_COLORS,
  RESULT_STATUS_COLORS,
  PIPELINE_STATUS_CONFIG,
  RECURRENCE_PRESETS,
  RECURRENCE_LABELS,
  type KanbanTask,
  type KanbanTemplate,
} from '@/api/kanban';

// Helper function to check if a column ID is templates
function isTemplatesColumn(columnId: string): columnId is 'templates' {
  return columnId === 'templates';
}

// Helper function to get project color from the projects array
function getTaskProjectColor(projectId: string, projects: Array<{ id: string; color?: string }>): string {
  const project = projects.find(p => p.id === projectId);
  // Use stored color if available, otherwise generate deterministic color from project ID
  return project?.color || getProjectColor(projectId);
}

export default function KanbanPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: projects = [] } = useGetProjects();
  const [projectFilter, setProjectFilter] = useState<string>(() => searchParams.get('project') || '');

  const { data: allTasks = [], isLoading } = useGetAllKanbanTasks();
  const createTask = useCreateKanbanTaskAny();
  const updateTask = useUpdateKanbanTaskAny();
  const deleteTask = useDeleteKanbanTaskAny();
  const updatePipeline = useUpdateKanbanPipelineAny();
  const approvePlan = useApprovePlan();
  const autoMove = useAutoMoveKanbanAny();
  const { showAutoMoveToast, showError, showSuccess } = useToast();

  // Templates hooks
  const effectiveProjectId = projectFilter || (projects.length === 1 ? projects[0]?.id : '');
  const { data: templates = [] } = useGetTemplates();
  const useTemplate = useUseTemplate();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();

  // Auto-move mutations
  const queryClient = useQueryClient();
  const updateProject = useUpdateProject();

  // Column limits
  const activeProjectId = projectFilter && projectFilter !== 'all' ? projectFilter : (projects.length === 1 ? projects[0]?.id : undefined);
  const { data: canAdvanceData } = useCanAdvance(activeProjectId);
  const [editingLimit, setEditingLimit] = useState<{ columnId: 'planning' | 'in_dev'; current: number } | null>(null);

  // Track recently auto-moved tasks for visual indicator
  const [recentlyMovedTasks, setRecentlyMovedTasks] = useState<Set<string>>(new Set());
  const recentlyMovedTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Filter tasks based on selected project
  const tasks = projectFilter && projectFilter !== 'all'
    ? allTasks.filter((task) => task.project_id === projectFilter)
    : allTasks;

  // Initialize auto-move, auto-approve and gate state from project settings
  useEffect(() => {
    if (projectFilter && projectFilter !== 'all') {
      const project = projects.find(p => p.id === projectFilter);
      setAutoMoveEnabled(project?.settings?.auto_move_enabled ?? false);
      setAutoMoveProjectId(projectFilter);
      setAutoApproveEnabled(project?.settings?.auto_approve_workflows ?? false);
      setAutoApproveProjectId(projectFilter);
      setGatePlanToDev(project?.settings?.auto_advance_plan_to_dev ?? true);
      setGateDevToStaging(project?.settings?.auto_advance_dev_to_staging ?? true);
      setGateStagingToDone(project?.settings?.auto_advance_staging_to_done ?? false);
    } else if (projects.length === 1) {
      setAutoMoveEnabled(projects[0]?.settings?.auto_move_enabled ?? false);
      setAutoMoveProjectId(projects[0]?.id ?? '');
      setAutoApproveEnabled(projects[0]?.settings?.auto_approve_workflows ?? false);
      setAutoApproveProjectId(projects[0]?.id ?? '');
      setGatePlanToDev(projects[0]?.settings?.auto_advance_plan_to_dev ?? true);
      setGateDevToStaging(projects[0]?.settings?.auto_advance_dev_to_staging ?? true);
      setGateStagingToDone(projects[0]?.settings?.auto_advance_staging_to_done ?? false);
    } else {
      setAutoMoveEnabled(false);
      setAutoMoveProjectId('');
      setAutoApproveEnabled(false);
      setAutoApproveProjectId('');
      setGatePlanToDev(true);
      setGateDevToStaging(true);
      setGateStagingToDone(false);
    }
  }, [projectFilter, projects]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 3 as 1 | 2 | 3 | 4 | 5,
    column: 'backlog' as KanbanTask['column'],
    attachment_ids: [] as string[],
  });

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [fileAttachments, setFileAttachments] = useState<FileAttachment[]>([]);
  const uploadFiles = useUploadFiles();
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [createProjectId, setCreateProjectId] = useState<string>('');

  // Auto-move state
  const [autoMoveEnabled, setAutoMoveEnabled] = useState(false);
  const [autoMoveProjectId, setAutoMoveProjectId] = useState<string>('');

  // Auto-approve state
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false);
  const [autoApproveProjectId, setAutoApproveProjectId] = useState<string>('');

  // Gate toggle state
  const [gatePlanToDev, setGatePlanToDev] = useState(true);
  const [gateDevToStaging, setGateDevToStaging] = useState(true);
  const [gateStagingToDone, setGateStagingToDone] = useState(false);

  // Templates and recurrence state
  const [editingRecurrence, setEditingRecurrence] = useState<KanbanTemplate | null>(null);
  const [recurrenceValue, setRecurrenceValue] = useState('');
  const [customCron, setCustomCron] = useState('');

  // Template modal state
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<KanbanTemplate | null>(null);
  const [templateFormData, setTemplateFormData] = useState({
    title: '',
    description: '',
    priority: 3 as 1 | 2 | 3 | 4 | 5,
    recurrence: '' as KanbanTemplate['recurrence'],
    is_public: true,
    project_id: '' as string | null,
  });

  // Template project selection modal state
  const [templateProjectModalOpen, setTemplateProjectModalOpen] = useState(false);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
  const [selectedProjectForTemplate, setSelectedProjectForTemplate] = useState<string>('');

  const handleOpenCreate = (column?: KanbanTask['column']) => {
    setEditingTask(null);
    setFormData({
      title: '',
      description: '',
      priority: 3,
      column: column || 'backlog',
      attachment_ids: [],
    });
    setFileAttachments([]);
    // Set the project ID for creating the task
    if (projectFilter && projectFilter !== 'all') {
      setCreateProjectId(projectFilter);
    } else if (projects.length === 1) {
      setCreateProjectId(projects[0].id);
    } else {
      setCreateProjectId('');
    }
    setModalOpen(true);
  };

  const handleOpenEdit = (task: KanbanTask) => {
    setEditingTask(task);
    let existingAttachmentIds: string[] = [];
    try {
      existingAttachmentIds = task.attachments ? JSON.parse(task.attachments) : [];
    } catch {
      existingAttachmentIds = [];
    }
    setFormData({
      title: task.title,
      description: task.description,
      priority: task.priority,
      column: task.column,
      attachment_ids: existingAttachmentIds,
    });
    setFileAttachments([]); // Existing attachments are already uploaded
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) return;

    // Upload new files first (if any pending)
    const pendingFiles = fileAttachments.filter(a => a.status === 'pending').map(a => a.file);
    let uploadedIds = [...formData.attachment_ids];

    if (pendingFiles.length > 0) {
      try {
        const results = await uploadFiles.mutateAsync(pendingFiles);
        const newIds = results.map(r => r.id);
        uploadedIds = [...uploadedIds, ...newIds];
      } catch {
        // Upload failed, still submit without new attachments
        console.warn('Failed to upload attachments, proceeding without them');
      }
    }

    if (editingTask) {
      updateTask.mutate({
        projectId: editingTask.project_id,
        id: editingTask.id,
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        column: formData.column,
        attachments: JSON.stringify(uploadedIds),
      });
    } else {
      // For creating tasks, use the createProjectId state
      if (!createProjectId) return;
      createTask.mutate({
        projectId: createProjectId,
        data: {
          title: formData.title,
          description: formData.description,
          priority: formData.priority,
          column: formData.column,
          attachments: JSON.stringify(uploadedIds),
        },
      });
    }
    setModalOpen(false);
  };

  const handleMoveTask = (task: KanbanTask, direction: 'left' | 'right') => {
    const currentIndex = COLUMNS.findIndex((col) => col.id === task.column);
    const newIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;

    // Check bounds and prevent moving to templates column
    if (newIndex >= 0 && newIndex < COLUMNS.length) {
      const targetColumn = COLUMNS[newIndex];
      if (targetColumn.id === 'templates') return; // Don't allow moving to templates column

      updateTask.mutate({
        projectId: task.project_id,
        id: task.id,
        column: targetColumn.id as KanbanTask['column'],
      });
    }
  };

  const handleDelete = () => {
    if (deleteConfirm) {
      const task = allTasks.find(t => t.id === deleteConfirm);
      if (task) {
        deleteTask.mutate({ projectId: task.project_id, taskId: deleteConfirm });
      }
      setDeleteConfirm(null);
    }
  };

  const handleToggleAutoMove = (enabled: boolean) => {
    setAutoMoveEnabled(enabled);
    if (autoMoveProjectId) {
      updateProject.mutate({
        id: autoMoveProjectId,
        settings: {
          auto_move_enabled: enabled,
          auto_approve_workflows: autoApproveEnabled,
          auto_advance_plan_to_dev: gatePlanToDev,
          auto_advance_dev_to_staging: gateDevToStaging,
          auto_advance_staging_to_done: gateStagingToDone,
        }
      });
    }
  };

  const handleToggleAutoApprove = (enabled: boolean) => {
    setAutoApproveEnabled(enabled);
    if (autoApproveProjectId) {
      updateProject.mutate({
        id: autoApproveProjectId,
        settings: {
          auto_move_enabled: autoMoveEnabled,
          auto_approve_workflows: enabled,
          auto_advance_plan_to_dev: gatePlanToDev,
          auto_advance_dev_to_staging: gateDevToStaging,
          auto_advance_staging_to_done: gateStagingToDone,
        }
      });
    }
  };

  const handleToggleGate = (gate: 'plan_to_dev' | 'dev_to_staging' | 'staging_to_done', enabled: boolean) => {
    const projectId = autoMoveProjectId || autoApproveProjectId;
    if (!projectId) return;

    if (gate === 'plan_to_dev') setGatePlanToDev(enabled);
    if (gate === 'dev_to_staging') setGateDevToStaging(enabled);
    if (gate === 'staging_to_done') setGateStagingToDone(enabled);

    updateProject.mutate({
      id: projectId,
      settings: {
        auto_move_enabled: autoMoveEnabled,
        auto_approve_workflows: autoApproveEnabled,
        auto_advance_plan_to_dev: gate === 'plan_to_dev' ? enabled : gatePlanToDev,
        auto_advance_dev_to_staging: gate === 'dev_to_staging' ? enabled : gateDevToStaging,
        auto_advance_staging_to_done: gate === 'staging_to_done' ? enabled : gateStagingToDone,
      }
    });
  };

  const handleRunAutoMove = () => {
    if (!autoMoveProjectId) return;

    autoMove.mutate(autoMoveProjectId, {
      onSuccess: (result) => {
        if (result.moved_tasks?.length > 0) {
          showSuccess(
            t('pages.kanban.autoMovedTasks', { count: result.moved_tasks.length, _count: result.moved_tasks.length }),
            t('pages.kanban.autoMovedTasksDescription')
          );

          // Mark recently moved tasks for visual indicator
          const newMovedTasks = new Set(recentlyMovedTasks);
          result.moved_tasks.forEach((move) => {
            newMovedTasks.add(move.task.id);
            showAutoMoveToast(move.task.title, move.from_column, move.to_column);

            // Clear the timeout if it exists
            const existingTimeout = recentlyMovedTimeoutsRef.current.get(move.task.id);
            if (existingTimeout) {
              clearTimeout(existingTimeout);
            }

            // Remove the visual indicator after 5 seconds
            const timeout = setTimeout(() => {
              setRecentlyMovedTasks((prev) => {
                const next = new Set(prev);
                next.delete(move.task.id);
                return next;
              });
            }, 5000);

            recentlyMovedTimeoutsRef.current.set(move.task.id, timeout);
          });

          setRecentlyMovedTasks(newMovedTasks);
        }
      },
      onError: (error: Error) => {
        showError(t('pages.kanban.autoMoveFailed'), error.message);
      },
    });
  };

  // const handleEditRecurrence = (task: KanbanTask) => {
  //   // Note: KanbanTask is not fully compatible with KanbanTemplate (missing is_public field)
  //   // This function appears to be unused
  //   setEditingRecurrence(task);
  //   const isPreset = RECURRENCE_PRESETS.some(p => p.value === task.recurrence);
  //   setRecurrenceValue(isPreset ? task.recurrence : (task.recurrence ? 'custom' : ''));
  //   setCustomCron(isPreset ? '' : (task.recurrence || ''));
  // };

  const handleSaveRecurrence = () => {
    if (!editingRecurrence) return;
    const cron = recurrenceValue === 'custom' ? customCron : recurrenceValue;
    updateTemplate.mutate({
      id: editingRecurrence.id,
      recurrence: cron as KanbanTemplate['recurrence']
    });
    setEditingRecurrence(null);
  };

  const handleOpenCreateTemplate = (task?: KanbanTask) => {
    setEditingTemplate(null);
    if (task) {
      setTemplateFormData({
        title: task.title,
        description: task.description,
        priority: task.priority,
        recurrence: '',
        is_public: true,
        project_id: null,
      });
    } else {
      setTemplateFormData({
        title: '',
        description: '',
        priority: 3,
        recurrence: '',
        is_public: true,
        project_id: null,
      });
    }
    setTemplateModalOpen(true);
  };

  const handleOpenEditTemplate = (template: KanbanTemplate) => {
    setEditingTemplate(template);
    setTemplateFormData({
      title: template.title,
      description: template.description,
      priority: template.priority,
      recurrence: template.recurrence,
      is_public: template.is_public,
      project_id: template.project_id,
    });
    setTemplateModalOpen(true);
  };

  const handleSubmitTemplate = () => {
    if (!templateFormData.title.trim()) return;

    if (editingTemplate) {
      updateTemplate.mutate({
        id: editingTemplate.id,
        ...templateFormData,
      });
    } else {
      createTemplate.mutate(templateFormData);
    }
    setTemplateModalOpen(false);
  };

  const handleDeleteTemplate = (templateId: string) => {
    deleteTemplate.mutate(templateId);
  };

  const handleUseTemplate = (templateId: string) => {
    if (!effectiveProjectId) {
      // No project selected, show project selection modal
      setPendingTemplateId(templateId);
      setSelectedProjectForTemplate('');
      setTemplateProjectModalOpen(true);
      return;
    }
    useTemplate.mutate({
      templateId,
      projectId: effectiveProjectId,
    });
  };

  const handleConfirmTemplateUsage = () => {
    if (!pendingTemplateId || !selectedProjectForTemplate) {
      showError('Project Required', 'Please select a project to use this template');
      return;
    }
    useTemplate.mutate({
      templateId: pendingTemplateId,
      projectId: selectedProjectForTemplate,
    });
    setTemplateProjectModalOpen(false);
    setPendingTemplateId(null);
    setSelectedProjectForTemplate('');
  };

  // Auto-move polling
  useEffect(() => {
    if (!autoMoveEnabled || !autoMoveProjectId) return;

    const interval = setInterval(() => {
      autoMove.mutate(autoMoveProjectId, {
        onSuccess: (result) => {
          if (result?.moved_tasks?.length > 0) {
            // Mark recently moved tasks for visual indicator
            const newMovedTasks = new Set(recentlyMovedTasks);
            result.moved_tasks.forEach((move) => {
              newMovedTasks.add(move.task.id);
              showAutoMoveToast(move.task.title, move.from_column, move.to_column);

              // Clear the timeout if it exists
              const existingTimeout = recentlyMovedTimeoutsRef.current.get(move.task.id);
              if (existingTimeout) {
                clearTimeout(existingTimeout);
              }

              // Remove the visual indicator after 5 seconds
              const timeout = setTimeout(() => {
                setRecentlyMovedTasks((prev) => {
                  const next = new Set(prev);
                  next.delete(move.task.id);
                  return next;
                });
              }, 5000);

              recentlyMovedTimeoutsRef.current.set(move.task.id, timeout);
            });

            setRecentlyMovedTasks(newMovedTasks);
          }
        },
        onError: (error: Error) => {
          console.error('Auto-move polling error:', error);
          // Don't show error toast for polling errors to avoid spam
          // Just log it for debugging
        },
      });
    }, 15000); // Poll every 15 seconds

    return () => clearInterval(interval);
  }, [autoMoveEnabled, autoMoveProjectId, autoMove, showAutoMoveToast]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      recentlyMovedTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      recentlyMovedTimeoutsRef.current.clear();
    };
  }, []);

  // Close limit editor on click outside
  useEffect(() => {
    if (!editingLimit) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-limit-editor]')) {
        setEditingLimit(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingLimit]);

  const getColumnLimit = (columnId: 'planning' | 'in_dev'): number | undefined => {
    if (!activeProjectId) return undefined;
    if (canAdvanceData?.limits) {
      return columnId === 'planning'
        ? canAdvanceData.limits.max_planning_tasks
        : canAdvanceData.limits.max_in_progress_tasks;
    }
    const project = projects.find(p => p.id === activeProjectId);
    return columnId === 'planning'
      ? project?.settings?.max_planning_tasks
      : project?.settings?.max_in_progress_tasks;
  };

  const isColumnLimitReached = (columnId: 'planning' | 'in_dev', count: number): boolean => {
    const limit = getColumnLimit(columnId);
    if (limit === undefined || limit === 0) return false;
    return count >= limit;
  };

  const isColumnLimitApproaching = (columnId: 'planning' | 'in_dev', count: number): boolean => {
    const limit = getColumnLimit(columnId);
    if (limit === undefined || limit === 0) return false;
    return count >= limit - 1 && count < limit;
  };

  const getTasksByColumn = (columnId: string) => {
    return tasks
      .filter((task) => task.column === columnId)
      .sort((a, b) => a.order_index - b.order_index);
  };

  const getTaskColumn = (taskId: string) =>
    allTasks.find(t => t.id === taskId)?.column ?? 'backlog';

  if (projects.length === 0) {
    return (
      <div className="max-w-6xl mx-auto py-4 sm:py-8 px-4 sm:px-6">
        <PageHeader title={t('pages.kanban.title')} description={t('pages.kanban.description')} />
        <EmptyState
          icon={<LayoutGrid className="h-12 w-12" />}
          title={t('pages.kanban.empty.title')}
          description={t('pages.kanban.empty.description')}
        />
      </div>
    );
  }

  return (
    <div className="w-full mx-auto py-4 sm:py-8 px-4 sm:px-6 h-full flex flex-col overflow-hidden">
      <PageHeader
        title={t('pages.kanban.title')}
        description={
          projectFilter && projectFilter !== 'all'
            ? `Tasks for ${projects.find((p) => p.id === projectFilter)?.name || 'selected project'}`
            : t('pages.kanban.filters.allProjects')
        }
        actions={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {effectiveProjectId && canAdvanceData && (() => {
              const running = canAdvanceData.current_counts.running_workflows;
              const max = canAdvanceData.limits.max_concurrent_workflows;
              const isUnlimited = max === 0;
              const atLimit = !isUnlimited && running >= max;
              const nearLimit = !isUnlimited && !atLimit && running >= max - 1;
              const colorClass = atLimit
                ? 'text-red-600 dark:text-red-400'
                : nearLimit
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-green-600 dark:text-green-400';
              const label = isUnlimited
                ? `⚡ ${running} workflows`
                : `⚡ ${running}/${max} workflows`;
              const tooltip = isUnlimited
                ? `${running} workflow${running !== 1 ? 's' : ''} running (no limit configured)`
                : atLimit
                  ? `Limit reached: ${running}/${max} concurrent workflows`
                  : `${running}/${max} concurrent workflows`;
              return (
                <div
                  className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-md"
                  title={tooltip}
                >
                  <Zap className={`h-3.5 sm:h-4 w-3.5 sm:w-4 ${colorClass}`} />
                  <span className={`text-xs sm:text-sm font-medium ${colorClass}`}>{label}</span>
                </div>
              );
            })()}
            {autoMoveProjectId && (
              <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-md">
                <Zap className={`h-3.5 sm:h-4 w-3.5 sm:w-4 ${autoMoveEnabled ? 'text-yellow-500' : 'text-gray-400'}`} />
                <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 hidden sm:inline">{t('pages.kanban.autoMove')}</span>
                <Switch
                  checked={autoMoveEnabled}
                  onCheckedChange={handleToggleAutoMove}
                  disabled={updateProject.isPending}
                />
                {autoMoveEnabled && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRunAutoMove}
                    disabled={autoMove.isPending || !autoMoveEnabled}
                    title="Run auto-move now"
                    className="p-1 ml-1"
                  >
                    <Play className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
            {autoApproveProjectId && (
              <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-md">
                <CheckCircle className={`h-3.5 sm:h-4 w-3.5 sm:w-4 ${autoApproveEnabled ? 'text-green-600' : 'text-gray-400'}`} />
                <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 hidden sm:inline">{t('pages.kanban.autoApprove')}</span>
                <Switch
                  checked={autoApproveEnabled}
                  onCheckedChange={handleToggleAutoApprove}
                  disabled={updateProject.isPending}
                />
              </div>
            )}
            {projects.length > 0 && (
              <ProjectSelectDropdown
                value={projectFilter}
                onChange={(value) => setProjectFilter(value)}
                projects={projects}
                className="w-32 sm:w-48"
                showAllOption
                allOptionLabel={t('pages.kanban.filters.allProjects')}
                placeholder={t('pages.kanban.allProjectsPlaceholder')}
              />
            )}
            <Button variant="primary" onClick={() => handleOpenCreate()} className="text-xs sm:text-sm">
              <Plus className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
              <span className="hidden sm:inline">{t('pages.kanban.task.addTask')}</span><span className="sm:hidden">{t('pages.kanban.task.add')}</span>
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="text-center py-12 text-sm text-gray-500">Loading tasks...</div>
      ) : tasks.length === 0 && !templates.some(t => t.is_public) ? (
        <EmptyState
          icon={<LayoutGrid className="h-12 w-12" />}
          title={t('pages.kanban.noTasks.title')}
          description={t('pages.kanban.noTasks.description')}
          action={<Button variant="primary" onClick={() => handleOpenCreate()}>{t('pages.kanban.noTasks.addTask')}</Button>}
        />
      ) : (
        <div className="flex gap-2 sm:gap-4 p-2 sm:p-3 flex-1 overflow-x-auto overflow-y-auto min-h-0">
              {(() => {
                const visibleColumns = COLUMNS.filter(col => {
                  if (col.id !== 'templates') return true;
                  const hasPublicTemplates = templates.some(t => t.is_public);
                  const hasProjectTemplates = projectFilter && projectFilter !== 'all'
                    ? templates.some(t => !t.is_public && t.project_id === projectFilter)
                    : false;
                  return hasPublicTemplates || hasProjectTemplates;
                });

                const hasProject = !!(autoMoveProjectId || autoApproveProjectId);
                const gateConfigs: Array<{ afterColId: string; gateKey: 'plan_to_dev' | 'dev_to_staging' | 'staging_to_done'; labelKey: string; checked: boolean; fromLabel: string; toLabel: string }> = [];

                if (hasProject) {
                  gateConfigs.push(
                    { afterColId: 'planning', gateKey: 'plan_to_dev', labelKey: 'planToDev', checked: gatePlanToDev, fromLabel: t('pages.kanban.columns.planning'), toLabel: t('pages.kanban.columns.in_dev') },
                    { afterColId: 'in_dev', gateKey: 'dev_to_staging', labelKey: 'devToStaging', checked: gateDevToStaging, fromLabel: t('pages.kanban.columns.in_dev'), toLabel: t('pages.kanban.columns.validation') },
                    { afterColId: 'validation', gateKey: 'staging_to_done', labelKey: 'stagingToDone', checked: gateStagingToDone, fromLabel: t('pages.kanban.columns.validation'), toLabel: t('pages.kanban.columns.done') },
                  );
                }

                return visibleColumns.flatMap((column) => {
                  const elements: React.ReactNode[] = [];

                  // Render column
                  if (isTemplatesColumn(column.id)) {
                    elements.push(
                      <div key={column.id} className="flex flex-col min-h-0 min-w-[200px] sm:min-w-[220px] bg-amber-50 rounded-lg border border-amber-200">
                        <div className="px-2 sm:px-3 py-2 border-b border-amber-200 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <BookmarkCheck className="h-3.5 sm:h-4 w-3.5 sm:w-4 text-amber-600" />
                            <h3 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">{t(`pages.kanban.columns.${column.id}`)}</h3>
                          </div>
                          <span className="text-xs font-mono text-amber-600 bg-white px-1.5 sm:px-2 py-0.5 rounded border border-amber-200">
                            {templates.length}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-1.5 sm:p-2 space-y-1.5 sm:space-y-2">
                          {templates.map((template) => (
                            <TemplateCard
                              key={template.id}
                              template={template}
                              projects={projects}
                              onUseTemplate={handleUseTemplate}
                              onEditTemplate={handleOpenEditTemplate}
                              onEditRecurrence={(template) => {
                                setEditingRecurrence(template);
                                const isPreset = RECURRENCE_PRESETS.some(p => p.value === template.recurrence);
                                setRecurrenceValue(isPreset ? template.recurrence : (template.recurrence ? 'custom' : ''));
                                setCustomCron(isPreset ? '' : (template.recurrence || ''));
                              }}
                              onDeleteTemplate={handleDeleteTemplate}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  } else {
                    const columnTasks = getTasksByColumn(column.id);
                    elements.push(
                      <div key={column.id} className={`flex-1 min-w-[200px] sm:min-w-[220px] flex flex-col min-h-0 ${kanbanColors.columnBg} ${darkModeKanbanColors.columnBg} rounded-lg border transition-colors ${
                        (column.id === 'planning' || column.id === 'in_dev') && isColumnLimitReached(column.id, columnTasks.length)
                          ? 'border-red-300 dark:border-red-700'
                          : `${kanbanColors.cardBorder} ${darkModeKanbanColors.cardBorder}`
                      }`}>
                        <div className="px-2 sm:px-3 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                          <h3 className={`text-xs sm:text-sm font-semibold ${kanbanColors.columnHeader} ${darkModeKanbanColors.columnHeader}`}>{t(`pages.kanban.columns.${column.id}`)}</h3>
                          {(column.id === 'planning' || column.id === 'in_dev') ? (
                    <div className="relative" data-limit-editor>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const limit = getColumnLimit(column.id) ?? 0;
                          setEditingLimit({ columnId: column.id, current: limit });
                        }}
                        title={activeProjectId ? t('pages.kanban.limits.setLimit') : undefined}
                        className={`text-xs font-mono px-1.5 sm:px-2 py-0.5 rounded border cursor-pointer transition-colors ${
                          isColumnLimitReached(column.id, columnTasks.length)
                            ? 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700'
                            : isColumnLimitApproaching(column.id, columnTasks.length)
                              ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700'
                              : 'text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-500'
                        }`}
                      >
                        {activeProjectId ? (
                          (() => {
                            const limit = getColumnLimit(column.id);
                            if (limit === 0) return `${columnTasks.length} ∞`;
                            if (limit === undefined) return `${columnTasks.length}`;
                            return `${columnTasks.length}/${limit}`;
                          })()
                        ) : (
                          <span>{columnTasks.length}</span>
                        )}
                      </button>
                      {editingLimit && editingLimit.columnId === column.id && (
                        <div
                          className="absolute right-0 top-full mt-1 z-30 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 shadow-lg p-3 w-48"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {column.id === 'planning'
                              ? t('pages.kanban.limits.planningLimit')
                              : t('pages.kanban.limits.inDevLimit')}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            {t('pages.kanban.limits.current')}: {columnTasks.length}
                          </div>
                          <input
                            type="number"
                            min="0"
                            value={editingLimit.current}
                            onChange={(e) => setEditingLimit({ ...editingLimit, current: Math.max(0, parseInt(e.target.value) || 0) })}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 mb-1"
                            autoFocus
                          />
                          <div className="text-xs text-gray-400 mb-2">0 = {t('pages.kanban.limits.unlimited').toLowerCase()}</div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                if (!activeProjectId) return;
                                const settingsKey = editingLimit.columnId === 'planning' ? 'max_planning_tasks' : 'max_in_progress_tasks'; // max_in_progress_tasks still controls in_dev column
                                const project = projects.find(p => p.id === activeProjectId);
                                const s = project?.settings;
                                updateProject.mutate({
                                  id: activeProjectId,
                                  settings: {
                                    auto_move_enabled: s?.auto_move_enabled ?? false,
                                    auto_approve_workflows: s?.auto_approve_workflows ?? false,
                                    auto_advance_plan_to_dev: gatePlanToDev,
                                    auto_advance_dev_to_staging: gateDevToStaging,
                                    auto_advance_staging_to_done: gateStagingToDone,
                                    [settingsKey]: editingLimit.current,
                                  }
                                }, {
                                  onSuccess: () => {
                                    queryClient.invalidateQueries({ queryKey: ['kanban', 'can-advance', activeProjectId] });
                                  }
                                });
                                setEditingLimit(null);
                              }}
                              disabled={updateProject.isPending}
                              className="flex-1 text-xs px-2 py-1 bg-gray-900 text-white rounded hover:bg-gray-700 transition-colors disabled:opacity-50"
                            >
                              {t('pages.kanban.limits.save')}
                            </button>
                            <button
                              onClick={() => setEditingLimit(null)}
                              className="flex-1 text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                              {t('pages.kanban.limits.cancel')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-1.5 sm:px-2 py-0.5 rounded border border-gray-200 dark:border-gray-800">
                      {columnTasks.length}
                    </span>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenCreate(column.id as KanbanTask['column'])}
                  className="w-full m-1.5 sm:m-2 text-xs sm:text-sm"
                >
                  <Plus className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
                  <span className="hidden sm:inline">Add task</span><span className="sm:hidden">Add</span>
                </Button>

                <div
                  onDragOver={(e) => {
                    if (isTemplatesColumn(column.id)) return; // Don't allow dropping in templates
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setDragOverColumn(column.id);
                  }}
                  onDragLeave={(e) => {
                    if (isTemplatesColumn(column.id)) return; // Don't allow dropping in templates
                    // Só limpa se saiu da coluna de fato (não entrou em filho)
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverColumn(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedTaskId && !isTemplatesColumn(column.id) && column.id !== getTaskColumn(draggedTaskId)) {
                      // Check column limit for planning and in_dev
                      if (column.id === 'planning' || column.id === 'in_dev') {
                        const limit = getColumnLimit(column.id);
                        if (limit !== undefined && limit > 0 && columnTasks.length >= limit) {
                          showError(
                            t('pages.kanban.limits.limitReached'),
                            t('pages.kanban.limits.limitReachedMessage', { limit })
                          );
                          setDraggedTaskId(null);
                          setDragOverColumn(null);
                          return;
                        }
                      }
                      const task = allTasks.find(t => t.id === draggedTaskId);
                      if (task) {
                        updateTask.mutate({
                          projectId: task.project_id,
                          id: draggedTaskId,
                          column: column.id as KanbanTask['column'],
                        });
                      }
                    }
                    setDraggedTaskId(null);
                    setDragOverColumn(null);
                  }}
                  className={`flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-2 space-y-2 transition-colors rounded-b-lg ${
                    dragOverColumn === column.id
                      ? (column.id === 'planning' || column.id === 'in_dev') && isColumnLimitReached(column.id, columnTasks.length)
                        ? 'bg-red-50 dark:bg-red-900/20 ring-2 ring-inset ring-red-300 dark:ring-red-700'
                        : 'bg-orange-50 ring-2 ring-inset ring-orange-200'
                      : ''
                  }`}
                >
                  {columnTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      projects={projects}
                      onEdit={() => handleOpenEdit(task)}
                      onMoveLeft={() => handleMoveTask(task, 'left')}
                      onMoveRight={() => handleMoveTask(task, 'right')}
                      onDelete={() => setDeleteConfirm(task.id)}
                      onSaveAsTemplate={handleOpenCreateTemplate}
                      canMoveLeft={column.id !== 'backlog'}
                      canMoveRight={column.id !== 'done'}
                      onDragStart={(taskId) => {
                        setDraggedTaskId(taskId);
                      }}
                      onDragEnd={() => {
                        setDraggedTaskId(null);
                        setDragOverColumn(null);
                      }}
                      isDragging={draggedTaskId === task.id}
                      recentlyMoved={recentlyMovedTasks.has(task.id)}
                      onRetryPipeline={(taskId) => {
                        const task = allTasks.find(t => t.id === taskId);
                        if (task) {
                          updatePipeline.mutate({
                            projectId: task.project_id,
                            taskId,
                            data: {
                              pipeline_status: 'idle',
                              workflow_id: null,
                              error_message: ''
                            }
                          });
                        }
                      }}
                      onApproveWorkflow={(workflowId) => {
                        approvePlan.mutate(workflowId);
                      }}
                      onViewWorkflow={(workflowId) => {
                        navigate(`/plans/${workflowId}`, {
                          state: { from: '/kanban', fromLabel: 'Kanban' }
                        });
                      }}
                    />
                  ))}
                </div>
              </div>
                    );

                    // Insert gate toggle between columns if applicable
                    const gate = gateConfigs.find(g => g.afterColId === column.id);
                    if (gate) {
                      elements.push(
                        <div key={`gate-${column.id}`} className="flex flex-col items-center justify-center px-1 sm:px-2 flex-shrink-0 self-center">
                          <div className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg border transition-colors ${
                            gate.checked
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                              : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                          }`}>
                            <span className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {t(`pages.kanban.gates.${gate.labelKey}`)}
                            </span>
                            <Switch
                              checked={gate.checked}
                              onCheckedChange={(checked) => handleToggleGate(gate.gateKey, checked)}
                              disabled={updateProject.isPending}
                              className="scale-75 sm:scale-90"
                            />
                            <ArrowRight className={`h-3 sm:h-3.5 w-3 sm:w-3.5 ${
                              gate.checked ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'
                            }`} />
                          </div>
                        </div>
                      );
                    }
                  }

                  return elements;
                });
              })()}
            </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 p-6 max-w-md w-full mx-4 shadow-lg">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {editingTask ? t('pages.kanban.modal.editTask') : t('pages.kanban.modal.createTask')}
            </h3>

            <div className="space-y-4">
              {!editingTask && (!projectFilter || projectFilter === 'all') && projects.length > 1 && (
                <div>
                  <ProjectSelectDropdown
                    value={createProjectId}
                    onChange={(value) => setCreateProjectId(value)}
                    projects={projects}
                    label="Project *"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('pages.kanban.modal.title')}
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder={t('pages.kanban.modal.titlePlaceholder')}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('pages.kanban.modal.description')}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                  rows={3}
                  placeholder={t('pages.kanban.modal.descriptionPlaceholder')}
                />
              </div>

              {/* Existing attachments thumbnails (when editing) */}
              {editingTask && formData.attachment_ids.length > 0 && (() => {
                try {
                  const ids: string[] = typeof formData.attachment_ids === 'string'
                    ? JSON.parse(formData.attachment_ids)
                    : formData.attachment_ids;
                  if (!ids.length) return null;
                  return (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('pages.kanban.modal.attachments')}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {ids.map((id) => (
                          <div key={id} className="w-10 h-10 rounded border border-gray-200 dark:border-gray-800 overflow-hidden bg-gray-50 dark:bg-gray-800">
                            <img
                              src={getAttachmentUrl(id)}
                              alt="Attachment"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg class="h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg></div>';
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                } catch {
                  return null;
                }
              })()}

              {/* File attachment input for new uploads */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('pages.kanban.modal.addAttachments')}
                </label>
                <FileAttachmentInput
                  attachments={fileAttachments}
                  onAttachmentsChange={setFileAttachments}
                  maxFiles={5}
                  maxSize={10 * 1024 * 1024}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('pages.kanban.task.priority')}
                  </label>
                  <Select
                    value={formData.priority.toString()}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        priority: parseInt(e.target.value) as 1 | 2 | 3 | 4 | 5,
                      })
                    }
                  >
                    <option value="1">{`1 - ${t('pages.kanban.priority.critical')}`}</option>
                    <option value="2">{`2 - ${t('pages.kanban.priority.high')}`}</option>
                    <option value="3">{`3 - ${t('pages.kanban.priority.medium')}`}</option>
                    <option value="4">{`4 - ${t('pages.kanban.priority.low')}`}</option>
                    <option value="5">{`5 - ${t('pages.kanban.priority.minimal')}`}</option>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('pages.kanban.modal.column')}
                  </label>
                  <Select
                    value={formData.column}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        column: e.target.value as KanbanTask['column'],
                      })
                    }
                  >
                    {COLUMNS.filter(col => col.id !== 'templates').map((col) => (
                      <option key={col.id} value={col.id}>
                        {t(`pages.kanban.columns.${col.id}`)}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>
                {t('pages.kanban.actions.cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmit}
                disabled={!formData.title.trim() || (!editingTask && !createProjectId && (!projectFilter || projectFilter === 'all') && projects.length > 1)}
                loading={updateTask.isPending || createTask.isPending || uploadFiles.isPending}
              >
                {editingTask ? t('pages.kanban.modal.save') : t('pages.kanban.modal.create')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Recurrence Configuration Modal */}
      {editingRecurrence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setEditingRecurrence(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 p-6 max-w-sm w-full mx-4 space-y-4 shadow-lg">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Configure Schedule</h3>
            <p className="text-xs text-gray-500 truncate">{editingRecurrence.title}</p>

            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Recurrence</label>
              <select
                value={recurrenceValue}
                onChange={e => setRecurrenceValue(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {RECURRENCE_PRESETS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setEditingRecurrence(null)}>Cancel</Button>
              <Button
                variant="primary" size="sm"
                onClick={handleSaveRecurrence}
              >
                Save Schedule
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Template Create/Edit Modal */}
      {templateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setTemplateModalOpen(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 p-6 max-w-md w-full mx-4 shadow-lg">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {editingTemplate ? 'Edit Template' : 'Save as Template'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={templateFormData.title}
                  onChange={(e) => setTemplateFormData({ ...templateFormData, title: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Template title"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={templateFormData.description}
                  onChange={(e) => setTemplateFormData({ ...templateFormData, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                  rows={3}
                  placeholder="Template description"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Priority
                  </label>
                  <Select
                    value={templateFormData.priority.toString()}
                    onChange={(e) =>
                      setTemplateFormData({
                        ...templateFormData,
                        priority: parseInt(e.target.value) as 1 | 2 | 3 | 4 | 5,
                      })
                    }
                  >
                    <option value="1">{`1 - ${t('pages.kanban.priority.critical')}`}</option>
                    <option value="2">{`2 - ${t('pages.kanban.priority.high')}`}</option>
                    <option value="3">{`3 - ${t('pages.kanban.priority.medium')}`}</option>
                    <option value="4">{`4 - ${t('pages.kanban.priority.low')}`}</option>
                    <option value="5">{`5 - ${t('pages.kanban.priority.minimal')}`}</option>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Recurrence
                  </label>
                  <Select
                    value={templateFormData.recurrence}
                    onChange={(e) =>
                      setTemplateFormData({
                        ...templateFormData,
                        recurrence: e.target.value as KanbanTemplate['recurrence'],
                      })
                    }
                  >
                    {RECURRENCE_PRESETS.map(preset => (
                      <option key={preset.value} value={preset.value}>{preset.label}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Scope
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="templateScope"
                      checked={templateFormData.is_public}
                      onChange={() => setTemplateFormData({ ...templateFormData, is_public: true, project_id: null })}
                      className="text-gray-900 focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-700">Public (available to all projects)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="templateScope"
                      checked={!templateFormData.is_public}
                      onChange={() => setTemplateFormData({ ...templateFormData, is_public: false, project_id: effectiveProjectId })}
                      className="text-gray-900 focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-700">Project-specific</span>
                  </label>
                </div>
              </div>

              {!templateFormData.is_public && (
                <div>
                  <ProjectSelectDropdown
                    value={templateFormData.project_id || ''}
                    onChange={(value) => setTemplateFormData({ ...templateFormData, project_id: value || null })}
                    projects={projects}
                    label="Project *"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" size="sm" onClick={() => setTemplateModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmitTemplate}
                disabled={!templateFormData.title.trim() || (!templateFormData.is_public && !templateFormData.project_id)}
                loading={createTemplate.isPending || updateTemplate.isPending}
              >
                {editingTemplate ? 'Save' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Template Project Selection Modal */}
      {templateProjectModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Select Project for Template</h3>
              <p className="text-sm text-gray-600 mb-4">Choose which project to create this task in</p>

              <div className="mb-4">
                <ProjectSelectDropdown
                  value={selectedProjectForTemplate}
                  onChange={setSelectedProjectForTemplate}
                  projects={projects}
                  label="Project *"
                />
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button variant="secondary" size="sm" onClick={() => setTemplateProjectModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleConfirmTemplateUsage}
                  disabled={!selectedProjectForTemplate}
                  loading={useTemplate.isPending}
                >
                  Confirm
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteConfirm}
        title={t('kanban.task.deleteConfirmTitle')}
        description={t('kanban.task.deleteConfirmDescription')}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
        loading={deleteTask.isPending}
      />
    </div>
  );
}

interface TaskCardProps {
  task: KanbanTask;
  projects: Array<{ id: string; color?: string }>;
  onEdit: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onDelete: () => void;
  onSaveAsTemplate: (task: KanbanTask) => void;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onDragStart: (taskId: string) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  onRetryPipeline: (taskId: string) => void;
  onApproveWorkflow: (workflowId: string) => void;
  onViewWorkflow: (workflowId: string) => void;
  recentlyMoved?: boolean;
}

function TaskCard({
  task,
  projects,
  onEdit,
  onMoveLeft,
  onMoveRight,
  onDelete,
  onSaveAsTemplate,
  canMoveLeft,
  canMoveRight,
  onDragStart,
  onDragEnd,
  isDragging,
  onRetryPipeline,
  onApproveWorkflow,
  onViewWorkflow,
  recentlyMoved = false,
}: TaskCardProps) {
  const { t } = useTranslation();
  return (
    <div
      draggable
      onDragStart={(e) => {
        onDragStart(task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragEnd={onDragEnd}
      className={`group min-w-0 bg-white rounded-lg border border-gray-200 p-3 hover:border-gray-300 transition-all cursor-grab active:cursor-grabbing relative ${
        isDragging ? 'opacity-50 scale-95' : ''
      } ${recentlyMoved ? 'ring-2 ring-yellow-400 ring-offset-1' : ''}`}
    >
      {/* Auto-move badge */}
      {recentlyMoved && (
        <div className="absolute -top-1 -right-1 bg-yellow-400 text-yellow-900 text-xs font-bold px-1.5 py-0.5 rounded-full shadow-sm z-10 animate-pulse">
          <Zap className="h-3 w-3" />
        </div>
      )}

      <div className="flex justify-end mb-1">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMoveLeft}
            disabled={!canMoveLeft}
            title="Move left"
            className="p-1"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onMoveRight}
            disabled={!canMoveRight}
            title="Move right"
            className="p-1"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit} title="Edit" className="p-1">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <button
            onClick={(e) => { e.stopPropagation(); onSaveAsTemplate(task); }}
            className="p-1 text-gray-400 hover:text-amber-500 transition-colors"
            title="Save as template"
          >
            <Bookmark className="h-3.5 w-3.5" />
          </button>
          <Button variant="ghost" size="sm" onClick={onDelete} title="Delete" className="p-1">
            <Trash2 className="h-3.5 w-3.5 text-red-600" />
          </Button>
        </div>
      </div>

      <div className="mb-2">
        <h4 className="text-sm font-semibold text-gray-900 break-words">{task.title}</h4>
      </div>

      {task.description && (
        <p className="text-xs text-gray-600 mb-3 line-clamp-2">{task.description}</p>
      )}

      {/* Attachment indicator */}
      {(() => {
        try {
          const ids: string[] = task.attachments ? JSON.parse(task.attachments) : [];
          if (ids.length === 0) return null;
          return (
            <div className="flex items-center gap-1 mb-2 text-gray-400 dark:text-gray-500">
              <Paperclip className="h-3.5 w-3.5" />
              <span className="text-xs">{ids.length}</span>
            </div>
          );
        } catch {
          return null;
        }
      })()}

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded border ${PRIORITY_COLORS[task.priority]}`}
        >
          {t(`pages.kanban.priority.${task.priority === 1 ? 'critical' : task.priority === 2 ? 'high' : task.priority === 3 ? 'medium' : task.priority === 4 ? 'low' : 'minimal'}`)}
        </span>

        {task.project_name && (
          <div className="inline-flex items-center gap-1">
            <ProjectIcon
              project={{ id: task.project_id, color: getTaskProjectColor(task.project_id, projects) }}
              size={12}
              className="flex-shrink-0"
            />
            <span
              className="text-xs font-medium px-2 py-0.5 rounded border max-w-full break-words"
              style={{ backgroundColor: getTaskProjectColor(task.project_id, projects), color: 'white' }}
            >
              {task.project_name}
            </span>
          </div>
        )}

        {task.result_status && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded border ${RESULT_STATUS_COLORS[task.result_status]}`}
          >
            {task.result_status === 'success'
              ? t('pages.kanban.resultStatus.success')
              : task.result_status === 'partial'
                ? t('pages.kanban.resultStatus.partial')
                : t('pages.kanban.resultStatus.needs_rework')}
          </span>
        )}

        {task.result_notes && task.result_status && task.result_status !== 'success' && (
          <p className="text-xs text-gray-500 mt-2 italic line-clamp-2" title={task.result_notes}>
            💬 {task.result_notes}
          </p>
        )}

        {task.workflow_id && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewWorkflow(task.workflow_id!);
            }}
            className="inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 hover:underline"
          >
            <Link2 className="h-3 w-3" />
            Workflow {task.workflow_name ? `(${task.workflow_name})` : ''}
          </button>
        )}
      </div>

      {/* Pipeline status */}
      {task.pipeline_status && task.pipeline_status !== 'idle' && (() => {
        const cfg = PIPELINE_STATUS_CONFIG[task.pipeline_status];
        if (!cfg || !cfg.label) return null;
        return (
          <p className={`text-xs font-medium mt-2 ${
            cfg.animated ? 'animate-pulse' : ''
          } ${cfg.className}`}>
            {cfg.label}
          </p>
        );
      })()}

      {/* Error message */}
      {task.pipeline_status === 'failed' && task.error_message && (
        <p className="text-xs text-red-500 mt-1 truncate" title={task.error_message}>
          {task.error_message}
        </p>
      )}

      {/* Retry button for failed pipelines */}
      {task.pipeline_status === 'failed' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRetryPipeline(task.id);
          }}
          className="text-xs text-red-600 hover:text-red-800 mt-1 underline"
        >
          ↺ Retry pipeline
        </button>
      )}

      {/* Approve button for awaiting_approval pipelines */}
      {task.pipeline_status === 'awaiting_approval' && task.workflow_id && (
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onApproveWorkflow(task.workflow_id!);
            }}
            className="text-xs px-2 py-1 bg-green-700 text-white rounded hover:bg-green-800 transition-colors flex items-center gap-1"
          >
            <CheckCircle className="h-3 w-3" /> Approve & Run
          </button>
        </div>
      )}
    </div>
  );
}

interface TemplateCardProps {
  template: KanbanTemplate;
  projects: Array<{ id: string; color?: string }>;
  onUseTemplate: (templateId: string) => void;
  onEditTemplate: (template: KanbanTemplate) => void;
  onEditRecurrence: (template: KanbanTemplate) => void;
  onDeleteTemplate: (templateId: string) => void;
}

function TemplateCard({ template, projects, onUseTemplate, onEditTemplate, onEditRecurrence, onDeleteTemplate }: TemplateCardProps) {
  const { t } = useTranslation();
  return (
    <div className="bg-white rounded-lg border border-amber-200 p-3 hover:border-amber-300 transition-all relative">
      <div className="flex justify-end mb-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onUseTemplate(template.id)}
            className="p-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 transition-colors"
            title="Run now — creates a copy in Planning"
          >
            <Play className="h-3 w-3" />
          </button>
          <button
            onClick={() => onEditRecurrence(template)}
            className="p-1.5 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            title="Configure schedule"
          >
            <RefreshCw className="h-3 w-3 text-gray-500" />
          </button>
          <button
            onClick={() => onEditTemplate(template)}
            className="p-1.5 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            title="Edit template"
          >
            <Pencil className="h-3 w-3 text-gray-500" />
          </button>
          <button
            onClick={() => onDeleteTemplate(template.id)}
            className="p-1.5 border border-gray-300 rounded hover:bg-red-50 transition-colors"
            title="Delete template"
          >
            <Trash2 className="h-3 w-3 text-red-600" />
          </button>
        </div>
      </div>

      <div className="mb-2">
        <h4 className="text-sm font-semibold text-gray-900 break-words">{template.title}</h4>
      </div>

      {template.description && (
        <p className="text-xs text-gray-600 mb-3 line-clamp-2">{template.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {template.recurrence && (
          <span className="text-xs font-medium px-2 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">
            🔁 {RECURRENCE_LABELS[template.recurrence] || template.recurrence}
          </span>
        )}

        <span className={`text-xs font-medium px-2 py-0.5 rounded border ${PRIORITY_COLORS[template.priority]}`}>
          {t(`pages.kanban.priority.${template.priority === 1 ? 'critical' : template.priority === 2 ? 'high' : template.priority === 3 ? 'medium' : template.priority === 4 ? 'low' : 'minimal'}`)}
        </span>

        {template.is_public ? (
          <span className="text-xs font-medium px-2 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200">
            🌐 Public
          </span>
        ) : template.project_name && (
          <div className="inline-flex items-center gap-1">
            <ProjectIcon
              project={{ id: template.project_id!, color: getTaskProjectColor(template.project_id!, projects) }}
              size={12}
              className="flex-shrink-0"
            />
            <span
              className="text-xs font-medium px-2 py-0.5 rounded border max-w-full break-words"
              style={{ backgroundColor: getTaskProjectColor(template.project_id!, projects), color: 'white' }}
            >
              {template.project_name}
            </span>
          </div>
        )}
      </div>

      {template.last_run_at && (
        <p className="text-xs text-gray-400 mt-2">
          Last run: {new Date(template.last_run_at).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
