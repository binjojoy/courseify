import React, { useEffect, useState } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface NamePromptModalProps {
  isOpen: boolean;
  initialName?: string;
  onSave: (name: string) => void;
  onSkip?: () => void;
}

export const NamePromptModal: React.FC<NamePromptModalProps> = ({
  isOpen,
  initialName = '',
  onSave,
  onSkip
}) => {
  const [name, setName] = useState(initialName);
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);

  // Reopen on the current saved name rather than whatever was last typed.
  useEffect(() => {
    if (isOpen) setName(initialName);
  }, [isOpen, initialName]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onSkip?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onSkip]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim());
    } else if (onSkip) {
      onSkip();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim/80 backdrop-blur-xs animate-fadeIn"
      onMouseDown={event => { if (event.target === event.currentTarget) onSkip?.(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-prompt-title"
        aria-describedby="name-prompt-description"
        tabIndex={-1}
        className="w-full max-w-[400px] bg-bg-elevated rounded-2xl border border-border-default shadow-2xl p-6 flex flex-col focus:outline-none"
      >
        <h3 id="name-prompt-title" className="font-heading text-heading text-text-primary mb-1">
          What should we call you?
        </h3>
        <p id="name-prompt-description" className="font-body-sm text-body-sm text-text-muted mb-4">
          Your name is stored locally in this browser.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            id="profile-name-input"
            type="text"
            value={name}
            maxLength={60}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            aria-label="Your name"
            className="w-full h-10 px-3 bg-bg-surface border border-border-default rounded-lg text-text-primary focus:outline-none focus:border-accent text-sm"
          />

          <div className="flex items-center justify-end gap-2 pt-2">
            {onSkip && (
              <button
                type="button"
                onClick={onSkip}
                className="h-9 px-4 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover text-sm font-medium transition-colors"
              >
                Skip
              </button>
            )}
            <button
              type="submit"
              className="h-9 px-5 rounded-lg bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors shadow-sm"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
