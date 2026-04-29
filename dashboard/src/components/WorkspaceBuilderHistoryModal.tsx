import { useState, useEffect } from 'react'
import { X, Clock, CheckCircle2, XCircle, AlertCircle, ChevronRight, History, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from './Button'
import { cn } from '@/lib/utils'
import type { WorkspaceBuilderHistoryEntry } from '@/api/teams'
import {
  modalColors,
  darkModeModalColors,
  bgColors,
  darkModeBgColors,
  borderColors,
  darkModeBorderColors,
  textColors,
  darkModeTextColors,
  withDarkMode,
} from '@/lib/colors'

interface WorkspaceBuilderHistoryModalProps {
  isOpen: boolean
  entries: WorkspaceBuilderHistoryEntry[]
  teamId: string | null
  onSelect: (planId: string) => void
  onClose: () => void
}

const statusIcons: Record<string, React.ReactNode> = {
  success: <CheckCircle2 size={16} className="text-green-500" />,
  failed: <XCircle size={16} className="text-red-500" />,
  error: <XCircle size={16} className="text-red-500" />,
  running: <Loader2 size={16} className="animate-spin text-blue-500" />,
  pending: <Clock size={16} className="text-yellow-500" />,
  cancelled: <AlertCircle size={16} className="text-gray-400" />,
}

const statusLabels: Record<string, string> = {
  success: 'Completed',
  failed: 'Failed',
  error: 'Error',
  running: 'Running...',
  pending: 'Pending...',
  cancelled: 'Cancelled',
}

export function WorkspaceBuilderHistoryModal({
  isOpen,
  entries,
  teamId,
  onSelect,
  onClose,
}: WorkspaceBuilderHistoryModalProps) {
  const { t } = useTranslation('agents')

  if (!isOpen) return null

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString()
    } catch {
      return dateStr
    }
  }

  const canSelect = (entry: WorkspaceBuilderHistoryEntry) => {
    return entry.hasPlanFile && entry.status === 'success'
  }

  return (
    <div
      className={`fixed inset-0 ${withDarkMode(modalColors.overlay, darkModeModalColors.overlay)} flex items-center justify-center z-50 p-4 cursor-pointer`}
      onClick={onClose}
    >
      <div
        className={`${withDarkMode(modalColors.panel, darkModeModalColors.panel)} rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${withDarkMode(borderColors.default, darkModeBorderColors.default)}`}>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex-shrink-0">
              <History className="text-indigo-600 dark:text-indigo-400" size={18} />
            </div>
            <div>
              <h2 className={`text-xl font-semibold ${withDarkMode(modalColors.header, darkModeModalColors.header)}`}>
                {t('pages.agents.workspaceBuilder.historyTitle', { defaultValue: 'Workspace Builder History' })}
              </h2>
              <p className={`text-sm ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`}>
                {t('pages.agents.workspaceBuilder.historyDesc', { defaultValue: 'Select a previously generated plan to review and apply' })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`${withDarkMode(textColors.muted, darkModeTextColors.muted)} ${withDarkMode('hover:text-gray-600', 'dark:hover:text-gray-300')}`}
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          {entries.length === 0 ? (
            <div className={`text-center py-12 ${textColors.tertiary}`}>
              <History size={32} className="mx-auto mb-3 opacity-30" />
              <p>{t('pages.agents.workspaceBuilder.noHistory', { defaultValue: 'No workspace builder plans found for this team.' })}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className={cn(
                    `rounded-lg border ${withDarkMode(borderColors.default, darkModeBorderColors.default)}`,
                    withDarkMode(bgColors.secondary, darkModeBgColors.secondary),
                    canSelect(entry) && 'cursor-pointer hover:ring-2 hover:ring-indigo-500/50 transition-all',
                    !canSelect(entry) && 'opacity-60'
                  )}
                  onClick={() => canSelect(entry) && onSelect(entry.id)}
                >
                  <div className="flex items-center gap-3 p-4">
                    {/* Status icon */}
                    <div className="flex-shrink-0">
                      {statusIcons[entry.status] || <AlertCircle size={16} className="text-gray-400" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium ${withDarkMode(textColors.primary, darkModeTextColors.primary)}`}>
                          {entry.name}
                        </p>
                        <span className={cn(
                          'text-xs px-1.5 py-0.5 rounded',
                          entry.status === 'success' && 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
                          entry.status === 'failed' && 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
                          entry.status === 'error' && 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
                          entry.status === 'running' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
                          entry.status === 'pending' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
                          entry.status === 'cancelled' && 'bg-gray-100 text-gray-700 dark:bg-gray-900/50 dark:text-gray-300',
                        )}>
                          {statusLabels[entry.status] || entry.status}
                        </span>
                      </div>
                      {entry.summary && (
                        <p className={`text-xs mt-1 ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)} line-clamp-2`}>
                          {entry.summary}
                        </p>
                      )}
                      <div className={`flex items-center gap-3 mt-1.5 text-xs ${withDarkMode(textColors.muted, darkModeTextColors.muted)}`}>
                        <span>{formatDate(entry.created_at)}</span>
                        {entry.operationCount > 0 && (
                          <span>· {entry.operationCount} operations</span>
                        )}
                        {!entry.hasPlanFile && entry.status === 'success' && (
                          <span className="text-orange-500">
                            {t('pages.agents.workspaceBuilder.planFileMissing', { defaultValue: 'Plan file not found' })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Select arrow */}
                    {canSelect(entry) && (
                      <ChevronRight size={16} className={`flex-shrink-0 ${withDarkMode(textColors.muted, darkModeTextColors.muted)}`} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-end p-4 border-t ${withDarkMode(bgColors.tertiary, darkModeBgColors.tertiary)}`}>
          <Button onClick={onClose} variant="secondary" size="sm">
            {t('pages.agents.workspaceBuilder.close', { defaultValue: 'Close' })}
          </Button>
        </div>
      </div>
    </div>
  )
}
