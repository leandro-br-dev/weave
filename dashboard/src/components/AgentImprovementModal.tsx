import { useState, useEffect, useRef } from 'react'
import { X, Wand2, Check, Trash2, Edit3, Users } from 'lucide-react'
import { Button } from './Button'
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

interface AgentImprovementModalProps {
  isOpen: boolean
  agentName: string
  improvedContent: string
  onApprove: (content: string) => void
  onDiscard: () => void
  isLoading?: boolean
}

export function AgentImprovementModal({
  isOpen,
  agentName,
  improvedContent,
  onApprove,
  onDiscard,
  isLoading = false,
}: AgentImprovementModalProps) {
  const [editedContent, setEditedContent] = useState(improvedContent)
  const [isEditing, setIsEditing] = useState(false)
  const prevIsOpenRef = useRef(isOpen)

  // Reset internal state when the modal closes to prevent stale content
  // from appearing when it reopens for a different agent
  useEffect(() => {
    if (prevIsOpenRef.current && !isOpen) {
      setEditedContent('')
      setIsEditing(false)
    }
    prevIsOpenRef.current = isOpen
  }, [isOpen])

  // Sync editedContent when improvedContent changes (can arrive after mount)
  useEffect(() => {
    if (improvedContent && improvedContent !== editedContent) {
      setEditedContent(improvedContent)
    }
  }, [improvedContent]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleApprove = () => {
    onApprove(editedContent)
  }

  const handleReset = () => {
    setEditedContent(improvedContent)
    setIsEditing(false)
  }

  return (
    <div
      className={`fixed inset-0 ${withDarkMode(modalColors.overlay, darkModeModalColors.overlay)} flex items-center justify-center z-50 p-4 cursor-pointer`}
      onClick={onDiscard}
    >
      <div
        className={`${withDarkMode(modalColors.panel, darkModeModalColors.panel)} rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${withDarkMode(borderColors.default, darkModeBorderColors.default)}`}>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900">
              <Users className="text-purple-600 dark:text-purple-400" size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Wand2 className="text-orange-600 dark:text-orange-400" size={18} />
                <h2 className={`text-xl font-semibold ${withDarkMode(modalColors.header, darkModeModalColors.header)}`}>AI-Improved Agent</h2>
              </div>
              <p className={`text-xs ${withDarkMode(textColors.muted, darkModeTextColors.muted)} mt-0.5`}>{agentName}</p>
            </div>
          </div>
          <button
            onClick={onDiscard}
            disabled={isLoading}
            className={`${withDarkMode(textColors.muted, darkModeTextColors.muted)} ${withDarkMode('hover:text-gray-600', 'dark:hover:text-gray-300')} ${withDarkMode(interactiveStates.disabled, darkModeInteractiveStates.disabled)}`}
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-medium ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`}>Preview</h3>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  disabled={isLoading}
                  className={`text-sm text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 flex items-center gap-1 ${withDarkMode(interactiveStates.disabled, darkModeInteractiveStates.disabled)}`}
                >
                  <Edit3 size={14} />
                  Edit
                </button>
              )}
            </div>

            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              disabled={!isEditing || isLoading}
              className={`w-full h-96 px-4 py-3 font-mono text-sm border rounded-lg focus:ring-2 ${withDarkMode(interactiveStates.focusRing, darkModeInteractiveStates.focusRing)} ${
                isEditing
                  ? `${withDarkMode(borderColors.thick, darkModeBorderColors.thick)} ${withDarkMode(bgColors.secondary, darkModeBgColors.secondary)}`
                  : `${withDarkMode(borderColors.default, darkModeBorderColors.default)} ${withDarkMode(bgColors.tertiary, darkModeBgColors.tertiary)} ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`
              }`}
            />

            {isEditing && (
              <div className="flex gap-2">
                <Button
                  onClick={handleReset}
                  variant="secondary"
                  size="sm"
                  disabled={isLoading}
                >
                  Reset to AI Version
                </Button>
                <Button
                  onClick={() => setIsEditing(false)}
                  variant="secondary"
                  size="sm"
                  disabled={isLoading}
                >
                  Done Editing
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-end gap-3 p-6 border-t ${withDarkMode(bgColors.tertiary, darkModeBgColors.tertiary)}`}>
          <Button
            onClick={onDiscard}
            variant="secondary"
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Trash2 size={16} />
            Discard
          </Button>
          <Button
            onClick={handleApprove}
            variant="primary"
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Check size={16} />
            Approve & Save
          </Button>
        </div>
      </div>
    </div>
  )
}
