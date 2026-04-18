import { useState } from 'react'
import { CheckCircle, Send, ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useGetPendingUserInputs, useRespondUserInput, type UserInput } from '@/api/user_inputs'
import { PageHeader, Button, EmptyState } from '@/components'
import { textColors, darkModeTextColors, bgColors, darkModeBgColors, infoColors, darkModeInfoColors, successColors, codeBlockColors, darkModeCodeBlockColors, withDarkMode } from '@/lib/colors'

export default function UserInputsPage() {
  const { t } = useTranslation()
  const { data: pendingInputs = [], isLoading } = useGetPendingUserInputs()
  const respond = useRespondUserInput()
  const [showHistory, setShowHistory] = useState(false)
  const [successId, setSuccessId] = useState<string | null>(null)

  return (
    <div className="max-w-3xl mx-auto py-4 sm:py-8 px-4 sm:px-6">
      <PageHeader
        title={t('pages.userInputs.title')}
        description={pendingInputs.length > 0 ? t('pages.userInputs.pendingCount', { count: pendingInputs.length }) : undefined}
      />

      {isLoading ? (
        <EmptyState title={t('pages.userInputs.loading')} />
      ) : pendingInputs.length === 0 ? (
        <EmptyState
          icon={<CheckCircle className={`h-10 w-10 sm:h-12 sm:w-12 ${successColors.text}`} />}
          title={t('pages.userInputs.noPending')}
          description={t('pages.userInputs.noPendingDesc')}
        />
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {pendingInputs.map(input => (
            <UserInputCard
              key={input.id}
              input={input}
              onSubmit={(response) => {
                respond.mutate({ id: input.id, response }, {
                  onSuccess: () => {
                    setSuccessId(input.id)
                    setTimeout(() => setSuccessId(null), 3000)
                  }
                })
              }}
              isSubmitting={respond.isPending}
              isSuccess={successId === input.id}
            />
          ))}
        </div>
      )}

      {/* History section */}
      <div className="mt-8">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`flex items-center gap-2 text-sm font-medium ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)} hover:opacity-80 transition-opacity`}
        >
          {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {t('pages.userInputs.history')}
        </button>
        {showHistory && (
          <p className={`mt-2 text-sm ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}`}>
            {t('pages.userInputs.noHistory')}
          </p>
        )}
      </div>
    </div>
  )
}

function UserInputCard({ input, onSubmit, isSubmitting, isSuccess }: {
  input: UserInput
  onSubmit: (response: string) => void
  isSubmitting: boolean
  isSuccess: boolean
}) {
  const { t } = useTranslation()
  const [response, setResponse] = useState('')

  // Parse optional context
  const contextData = (() => {
    if (!input.context) return null
    try { return JSON.parse(input.context) }
    catch { return null }
  })()

  const ageSeconds = Math.round((Date.now() - new Date(input.created_at).getTime()) / 1000)
  const ageLabel = ageSeconds < 60
    ? `${ageSeconds}s ${t('pages.userInputs.ago')}`
    : ageSeconds < 3600
      ? `${Math.round(ageSeconds / 60)}m ${t('pages.userInputs.ago')}`
      : `${Math.round(ageSeconds / 3600)}h ${t('pages.userInputs.ago')}`

  const handleSubmit = () => {
    if (!response.trim()) return
    onSubmit(response.trim())
    setResponse('')
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
          <p className={`font-medium text-sm leading-relaxed ${withDarkMode(textColors.primary, darkModeTextColors.primary)}`}>
            {input.question}
          </p>
          <span className={`inline-flex items-center gap-1 ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)} text-xs mt-2`}>
            {t('pages.userInputs.plan')}{' '}
            <a href={`/plans/${input.plan_id}`} className={`underline ${withDarkMode('hover:text-gray-700', 'dark:hover:text-gray-300')}`}>
              {input.plan_name ?? input.plan_id.slice(0, 8)}
            </a>
            {' '}/ {t('pages.userInputs.task')}{' '}
            <code className={`${bgColors.tertiary} ${darkModeBgColors.tertiary} px-1 rounded`}>{input.task_id.slice(0, 8)}</code>
          </span>
        </div>
        <span className={`text-xs ${withDarkMode(textColors.muted, darkModeTextColors.muted)} whitespace-nowrap ml-3 flex-shrink-0`}>{ageLabel}</span>
      </div>

      {/* Optional context */}
      {contextData && typeof contextData === 'object' && (
        <div className="mb-3">
          <p className={`text-xs font-semibold mb-1 ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}`}>
            {t('pages.userInputs.context')}
          </p>
          <pre className={`${codeBlockColors.bg} ${codeBlockColors.text} ${darkModeCodeBlockColors.bg} ${darkModeCodeBlockColors.text} rounded p-2 text-xs overflow-x-auto max-h-24 whitespace-pre-wrap`}>
            {JSON.stringify(contextData, null, 2)}
          </pre>
        </div>
      )}

      {/* Response textarea + submit */}
      <div className="mt-4">
        <textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('pages.userInputs.placeholder')}
          rows={3}
          className={`w-full rounded-lg border ${infoColors.border} ${darkModeInfoColors.border} ${withDarkMode(bgColors.primary, darkModeBgColors.primary)} ${withDarkMode(textColors.primary, darkModeTextColors.primary)} px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400`}
          disabled={isSubmitting}
        />
        <div className="flex items-center justify-between mt-2">
          <span className={`text-xs ${withDarkMode(textColors.muted, darkModeTextColors.muted)}`}>
            Ctrl+Enter to send
          </span>
          {isSuccess ? (
            <span className={`flex items-center gap-1 text-sm font-medium ${successColors.text}`}>
              <CheckCircle className="h-4 w-4" /> {t('pages.userInputs.submitted')}
            </span>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!response.trim() || isSubmitting}
              className={`${infoColors.text} ${infoColors.bg} ${infoColors.border} hover:bg-blue-100 dark:hover:bg-blue-900 border-blue-300 dark:border-blue-800`}
              size="sm"
            >
              <Send className="h-3.5 w-3.5" /> {t('pages.userInputs.submit')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
