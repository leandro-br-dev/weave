import type { SelectHTMLAttributes } from 'react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import {
  bgColors,
  darkModeBgColors,
  borderColors,
  darkModeBorderColors,
  textColors,
  darkModeTextColors,
  interactiveStates,
  darkModeErrorColors,
  errorColors,
  withDarkMode,
} from '@/lib/colors'

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  id?: string
  label?: string
  error?: string
  errorI18nKey?: string // Allow translation key for error messages
  placeholderI18nKey?: string // Allow translation key for placeholder
}

export function Select({ label, error, errorI18nKey, placeholderI18nKey, className = '', id, ...props }: SelectProps) {
  const generatedId = useId()
  const selectId = id || generatedId
  const { t } = useTranslation()

  // Use errorI18nKey if provided, otherwise use error directly
  const displayError = errorI18nKey ? t(errorI18nKey, { defaultValue: error || '' }) : error

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={selectId} className={`block text-xs font-medium ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`}>
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`
          w-full border ${withDarkMode(borderColors.default, darkModeBorderColors.thick)} rounded-md px-3 py-2 text-sm
          ${withDarkMode(bgColors.secondary, darkModeBgColors.tertiary)} ${withDarkMode(textColors.primary, darkModeTextColors.primary)}
          focus:outline-none focus:ring-2 ${interactiveStates.focusRing} focus:border-transparent
          ${withDarkMode('disabled:bg-gray-50', 'dark:disabled:bg-gray-900')} ${withDarkMode('disabled:text-gray-400', 'dark:disabled:text-gray-500')}
          ${error ? `${borderColors.thick} ${darkModeErrorColors.border}` : ''} ${className}
        `}
        {...props}
      />
      {displayError && <p className={`text-xs ${withDarkMode(errorColors.text, darkModeErrorColors.text)}`}>{displayError}</p>}
    </div>
  )
}
