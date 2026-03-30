import type { InputHTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'

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
      {label && <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">{label}</label>}
      <input
        className={`
          w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm
          bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
          focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 focus:border-transparent
          disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-400 dark:disabled:text-gray-500
          read-only:bg-gray-50 dark:read-only:bg-gray-900 read-only:text-gray-500 dark:read-only:text-gray-400
          placeholder:text-gray-400 dark:placeholder:text-gray-500
          ${error ? 'border-red-400 dark:border-red-500' : ''} ${className}
        `}
        {...props}
      />
      {hint && !displayError && <p className="text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
      {displayError && <p className="text-xs text-red-600 dark:text-red-400">{displayError}</p>}
    </div>
  )
}
