import { useTranslation } from 'react-i18next'
import {
  bgColors,
  darkModeBgColors,
  borderColors,
  darkModeBorderColors,
  textColors,
  darkModeTextColors,
  metricColors,
  darkModeMetricColors,
  withDarkMode,
} from '@/lib/colors'

interface MetricCardProps {
  label?: string
  value: string | number
  trend?: 'up' | 'down' | 'neutral'
  color?: 'default' | 'green' | 'red' | 'amber'
  labelI18nKey?: string // Allow translation key for label
}

export function MetricCard({ label, value, color = 'default', labelI18nKey }: MetricCardProps) {
  const { t } = useTranslation()

  const colorClasses = {
    default: withDarkMode(metricColors.default.text, darkModeMetricColors.default.text),
    green:   withDarkMode(metricColors.green.text, darkModeMetricColors.green.text),
    red:     withDarkMode(metricColors.red.text, darkModeMetricColors.red.text),
    amber:   withDarkMode(metricColors.amber.text, darkModeMetricColors.amber.text),
  }

  // Use labelI18nKey if provided, otherwise use label directly
  const displayLabel = labelI18nKey ? t(labelI18nKey, { defaultValue: label || '' }) : label

  return (
    <div className={`${withDarkMode(bgColors.secondary, darkModeBgColors.secondary)} border ${withDarkMode(borderColors.default, darkModeBorderColors.default)} rounded-lg p-5`}>
      <p className={`text-xs font-medium ${withDarkMode(textColors.muted, darkModeTextColors.muted)} uppercase tracking-wide mb-2`}>{displayLabel}</p>
      <p className={`text-2xl font-semibold ${colorClasses[color]}`}>{value}</p>
    </div>
  )
}
