import { useTranslation } from 'react-i18next'

const config: Record<string, { bg: string; text: string; dot: string; labelI18nKey: string }> = {
  pending:           { bg: 'bg-gray-100',   text: 'text-gray-600',  dot: 'bg-gray-400',  labelI18nKey: 'components.status.pending' },
  running:           { bg: 'bg-blue-50',    text: 'text-blue-700',  dot: 'bg-blue-500',  labelI18nKey: 'components.status.running' },
  success:           { bg: 'bg-green-50',   text: 'text-green-700', dot: 'bg-green-500', labelI18nKey: 'components.status.success' },
  failed:            { bg: 'bg-red-50',     text: 'text-red-700',   dot: 'bg-red-500',   labelI18nKey: 'components.status.failed' },
  timeout:           { bg: 'bg-amber-50',   text: 'text-amber-700', dot: 'bg-amber-500', labelI18nKey: 'components.status.timeout' },
  approved:          { bg: 'bg-green-50',   text: 'text-green-700', dot: 'bg-green-500', labelI18nKey: 'components.status.approved' },
  denied:            { bg: 'bg-red-50',     text: 'text-red-700',   dot: 'bg-red-500',   labelI18nKey: 'components.status.denied' },
  awaiting_approval: { bg: 'bg-amber-50',   text: 'text-amber-700', dot: 'bg-amber-500', labelI18nKey: 'components.status.awaitingApproval' },
}

interface StatusBadgeProps {
  status: string
  animate?: boolean  // pulsa quando running
}

export function StatusBadge({ status, animate }: StatusBadgeProps) {
  const { t } = useTranslation()

  const c = config[status] ?? {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    dot: 'bg-gray-400',
    labelI18nKey: status
  }

  const label = t(c.labelI18nKey, { defaultValue: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ') })

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot} ${animate && status === 'running' ? 'animate-pulse' : ''}`} />
      {label}
    </span>
  )
}
