import { useState, useRef } from 'react'
import { Link } from 'react-router'
import { Plus, Upload, Loader2, ChevronUp, ChevronDown, ChevronsUpDown, Paperclip, GitBranch, ArrowUpRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  PageHeader,
  Button,
  MetricCard,
  StatusBadge,
  EmptyState,
  Pagination,
  ProjectIcon,
  ProjectSelectDropdown,
} from '@/components'
import { useGetPlans, useGetMetrics, useCreatePlan } from '@/api/plans'
import { useGetProjects } from '@/api/projects'
import {
  bgColors, darkModeBgColors,
  textColors, darkModeTextColors,
  borderColors, darkModeBorderColors,
  accentColors, darkModeAccentColors,
  tableColors, darkModeTableColors,
  interactiveStates, darkModeInteractiveStates,
  withDarkMode,
} from '@/lib/colors'

const PAGE_SIZE = 15

export default function WorkflowsPage() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [projectFilter, setProjectFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortColumn, setSortColumn] = useState<string>('created_at')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const importRef = useRef<HTMLInputElement>(null)

  const { data: metrics } = useGetMetrics()
  const { data: allPlans = [], isLoading, error } = useGetPlans()
  const { data: projects = [] } = useGetProjects()
  const importPlan = useCreatePlan()

  // Filter by project
  const projectFiltered = projectFilter
    ? allPlans.filter((p: any) => p.project_id === projectFilter)
    : allPlans

  // Filter by status on frontend
  let filtered = statusFilter
    ? projectFiltered.filter((p: any) => p.status === statusFilter)
    : projectFiltered

  // Sort function
  filtered = [...filtered].sort((a: any, b: any) => {
    let aValue: any
    let bValue: any

    switch (sortColumn) {
      case 'name':
        aValue = a.name?.toLowerCase() || ''
        bValue = b.name?.toLowerCase() || ''
        break
      case 'status':
        aValue = a.status || ''
        bValue = b.status || ''
        break
      case 'tasks':
        const aTasks = Array.isArray(a.tasks) ? a.tasks : []
        const bTasks = Array.isArray(b.tasks) ? b.tasks : []
        aValue = aTasks.length
        bValue = bTasks.length
        break
      case 'duration':
        aValue =
          a.started_at && a.completed_at
            ? Math.round(
                (new Date(a.completed_at).getTime() -
                  new Date(a.started_at).getTime()) /
                  1000
              )
            : -1
        bValue =
          b.started_at && b.completed_at
            ? Math.round(
                (new Date(b.completed_at).getTime() -
                  new Date(b.started_at).getTime()) /
                  1000
              )
            : -1
        break
      case 'client':
        aValue = a.client_id?.split('-')[0] || ''
        bValue = b.client_id?.split('-')[0] || ''
        break
      case 'created_at':
        aValue = new Date(a.created_at).getTime()
        bValue = new Date(b.created_at).getTime()
        break
      default:
        return 0
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const json = JSON.parse(await file.text())
      if (!json.name || !Array.isArray(json.tasks)) {
        alert('Invalid JSON: must have "name" and "tasks" array')
        return
      }
      await importPlan.mutateAsync({
        name: json.name,
        tasks: json.tasks,
        project_id: projectFilter || undefined,
      })
      e.target.value = ''
    } catch (err) {
      alert(`Import failed: ${err instanceof Error ? err.message : 'Invalid JSON'}`)
    }
  }

  const handleExport = (plan: any) => {
    const tasks = Array.isArray(plan.tasks)
      ? plan.tasks
      : JSON.parse(plan.tasks ?? '[]')
    const blob = new Blob(
      [JSON.stringify({ name: plan.name, tasks }, null, 2)],
      { type: 'application/json' }
    )
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `${plan.name.replace(/\s+/g, '-').toLowerCase()}.json`,
    })
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <ChevronsUpDown className="h-3 w-3 inline ml-1 opacity-30" />
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="h-3 w-3 inline ml-1 opacity-70" />
    ) : (
      <ChevronDown className="h-3 w-3 inline ml-1 opacity-70" />
    )
  }

  const formatDuration = (s: number) =>
    s < 60
      ? `${s}s`
      : s < 3600
        ? `${Math.round(s / 60)}m`
        : `${(s / 3600).toFixed(1)}h`

  const countTaskAttachments = (plan: any): number => {
    // Plan-level attachments (collected by backend from all task attachment_ids)
    const planAttachments: string[] = Array.isArray(plan.attachments) ? plan.attachments : []
    // Also count from individual tasks as fallback
    const tasks = Array.isArray(plan.tasks) ? plan.tasks : []
    const taskAttachments = tasks.reduce((sum: number, t: any) => {
      return sum + (Array.isArray(t.attachment_ids) ? t.attachment_ids.length : 0)
    }, 0)
    // Use the max of both to avoid duplicates but not miss any
    return Math.max(planAttachments.length, taskAttachments)
  }

  // Helper to get project by ID
  const getProjectById = (projectId: string) =>
    projects.find(p => p.id === projectId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className={textColors.tertiary}>Loading workflows...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500 dark:text-red-400">
          Error loading workflows: {(error as Error).message}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto py-4 sm:py-8 px-4 sm:px-6">
      <PageHeader
        title={t('pages.workflows.title')}
        description={t('pages.workflows.description')}
        actions={
          <>
            {/* Project filter */}
            <ProjectSelectDropdown
              value={projectFilter}
              onChange={(value) => {
                setProjectFilter(value)
                setPage(1)
              }}
              projects={projects}
              showAllOption
              allOptionLabel={t('pages.workflows.filters.allProjects')}
              placeholder={t('pages.workflows.filters.allProjects')}
              className="w-40 sm:w-64"
            />

            {/* Import */}
            <label
              className={`cursor-pointer inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 border ${withDarkMode(borderColors.thick, darkModeBorderColors.thick)} rounded-md text-xs sm:text-sm ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)} ${withDarkMode(interactiveStates.hoverBg, darkModeInteractiveStates.hoverBg)} ${
                importPlan.isPending ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {importPlan.isPending ? (
                <>
                  <Loader2 className="h-3.5 sm:h-4 w-3.5 sm:w-4 animate-spin" />
                  <span className="hidden sm:inline">{t('pages.workflows.header.importing')}</span>
                </>
              ) : (
                <>
                  <Upload className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
                  <span className="hidden sm:inline">{t('pages.workflows.header.import')}</span>
                </>
              )}
              <input
                ref={importRef}
                type="file"
                accept=".json"
                className="hidden"
                disabled={importPlan.isPending}
                onChange={handleImport}
              />
            </label>

            <Button
              variant="primary"
              onClick={() => (window.location.href = '/plans/new')}
              className="text-xs sm:text-sm"
            >
              <Plus className="h-3.5 sm:h-4 w-3.5 sm:w-4" /> <span className="hidden sm:inline">{t('pages.workflows.header.newWorkflow')}</span><span className="sm:hidden">{t('pages.workflows.header.new')}</span>
            </Button>
          </>
        }
      />

      {/* Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-8">
          <MetricCard label={t('pages.workflows.list.metrics.total')} value={metrics.total} />
          <MetricCard
            label={t('pages.workflows.list.metrics.successRate')}
            value={`${metrics.success_rate}%`}
            color={
              metrics.success_rate >= 70
                ? 'green'
                : metrics.success_rate >= 40
                  ? 'amber'
                  : 'red'
            }
          />
          <MetricCard
            label={t('pages.workflows.list.metrics.avgDuration')}
            value={formatDuration(metrics.avg_duration_seconds)}
          />
          <MetricCard
            label={t('pages.workflows.list.metrics.last7Days')}
            value={`${metrics.last_7_days.success}✓ ${metrics.last_7_days.failed}✗`}
          />
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-1 mb-4">
        {['', 'pending', 'running', 'success', 'failed'].map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatusFilter(s)
              setPage(1)
            }}
            className={`px-2 sm:px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
              statusFilter === s
                ? `${withDarkMode(bgColors.inverted, 'dark:bg-gray-100')} ${withDarkMode(textColors.inverted, 'dark:text-gray-900')}`
                : `${textColors.tertiary} ${withDarkMode(interactiveStates.hoverBg, darkModeInteractiveStates.hoverBg)}`
            }`}
          >
            {s === '' ? t('pages.workflows.filters.all') :
             s === 'pending' ? t('pages.workflows.filters.pending') :
             s === 'running' ? t('pages.workflows.filters.running') :
             s === 'success' ? t('pages.workflows.filters.success') :
             t('pages.workflows.filters.failed')}
            {s !== '' && metrics?.by_status?.[s as keyof typeof metrics.by_status] ? (
              <span className="ml-1 text-xs opacity-70">
                {metrics.by_status[s as keyof typeof metrics.by_status]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Table - Responsive with card view on mobile */}
      <div className={`${withDarkMode(bgColors.secondary, darkModeBgColors.secondary)} border ${withDarkMode(borderColors.default, darkModeBorderColors.default)} rounded-lg overflow-hidden`}>
        {paginated.length === 0 ? (
          <EmptyState
            title={
              statusFilter
                ? t('pages.workflows.empty.noStatusWorkflows', { status: statusFilter })
                : t('pages.workflows.empty.noWorkflows')
            }
            description={
              statusFilter
                ? t('pages.workflows.empty.tryClearingFilter')
                : t('pages.workflows.empty.createFirst')
            }
          />
        ) : (
          <>
            {/* Desktop table view */}
            <div className="hidden md:block">
              <table className="min-w-full">
                <thead>
                  <tr className={`${withDarkMode(tableColors.headerBg, darkModeTableColors.headerBg)} border-b ${withDarkMode(borderColors.default, darkModeBorderColors.default)}`}>
                    <th
                      className={`px-4 py-3 text-left text-xs font-medium ${withDarkMode(tableColors.headerText, darkModeTableColors.headerText)} uppercase tracking-wide cursor-pointer ${withDarkMode(interactiveStates.hoverBg, darkModeInteractiveStates.hoverBg)} select-none`}
                      onClick={() => handleSort('name')}
                    >
                      {t('pages.workflows.list.table.name')}{getSortIcon('name')}
                    </th>
                    <th
                      className={`px-4 py-3 text-left text-xs font-medium ${withDarkMode(tableColors.headerText, darkModeTableColors.headerText)} uppercase tracking-wide cursor-pointer ${withDarkMode(interactiveStates.hoverBg, darkModeInteractiveStates.hoverBg)} select-none`}
                      onClick={() => handleSort('status')}
                    >
                      {t('pages.workflows.list.table.status')}{getSortIcon('status')}
                    </th>
                    <th
                      className={`px-4 py-3 text-left text-xs font-medium ${withDarkMode(tableColors.headerText, darkModeTableColors.headerText)} uppercase tracking-wide cursor-pointer ${withDarkMode(interactiveStates.hoverBg, darkModeInteractiveStates.hoverBg)} select-none`}
                      onClick={() => handleSort('tasks')}
                    >
                      {t('pages.workflows.list.table.tasks')}{getSortIcon('tasks')}
                    </th>
                    <th
                      className={`px-4 py-3 text-left text-xs font-medium ${withDarkMode(tableColors.headerText, darkModeTableColors.headerText)} uppercase tracking-wide cursor-pointer ${withDarkMode(interactiveStates.hoverBg, darkModeInteractiveStates.hoverBg)} select-none`}
                      onClick={() => handleSort('duration')}
                    >
                      {t('pages.workflows.list.table.duration')}{getSortIcon('duration')}
                    </th>
                    <th
                      className={`px-4 py-3 text-left text-xs font-medium ${withDarkMode(tableColors.headerText, darkModeTableColors.headerText)} uppercase tracking-wide cursor-pointer ${withDarkMode(interactiveStates.hoverBg, darkModeInteractiveStates.hoverBg)} select-none`}
                      onClick={() => handleSort('client')}
                    >
                      {t('pages.workflows.list.table.client')}{getSortIcon('client')}
                    </th>
                    <th
                      className={`px-4 py-3 text-left text-xs font-medium ${withDarkMode(tableColors.headerText, darkModeTableColors.headerText)} uppercase tracking-wide cursor-pointer ${withDarkMode(interactiveStates.hoverBg, darkModeInteractiveStates.hoverBg)} select-none`}
                      onClick={() => handleSort('created_at')}
                    >
                      {t('pages.workflows.list.table.when')}{getSortIcon('created_at')}
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className={`divide-y ${withDarkMode(borderColors.subtle, darkModeBorderColors.default)}`}>
                  {paginated.map((plan: any) => {
                    const tasks = Array.isArray(plan.tasks) ? plan.tasks : []
                    const duration =
                      plan.started_at && plan.completed_at
                        ? Math.round(
                            (new Date(plan.completed_at).getTime() -
                              new Date(plan.started_at).getTime()) /
                              1000
                          )
                        : null
                    const attachmentCount = countTaskAttachments(plan)
                    return (
                      <tr
                        key={plan.id}
                        className={`${withDarkMode(tableColors.rowHover, darkModeTableColors.rowHover)} transition-colors`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {plan.project_id && getProjectById(plan.project_id) && (
                              <ProjectIcon
                                project={getProjectById(plan.project_id)!}
                                size={16}
                              />
                            )}
                            {plan.parent_plan_id && (
                              <span
                                className="inline-flex items-center gap-0.5 text-purple-500 dark:text-purple-400"
                                title={t('pages.workflows.list.table.childWorkflowTooltip')}
                              >
                                <GitBranch className="h-3.5 w-3.5" />
                              </span>
                            )}
                            <Link
                              to={`/plans/${plan.id}`}
                              className={`text-sm font-medium ${withDarkMode(textColors.primary, darkModeTextColors.primary)} ${withDarkMode('hover:text-gray-600', 'dark:hover:text-gray-300')}`}
                            >
                              {plan.name}
                            </Link>
                            {plan.parent_plan_id && (
                              <Link
                                to={`/plans/${plan.parent_plan_id}`}
                                className={`inline-flex items-center gap-0.5 text-xs ${withDarkMode('text-purple-500 hover:text-purple-700', 'dark:text-purple-400 dark:hover:text-purple-300')}`}
                                title={t('pages.workflows.list.table.viewParentTooltip')}
                              >
                                <ArrowUpRight className="h-3 w-3" />
                              </Link>
                            )}
                            {attachmentCount > 0 && (
                              <span className={`inline-flex items-center gap-0.5 text-xs ${withDarkMode(textColors.muted, darkModeTextColors.veryMuted)}`} title={`${attachmentCount} attachment(s)`}>
                                <Paperclip className="h-3 w-3" />
                                <span>{attachmentCount}</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={plan.status} animate />
                        </td>
                        <td className={`px-4 py-3 text-sm ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}`}>
                          {tasks.length}
                        </td>
                        <td className={`px-4 py-3 text-sm ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}`}>
                          {duration !== null ? formatDuration(duration) : '—'}
                        </td>
                        <td className={`px-4 py-3 text-xs font-mono ${withDarkMode(textColors.muted, darkModeTextColors.veryMuted)}`}>
                          {plan.client_id?.split('-')[0] ?? '—'}
                        </td>
                        <td className={`px-4 py-3 text-xs ${withDarkMode(textColors.muted, darkModeTextColors.veryMuted)}`}>
                          {new Date(plan.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleExport(plan)}
                            className={`text-xs ${withDarkMode(textColors.muted, darkModeTextColors.veryMuted)} ${withDarkMode('hover:text-gray-600', 'dark:hover:text-gray-300')}`}
                            title={t('pages.workflows.list.table.export')}
                          >
                            ↓
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card view */}
            <div className="md:hidden space-y-3">
              {paginated.map((plan: any) => {
                const tasks = Array.isArray(plan.tasks) ? plan.tasks : []
                const duration =
                  plan.started_at && plan.completed_at
                    ? Math.round(
                        (new Date(plan.completed_at).getTime() -
                          new Date(plan.started_at).getTime()) /
                          1000
                      )
                    : null
                const attachmentCount = countTaskAttachments(plan)
                return (
                  <div
                    key={plan.id}
                    className={`${withDarkMode(bgColors.secondary, darkModeBgColors.secondary)} border ${withDarkMode(borderColors.default, darkModeBorderColors.default)} rounded-lg p-4 hover:shadow-md transition-shadow`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {plan.project_id && getProjectById(plan.project_id) && (
                          <ProjectIcon
                            project={getProjectById(plan.project_id)!}
                            size={16}
                          />
                        )}
                        {plan.parent_plan_id && (
                          <span
                            className="inline-flex items-center gap-0.5 text-purple-500 dark:text-purple-400 flex-shrink-0"
                            title={t('pages.workflows.list.table.childWorkflowTooltip')}
                          >
                            <GitBranch className="h-3.5 w-3.5" />
                          </span>
                        )}
                        <Link
                          to={`/plans/${plan.id}`}
                          className={`text-sm font-medium ${withDarkMode(textColors.primary, darkModeTextColors.primary)} ${withDarkMode('hover:text-gray-600', 'dark:hover:text-gray-300')} truncate`}
                        >
                          {plan.name}
                        </Link>
                        {plan.parent_plan_id && (
                          <Link
                            to={`/plans/${plan.parent_plan_id}`}
                            className={`inline-flex items-center gap-0.5 text-xs text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 flex-shrink-0`}
                            title={t('pages.workflows.list.table.viewParentTooltip')}
                          >
                            <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        )}
                        {attachmentCount > 0 && (
                          <span className={`inline-flex items-center gap-0.5 text-xs ${withDarkMode(textColors.muted, darkModeTextColors.veryMuted)}`} title={`${attachmentCount} attachment(s)`}>
                            <Paperclip className="h-3 w-3" />
                            <span>{attachmentCount}</span>
                          </span>
                        )}
                      </div>
                      <StatusBadge status={plan.status} animate />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div>
                        <span className={withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}>{t('pages.workflows.list.table.tasks')}:</span>{' '}
                        <span className="font-medium">{tasks.length}</span>
                      </div>
                      <div>
                        <span className={withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}>{t('pages.workflows.list.table.duration')}:</span>{' '}
                        <span className="font-medium">{duration !== null ? formatDuration(duration) : '—'}</span>
                      </div>
                      <div>
                        <span className={withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}>{t('pages.workflows.list.table.client')}:</span>{' '}
                        <span className="font-mono">{plan.client_id?.split('-')[0] ?? '—'}</span>
                      </div>
                      <div>
                        <span className={withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}>{t('pages.workflows.list.table.created')}:</span>{' '}
                        <span className="font-medium">
                          {new Date(plan.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <Link
                        to={`/plans/${plan.id}`}
                        className={`text-xs ${withDarkMode(accentColors.text, darkModeAccentColors.text)} hover:text-orange-800`}
                      >
                        View details →
                      </Link>
                      <button
                        onClick={() => handleExport(plan)}
                        className={`text-xs ${withDarkMode(textColors.muted, darkModeTextColors.veryMuted)} ${withDarkMode('hover:text-gray-600', 'dark:hover:text-gray-300')}`}
                      >
                        Export ↓
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
        <Pagination
          page={page}
          totalPages={totalPages}
          total={filtered.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>
    </div>
  )
}
