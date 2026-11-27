import React from 'react';
import { CheckCircle2, AlertCircle, Info, WifiOff } from 'lucide-react';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  tone: ToastTone;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const ToastBanner: React.FC<{ toast: ToastMessage | null; onDismiss: () => void }> = ({
  toast,
  onDismiss
}) => {
  if (!toast) return null;

  const toneStyle =
    toast.tone === 'success'
      ? 'border-success/40 text-success'
      : toast.tone === 'error'
      ? 'border-error/40 text-error'
      : 'border-info/40 text-info';

  const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? AlertCircle : Info;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-32px)] max-w-[440px] pointer-events-auto">
      <div
        onClick={onDismiss}
        className={`flex items-center justify-between gap-3 px-4 py-3 rounded-[12px] bg-surface border shadow-card ${toneStyle}`}
        role="status"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon className="w-4 h-4 shrink-0" strokeWidth={1.85} />
          <span className="text-xs font-medium text-textPrimary truncate">{toast.text}</span>
        </div>
        {toast.actionLabel && toast.onAction && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toast.onAction?.();
            }}
            className="text-xs font-semibold text-primary hover:underline shrink-0"
          >
            {toast.actionLabel}
          </button>
        )}
      </div>
    </div>
  );
};

export const OfflineBanner: React.FC = () => (
  <div className="w-full px-4 py-2 bg-warning/15 border-b border-warning/30 flex items-center justify-center gap-2 text-xs font-medium text-warning shrink-0">
    <WifiOff className="w-3.5 h-3.5" strokeWidth={1.8} />
    <span>Offline mode · Editing tetap berjalan di perangkatmu</span>
  </div>
);
