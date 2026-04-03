import type { InputHTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import {
  bgColors,
  darkModeBgColors,
  borderColors,
  darkModeBorderColors,
  textColors,
  darkModeTextColors,
  interactiveStates,
  errorColors,
  darkModeErrorColors,
  withDarkMode,
} from '@/lib/colors'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  errorI18nKey?: string // Allow translation key for error messages
}

export function Input({ label, error, hint, errorI18nKey, className = '', ...props }: InputProps) {
  const { t } = useTranslation()

  // Use errorI18nKey if provided, otherwise use error directly
  const displayError = errorI18nKey ? t(errorI18nKey, { defaultValue: error || '' }) : error

  return (
    <div className="space-y-1">
      {label && <label className={`block text-xs font-medium ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`}>{label}</label>}
      <input
        className={`
          w-full border ${withDarkMode(borderColors.default, darkModeBorderColors.thick)} rounded-md px-3 py-2 text-sm
          ${withDarkMode(bgColors.secondary, darkModeBgColors.tertiary)} ${withDarkMode(textColors.primary, darkModeTextColors.primary)}
          focus:outline-none focus:ring-2 ${interactiveStates.focusRing} focus:border-transparent
          ${withDarkMode('disabled:bg-gray-50', 'dark:disabled:bg-gray-900')} ${withDarkMode('disabled:text-gray-400', 'dark:disabled:text-gray-500')}
          ${withDarkMode('read-only:bg-gray-50', 'dark:read-only:bg-gray-900')} ${withDarkMode('read-only:text-gray-500', 'dark:read-only:text-gray-400')}
          ${withDarkMode('placeholder:text-gray-400', 'dark:placeholder:text-gray-500')}
          ${error ? `${borderColors.thick} ${darkModeErrorColors.border}` : ''} ${className}
        `}
        {...props}
      />
      {hint && !displayError && <p className={`text-xs ${withDarkMode(textColors.muted, darkModeTextColors.muted)}`}>{hint}</p>}
      {displayError && <p className={`text-xs ${withDarkMode(errorColors.text, darkModeErrorColors.text)}`}>{displayError}</p>}
    </div>
  )
}
