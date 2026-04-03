import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router';
import { useCreatePlan, type Task } from '@/api/plans';
import { useGetWorkspaces } from '@/api/workspaces';
import { useGetProjects } from '@/api/projects';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { FileAttachmentInput, type FileAttachment } from '@/components/FileAttachmentInput';
import { useUploadFiles, type AttachmentResponse } from '@/api/uploads';

interface TaskForm {
  id: string;
  name: string;
  prompt: string;
  cwd: string;
  workspace: string;
  env_context?: string;
  selectedEnvId?: string;
  permission_mode?: string;
  depends_on?: string[];
  tools?: string[];
  attachments: FileAttachment[];
}

interface FormErrors {
  name?: string;
  tasks?: string[];
}

export function CreatePlanForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const createMutation = useCreatePlan();
  const { data: projects = [] } = useGetProjects();
  const [projectId, setProjectId] = useState('');
  const uploadFiles = useUploadFiles();

  // Workspaces filtered by selected project
  const { data: workspaces = [] } = useGetWorkspaces(
    projectId ? { project_id: projectId } : undefined
  );

  // Environments filtered by selected project
  const selectedProject = projects.find(p => p.id === projectId);
  const environments = selectedProject?.environments ?? [];

  // Helper function to create an empty task
  const getEmptyTask = (): TaskForm => ({
    id: crypto.randomUUID(),
    name: '',
    prompt: '',
    cwd: '',
    workspace: '',
    permission_mode: 'acceptEdits',
    depends_on: [],
    tools: [],
    attachments: [],
  });

  const [planName, setPlanName] = useState('');
  const [tasks, setTasks] = useState<TaskForm[]>([getEmptyTask()]);
  const [errors, setErrors] = useState<FormErrors>({});

  // Prefill form with plan data from navigation state
  useEffect(() => {
    const incomingPlan = location.state?.plan as any;
    if (incomingPlan) {
      // Set plan name
      setPlanName(incomingPlan.name || '');

      // Convert tasks from incoming plan to TaskForm format
      const prefilledTasks = (incomingPlan.tasks || []).map((task: any) => ({
        id: task.id || crypto.randomUUID(),
        name: task.name || '',
        prompt: task.prompt || '',
        cwd: task.cwd || '',
        workspace: task.workspace || '',
        permission_mode: task.permission_mode || 'acceptEdits',
        depends_on: task.depends_on || [],
        tools: task.tools || [],
        attachments: [],
        // Note: env_context and selectedEnvId are not pre-filled as they require project lookup
        env_context: undefined,
        selectedEnvId: undefined,
      }));

      setTasks(prefilledTasks.length > 0 ? prefilledTasks : [getEmptyTask()]);

      // Clear the state to prevent repopulation on refresh
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [location.state]);

  // Handle project change - reset agent and environment for all tasks
  const handleProjectChange = (newProjectId: string) => {
    setProjectId(newProjectId);
    setTasks(tasks.map(t => ({
      ...t,
      workspace: '',
      selectedEnvId: '',
      cwd: '',
      env_context: '',
      attachments: [],
    })));
  };

  // Handle environment selection for a task
  const handleEnvSelect = (taskIdx: number, envId: string) => {
    const env = environments.find(e => e.id === envId);
    setTasks(tasks.map((t, i) => i !== taskIdx ? t : {
      ...t,
      selectedEnvId: envId,
      cwd: env?.project_path ?? t.cwd,
      env_context: env ? `${env.name} (${env.type})\nProject path: ${env.project_path}` : '',
      // Auto-fill workspace with agent_workspace from environment only if an agent has been created
      workspace: env?.agent_workspace || t.workspace,
    }));
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!planName.trim()) {
      newErrors.name = t('createPlan.validation.planNameRequired');
    }

    const taskErrors: string[] = tasks.map((task) => {
      if (!task.name.trim()) return t('createPlan.validation.taskNameRequired');
      if (!task.prompt.trim()) return t('createPlan.validation.taskPromptRequired');
      if (!task.cwd.trim()) return t('createPlan.validation.workingDirectoryRequired');
      if (!task.workspace.trim()) return t('createPlan.validation.agentWorkspaceRequired');
      return '';
    });

    if (taskErrors.some((error) => error !== '')) {
      newErrors.tasks = taskErrors;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    // Upload all pending attachments across all tasks
    const allAttachmentIds: string[] = [];
    const taskAttachmentIdMap = new Map<number, string[]>();

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const pendingFiles = task.attachments.filter(a => a.status === 'pending').map(a => a.file);
      const alreadyUploaded = task.attachments.filter(a => a.status === 'uploaded' && a.serverData).map(a => a.serverData!.id);

      if (pendingFiles.length > 0) {
        try {
          const uploaded = await uploadFiles.mutateAsync(pendingFiles);
          const ids = uploaded.map(u => u.id);
          taskAttachmentIdMap.set(i, [...alreadyUploaded, ...ids]);
          allAttachmentIds.push(...ids);
        } catch (err) {
          console.error(`Failed to upload attachments for task ${i + 1}:`, err);
          // Continue with already uploaded ones
          if (alreadyUploaded.length > 0) {
            taskAttachmentIdMap.set(i, alreadyUploaded);
            allAttachmentIds.push(...alreadyUploaded);
          }
        }
      } else if (alreadyUploaded.length > 0) {
        taskAttachmentIdMap.set(i, alreadyUploaded);
        allAttachmentIds.push(...alreadyUploaded);
      }
    }

    const tasksToCreate: Task[] = tasks.map((task, index) => ({
      id: task.id,
      name: task.name,
      prompt: task.prompt,
      cwd: task.cwd,
      workspace: task.workspace,
      env_context: task.env_context,
      permission_mode: task.permission_mode,
      depends_on: task.depends_on,
      tools: task.tools,
      attachment_ids: taskAttachmentIdMap.get(index),
    }));

    createMutation.mutate(
      {
        name: planName,
        project_id: projectId || undefined,
        tasks: tasksToCreate
      },
      {
        onSuccess: (data) => {
          navigate(`/plans/${data.id}`);
        },
      }
    );
  };

  const addTask = () => {
    setTasks([...tasks, getEmptyTask()]);
  };

  const removeTask = (index: number) => {
    if (tasks.length > 1) {
      // Clean up any object URLs for previews
      const task = tasks[index];
      task.attachments.forEach(a => {
        if (a.preview) URL.revokeObjectURL(a.preview);
      });
      setTasks(tasks.filter((_, i) => i !== index));
    }
  };

  const handleAttachmentsChange = (taskIndex: number, newAttachments: FileAttachment[]) => {
    setTasks(tasks.map((t, i) => i !== taskIndex ? t : { ...t, attachments: newAttachments }));
  };

  const handleUploadAttachments = async (taskIndex: number) => {
    const task = tasks[taskIndex];
    const pendingFiles = task.attachments.filter(a => a.status === 'pending').map(a => a.file);
    if (pendingFiles.length === 0) return;

    // Mark all pending as uploading
    setTasks(tasks.map((t, i) => {
      if (i !== taskIndex) return t;
      return {
        ...t,
        attachments: t.attachments.map(a => a.status === 'pending' ? { ...a, status: 'uploading' as const } : a),
      };
    }));

    try {
      const uploaded = await uploadFiles.mutateAsync(pendingFiles);
      // Create a map of file name -> server data
      const uploadMap = new Map<string, AttachmentResponse>();
      uploaded.forEach(u => uploadMap.set(u.file_name, u));

      setTasks(tasks.map((t, i) => {
        if (i !== taskIndex) return t;
        return {
          ...t,
          attachments: t.attachments.map(a => {
            if (a.status === 'uploading') {
              const serverData = uploadMap.get(a.file.name);
              if (serverData) {
                return { ...a, status: 'uploaded' as const, serverData };
              }
              return { ...a, status: 'error' as const };
            }
            return a;
          }),
        };
      }));
    } catch {
      setTasks(tasks.map((t, i) => {
        if (i !== taskIndex) return t;
        return {
          ...t,
          attachments: t.attachments.map(a =>
            a.status === 'uploading' ? { ...a, status: 'error' as const } : a
          ),
        };
      }));
    }
  };

  const updateTask = (index: number, field: keyof TaskForm, value: string | string[]) => {
    const updatedTasks = [...tasks];
    (updatedTasks[index] as any)[field] = value;
    setTasks(updatedTasks);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-4">
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
          ← {t('createPlan.backToPlans')}
        </Link>
      </div>

      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('createPlan.title')}</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Project Selection */}
            <div>
              <label htmlFor="project" className="block text-sm font-medium text-gray-700">
                {t('createPlan.project.label')} *
              </label>
              <select
                id="project"
                value={projectId}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm px-3 py-2 border"
                required
              >
                <option value="">{t('createPlan.project.selectPlaceholder')}</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              {projects.length === 0 && (
                <p className="mt-1 text-sm text-amber-600">
                  {t('createPlan.project.noProjects')}{' '}
                  <Link to="/projects" className="underline">{t('createPlan.project.createProjectLink')}</Link>
                </p>
              )}
            </div>

            {/* Plan Name */}
            <div>
              <label htmlFor="planName" className="block text-sm font-medium text-gray-700">
                {t('createPlan.planName.label')} *
              </label>
              <input
                type="text"
                id="planName"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                className={cn(
                  'mt-1 block w-full rounded-md border-gray-300 shadow-sm',
                  'focus:border-orange-500 focus:ring-orange-500 sm:text-sm',
                  'px-3 py-2 border',
                  errors.name && 'border-red-500'
                )}
                placeholder={t('createPlan.planName.placeholder')}
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>

            {/* Tasks */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  {t('createPlan.tasks.label')} *
                </label>
                <button
                  type="button"
                  onClick={addTask}
                  className="rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500"
                >
                  {t('createPlan.tasks.addTask')}
                </button>
              </div>

              <div className="space-y-6">
                {tasks.map((task, index) => (
                  <div
                    key={task.id}
                    className="border border-gray-300 rounded-md p-4 space-y-4 relative"
                  >
                    {tasks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTask(index)}
                        className="absolute top-2 right-2 text-red-600 hover:text-red-800 text-sm"
                      >
                        {t('createPlan.tasks.remove')}
                      </button>
                    )}

                    <h3 className="text-lg font-medium text-gray-900">{t('createPlan.tasks.taskNumber', { number: index + 1 })}</h3>

                    {errors.tasks?.[index] && (
                      <p className="text-sm text-red-600">{errors.tasks[index]}</p>
                    )}

                    {!projectId && (
                      <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                        {t('createPlan.tasks.selectProjectHint')}
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor={`task-name-${index}`}
                        className="block text-sm font-medium text-gray-700"
                      >
                        {t('createPlan.tasks.taskName.label')} *
                      </label>
                      <input
                        type="text"
                        id={`task-name-${index}`}
                        value={task.name}
                        onChange={(e) => updateTask(index, 'name', e.target.value)}
                        className={cn(
                          'mt-1 block w-full rounded-md border-gray-300 shadow-sm',
                          'focus:border-orange-500 focus:ring-orange-500 sm:text-sm',
                          'px-3 py-2 border',
                          errors.tasks?.[index] && 'border-red-500'
                        )}
                        placeholder={t('createPlan.tasks.taskName.placeholder')}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`task-prompt-${index}`}
                        className="block text-sm font-medium text-gray-700"
                      >
                        {t('createPlan.tasks.prompt.label')} *
                      </label>
                      <textarea
                        id={`task-prompt-${index}`}
                        rows={4}
                        value={task.prompt}
                        onChange={(e) => updateTask(index, 'prompt', e.target.value)}
                        className={cn(
                          'mt-1 block w-full rounded-md border-gray-300 shadow-sm',
                          'focus:border-orange-500 focus:ring-orange-500 sm:text-sm',
                          'px-3 py-2 border',
                          errors.tasks?.[index] && 'border-red-500'
                        )}
                        placeholder={t('createPlan.tasks.prompt.placeholder')}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Agent Workspace */}
                      <div>
                        <label
                          htmlFor={`task-workspace-${index}`}
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          {t('createPlan.tasks.agent.label')} <span className="text-red-500">*</span>
                        </label>
                        <select
                          id={`task-workspace-${index}`}
                          value={task.workspace ?? ''}
                          onChange={(e) => {
                            const ws = workspaces.find(w => w.path === e.target.value)
                            updateTask(index, 'workspace', e.target.value)
                            // If no environment selected, pre-fill CWD with parent directory (project root)
                            if (ws && !task.selectedEnvId) {
                              // Workspace path is /root/projects/weave/projects/{name}/agent-coder
                              // We want the parent: /root/projects/weave/projects/{name}
                              const projectRoot = ws.path.split('/agent-coder')[0]
                              updateTask(index, 'cwd', projectRoot)
                            }
                          }}
                          className={cn(
                            'block w-full rounded-md border-gray-300 shadow-sm',
                            'focus:border-orange-500 focus:ring-orange-500 sm:text-sm',
                            'px-3 py-2 border',
                            errors.tasks?.[index] && 'border-red-500'
                          )}
                          required
                          disabled={!projectId}
                        >
                          <option value="">{t('createPlan.tasks.agent.selectPlaceholder')}</option>
                          {workspaces.map(ws => (
                            <option key={ws.id} value={ws.path}>
                              {ws.name}
                            </option>
                          ))}
                        </select>
                        {!projectId && workspaces.length === 0 && (
                          <p className="text-xs text-gray-400 mt-1">
                            {t('createPlan.tasks.agent.selectProjectFirst')}
                          </p>
                        )}
                        {projectId && workspaces.length === 0 && (
                          <p className="text-xs text-amber-600 mt-1">
                            {t('createPlan.tasks.agent.noAgents')}{' '}
                            <Link to="/agents" className="underline">{t('createPlan.tasks.agent.createWorkspaceLink')}</Link>
                          </p>
                        )}
                      </div>

                      {/* Environment */}
                      <div>
                        <label
                          htmlFor={`task-environment-${index}`}
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          {t('createPlan.tasks.environment.label')}
                        </label>
                        <select
                          id={`task-environment-${index}`}
                          value={task.selectedEnvId ?? ''}
                          onChange={(e) => handleEnvSelect(index, e.target.value)}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm px-3 py-2 border"
                          disabled={!projectId}
                        >
                          <option value="">{t('createPlan.tasks.environment.defaultOption')}</option>
                          {environments.map(env => (
                            <option key={env.id} value={env.id}>
                              {env.name} ({env.type})
                            </option>
                          ))}
                        </select>
                        {!projectId && environments.length === 0 && (
                          <p className="text-xs text-gray-400 mt-1">
                            {t('createPlan.tasks.agent.selectProjectFirst')}
                          </p>
                        )}
                        {projectId && environments.length === 0 && (
                          <p className="text-xs text-amber-600 mt-1">
                            {t('createPlan.tasks.environment.noEnvironments')}{' '}
                            <Link to="/projects" className="underline">{t('createPlan.tasks.environment.manageProjectsLink')}</Link>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Working directory - read-only, derived from environment or workspace */}
                    <div>
                      <label
                        htmlFor={`task-cwd-${index}`}
                        className="block text-sm font-medium text-gray-400 mb-1 text-xs"
                      >
                        {t('createPlan.tasks.workingDirectory.label')}
                      </label>
                      <input
                        type="text"
                        id={`task-cwd-${index}`}
                        value={task.cwd}
                        readOnly
                        className="block w-full rounded-md border-gray-300 shadow-sm px-3 py-2 border bg-gray-50 text-gray-500 cursor-default sm:text-sm"
                        placeholder={t('createPlan.tasks.workingDirectory.placeholder')}
                      />
                    </div>

                    {/* Attachments */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('createPlan.tasks.attachments.label')}
                      </label>
                      <FileAttachmentInput
                        attachments={task.attachments}
                        onAttachmentsChange={(newAttachments) => handleAttachmentsChange(index, newAttachments)}
                        maxFiles={5}
                      />
                      {task.attachments.some(a => a.status === 'pending') && (
                        <button
                          type="button"
                          onClick={() => handleUploadAttachments(index)}
                          disabled={uploadFiles.isPending}
                          className="mt-1.5 text-xs text-orange-600 hover:text-orange-800 disabled:opacity-50"
                        >
                          {t('createPlan.tasks.attachments.uploadNow')}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Link
                to="/"
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
              >
                {t('createPlan.actions.cancel')}
              </Link>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className={cn(
                  'rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm',
                  'hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {createMutation.isPending ? t('createPlan.actions.creating') : t('createPlan.actions.createPlan')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
