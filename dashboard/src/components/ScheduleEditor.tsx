import { useTranslation } from 'react-i18next'
import {
  borderColors, darkModeBorderColors,
  bgColors, darkModeBgColors,
  textColors, darkModeTextColors,
  withDarkMode,
} from '@/lib/colors'

export type RecurrenceValue = '' | 'hourly' | 'daily' | 'weekly_monday' | 'weekly_friday' | 'monthly'

const SCHEDULE_OPTIONS: { value: RecurrenceValue; labelKey: string }[] = [
  { value: 'hourly', labelKey: 'hourly' },
  { value: 'daily', labelKey: 'daily' },
  { value: 'weekly_monday', labelKey: 'weekly_monday' },
  { value: 'weekly_friday', labelKey: 'weekly_friday' },
  { value: 'monthly', labelKey: 'monthly' },
]

interface ScheduleEditorProps {
  /** Current recurrence value */
  recurrence: RecurrenceValue
  /** Current schedule time in HH:MM format */
  scheduleTime: string
  /** Called when recurrence or time changes */
  onChange: (recurrence: RecurrenceValue, scheduleTime: string) => void
  /** Whether to use dark-mode styled inputs */
  styled?: boolean
  /** CSS class for the container */
  className?: string
  /** Label text override (defaults to i18n key) */
  label?: string
}

export function ScheduleEditor({
  recurrence,
  scheduleTime,
  onChange,
  styled = true,
  className = '',
  label,
}: ScheduleEditorProps) {
  const { t } = useTranslation()

  const handleRecurrenceChange = (value: string) => {
    const rec = value as RecurrenceValue
    // Reset time to default when switching to a different preset
    let newTime = scheduleTime
    if (rec === 'hourly' || rec === '') {
      newTime = ''
    } else if (!scheduleTime) {
      newTime = '09:00'
    }
    onChange(rec, newTime)
  }

  if (styled) {
    return (
      <div className={className}>
        {label !== undefined && (
          <label className={`block text-xs font-medium ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)} mb-1`}>
            {label}
          </label>
        )}
        <div className="flex gap-2">
          <select
            value={recurrence}
            onChange={e => handleRecurrenceChange(e.target.value)}
            className={`flex-1 px-3 py-2 border ${withDarkMode(borderColors.default, darkModeBorderColors.default)} rounded-md text-sm ${withDarkMode(bgColors.primary, darkModeBgColors.primary)} ${withDarkMode(textColors.primary, darkModeTextColors.primary)}`}
          >
            <option value="">{t('workflowTemplates.schedule.manual')}</option>
            {SCHEDULE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {t(`workflowTemplates.schedule.presets.${opt.labelKey}`)}
              </option>
            ))}
          </select>
          {recurrence && recurrence !== 'hourly' && (
            <input
              type="time"
              value={scheduleTime || '09:00'}
              onChange={e => onChange(recurrence, e.target.value)}
              className={`px-3 py-2 border ${withDarkMode(borderColors.default, darkModeBorderColors.default)} rounded-md text-sm ${withDarkMode(bgColors.primary, darkModeBgColors.primary)} ${withDarkMode(textColors.primary, darkModeTextColors.primary)}`}
              title={t('workflowTemplates.schedule.time')}
            />
          )}
        </div>
      </div>
    )
  }

  // Unstyled version for PlanDetail save modal (uses Tailwind directly)
  return (
    <div className={className}>
      {label !== undefined && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
          {label}
        </label>
      )}
      <div className="flex gap-2">
        <select
          value={recurrence}
          onChange={e => handleRecurrenceChange(e.target.value)}
          className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="">{t('workflowTemplates.schedule.manual')}</option>
          {SCHEDULE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {t(`workflowTemplates.schedule.presets.${opt.labelKey}`)}
            </option>
          ))}
        </select>
        {recurrence && recurrence !== 'hourly' && (
          <input
            type="time"
            value={scheduleTime || '09:00'}
            onChange={e => onChange(recurrence, e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            title={t('workflowTemplates.schedule.time')}
          />
        )}
      </div>
    </div>
  )
}
