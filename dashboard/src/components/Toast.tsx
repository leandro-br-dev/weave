import { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  successColors,
  errorColors,
  infoColors,
  warningColors,
  darkModeSuccessColors,
  darkModeErrorColors,
  darkModeInfoColors,
  darkModeWarningColors,
  textColors,
  darkModeTextColors,
  withDarkMode,
} from '@/lib/colors';

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
  success: <CheckCircle className="h-4 w-4" />,
  error: <AlertCircle className="h-4 w-4" />,
  info: <Info className="h-4 w-4" />,
  'auto-move': <Zap className="h-4 w-4" />,
};

const TOAST_ICON_COLORS = {
  success: withDarkMode(successColors.text, darkModeSuccessColors.text),
  error: withDarkMode(errorColors.text, darkModeErrorColors.text),
  info: withDarkMode(infoColors.text, darkModeInfoColors.text),
  'auto-move': withDarkMode(warningColors.text, darkModeWarningColors.text),
};

const TOAST_STYLES: Record<ToastType, string> = {
  success: `${withDarkMode(successColors.bg, darkModeSuccessColors.bg)} ${withDarkMode(successColors.border, darkModeSuccessColors.border)}`,
  error: `${withDarkMode(errorColors.bg, darkModeErrorColors.bg)} ${withDarkMode(errorColors.borderStrong, darkModeErrorColors.borderStrong)}`,
  info: `${withDarkMode(infoColors.bg, darkModeInfoColors.bg)} ${withDarkMode(infoColors.border, darkModeInfoColors.border)}`,
  'auto-move': `${withDarkMode(warningColors.bg, darkModeWarningColors.bg)} ${withDarkMode(warningColors.border, darkModeWarningColors.border)}`,
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
      <div className={`flex-shrink-0 mt-0.5 ${TOAST_ICON_COLORS[toast.type]}`}>
        {TOAST_ICONS[toast.type]}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${withDarkMode(textColors.primary, darkModeTextColors.primary)}`}>{displayTitle}</p>
        {displayMessage && (
          <p className={`text-xs ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)} mt-0.5`}>{displayMessage}</p>
        )}
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className={`flex-shrink-0 ${withDarkMode(textColors.muted, darkModeTextColors.muted)} ${withDarkMode('hover:text-gray-600', 'dark:hover:text-gray-300')} transition-colors`}
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
