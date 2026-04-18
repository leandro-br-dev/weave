import { useState } from 'react'
import { AlertTriangle, Check, CheckCircle, X, Send, MessageCircleQuestion } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { useGetPendingApprovals, useRespondApproval, type Approval } from '@/api/approvals'
import { useGetPendingUserInputs, useRespondUserInput, type UserInput } from '@/api/user_inputs'
import { useApprovePlan, type Plan } from '@/api/plans'
import { apiClient } from '@/api/client'
import { PageHeader, Button, EmptyState } from '@/components'
import { textColors, darkModeTextColors, bgColors, darkModeBgColors, warningColors, darkModeWarningColors, successColors, infoColors, darkModeInfoColors, codeBlockColors, darkModeCodeBlockColors, withDarkMode } from '@/lib/colors'

export default function ApprovalsPage() {
  const { t } = useTranslation()
  const { data: approvals = [], isLoading } = useGetPendingApprovals()
  const respond = useRespondApproval()
  const { data: userInputs = [], isLoading: isLoadingInputs } = useGetPendingUserInputs()
  const respondInput = useRespondUserInput()
  const navigate = useNavigate()
  const approvePlan = useApprovePlan()

  // Fetch plans awaiting approval
  const { data: pendingPlans = [], isLoading: isLoadingPlans } = useQuery({
    queryKey: ['plans', 'awaiting_approval'],
    queryFn: async () => {
      const all = await apiClient.get<Plan[]>('/api/plans');
      return all.filter(p => p.status === 'awaiting_approval');
    },
    refetchInterval: 5000,
  })

  const totalPending = approvals.length + pendingPlans.length + userInputs.length

  const allLoading = isLoading || isLoadingPlans || isLoadingInputs

  return (
    <div className="max-w-3xl mx-auto py-4 sm:py-8 px-4 sm:px-6">
      <PageHeader
        title={t('pages.approvals.title')}
        description={totalPending > 0 ? t('pages.approvals.pendingCount', { count: totalPending }) : undefined}
      />

      {allLoading ? (
        <EmptyState title={t('pages.approvals.loading')} />
      ) : approvals.length === 0 && pendingPlans.length === 0 && userInputs.length === 0 ? (
        <EmptyState
          icon={<CheckCircle className={`h-10 w-10 sm:h-12 sm:w-12 ${successColors.text}`} />}
          title={t('pages.approvals.noPending')}
          description={t('pages.approvals.noPendingDesc')}
        />
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* Workflow Approvals Section */}
          {pendingPlans.length > 0 && (
            <div>
              <h2 className={`text-xs sm:text-sm font-semibold ${withDarkMode(textColors.primary, darkModeTextColors.primary)} mb-2 sm:mb-3`}>
                {t('pages.approvals.workflowApprovals', { count: pendingPlans.length })}
              </h2>
              <div className="space-y-2">
                {pendingPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 ${warningColors.bg} ${darkModeWarningColors.bg} ${warningColors.border} ${darkModeWarningColors.border} rounded-lg`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${withDarkMode(textColors.primary, darkModeTextColors.primary)} truncate`}>{plan.name}</p>
                      <p className={`text-xs ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}`}>
                        {plan.tasks?.length ?? 0} {t('pages.approvals.tasks')} · {t('pages.approvals.created')} {new Date(plan.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/plans/${plan.id}`, {
                          state: { from: '/approvals', fromLabel: t('pages.approvals.approvals') }
                        })}
                        className="text-xs sm:text-sm"
                      >
                        {t('pages.approvals.review')}
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => approvePlan.mutate(plan.id)}
                        loading={approvePlan.isPending}
                        className="text-xs sm:text-sm"
                      >
                        <CheckCircle className="h-3 w-3" /> {t('pages.approvals.approve')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tool Use Approvals Section */}
          {approvals.length > 0 && (
            <div>
              {(pendingPlans.length > 0 || userInputs.length > 0) && (
                <h2 className={`text-xs sm:text-sm font-semibold ${withDarkMode(textColors.primary, darkModeTextColors.primary)} mb-2 sm:mb-3`}>
                  {t('pages.approvals.toolUseApprovals', { count: approvals.length })}
                </h2>
              )}
              <div className="space-y-3 sm:space-y-4">
                {approvals.map(approval => (
                  <ApprovalCard
                    key={approval.id}
                    approval={approval}
                    onDecision={(decision) => respond.mutate({ id: approval.id, decision })}
                    isLoading={respond.isPending}
                  />
                ))}
              </div>
            </div>
          )}

          {/* User Inputs / Information Requests Section */}
          {userInputs.length > 0 && (
            <div>
              <h2 className={`text-xs sm:text-sm font-semibold ${withDarkMode(textColors.primary, darkModeTextColors.primary)} mb-2 sm:mb-3`}>
                {t('pages.approvals.infoRequests', { count: userInputs.length })}
              </h2>
              <div className="space-y-3 sm:space-y-4">
                {userInputs.map(input => (
                  <UserInputInlineCard
                    key={input.id}
                    input={input}
                    onSubmit={(response) => respondInput.mutate({ id: input.id, response })}
                    isSubmitting={respondInput.isPending}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ApprovalCard({ approval, onDecision, isLoading }: {
  approval: Approval
  onDecision: (d: 'approved' | 'denied') => void
  isLoading: boolean
}) {
  const { t } = useTranslation()
  const inputData = (() => {
    try { return JSON.parse(approval.input) }
    catch { return approval.input }
  })()

  const ageSeconds = Math.round((Date.now() - new Date(approval.created_at).getTime()) / 1000)
  const ageLabel = ageSeconds < 60 ? `${ageSeconds}s ${t('pages.approvals.ago')}` : `${Math.round(ageSeconds/60)}m ${t('pages.approvals.ago')}`

  return (
    <div className={`border ${warningColors.border} ${darkModeWarningColors.border} rounded-lg p-5 ${warningColors.bg} ${darkModeWarningColors.bg}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className={`font-semibold ${withDarkMode(textColors.primary, darkModeTextColors.primary)} font-mono`}>{approval.tool}</span>
          <span className={`${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)} text-sm ml-2`}>
            {t('pages.approvals.plan')}{' '}
            <a href={`/plans/${approval.plan_id}`} className={`underline ${withDarkMode('hover:text-gray-700', 'dark:hover:text-gray-300')}`}>
              {approval.plan_name ?? approval.plan_id.slice(0, 8)}
            </a>
            {' '}/ {t('pages.approvals.task')}{' '}
            <code className={`text-xs ${bgColors.tertiary} ${darkModeBgColors.tertiary} px-1 rounded`}>{approval.task_id}</code>
          </span>
        </div>
        <span className={`text-xs ${withDarkMode(textColors.muted, darkModeTextColors.muted)} whitespace-nowrap ml-2`}>{ageLabel}</span>
      </div>

      {approval.reason && (
        <p className={`text-sm ${warningColors.textAlt} ${darkModeWarningColors.textAlt} mb-3 flex items-start gap-1.5`}>
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          {approval.reason}
        </p>
      )}

      <pre className={`${codeBlockColors.bg} ${codeBlockColors.text} ${darkModeCodeBlockColors.bg} ${darkModeCodeBlockColors.text} rounded p-3 text-xs overflow-x-auto mb-4 max-h-40 whitespace-pre-wrap`}>
        {typeof inputData === 'object'
          ? JSON.stringify(inputData, null, 2)
          : String(inputData)}
      </pre>

      <div className="flex gap-3">
        <Button
          onClick={() => onDecision('approved')}
          disabled={isLoading}
          className={`${successColors.text} ${successColors.bg} ${successColors.border} hover:bg-green-700 border-green-600`}
        >
          <Check className="h-4 w-4" /> {t('pages.approvals.approve')}
        </Button>
        <Button
          onClick={() => onDecision('denied')}
          disabled={isLoading}
          variant="danger"
        >
          <X className="h-4 w-4" /> {t('pages.approvals.deny')}
        </Button>
      </div>
    </div>
  )
}

function UserInputInlineCard({ input, onSubmit, isSubmitting }: {
  input: UserInput
  onSubmit: (response: string) => void
  isSubmitting: boolean
}) {
  const { t } = useTranslation()
  const [response, setResponse] = useState('')
  const [successId, setSuccessId] = useState<string | null>(null)

  // Parse optional context
  const contextData = (() => {
    if (!input.context) return null
    try { return JSON.parse(input.context) }
    catch { return null }
  })()

  const ageSeconds = Math.round((Date.now() - new Date(input.created_at).getTime()) / 1000)
  const ageLabel = ageSeconds < 60
    ? `${ageSeconds}s ${t('pages.approvals.ago')}`
    : ageSeconds < 3600
      ? `${Math.round(ageSeconds / 60)}m ${t('pages.approvals.ago')}`
      : `${Math.round(ageSeconds / 3600)}h ${t('pages.approvals.ago')}`

  const handleSubmit = () => {
    if (!response.trim()) return
    onSubmit(response.trim())
    setSuccessId(input.id)
    setResponse('')
    setTimeout(() => setSuccessId(null), 3000)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit()
    }
  }

  return (
    <div className={`border ${infoColors.border} ${darkModeInfoColors.border} rounded-lg p-5 ${infoColors.bg} ${darkModeInfoColors.bg}`}>
      {/* Header: question + metadata */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <MessageCircleQuestion className={`h-4 w-4 flex-shrink-0 ${infoColors.text}`} />
            <span className={`text-xs font-medium ${infoColors.textAlt} ${darkModeInfoColors.textAlt}`}>
              {t('pages.approvals.infoRequestsDesc')}
            </span>
          </div>
          <p className={`font-medium text-sm leading-relaxed ${withDarkMode(textColors.primary, darkModeTextColors.primary)}`}>
            {input.question}
          </p>
          <span className={`inline-flex items-center gap-1 ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)} text-xs mt-2`}>
            {t('pages.approvals.plan')}{' '}
            <a href={`/plans/${input.plan_id}`} className={`underline ${withDarkMode('hover:text-gray-700', 'dark:hover:text-gray-300')}`}>
              {input.plan_name ?? input.plan_id.slice(0, 8)}
            </a>
            {' '}/ {t('pages.approvals.task')}{' '}
            <code className={`${bgColors.tertiary} ${darkModeBgColors.tertiary} px-1 rounded`}>{input.task_id.slice(0, 8)}</code>
          </span>
        </div>
        <span className={`text-xs ${withDarkMode(textColors.muted, darkModeTextColors.muted)} whitespace-nowrap ml-3 flex-shrink-0`}>{ageLabel}</span>
      </div>

      {/* Optional context */}
      {contextData && typeof contextData === 'object' && (
        <pre className={`${codeBlockColors.bg} ${codeBlockColors.text} ${darkModeCodeBlockColors.bg} ${darkModeCodeBlockColors.text} rounded p-2 text-xs overflow-x-auto mb-3 max-h-20 whitespace-pre-wrap`}>
          {JSON.stringify(contextData, null, 2)}
        </pre>
      )}

      {/* Response textarea + submit */}
      <textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('pages.approvals.responsePlaceholder')}
        rows={2}
        className={`w-full rounded-lg border ${infoColors.border} ${darkModeInfoColors.border} ${withDarkMode(bgColors.primary, darkModeBgColors.primary)} ${withDarkMode(textColors.primary, darkModeTextColors.primary)} px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400`}
        disabled={isSubmitting}
      />
      <div className="flex items-center justify-between mt-2">
        <span className={`text-xs ${withDarkMode(textColors.muted, darkModeTextColors.muted)}`}>
          Ctrl+Enter
        </span>
        {successId === input.id ? (
          <span className={`flex items-center gap-1 text-sm font-medium ${successColors.text}`}>
            <CheckCircle className="h-4 w-4" /> {t('pages.approvals.responseSent')}
          </span>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!response.trim() || isSubmitting}
            className={`${infoColors.text} ${infoColors.bg} ${infoColors.border} hover:bg-blue-100 dark:hover:bg-blue-900 border-blue-300 dark:border-blue-800`}
            size="sm"
          >
            <Send className="h-3.5 w-3.5" /> {t('pages.approvals.sendResponse')}
          </Button>
        )}
      </div>
    </div>
  )
}
