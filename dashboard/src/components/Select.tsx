import type { SelectHTMLAttributes } from 'react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

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
        <label htmlFor={selectId} className="block text-xs font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`
          w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm
          bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
          focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 focus:border-transparent
          disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-400 dark:disabled:text-gray-500
          ${error ? 'border-red-400 dark:border-red-500' : ''} ${className}
        `}
        {...props}
      />
      {displayError && <p className="text-xs text-red-600 dark:text-red-400">{displayError}</p>}
    </div>
  )
}
