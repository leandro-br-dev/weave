import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  textColors,
  darkModeTextColors,
  withDarkMode,
} from '@/lib/colors'

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
        <h1 className={`text-2xl font-semibold ${withDarkMode(textColors.primary, darkModeTextColors.primary)} tracking-tight`}>{finalTitle}</h1>
        {finalDescription && (
          <p className={`mt-1 text-sm ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}`}>{finalDescription}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 ml-4">{actions}</div>}
    </div>
  )
}
