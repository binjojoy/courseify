import React, { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  icon?: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel,
  icon = 'warning'
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      previouslyFocusedRef.current?.focus();
      return;
    }
    previouslyFocusedRef.current = document.activeElement as HTMLElement;
    dialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn" role="presentation">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" tabIndex={-1} className="w-full max-w-[440px] bg-bg-elevated rounded-2xl border border-border-default shadow-2xl p-6 sm:p-7 flex flex-col relative animate-scaleUp focus:outline-none">
        <div className="w-11 h-11 rounded-full bg-error-subtle text-error flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-[24px]">{icon}</span>
        </div>
        <h3 id="confirm-dialog-title" className="font-heading text-heading text-text-primary mb-2 text-lg font-bold">
          {title}
        </h3>
        <p className="font-body text-body text-text-secondary mb-6 leading-relaxed text-sm">
          {body}
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 px-4 rounded-lg border border-border-default bg-bg-surface text-text-primary hover:bg-bg-hover transition-colors font-medium text-sm"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-10 px-4 rounded-lg font-medium text-sm text-white transition-colors shadow-sm ${
              isDestructive
                ? 'bg-error hover:bg-error/90 active:bg-error/80'
                : 'bg-accent hover:bg-accent-hover'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
