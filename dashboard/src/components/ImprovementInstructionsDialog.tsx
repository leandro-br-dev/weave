import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Wand2, MessageSquare, ArrowRight } from 'lucide-react'
import { Button } from './Button'
import {
  modalColors,
  darkModeModalColors,
  textColors,
  darkModeTextColors,
  withDarkMode,
} from '@/lib/colors'

interface ImprovementInstructionsDialogProps {
  open: boolean
  title?: string
  description?: string
  placeholder?: string
  targetLabel?: string
  /** Called when user clicks "Melhorar" (with or without instructions) */
  onConfirm: (instructions: string) => void
  /** Called when user cancels */
  onCancel: () => void
}

export function ImprovementInstructionsDialog({
  open,
  title,
  description,
  placeholder,
  targetLabel,
  onConfirm,
  onCancel,
}: ImprovementInstructionsDialogProps) {
  const { t } = useTranslation()
  const [instructions, setInstructions] = useState('')

  if (!open) return null

  const finalTitle = title || t('components.improvementInstructions.title')
  const finalDescription = description || t('components.improvementInstructions.description')
  const finalPlaceholder = placeholder || t('components.improvementInstructions.placeholder')

  const handleConfirm = () => {
    onConfirm(instructions.trim())
    setInstructions('')
  }

  const handleCancel = () => {
    setInstructions('')
    onCancel()
  }

  // Allow Ctrl+Enter to submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleConfirm()
    }
    if (e.key === 'Escape') {
      handleCancel()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className={`absolute inset-0 ${withDarkMode(modalColors.overlay, darkModeModalColors.overlay)}`}
        onClick={handleCancel}
      />
      <div
        className={`relative ${withDarkMode(modalColors.panel, darkModeModalColors.panel)} rounded-lg border ${withDarkMode(modalColors.border, darkModeModalColors.border)} p-6 max-w-lg w-full mx-4 shadow-lg`}
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex-shrink-0">
            <Wand2 size={20} className="text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`text-sm font-semibold ${withDarkMode(modalColors.header, darkModeModalColors.header)}`}>
              {finalTitle}
            </h3>
            <p className={`text-xs mt-1 ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}`}>
              {finalDescription}
            </p>
            {targetLabel && (
              <div className="mt-2">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300`}>
                  <MessageSquare size={11} />
                  {targetLabel}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Textarea for instructions */}
        <div className="mb-4">
          <label className={`block text-xs font-medium mb-1.5 ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`}>
            {t('components.improvementInstructions.instructionsLabel')}
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={finalPlaceholder}
            rows={4}
            className={`w-full px-3 py-2 text-sm rounded-lg border ${withDarkMode(
              'border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500',
              'border-gray-600 bg-gray-800 text-gray-100 placeholder-gray-500 focus:border-purple-400 focus:ring-1 focus:ring-purple-400'
            )} resize-none outline-none transition-colors`}
            autoFocus
          />
          <p className={`text-xs mt-1 ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}`}>
            {t('components.improvementInstructions.hint')}
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={handleCancel}>
            {t('components.improvementInstructions.cancel')}
          </Button>
          <Button variant="primary" size="sm" onClick={handleConfirm}>
            <span className="flex items-center gap-1.5">
              <Wand2 size={14} />
              {t('components.improvementInstructions.confirm')}
              <ArrowRight size={14} />
            </span>
          </Button>
        </div>
      </div>
    </div>
  )
}
