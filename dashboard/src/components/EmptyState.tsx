import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface EmptyStateProps {
  icon?: ReactNode
  title?: string
  description?: string
  action?: ReactNode
  i18nKey?: string // Allow using a translation key directly
}

export function EmptyState({ icon, title, description, action, i18nKey }: EmptyStateProps) {
  const { t } = useTranslation()

  // If i18nKey is provided, use it for title and description
  const finalTitle = title || (i18nKey ? t(`${i18nKey}.title`) : '')
  const finalDescription = description || (i18nKey ? t(`${i18nKey}.description`, { defaultValue: '' }) : '')

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="text-gray-300 mb-4">{icon}</div>}
      <p className="text-sm font-medium text-gray-600">{finalTitle}</p>
      {finalDescription && <p className="text-xs text-gray-400 mt-1 max-w-xs">{finalDescription}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
