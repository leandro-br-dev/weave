import { useTranslation } from 'react-i18next'

interface MetricCardProps {
  label?: string
  value: string | number
  trend?: 'up' | 'down' | 'neutral'
  color?: 'default' | 'green' | 'red' | 'amber'
  labelI18nKey?: string // Allow translation key for label
}

export function MetricCard({ label, value, color = 'default', labelI18nKey }: MetricCardProps) {
  const { t } = useTranslation()

  const colors = {
    default: 'text-gray-900 dark:text-gray-100',
    green:   'text-green-600 dark:text-green-400',
    red:     'text-red-600 dark:text-red-400',
    amber:   'text-amber-600 dark:text-amber-400',
  }

  // Use labelI18nKey if provided, otherwise use label directly
  const displayLabel = labelI18nKey ? t(labelI18nKey, { defaultValue: label || '' }) : label

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{displayLabel}</p>
      <p className={`text-2xl font-semibold ${colors[color]}`}>{value}</p>
    </div>
  )
}
