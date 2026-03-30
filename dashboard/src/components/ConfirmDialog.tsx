import { Button } from './Button'
import { useTranslation } from 'react-i18next'

interface ConfirmDialogProps {
  open: boolean
  title?: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
  onConfirm,
  onCancel,
  loading
}: ConfirmDialogProps) {
  const { t } = useTranslation()

  // Use provided labels or fall back to translations
  const defaultConfirmLabel = variant === 'danger' ? 'components.confirmDialog.delete' : 'components.confirmDialog.confirm'
  const finalConfirmLabel = confirmLabel || t(defaultConfirmLabel)
  const finalCancelLabel = cancelLabel || t('components.confirmDialog.cancel')
  const finalTitle = title || t('components.confirmDialog.defaultTitle')
  const finalDescription = description || t('components.confirmDialog.defaultMessage')

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative bg-white rounded-lg border border-gray-200 p-6 max-w-sm w-full mx-4 shadow-lg">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">{finalTitle}</h3>
        <p className="text-sm text-gray-500 mb-5">{finalDescription}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>{finalCancelLabel}</Button>
          <Button variant={variant} size="sm" onClick={onConfirm} loading={loading}>
            {finalConfirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
