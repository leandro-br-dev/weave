import { useState, useEffect, useRef } from 'react'
import { X, Edit3, Trash2, ChevronDown, ChevronRight, Check, FileText, Code, Users, Wand2, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from './Button'
import { cn } from '@/lib/utils'
import {
  modalColors,
  darkModeModalColors,
  bgColors,
  darkModeBgColors,
  borderColors,
  darkModeBorderColors,
  textColors,
  darkModeTextColors,
  interactiveStates,
  darkModeInteractiveStates,
  withDarkMode,
} from '@/lib/colors'

export interface BuilderOperation {
  id: string
  type: 'create_agent' | 'update_agent' | 'delete_agent' | 'create_skill' | 'update_skill' | 'delete_skill' | 'update_claude_md'
  name?: string
  content?: string
  previousContent?: string
  reason: string
}

interface WorkspaceBuilderModalProps {
  isOpen: boolean
  summary: string
  operations: BuilderOperation[]
  onApply: (approvedIds: string[], editedContents: Record<string, string>) => void
  onDiscard: () => void
  isLoading?: boolean
}

const OPERATION_ICONS: Record<string, React.ReactNode> = {
  create_agent: <Users size={14} />,
  update_agent: <Users size={14} />,
  delete_agent: <Users size={14} />,
  create_skill: <Code size={14} />,
  update_skill: <Code size={14} />,
  delete_skill: <Code size={14} />,
  update_claude_md: <FileText size={14} />,
}

export function WorkspaceBuilderModal({
  isOpen,
  summary,
  operations,
  onApply,
  onDiscard,
  isLoading = false,
}: WorkspaceBuilderModalProps) {
  const { t } = useTranslation('agents')

  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set())
  const [expandedOps, setExpandedOps] = useState<Set<string>>(new Set())
  const [editingOpId, setEditingOpId] = useState<string | null>(null)
  const [editContents, setEditContents] = useState<Record<string, string>>({})

  // Reset state when modal opens — use ref to track previous open state
  const prevIsOpenRef = useRef(false)
  useEffect(() => {
    if (prevIsOpenRef.current && !isOpen) {
      // Modal closed — reset internal state
      setApprovedIds(new Set())
      setExpandedOps(new Set())
      setEditingOpId(null)
      setEditContents({})
    }
    if (!prevIsOpenRef.current && isOpen) {
      // Modal opened — initialize approved set from operations
      setApprovedIds(new Set(operations.map(op => op.id)))
    }
    prevIsOpenRef.current = isOpen
  }, [isOpen, operations])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen || isLoading) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDiscard()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isLoading, onDiscard])

  if (!isOpen) return null

  const typeConfig: Record<string, { label: string; color: string; darkColor: string }> = {
    create_agent: { label: t('pages.agents.workspaceBuilder.createAgent'), color: 'bg-green-100 text-green-700', darkColor: 'dark:bg-green-900/50 dark:text-green-300' },
    update_agent: { label: t('pages.agents.workspaceBuilder.updateAgent'), color: 'bg-blue-100 text-blue-700', darkColor: 'dark:bg-blue-900/50 dark:text-blue-300' },
    delete_agent: { label: t('pages.agents.workspaceBuilder.deleteAgent'), color: 'bg-red-100 text-red-700', darkColor: 'dark:bg-red-900/50 dark:text-red-300' },
    create_skill: { label: t('pages.agents.workspaceBuilder.createSkill'), color: 'bg-green-100 text-green-700', darkColor: 'dark:bg-green-900/50 dark:text-green-300' },
    update_skill: { label: t('pages.agents.workspaceBuilder.updateSkill'), color: 'bg-blue-100 text-blue-700', darkColor: 'dark:bg-blue-900/50 dark:text-blue-300' },
    delete_skill: { label: t('pages.agents.workspaceBuilder.deleteSkill'), color: 'bg-red-100 text-red-700', darkColor: 'dark:bg-red-900/50 dark:text-red-300' },
    update_claude_md: { label: t('pages.agents.workspaceBuilder.updateClaudeMd'), color: 'bg-purple-100 text-purple-700', darkColor: 'dark:bg-purple-900/50 dark:text-purple-300' },
  }

  const toggleApproved = (id: string) => {
    setApprovedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleExpanded = (id: string) => {
    setExpandedOps(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAll = () => {
    setApprovedIds(new Set(operations.map(op => op.id)))
  }

  const handleDeselectAll = () => {
    setApprovedIds(new Set())
  }

  const startEditing = (op: BuilderOperation) => {
    setEditingOpId(op.id)
    setEditContents(prev => ({
      ...prev,
      [op.id]: op.content || '',
    }))
  }

  const stopEditing = () => {
    setEditingOpId(null)
  }

  const resetToAi = (op: BuilderOperation) => {
    setEditContents(prev => ({
      ...prev,
      [op.id]: op.content || '',
    }))
  }

  const updateEditContent = (id: string, value: string) => {
    setEditContents(prev => ({
      ...prev,
      [id]: value,
    }))
  }

  const handleApply = () => {
    const approvedArray = Array.from(approvedIds)
    const finalEditedContents: Record<string, string> = {}
    for (const [id, content] of Object.entries(editContents)) {
      if (approvedIds.has(id)) {
        finalEditedContents[id] = content
      }
    }
    onApply(approvedArray, finalEditedContents)
  }

  const allApproved = approvedIds.size === operations.length
  const isUpdateOp = (type: string) => type.startsWith('update_')
  const isCreateOp = (type: string) => type.startsWith('create_')
  const canEdit = (op: BuilderOperation) => isCreateOp(op.type) || isUpdateOp(op.type)

  return (
    <div
      className={`fixed inset-0 ${withDarkMode(modalColors.overlay, darkModeModalColors.overlay)} flex items-center justify-center z-50 p-4 cursor-pointer`}
      onClick={onDiscard}
    >
      <div
        className={`${withDarkMode(modalColors.panel, darkModeModalColors.panel)} rounded-lg shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-start justify-between p-6 border-b ${withDarkMode(borderColors.default, darkModeBorderColors.default)}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/50 flex-shrink-0">
              <Wand2 className="text-orange-600 dark:text-orange-400" size={18} />
            </div>
            <div className="min-w-0">
              <h2 className={`text-xl font-semibold ${withDarkMode(modalColors.header, darkModeModalColors.header)}`}>
                {t('pages.agents.workspaceBuilder.modalTitle')}
              </h2>
              {summary && (
                <p className={`text-sm mt-1 ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)} line-clamp-2`}>
                  {summary}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onDiscard}
            disabled={isLoading}
            className={`${withDarkMode(textColors.muted, darkModeTextColors.muted)} ${withDarkMode('hover:text-gray-600', 'dark:hover:text-gray-300')} ${withDarkMode(interactiveStates.disabled, darkModeInteractiveStates.disabled)} flex-shrink-0`}
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          {operations.length === 0 ? (
            <div className={`text-center py-8 ${textColors.tertiary}`}>
              <p>{t('pages.agents.workspaceBuilder.noOperations')}</p>
            </div>
          ) : (
            <>
              {/* Select All / Deselect All */}
              <div className="flex items-center gap-3 mb-4">
                {allApproved ? (
                  <button
                    onClick={handleDeselectAll}
                    disabled={isLoading}
                    className={`text-sm ${withDarkMode('text-orange-600', 'text-orange-400')} hover:text-orange-700 dark:hover:text-orange-300 disabled:opacity-50`}
                  >
                    {t('pages.agents.workspaceBuilder.deselectAll')}
                  </button>
                ) : (
                  <button
                    onClick={handleSelectAll}
                    disabled={isLoading}
                    className={`text-sm ${withDarkMode('text-orange-600', 'text-orange-400')} hover:text-orange-700 dark:hover:text-orange-300 disabled:opacity-50`}
                  >
                    {t('pages.agents.workspaceBuilder.selectAll')}
                  </button>
                )}
                <span className={`text-sm ${textColors.muted}`}>
                  {approvedIds.size} / {operations.length}
                </span>
              </div>

              {/* Operations list */}
              <div className="space-y-2">
                {operations.map(op => {
                  const config = typeConfig[op.type]
                  const isExpanded = expandedOps.has(op.id)
                  const isChecked = approvedIds.has(op.id)
                  const isEditing = editingOpId === op.id
                  const isDisabled = isLoading

                  return (
                    <div
                      key={op.id}
                      className={cn(
                        `rounded-lg border ${withDarkMode(borderColors.default, darkModeBorderColors.default)}`,
                        withDarkMode(bgColors.secondary, darkModeBgColors.secondary),
                        !isChecked && 'opacity-60'
                      )}
                    >
                      {/* Operation row */}
                      <div className="flex items-start gap-3 p-3">
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleApproved(op.id)}
                          disabled={isDisabled}
                          className="mt-1 rounded border-gray-300 text-orange-600 focus:ring-orange-500 disabled:opacity-50"
                        />

                        {/* Type icon + badge */}
                        <div className="flex-shrink-0 mt-0.5">
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded',
                            config.color, config.darkColor
                          )}>
                            {OPERATION_ICONS[op.type]}
                            {config.label}
                          </span>
                        </div>

                        {/* Name + reason */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${withDarkMode(textColors.primary, darkModeTextColors.primary)}`}>
                            {op.name || '-'}
                          </p>
                          {op.reason && (
                            <p className={`text-xs mt-0.5 ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)} line-clamp-2`}>
                              {op.reason}
                            </p>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {op.content && (
                            <button
                              onClick={() => toggleExpanded(op.id)}
                              disabled={isDisabled}
                              className={`p-1 rounded ${withDarkMode(textColors.muted, darkModeTextColors.muted)} ${withDarkMode('hover:text-gray-600 hover:bg-gray-100', 'dark:hover:text-gray-300 dark:hover:bg-gray-800')} disabled:opacity-50`}
                              title={isExpanded ? t('pages.agents.workspaceBuilder.collapse') : t('pages.agents.workspaceBuilder.expand')}
                            >
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                          )}
                          {canEdit(op) && (
                            <button
                              onClick={() => startEditing(op)}
                              disabled={isDisabled || isEditing}
                              className={`p-1 rounded ${withDarkMode(textColors.muted, darkModeTextColors.muted)} ${withDarkMode('hover:text-gray-600 hover:bg-gray-100', 'dark:hover:text-gray-300 dark:hover:bg-gray-800')} disabled:opacity-50`}
                              title={t('pages.agents.workspaceBuilder.edit')}
                            >
                              <Edit3 size={16} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div className={`border-t ${withDarkMode(borderColors.default, darkModeBorderColors.default)} px-3 pb-3`}>
                          {/* Update operations: show previous content */}
                          {isUpdateOp(op.type) && op.previousContent && (
                            <div className="mt-3">
                              <p className={`text-xs font-medium mb-1 ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}`}>
                                {t('pages.agents.workspaceBuilder.previous')}
                              </p>
                              <textarea
                                value={op.previousContent}
                                readOnly
                                rows={8}
                                className={`w-full px-3 py-2 font-mono text-sm border rounded-lg ${withDarkMode(borderColors.default, darkModeBorderColors.default)} ${withDarkMode(bgColors.tertiary, darkModeBgColors.tertiary)} ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)} resize-none`}
                              />
                            </div>
                          )}

                          {/* Proposed content */}
                          {op.content && (
                            <div className={cn(isUpdateOp(op.type) && op.previousContent && 'mt-3')}>
                              <p className={`text-xs font-medium mb-1 ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}`}>
                                {isUpdateOp(op.type)
                                  ? t('pages.agents.workspaceBuilder.proposed')
                                  : t('pages.agents.workspaceBuilder.content')
                                }
                              </p>
                              <textarea
                                value={isEditing ? (editContents[op.id] ?? '') : op.content}
                                onChange={(e) => updateEditContent(op.id, e.target.value)}
                                readOnly={!isEditing}
                                rows={8}
                                className={cn(
                                  'w-full px-3 py-2 font-mono text-sm border rounded-lg resize-none',
                                  isEditing
                                    ? `${withDarkMode('border-orange-500', 'border-orange-400')} ${withDarkMode(bgColors.secondary, darkModeBgColors.secondary)} ${withDarkMode(textColors.primary, darkModeTextColors.primary)} focus:ring-2 focus:ring-orange-500 focus:border-orange-500`
                                    : `${withDarkMode(borderColors.default, darkModeBorderColors.default)} ${withDarkMode(bgColors.tertiary, darkModeBgColors.tertiary)} ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`
                                )}
                              />
                              {isEditing && (
                                <div className="flex gap-2 mt-2">
                                  <Button
                                    onClick={() => resetToAi(op)}
                                    variant="secondary"
                                    size="sm"
                                    disabled={isDisabled}
                                  >
                                    {t('pages.agents.workspaceBuilder.resetToAi')}
                                  </Button>
                                  <Button
                                    onClick={stopEditing}
                                    variant="secondary"
                                    size="sm"
                                    disabled={isDisabled}
                                  >
                                    <Check size={14} className="mr-1" />
                                    {t('pages.agents.workspaceBuilder.doneEditing')}
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-end gap-3 p-6 border-t ${withDarkMode(bgColors.tertiary, darkModeBgColors.tertiary)}`}>
          {isLoading && (
            <div className={`flex items-center gap-2 text-sm ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`}>
              <Loader2 size={14} className="animate-spin" />
              <span>{t('pages.agents.workspaceBuilder.applying')}</span>
            </div>
          )}
          <Button
            onClick={onDiscard}
            variant="secondary"
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Trash2 size={16} />
            {t('pages.agents.workspaceBuilder.discard')}
          </Button>
          <Button
            onClick={handleApply}
            variant="primary"
            disabled={isLoading || approvedIds.size === 0}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Check size={16} />
            )}
            {approvedIds.size > 0
              ? t('pages.agents.workspaceBuilder.apply', { count: approvedIds.size })
              : t('pages.agents.workspaceBuilder.applyZero')
            }
          </Button>
        </div>
      </div>
    </div>
  )
}
