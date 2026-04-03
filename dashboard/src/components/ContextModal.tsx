import { X, FolderTree, GitBranch, GitCommit, Globe, FileCode, FolderOpen } from 'lucide-react'
import { Button } from '@/components'
import { type ProjectContext } from '@/api/projects'
import { useTranslation } from 'react-i18next'
import {
  modalColors,
  darkModeModalColors,
  bgColors,
  darkModeBgColors,
  borderColors,
  darkModeBorderColors,
  textColors,
  darkModeTextColors,
  infoColors,
  darkModeInfoColors,
  errorColors,
  darkModeErrorColors,
  withDarkMode,
} from '@/lib/colors'

interface ContextModalProps {
  isOpen: boolean
  onClose: () => void
  context: ProjectContext | null
  isLoading: boolean
  error: string | null
  environmentName: string
  projectName: string
}

export function ContextModal({
  isOpen,
  onClose,
  context,
  isLoading,
  error,
  environmentName,
  projectName,
}: ContextModalProps) {
  const { t } = useTranslation()
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className={`absolute inset-0 ${withDarkMode(modalColors.overlay, darkModeModalColors.overlay)}`} onClick={onClose} />
      <div className={`relative ${withDarkMode(modalColors.panel, darkModeModalColors.panel)} rounded-lg border ${withDarkMode(modalColors.border, darkModeModalColors.border)} w-full max-w-3xl mx-4 flex flex-col max-h-[85vh]`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${withDarkMode(borderColors.default, darkModeBorderColors.default)}`}>
          <div className="flex items-center gap-2">
            <FolderTree className={`h-4 w-4 ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}`} />
            <span className={`text-sm font-semibold ${withDarkMode(modalColors.header, darkModeModalColors.header)}`}>{t('components.contextModal.title')}</span>
            <span className={`text-xs ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}`}>
              {projectName} / {environmentName}
            </span>
            {isLoading && (
              <span className={`text-xs ${withDarkMode(infoColors.bg, darkModeInfoColors.bg)} ${withDarkMode(infoColors.text, darkModeInfoColors.text)} px-2 py-0.5 rounded-full animate-pulse`}>
                {t('components.contextModal.generating')}
              </span>
            )}
          </div>
          <button onClick={onClose} className={`${withDarkMode(textColors.muted, darkModeTextColors.muted)} ${withDarkMode('hover:text-gray-600', 'dark:hover:text-gray-300')}`}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-5">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${withDarkMode(textColors.primary, darkModeTextColors.primary)} mx-auto mb-3`}></div>
                <p className={`text-sm ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`}>{t('components.contextModal.generatingContext')}</p>
              </div>
            </div>
          )}

          {error && (
            <div className={`${withDarkMode(errorColors.bg, darkModeErrorColors.bg)} border ${withDarkMode(errorColors.border, darkModeErrorColors.border)} rounded-lg p-4`}>
              <p className={`text-sm ${withDarkMode(errorColors.textAlt, darkModeErrorColors.textAlt)}`}>{error}</p>
            </div>
          )}

          {context && !isLoading && (
            <div className="space-y-4">
              {/* File Structure */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FolderOpen className={`h-4 w-4 ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`} />
                  <h3 className={`text-sm font-semibold ${withDarkMode(modalColors.header, darkModeModalColors.header)}`}>{t('components.contextModal.fileStructure')}</h3>
                </div>
                <div className={`${withDarkMode(bgColors.inverted, darkModeBgColors.inverted)} rounded-lg p-4 font-mono text-xs text-gray-300 overflow-x-auto max-h-64 overflow-y-auto`}>
                  <pre className="whitespace-pre-wrap">{context.structure}</pre>
                </div>
              </div>

              {/* Git Information */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <GitBranch className={`h-4 w-4 ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`} />
                  <h3 className={`text-sm font-semibold ${withDarkMode(modalColors.header, darkModeModalColors.header)}`}>{t('components.contextModal.gitInformation')}</h3>
                </div>
                <div className={`${withDarkMode(bgColors.tertiary, darkModeBgColors.tertiary)} border ${withDarkMode(borderColors.default, darkModeBorderColors.default)} rounded-lg p-4 space-y-2`}>
                  <div className="flex items-center gap-3">
                    <GitBranch className={`h-3.5 w-3.5 ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}`} />
                    <span className={`text-xs ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`}>{t('components.contextModal.branch')}:</span>
                    <code className={`text-xs ${withDarkMode(bgColors.secondary, darkModeBgColors.secondary)} px-2 py-0.5 rounded border ${withDarkMode(borderColors.default, darkModeBorderColors.default)} font-mono`}>
                      {context.git_info.branch}
                    </code>
                  </div>
                  <div className="flex items-center gap-3">
                    <GitCommit className={`h-3.5 w-3.5 ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}`} />
                    <span className={`text-xs ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`}>{t('components.contextModal.lastCommit')}:</span>
                    <code className={`text-xs ${withDarkMode(bgColors.secondary, darkModeBgColors.secondary)} px-2 py-0.5 rounded border ${withDarkMode(borderColors.default, darkModeBorderColors.default)} font-mono`}>
                      {context.git_info.last_commit}
                    </code>
                  </div>
                  <div className="flex items-center gap-3">
                    <Globe className={`h-3.5 w-3.5 ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}`} />
                    <span className={`text-xs ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`}>{t('components.contextModal.remote')}:</span>
                    <code className={`text-xs ${withDarkMode(bgColors.secondary, darkModeBgColors.secondary)} px-2 py-0.5 rounded border ${withDarkMode(borderColors.default, darkModeBorderColors.default)} font-mono break-all`}>
                      {context.git_info.remote}
                    </code>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileCode className={`h-4 w-4 ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`} />
                  <h3 className={`text-sm font-semibold ${withDarkMode(modalColors.header, darkModeModalColors.header)}`}>{t('components.contextModal.statistics')}</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg p-3">
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">{t('components.contextModal.totalFiles')}</p>
                    <p className="text-2xl font-semibold text-blue-900 dark:text-blue-100 mt-1">{context.stats.total_files}</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 rounded-lg p-3">
                    <p className="text-xs text-green-600 dark:text-green-400 font-medium">{t('components.contextModal.totalDirectories')}</p>
                    <p className="text-2xl font-semibold text-green-900 dark:text-green-100 mt-1">{context.stats.total_dirs}</p>
                  </div>
                </div>

                {/* Languages */}
                {context.stats.languages && Object.keys(context.stats.languages).length > 0 && (
                  <div className={`mt-3 ${withDarkMode(bgColors.tertiary, darkModeBgColors.tertiary)} border ${withDarkMode(borderColors.default, darkModeBorderColors.default)} rounded-lg p-3`}>
                    <p className={`text-xs ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)} font-medium mb-2`}>{t('components.contextModal.languages')}</p>
                    <div className="space-y-1.5">
                      {Object.entries(context.stats.languages)
                        .sort(([, a], [, b]) => b - a)
                        .map(([lang, count]) => (
                          <div key={lang} className="flex items-center justify-between">
                            <span className={`text-xs ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`}>{lang}</span>
                            <span className={`text-xs font-medium ${withDarkMode(modalColors.header, darkModeModalColors.header)}`}>{t('components.contextModal.filesCount', { count })}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-5 py-4 border-t ${withDarkMode(borderColors.default, darkModeBorderColors.default)} flex justify-end`}>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('components.contextModal.close')}
          </Button>
        </div>
      </div>
    </div>
  )
}
