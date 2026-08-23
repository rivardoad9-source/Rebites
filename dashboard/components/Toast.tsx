'use client';

import { useEffect } from 'react';
import { Undo2, X } from 'lucide-react';

export interface ToastState {
  id: number;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Toast tunggal di atas bottom-nav, cukup sekali sentuh untuk urungkan. */
export default function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastState | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, 7000);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-[72px] z-30 flex justify-center px-4 lg:bottom-6"
    >
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-ink/10 bg-card px-4 py-3 text-sm text-ink shadow-lg">
        <span className="flex-1">{toast.text}</span>
        {toast.actionLabel && toast.onAction ? (
          <button
            type="button"
            onClick={() => {
              toast.onAction?.();
              onDismiss();
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand/10 px-2.5 py-1.5 font-bold text-brand-deep"
          >
            <Undo2 className="h-4 w-4" aria-hidden />
            {toast.actionLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Tutup notifikasi"
          className="shrink-0 rounded-lg p-1 text-ink/40"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
