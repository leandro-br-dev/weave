import { useState } from 'react'
import { X, Bot, Map, Sparkles } from 'lucide-react'
import { Button } from '@/components'
import { useCreateDefaultAgents } from '@/api/projects'
import { useTranslation } from 'react-i18next'
import {
  modalColors,
  darkModeModalColors,
  borderColors,
  darkModeBorderColors,
  textColors,
  darkModeTextColors,
  errorColors,
  darkModeErrorColors,
  withDarkMode,
} from '@/lib/colors'

interface DefaultAgentsModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  environmentId: string
  projectName: string
  environmentName: string
}

export function DefaultAgentsModal({
  isOpen,
  onClose,
  projectId,
  environmentId,
  projectName,
  environmentName,
}: DefaultAgentsModalProps) {
  const { t } = useTranslation()
  const createDefaultAgents = useCreateDefaultAgents()

  const [createCoder, setCreateCoder] = useState(true)
  const [createPlanner, setCreatePlanner] = useState(true)

  if (!isOpen) return null

  const handleCreate = async () => {
    if (!createCoder && !createPlanner) return

    try {
      await createDefaultAgents.mutateAsync({
        projectId,
        environmentId,
        create_coder: createCoder,
        create_planner: createPlanner,
      })
      onClose()
    } catch {
      // Error handled by mutation state
    }
  }

  const handleSkip = () => {
    onClose()
  }

  const atLeastOneSelected = createCoder || createPlanner

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className={`absolute inset-0 ${withDarkMode(modalColors.overlay, darkModeModalColors.overlay)}`} onClick={handleSkip} />
      <div className={`relative ${withDarkMode(modalColors.panel, darkModeModalColors.panel)} rounded-lg border ${withDarkMode(modalColors.border, darkModeModalColors.border)} w-full max-w-lg mx-4`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${withDarkMode(borderColors.default, darkModeBorderColors.default)}`}>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span className={`text-sm font-semibold ${withDarkMode(modalColors.header, darkModeModalColors.header)}`}>
              {t('pages.projects.defaultAgents.title')}
            </span>
          </div>
          <button onClick={handleSkip} className={`${withDarkMode(textColors.muted, darkModeTextColors.muted)} ${withDarkMode('hover:text-gray-600', 'dark:hover:text-gray-300')}`}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          <p className={`text-sm ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)} mb-1`}>
            {t('pages.projects.defaultAgents.description')}
          </p>
          <p className={`text-xs ${withDarkMode(textColors.muted, darkModeTextColors.muted)} mb-4`}>
            {projectName} / {environmentName}
          </p>
          <div className={`mb-4 p-3 rounded-lg ${withDarkMode('bg-blue-50 border border-blue-200', 'dark:bg-blue-900/20 dark:border-blue-800')}`}>
            <p className={`text-xs ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`}>
              <strong>Note:</strong> When creating a project with default environments, the system auto-creates the matching team (Plan Team, Dev Team, or Staging Team) with the correct permissions and CLAUDE.md. This modal is only needed for manually-created environments.
            </p>
          </div>

          <div className="space-y-3">
            {/* Coder Agent Checkbox */}
            <label
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                createCoder
                  ? 'border-blue-300 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/20'
                  : `${withDarkMode(borderColors.default, darkModeBorderColors.default)} ${withDarkMode('hover:border-gray-300', 'dark:hover:border-gray-500')}`
              }`}
            >
              <input
                type="checkbox"
                checked={createCoder}
                onChange={(e) => setCreateCoder(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0 p-1.5 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                  <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${withDarkMode(modalColors.header, darkModeModalColors.header)}`}>
                      {t('pages.projects.defaultAgents.coder.label')}
                    </span>
                  </div>
                  <p className={`text-xs ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)} mt-0.5`}>
                    {t('pages.projects.defaultAgents.coder.description')}
                  </p>
                </div>
              </div>
            </label>

            {/* Planner Agent Checkbox */}
            <label
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                createPlanner
                  ? 'border-amber-300 bg-amber-50 dark:border-amber-600 dark:bg-amber-900/20'
                  : `${withDarkMode(borderColors.default, darkModeBorderColors.default)} ${withDarkMode('hover:border-gray-300', 'dark:hover:border-gray-500')}`
              }`}
            >
              <input
                type="checkbox"
                checked={createPlanner}
                onChange={(e) => setCreatePlanner(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0 p-1.5 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
                  <Map className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${withDarkMode(modalColors.header, darkModeModalColors.header)}`}>
                      {t('pages.projects.defaultAgents.planner.label')}
                    </span>
                    <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                      {t('pages.projects.defaultAgents.requiredBadge')}
                    </span>
                  </div>
                  <p className={`text-xs ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)} mt-0.5`}>
                    {t('pages.projects.defaultAgents.planner.description')}
                  </p>
                </div>
              </div>
            </label>
          </div>

          {/* Error message */}
          {createDefaultAgents.isError && (
            <div className={`mt-3 ${withDarkMode(errorColors.bg, darkModeErrorColors.bg)} border ${withDarkMode(errorColors.border, darkModeErrorColors.border)} rounded-lg p-3`}>
              <p className={`text-xs ${withDarkMode(errorColors.textAlt, darkModeErrorColors.textAlt)}`}>
                {t('pages.projects.defaultAgents.error')}: {(createDefaultAgents.error as Error)?.message}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-5 py-4 border-t ${withDarkMode(borderColors.default, darkModeBorderColors.default)} flex items-center justify-between`}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            disabled={createDefaultAgents.isPending}
          >
            {t('pages.projects.defaultAgents.skip')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleCreate}
            disabled={!atLeastOneSelected || createDefaultAgents.isPending}
            loading={createDefaultAgents.isPending}
          >
            {createDefaultAgents.isPending
              ? t('pages.projects.defaultAgents.creating')
              : t('pages.projects.defaultAgents.create')}
          </Button>
        </div>
      </div>
    </div>
  )
}
