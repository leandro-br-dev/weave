import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bookmark, Play, Pencil, Trash2, CopyPlus, Loader2, Clock,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  PageHeader,
  Button,
  EmptyState,
  ProjectSelectDropdown,
  ScheduleEditor,
  type RecurrenceValue,
} from '@/components'
import {
  useGetWorkflowTemplates,
  useRunWorkflowTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useCreateTemplate,
  RECURRENCE_LABELS,
  type KanbanTemplate,
  type PlanData,
} from '@/api/kanban'
import { useGetProjects } from '@/api/projects'
import { useToast } from '@/contexts/ToastContext'
import {
  bgColors, darkModeBgColors,
  textColors, darkModeTextColors,
  borderColors, darkModeBorderColors,
  tableColors, darkModeTableColors,
  withDarkMode,
} from '@/lib/colors'

/** Parse plan_data which may be a JSON string or already parsed object */
function parsePlanData(planData: KanbanTemplate['plan_data']): PlanData | null {
  if (!planData) return null
  if (typeof planData === 'string') {
    try { return JSON.parse(planData) } catch { return null }
  }
  return planData
}

export default function WorkflowTemplatesPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()

  const { data: templates = [], isLoading } = useGetWorkflowTemplates()
  const { data: projects = [] } = useGetProjects()
  const runTemplate = useRunWorkflowTemplate()
  const updateTemplate = useUpdateTemplate()
  const deleteTemplate = useDeleteTemplate()
  const createTemplate = useCreateTemplate()

  const [runModal, setRunModal] = useState<KanbanTemplate | null>(null)
  const [runProjectId, setRunProjectId] = useState('')
  const [scheduleModal, setScheduleModal] = useState<KanbanTemplate | null>(null)
  const [scheduleForm, setScheduleForm] = useState<{
    title: string
    description: string
    recurrence: RecurrenceValue
    scheduleTime: string
  }>({ title: '', description: '', recurrence: '', scheduleTime: '09:00' })
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const getProjectName = (projectId: string | null | undefined) => {
    if (!projectId) return '—'
    const project = projects.find(p => p.id === projectId)
    return project?.name || projectId.slice(0, 8)
  }

  const getRecurrenceLabel = (recurrence: string) => {
    if (!recurrence) return t('workflowTemplates.schedule.manual')
    return RECURRENCE_LABELS[recurrence] || recurrence
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  }

  const getTaskCount = (template: KanbanTemplate) => {
    const planData = parsePlanData(template.plan_data)
    return planData?.tasks?.length ?? 0
  }

  // Handlers
  const handleRun = () => {
    if (!runModal || !runProjectId) return
    runTemplate.mutate(
      { templateId: runModal.id, projectId: runProjectId },
      {
        onSuccess: () => {
          toast.showSuccess(t('workflowTemplates.runSuccess'))
          setRunModal(null)
          setRunProjectId('')
        },
        onError: () => toast.showError(t('workflowTemplates.runError')),
      },
    )
  }

  const handleEditTemplate = (template: KanbanTemplate) => {
    if (template.template_plan_id) {
      navigate(`/plans/${template.template_plan_id}`)
    }
  }

  const handleScheduleSave = () => {
    if (!scheduleModal) return
    updateTemplate.mutate(
      {
        id: scheduleModal.id,
        title: scheduleForm.title,
        description: scheduleForm.description,
        recurrence: scheduleForm.recurrence,
        schedule_time: scheduleForm.recurrence && scheduleForm.recurrence !== 'hourly'
          ? scheduleForm.scheduleTime || null
          : null,
      },
      {
        onSuccess: () => {
          toast.showSuccess(t('workflowTemplates.updateSuccess'))
          setScheduleModal(null)
        },
        onError: () => toast.showError(t('workflowTemplates.updateError')),
      },
    )
  }

  const handleDelete = (id: string) => {
    deleteTemplate.mutate(id, {
      onSuccess: () => {
        toast.showSuccess(t('workflowTemplates.deleteSuccess'))
        setDeleteConfirm(null)
      },
      onError: () => toast.showError(t('workflowTemplates.deleteError')),
    })
  }

  const handleDuplicate = (template: KanbanTemplate) => {
    const planData = parsePlanData(template.plan_data)
    createTemplate.mutate(
      {
        title: `${template.title} (cópia)`,
        description: template.description,
        priority: template.priority,
        template_type: 'workflow',
        plan_data: planData,
        skip_planning: true,
        project_id: template.project_id,
      },
      {
        onSuccess: () => toast.showSuccess(t('workflowTemplates.duplicateSuccess')),
        onError: () => toast.showError(t('workflowTemplates.duplicateError')),
      },
    )
  }

  const openScheduleModal = (template: KanbanTemplate) => {
    const recurrence = template.recurrence || ''
    setScheduleForm({
      title: template.title,
      description: template.description,
      recurrence: recurrence as RecurrenceValue,
      scheduleTime: template.schedule_time || '09:00',
    })
    setScheduleModal(template)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className={textColors.tertiary}>{t('workflowTemplates.title')}...</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto py-4 sm:py-8 px-4 sm:px-6">
      <PageHeader
        title={t('workflowTemplates.title')}
        description={t('workflowTemplates.description')}
      />

      {/* Table */}
      <div className={`${withDarkMode(bgColors.secondary, darkModeBgColors.secondary)} border ${withDarkMode(borderColors.default, darkModeBorderColors.default)} rounded-lg overflow-hidden`}>
        {templates.length === 0 ? (
          <EmptyState
            title={t('workflowTemplates.empty.title')}
            description={t('workflowTemplates.empty.description')}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <table className="min-w-full">
                <thead>
                  <tr className={`${withDarkMode(tableColors.headerBg, darkModeTableColors.headerBg)} border-b ${withDarkMode(borderColors.default, darkModeBorderColors.default)}`}>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${withDarkMode(tableColors.headerText, darkModeTableColors.headerText)} uppercase tracking-wide`}>
                      {t('workflowTemplates.table.name')}
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${withDarkMode(tableColors.headerText, darkModeTableColors.headerText)} uppercase tracking-wide`}>
                      {t('workflowTemplates.table.project')}
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${withDarkMode(tableColors.headerText, darkModeTableColors.headerText)} uppercase tracking-wide`}>
                      {t('workflowTemplates.table.tasks')}
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${withDarkMode(tableColors.headerText, darkModeTableColors.headerText)} uppercase tracking-wide`}>
                      {t('workflowTemplates.table.recurrence')}
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${withDarkMode(tableColors.headerText, darkModeTableColors.headerText)} uppercase tracking-wide`}>
                      {t('workflowTemplates.table.lastRun')}
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${withDarkMode(tableColors.headerText, darkModeTableColors.headerText)} uppercase tracking-wide`}>
                      {t('workflowTemplates.table.nextRun')}
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${withDarkMode(tableColors.headerText, darkModeTableColors.headerText)} uppercase tracking-wide`}>
                      {t('workflowTemplates.table.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${withDarkMode(borderColors.subtle, darkModeBorderColors.default)}`}>
                  {templates.map((template) => (
                    <tr key={template.id} className={`${withDarkMode(tableColors.rowHover, darkModeTableColors.rowHover)} transition-colors`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Bookmark className={`h-4 w-4 ${withDarkMode(textColors.muted, darkModeTextColors.veryMuted)}`} />
                          <div>
                            <span className={`text-sm font-medium ${withDarkMode(textColors.primary, darkModeTextColors.primary)}`}>
                              {template.title}
                            </span>
                            {template.description && (
                              <p className={`text-xs ${withDarkMode(textColors.muted, darkModeTextColors.veryMuted)} truncate max-w-xs`}>
                                {template.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-sm ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}`}>
                        {getProjectName(template.project_id)}
                      </td>
                      <td className={`px-4 py-3 text-sm ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}`}>
                        {getTaskCount(template)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${template.recurrence ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                          <Clock className="h-3 w-3" />
                          {getRecurrenceLabel(template.recurrence)}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-xs ${withDarkMode(textColors.muted, darkModeTextColors.veryMuted)}`}>
                        {formatDate(template.last_run_at)}
                      </td>
                      <td className={`px-4 py-3 text-xs ${withDarkMode(textColors.muted, darkModeTextColors.veryMuted)}`}>
                        {formatDate((template as any).next_run_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setRunModal(template); setRunProjectId(template.project_id || '') }}
                            className={`p-1.5 rounded-md ${withDarkMode('hover:bg-green-50 text-green-600', 'hover:bg-green-900/20 dark:text-green-400')} transition-colors`}
                            title={t('workflowTemplates.actions.runNow')}
                          >
                            <Play className="h-4 w-4" />
                          </button>
                          {template.template_plan_id && (
                            <button
                              onClick={() => handleEditTemplate(template)}
                              className={`p-1.5 rounded-md ${withDarkMode('hover:bg-blue-50 text-blue-600', 'hover:bg-blue-900/20 dark:text-blue-400')} transition-colors`}
                              title={t('workflowTemplates.actions.edit')}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => openScheduleModal(template)}
                            className={`p-1.5 rounded-md ${withDarkMode('hover:bg-amber-50 text-amber-600', 'hover:bg-amber-900/20 dark:text-amber-400')} transition-colors`}
                            title={t('workflowTemplates.actions.schedule')}
                          >
                            <Clock className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDuplicate(template)}
                            className={`p-1.5 rounded-md ${withDarkMode('hover:bg-gray-50 text-gray-600', 'hover:bg-gray-700 dark:text-gray-400')} transition-colors`}
                            title={t('workflowTemplates.actions.duplicate')}
                          >
                            <CopyPlus className="h-4 w-4" />
                          </button>
                          {deleteConfirm === template.id ? (
                            <span className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(template.id)}
                                className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                              >
                                {t('workflowTemplates.deleteConfirm.confirm')}
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-2 py-1 border text-xs rounded hover:bg-gray-50"
                              >
                                {t('workflowTemplates.deleteConfirm.cancel')}
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(template.id)}
                              className={`p-1.5 rounded-md ${withDarkMode('hover:bg-red-50 text-red-600', 'hover:bg-red-900/20 dark:text-red-400')} transition-colors`}
                              title={t('workflowTemplates.actions.delete')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card view */}
            <div className="md:hidden space-y-3 p-4">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`${withDarkMode(bgColors.secondary, darkModeBgColors.secondary)} border ${withDarkMode(borderColors.default, darkModeBorderColors.default)} rounded-lg p-4`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Bookmark className={`h-4 w-4 flex-shrink-0 ${withDarkMode(textColors.muted, darkModeTextColors.veryMuted)}`} />
                      <span className={`text-sm font-medium ${withDarkMode(textColors.primary, darkModeTextColors.primary)} truncate`}>
                        {template.title}
                      </span>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${template.recurrence ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                      <Clock className="h-3 w-3" />
                      {getRecurrenceLabel(template.recurrence)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1 text-xs mb-3">
                    <div>
                      <span className={withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}>{t('workflowTemplates.table.project')}:</span>{' '}
                      <span className="font-medium">{getProjectName(template.project_id)}</span>
                    </div>
                    <div>
                      <span className={withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}>{t('workflowTemplates.table.tasks')}:</span>{' '}
                      <span className="font-medium">{getTaskCount(template)}</span>
                    </div>
                    <div>
                      <span className={withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}>{t('workflowTemplates.table.lastRun')}:</span>{' '}
                      <span className="font-medium">{formatDate(template.last_run_at)}</span>
                    </div>
                    <div>
                      <span className={withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}>{t('workflowTemplates.table.nextRun')}:</span>{' '}
                      <span className="font-medium">{formatDate((template as any).next_run_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setRunModal(template); setRunProjectId(template.project_id || '') }}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20 rounded"
                    >
                      <Play className="h-3.5 w-3.5" /> {t('workflowTemplates.actions.runNow')}
                    </button>
                    {template.template_plan_id && (
                      <button
                        onClick={() => handleEditTemplate(template)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded"
                      >
                        <Pencil className="h-3.5 w-3.5" /> {t('workflowTemplates.actions.edit')}
                      </button>
                    )}
                    <button
                      onClick={() => openScheduleModal(template)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20 rounded"
                    >
                      <Clock className="h-3.5 w-3.5" /> {t('workflowTemplates.actions.schedule')}
                    </button>
                    <button
                      onClick={() => handleDuplicate(template)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700 rounded"
                    >
                      <CopyPlus className="h-3.5 w-3.5" /> {t('workflowTemplates.actions.duplicate')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Run Modal */}
      {runModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setRunModal(null)} />
          <div className={`relative ${withDarkMode(bgColors.secondary, darkModeBgColors.secondary)} rounded-lg border ${withDarkMode(borderColors.default, darkModeBorderColors.default)} w-full max-w-md mx-4 p-6 shadow-2xl`}>
            <h2 className={`text-lg font-semibold ${withDarkMode(textColors.primary, darkModeTextColors.primary)} mb-2`}>
              {t('workflowTemplates.runModal.title')}
            </h2>
            <p className={`text-sm ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)} mb-4`}>
              {t('workflowTemplates.runModal.description')}
            </p>
            <div className="mb-4">
              <label className={`block text-xs font-medium ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)} mb-1`}>
                {t('workflowTemplates.table.project')}
              </label>
              <ProjectSelectDropdown
                value={runProjectId}
                onChange={setRunProjectId}
                projects={projects}
                placeholder={t('workflowTemplates.runModal.selectProject')}
                className="w-full"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setRunModal(null)}>
                {t('workflowTemplates.runModal.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={handleRun}
                disabled={!runProjectId || runTemplate.isPending}
              >
                {runTemplate.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> {t('workflowTemplates.runModal.running')}</>
                ) : (
                  <><Play className="h-4 w-4" /> {t('workflowTemplates.runModal.run')}</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {scheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setScheduleModal(null)} />
          <div className={`relative ${withDarkMode(bgColors.secondary, darkModeBgColors.secondary)} rounded-lg border ${withDarkMode(borderColors.default, darkModeBorderColors.default)} w-full max-w-lg mx-4 p-6 shadow-2xl`}>
            <h2 className={`text-lg font-semibold ${withDarkMode(textColors.primary, darkModeTextColors.primary)} mb-4`}>
              {t('workflowTemplates.scheduleModal.title')}
            </h2>
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className={`block text-xs font-medium ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)} mb-1`}>
                  {t('workflowTemplates.editModal.name')}
                </label>
                <input
                  type="text"
                  value={scheduleForm.title}
                  onChange={e => setScheduleForm(f => ({ ...f, title: e.target.value }))}
                  className={`w-full px-3 py-2 border ${withDarkMode(borderColors.default, darkModeBorderColors.default)} rounded-md text-sm ${withDarkMode(bgColors.primary, darkModeBgColors.primary)} ${withDarkMode(textColors.primary, darkModeTextColors.primary)}`}
                />
              </div>

              {/* Description */}
              <div>
                <label className={`block text-xs font-medium ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)} mb-1`}>
                  {t('workflowTemplates.editModal.description')}
                </label>
                <textarea
                  value={scheduleForm.description}
                  onChange={e => setScheduleForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className={`w-full px-3 py-2 border ${withDarkMode(borderColors.default, darkModeBorderColors.default)} rounded-md text-sm ${withDarkMode(bgColors.primary, darkModeBgColors.primary)} ${withDarkMode(textColors.primary, darkModeTextColors.primary)}`}
                />
              </div>

              {/* Schedule */}
              <ScheduleEditor
                recurrence={scheduleForm.recurrence}
                scheduleTime={scheduleForm.scheduleTime}
                onChange={(recurrence, scheduleTime) => setScheduleForm(f => ({ ...f, recurrence, scheduleTime }))}
                label={t('workflowTemplates.editModal.recurrence')}
              />
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="secondary" onClick={() => setScheduleModal(null)}>
                {t('workflowTemplates.editModal.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={handleScheduleSave}
                disabled={updateTemplate.isPending}
              >
                {updateTemplate.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> {t('workflowTemplates.editModal.saving')}</>
                ) : (
                  t('workflowTemplates.editModal.save')
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
