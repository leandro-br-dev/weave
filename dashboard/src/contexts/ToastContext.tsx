import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { type Toast, type ToastType, ToastContainer } from '@/components/Toast';

interface ToastContextValue {
  showToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
  showAutoMoveToast: (taskTitle: string, fromColumn: string, toColumn: string) => void;
  showError: (title: string, message?: string) => void;
  showSuccess: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, title: string, message?: string, duration?: number) => {
      const id = Math.random().toString(36).substring(7);
      const newToast: Toast = { id, type, title, message, duration };
      setToasts((prev) => [...prev, newToast]);
    },
    []
  );

  const showAutoMoveToast = useCallback(
    (taskTitle: string, fromColumn: string, toColumn: string) => {
      const id = Math.random().toString(36).substring(7);
      const newToast: Toast = {
        id,
        type: 'auto-move',
        title: `Auto-moved: ${taskTitle}`,
        message: `${fromColumn} → ${toColumn}`,
        duration: 5000,
      };
      setToasts((prev) => [...prev, newToast]);
    },
    []
  );

  const showError = useCallback(
    (title: string, message?: string) => {
      showToast('error', title, message);
    },
    [showToast]
  );

  const showSuccess = useCallback(
    (title: string, message?: string) => {
      showToast('success', title, message);
    },
    [showToast]
  );

  return (
    <ToastContext.Provider
      value={{ showToast, showAutoMoveToast, showError, showSuccess }}
    >
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  );
}
