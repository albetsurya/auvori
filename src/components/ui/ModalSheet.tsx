import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalSheetProps {
  isOpen: boolean;
  onClose: () => void;
  variant?: 'sheet' | 'modal';
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}

export const ModalSheet: React.FC<ModalSheetProps> = ({
  isOpen,
  onClose,
  variant = 'sheet',
  title,
  subtitle,
  children,
  maxWidthClass = 'max-w-[480px]'
}) => {
  const dragStartY = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isSheet = variant === 'sheet';

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex justify-center transition-opacity duration-slow ${
        isSheet ? 'items-end sm:items-center sm:p-4' : 'items-center p-4'
      }`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          if (isSheet) dragStartY.current = e.touches[0].clientY;
        }}
        onTouchEnd={(e) => {
          if (isSheet && dragStartY.current !== null) {
            const delta = e.changedTouches[0].clientY - dragStartY.current;
            if (delta > 72) onClose();
            dragStartY.current = null;
          }
        }}
        className={`w-full ${maxWidthClass} bg-surface border border-border shadow-sheet p-6 space-y-5 transition-transform duration-slow ${
          isSheet
            ? 'rounded-t-[24px] rounded-b-none sm:rounded-[24px] pb-[max(1.5rem,env(safe-area-inset-bottom))]'
            : 'rounded-[24px]'
        }`}
      >
        {isSheet && (
          <div className="flex justify-center -mt-2 mb-1 sm:hidden">
            <span className="w-9 h-1 rounded-full bg-border block" />
          </div>
        )}

        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-3">
            <div>
              {title && (
                <h2 className="font-display text-2xl font-semibold text-textPrimary leading-tight">
                  {title}
                </h2>
              )}
              {subtitle && <p className="text-xs text-textSecondary mt-1">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-11 h-11 -mt-2 -mr-2 rounded-[12px] flex items-center justify-center text-textSecondary hover:text-textPrimary hover:bg-surfaceSecondary transition duration-fast"
            >
              <X className="w-5 h-5" strokeWidth={1.8} />
            </button>
          </div>
        )}

        {children}
      </div>
    </div>
  );
};
