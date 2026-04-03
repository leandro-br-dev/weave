import { useTranslation } from 'react-i18next'
import {
  statusColors,
  darkModeStatusColors,
  withDarkMode,
} from '@/lib/colors'

const config: Record<string, { bg: string; text: string; dot: string; darkBg: string; darkText: string; labelI18nKey: string }> = {
  pending:           { bg: statusColors.pending.bg,       text: statusColors.pending.text,       dot: statusColors.pending.solid,       darkBg: darkModeStatusColors.pending.bg,       darkText: darkModeStatusColors.pending.text,       labelI18nKey: 'components.status.pending' },
  running:           { bg: statusColors.running.bg,       text: statusColors.running.text,       dot: statusColors.running.solid,       darkBg: darkModeStatusColors.running.bg,       darkText: darkModeStatusColors.running.text,       labelI18nKey: 'components.status.running' },
  success:           { bg: statusColors.success.bg,       text: statusColors.success.text,       dot: statusColors.success.solid,       darkBg: darkModeStatusColors.success.bg,       darkText: darkModeStatusColors.success.text,       labelI18nKey: 'components.status.success' },
  failed:            { bg: statusColors.failed.bg,        text: statusColors.failed.text,        dot: statusColors.failed.solid,        darkBg: darkModeStatusColors.failed.bg,        darkText: darkModeStatusColors.failed.text,        labelI18nKey: 'components.status.failed' },
  timeout:           { bg: statusColors.timeout.bg,       text: statusColors.timeout.text,       dot: statusColors.timeout.solid,       darkBg: darkModeStatusColors.timeout.bg,       darkText: darkModeStatusColors.timeout.text,       labelI18nKey: 'components.status.timeout' },
  approved:          { bg: statusColors.approved.bg,      text: statusColors.approved.text,      dot: statusColors.approved.solid,      darkBg: darkModeStatusColors.approved.bg,      darkText: darkModeStatusColors.approved.text,      labelI18nKey: 'components.status.approved' },
  denied:            { bg: statusColors.denied.bg,        text: statusColors.denied.text,        dot: statusColors.denied.solid,        darkBg: darkModeStatusColors.denied.bg,        darkText: darkModeStatusColors.denied.text,        labelI18nKey: 'components.status.denied' },
  awaiting_approval: { bg: statusColors.timeout.bg,       text: statusColors.timeout.text,       dot: statusColors.timeout.solid,       darkBg: darkModeStatusColors.timeout.bg,       darkText: darkModeStatusColors.timeout.text,       labelI18nKey: 'components.status.awaitingApproval' },
}

const defaultConfig = {
  bg: statusColors.unknown.bg,
  text: statusColors.unknown.text,
  dot: statusColors.unknown.solid,
  darkBg: darkModeStatusColors.unknown.bg,
  darkText: darkModeStatusColors.unknown.text,
}

interface StatusBadgeProps {
  status: string
  animate?: boolean  // pulsa quando running
}

export function StatusBadge({ status, animate }: StatusBadgeProps) {
  const { t } = useTranslation()

  const c = config[status] ?? {
    ...defaultConfig,
    labelI18nKey: status
  }

  const label = t(c.labelI18nKey, { defaultValue: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ') })

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${withDarkMode(c.bg, c.darkBg)} ${withDarkMode(c.text, c.darkText)}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot} ${animate && status === 'running' ? 'animate-pulse' : ''}`} />
      {label}
    </span>
  )
}
