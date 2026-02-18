'use client';

import { useState, useCallback, useEffect } from 'react';
import { TOAST_DISPLAY_MS, TOAST_EXIT_MS } from '@/lib/hookUtils';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastState {
  message: string;
  kind: ToastKind;
  dismissing?: boolean;
}

export interface UseToastReturn {
  toast: ToastState | null;
  showToast: (message: string, kind?: ToastKind) => void;
}

export function useToast(): UseToastReturn {
  const [toast, setToast] = useState<ToastState | null>(null);

  // Start exit animation after display duration
  useEffect(() => {
    if (!toast || toast.dismissing) return;
    const timeout = setTimeout(() => {
      setToast(prev => prev ? { ...prev, dismissing: true } : null);
    }, TOAST_DISPLAY_MS);
    return () => clearTimeout(timeout);
  }, [toast]);

  // Remove from DOM after exit animation completes
  useEffect(() => {
    if (!toast?.dismissing) return;
    const timeout = setTimeout(() => setToast(null), TOAST_EXIT_MS);
    return () => clearTimeout(timeout);
  }, [toast?.dismissing]);

  const showToast = useCallback((message: string, kind: ToastKind = 'info') => {
    setToast({ message, kind });
  }, []);

  return { toast, showToast };
}
