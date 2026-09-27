import React from 'react';

import { useFocusTrap } from '../hooks/useFocusTrap';

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
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn"
      role="presentation"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-body"
        tabIndex={-1}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            onCancel();
          }
        }}
        className="w-full max-w-[440px] bg-bg-elevated rounded-2xl border border-border-default shadow-2xl p-6 sm:p-7 flex flex-col relative animate-scaleUp focus:outline-none"
      >
        <div className={`w-11 h-11 rounded-full flex items-center justify-center mb-4 ${isDestructive ? 'bg-error-subtle text-error' : 'bg-accent-subtle text-accent'}`}>
          <span className="material-symbols-outlined text-[24px]">{icon}</span>
        </div>
        <h3 id="confirm-dialog-title" className="font-heading text-heading text-text-primary mb-2 text-lg font-bold">
          {title}
        </h3>
        <p id="confirm-dialog-body" className="font-body text-body text-text-secondary mb-6 leading-relaxed text-sm">
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
