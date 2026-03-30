import { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type ToastType = 'success' | 'error' | 'info' | 'auto-move';

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  titleI18nKey?: string;
  message?: string;
  messageI18nKey?: string;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

const TOAST_ICONS = {
  success: <CheckCircle className="h-4 w-4 text-green-600" />,
  error: <AlertCircle className="h-4 w-4 text-red-600" />,
  info: <Info className="h-4 w-4 text-blue-600" />,
  'auto-move': <Zap className="h-4 w-4 text-yellow-600" />,
};

const TOAST_STYLES = {
  success: 'border-green-200 bg-green-50',
  error: 'border-red-200 bg-red-50',
  info: 'border-blue-200 bg-blue-50',
  'auto-move': 'border-yellow-200 bg-yellow-50',
};

export function ToastItem({ toast, onClose }: ToastProps) {
  const { t } = useTranslation();

  useEffect(() => {
    const duration = toast.duration ?? 4000;
    const timer = setTimeout(() => onClose(toast.id), duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onClose]);

  // Use i18n keys if provided, otherwise use direct values
  const displayTitle = toast.titleI18nKey ? t(toast.titleI18nKey, { defaultValue: toast.title || '' }) : toast.title;
  const displayMessage = toast.messageI18nKey ? t(toast.messageI18nKey || '', { defaultValue: toast.message || '' }) : toast.message;

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border shadow-sm transition-all animate-in slide-in-from-right ${TOAST_STYLES[toast.type]}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex-shrink-0 mt-0.5">
        {TOAST_ICONS[toast.type]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{displayTitle}</p>
        {displayMessage && (
          <p className="text-xs text-gray-600 mt-0.5">{displayMessage}</p>
        )}
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label={t('components.toast.close', { defaultValue: 'Close notification' })}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-md w-full">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
}
