import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function Card({ children, className = '', padding = 'md' }: CardProps) {
  const paddings = { none: '', sm: 'p-3', md: 'p-5', lg: 'p-6' }
  return (
    <div className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg ${paddings[padding]} ${className}`}>
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title?: string
  description?: string
  actions?: ReactNode
  i18nKey?: string // Allow using a translation key directly
}

export function CardHeader({ title, description, actions, i18nKey }: CardHeaderProps) {
  const { t } = useTranslation()

  // If i18nKey is provided, use it for title and description
  const finalTitle = title || (i18nKey ? t(`${i18nKey}.title`) : '')
  const finalDescription = description || (i18nKey ? t(`${i18nKey}.description`, { defaultValue: '' }) : '')

  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{finalTitle}</h3>
        {finalDescription && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{finalDescription}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  )
}
