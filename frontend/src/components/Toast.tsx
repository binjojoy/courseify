import React from 'react';

interface ToastProps {
  message: string | null;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  if (!message) return null;

  return (
    <div className="fixed bottom-6 left-6 z-50 flex items-center gap-3 px-4 py-3 bg-bg-elevated text-text-primary rounded-xl shadow-xl border border-border-default animate-fadeIn">
      <span className="material-symbols-outlined text-[18px] text-accent">info</span>
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={onClose}
        className="ml-2 text-text-muted hover:text-text-primary p-0.5"
      >
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>
    </div>
  );
};
