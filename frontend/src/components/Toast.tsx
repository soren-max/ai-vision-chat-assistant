/**
 * Toast — 轻量通知系统
 *
 * 用法:
 *   import { toast } from './Toast';
 *   toast.success('Camera started');
 *   toast.error('Connection failed');
 *   toast.info('Processing...');
 */

let toastId = 0;

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

// Global state (simple event emitter)
let listeners: Array<(items: ToastItem[]) => void> = [];
let items: ToastItem[] = [];

function emit() {
  listeners.forEach(fn => fn([...items]));
}

function addToast(type: ToastType, message: string, durationMs = 3000) {
  const id = ++toastId;
  items = [...items, { id, type, message }];
  emit();
  setTimeout(() => {
    items = items.filter(t => t.id !== id);
    emit();
  }, durationMs);
}

export const toast = {
  success: (msg: string) => addToast('success', msg),
  error: (msg: string) => addToast('error', msg, 5000),
  info: (msg: string) => addToast('info', msg),
  warning: (msg: string) => addToast('warning', msg, 4000),
};

// ============================================================
// Component
// ============================================================

import { useEffect, useState } from 'react';

const TOAST_STYLES: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: 'bg-accent/10', border: 'border-accent/30', icon: '✓' },
  error:   { bg: 'bg-danger/10', border: 'border-danger/30',  icon: '✕' },
  info:    { bg: 'bg-primary/10', border: 'border-primary/30', icon: 'ℹ' },
  warning: { bg: 'bg-warning/10', border: 'border-warning/30', icon: '⚠' },
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.push(setToasts);
    return () => { listeners = listeners.filter(fn => fn !== setToasts); };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-6 z-50 flex flex-col gap-2">
      {toasts.map(t => {
        const style = TOAST_STYLES[t.type];
        return (
          <div
            key={t.id}
            className={`px-4 py-2.5 rounded-md border text-sm font-mono
                       animate-slide-up shadow-panel backdrop-blur-sm
                       ${style.bg} ${style.border} text-white`}
          >
            <span className="mr-2">{style.icon}</span>
            {t.message}
          </div>
        );
      })}
    </div>
  );
}
