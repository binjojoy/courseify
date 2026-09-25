import React, { useEffect, useState } from 'react';

interface ToastProps {
  message: string | null;
  onClose: () => void;
  undoAction?: {
    label: string;
    onUndo: () => void;
    durationMs?: number;
  } | null;
}

export const Toast: React.FC<ToastProps> = ({ message, onClose, undoAction }) => {
  const [secondsRemaining, setSecondsRemaining] = useState(5);

  useEffect(() => {
    if (!message) return;
    if (undoAction) {
      setSecondsRemaining(Math.ceil((undoAction.durationMs || 5000) / 1000));
      const interval = setInterval(() => {
        setSecondsRemaining((prev) => (prev > 1 ? prev - 1 : 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [message, undoAction]);

  if (!message) return null;

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-50 flex items-center gap-3 px-4 py-3 bg-bg-elevated text-text-primary rounded-xl shadow-2xl border border-border-default animate-fadeIn max-w-[90vw]">
      <span className="material-symbols-outlined text-[20px] text-accent shrink-0">info</span>
      <span className="text-sm font-medium">{message}</span>

      {undoAction && (
        <button
          type="button"
          onClick={() => {
            undoAction.onUndo();
            onClose();
          }}
          className="ml-2 px-2.5 py-1 rounded bg-accent text-white font-medium text-xs hover:bg-accent-hover transition-colors shrink-0 flex items-center gap-1 shadow-xs"
        >
          <span className="material-symbols-outlined text-[14px]">undo</span>
          <span>{undoAction.label} ({secondsRemaining}s)</span>
        </button>
      )}

      <button
        onClick={onClose}
        aria-label="Dismiss notification"
        className="ml-1 text-text-muted hover:text-text-primary p-1 rounded-lg hover:bg-bg-hover transition-colors"
      >
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>
    </div>
  );
};
