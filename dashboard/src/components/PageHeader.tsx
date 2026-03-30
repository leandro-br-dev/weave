import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface PageHeaderProps {
  title?: string
  description?: string
  actions?: ReactNode
  i18nKey?: string // Allow using a translation key directly
}

export function PageHeader({ title, description, actions, i18nKey }: PageHeaderProps) {
  const { t } = useTranslation()

  // If i18nKey is provided, use it for title and description
  const finalTitle = title || (i18nKey ? t(`${i18nKey}.title`) : '')
  const finalDescription = description || (i18nKey ? t(`${i18nKey}.description`, { defaultValue: '' }) : '')

  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">{finalTitle}</h1>
        {finalDescription && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{finalDescription}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 ml-4">{actions}</div>}
    </div>
  )
}
