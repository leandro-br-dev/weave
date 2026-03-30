import { AlertTriangle, Check, CheckCircle, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { useGetPendingApprovals, useRespondApproval, type Approval } from '@/api/approvals'
import { useApprovePlan, type Plan } from '@/api/plans'
import { apiClient } from '@/api/client'
import { PageHeader, Button, EmptyState } from '@/components'

export default function ApprovalsPage() {
  const { t } = useTranslation()
  const { data: approvals = [], isLoading } = useGetPendingApprovals()
  const respond = useRespondApproval()
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

  const totalPending = approvals.length + pendingPlans.length

  return (
    <div className="max-w-3xl mx-auto py-4 sm:py-8 px-4 sm:px-6">
      <PageHeader
        title={t('pages.approvals.title')}
        description={totalPending > 0 ? t('pages.approvals.pendingCount', { count: totalPending }) : undefined}
      />

      {(isLoading || isLoadingPlans) ? (
        <EmptyState title={t('pages.approvals.loading')} />
      ) : approvals.length === 0 && pendingPlans.length === 0 ? (
        <EmptyState
          icon={<CheckCircle className="h-10 w-10 sm:h-12 sm:w-12 text-green-400" />}
          title={t('pages.approvals.noPending')}
          description={t('pages.approvals.noPendingDesc')}
        />
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* Workflow Approvals Section */}
          {pendingPlans.length > 0 && (
            <div>
              <h2 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white mb-2 sm:mb-3">
                {t('pages.approvals.workflowApprovals', { count: pendingPlans.length })}
              </h2>
              <div className="space-y-2">
                {pendingPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{plan.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
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
              {pendingPlans.length > 0 && (
                <h2 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white mb-2 sm:mb-3">
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
    <div className="border border-amber-200 dark:border-amber-800 rounded-lg p-5 bg-amber-50 dark:bg-amber-900/20">
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="font-semibold text-gray-900 dark:text-white font-mono">{approval.tool}</span>
          <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">
            {t('pages.approvals.plan')}{' '}
            <a href={`/plans/${approval.plan_id}`} className="underline hover:text-gray-700 dark:hover:text-gray-300">
              {approval.plan_name ?? approval.plan_id.slice(0, 8)}
            </a>
            {' '}/ {t('pages.approvals.task')}{' '}
            <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">{approval.task_id}</code>
          </span>
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap ml-2">{ageLabel}</span>
      </div>

      {approval.reason && (
        <p className="text-sm text-amber-800 mb-3 flex items-start gap-1.5">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          {approval.reason}
        </p>
      )}

      <pre className="bg-gray-900 text-gray-100 rounded p-3 text-xs overflow-x-auto mb-4 max-h-40 whitespace-pre-wrap">
        {typeof inputData === 'object'
          ? JSON.stringify(inputData, null, 2)
          : String(inputData)}
      </pre>

      <div className="flex gap-3">
        <Button
          onClick={() => onDecision('approved')}
          disabled={isLoading}
          className="bg-green-600 hover:bg-green-700 border-green-600"
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
