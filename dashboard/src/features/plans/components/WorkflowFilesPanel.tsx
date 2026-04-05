import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useTranslation } from 'react-i18next'
import { useGetWorkflowFiles } from '@/api/plans'
import { Tabs } from '@/components/Tabs'
import { FileText, FileJson, AlertTriangle, RefreshCw, Eye } from 'lucide-react'

interface WorkflowFilesPanelProps {
  planId: string
}

/** Empty state when all files are null */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <FileText className="h-10 w-10 mb-3 opacity-50" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

/** Renders markdown content with styling */
function MarkdownViewer({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-pre:bg-gray-900 dark:prose-pre:bg-gray-800 prose-code:text-orange-600 dark:prose-code:text-orange-400 prose-a:text-orange-600 dark:prose-a:text-orange-400">
      <Markdown remarkPlugins={[remarkGfm]}>
        {content}
      </Markdown>
    </div>
  )
}

/** Renders plan.json as formatted code */
function JsonViewer({ data }: { data: unknown }) {
  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2)

  return (
    <pre className="text-sm text-gray-100 bg-gray-900 rounded-md p-4 overflow-x-auto font-mono whitespace-pre-wrap">
      {jsonStr}
    </pre>
  )
}

/** Renders errors.log with red-tinted styling */
function ErrorsViewer({ content }: { content: string }) {
  return (
    <pre className="text-sm text-red-300 bg-red-950/50 rounded-md p-4 overflow-x-auto font-mono whitespace-pre-wrap border border-red-900/30">
      {content}
    </pre>
  )
}

export function WorkflowFilesPanel({ planId }: WorkflowFilesPanelProps) {
  const { t } = useTranslation()
  const { data: files, isLoading, isError, refetch, isFetching } = useGetWorkflowFiles(planId)

  const hasState = !!files?.state
  const hasPlanJson = !!files?.plan_json
  const hasErrors = !!files?.errors
  const hasAnyContent = hasState || hasPlanJson || hasErrors

  const tabs = [
    {
      id: 'state',
      label: t('planDetail.workflowFiles.stateMd', 'state.md'),
      icon: <FileText className="h-4 w-4" />,
      content: hasState ? (
        <MarkdownViewer content={files!.state!} />
      ) : (
        <EmptyState message={t('planDetail.workflowFiles.emptyState', 'No state recorded yet. The agents have not started writing to this file.')} />
      ),
    },
    {
      id: 'plan',
      label: t('planDetail.workflowFiles.planJson', 'plan.json'),
      icon: <FileJson className="h-4 w-4" />,
      content: hasPlanJson ? (
        <JsonViewer data={files!.plan_json} />
      ) : (
        <EmptyState message={t('planDetail.workflowFiles.emptyPlan', 'No plan data recorded yet.')} />
      ),
    },
    {
      id: 'errors',
      label: t('planDetail.workflowFiles.errorsLog', 'errors.log'),
      icon: <AlertTriangle className="h-4 w-4" />,
      content: hasErrors ? (
        <ErrorsViewer content={files!.errors!} />
      ) : (
        <EmptyState message={t('planDetail.workflowFiles.emptyErrors', 'No errors recorded. Everything looks clean!')} />
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold leading-7 text-gray-900">
              {t('planDetail.workflowFiles.title', 'Workflow Context')}
            </h2>
          </div>
          <div className="flex items-center justify-center py-12 text-gray-400">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm">{t('planDetail.workflowFiles.loading', 'Loading workflow files...')}</span>
          </div>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold leading-7 text-gray-900">
              {t('planDetail.workflowFiles.title', 'Workflow Context')}
            </h2>
          </div>
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <AlertTriangle className="h-8 w-8 mb-2 text-red-300" />
            <p className="text-sm">{t('planDetail.workflowFiles.error', 'Failed to load workflow files.')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold leading-7 text-gray-900">
              {t('planDetail.workflowFiles.title', 'Workflow Context')}
            </h2>
            {!hasAnyContent && (
              <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                {t('planDetail.workflowFiles.noData', 'No data')}
              </span>
            )}
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50"
            title={t('planDetail.workflowFiles.refresh', 'Refresh')}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            {t('planDetail.workflowFiles.refresh', 'Refresh')}
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          {t('planDetail.workflowFiles.description', 'Live audit trail showing communication between agents: what the Planner told the Coder, and what the Coder told the Tester.')}
        </p>
        <Tabs tabs={tabs} defaultTab="state" />
      </div>
    </div>
  )
}
