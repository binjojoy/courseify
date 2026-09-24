import React, { useState } from 'react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim/80 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-[400px] bg-bg-elevated rounded-2xl border border-border-default shadow-2xl p-6 flex flex-col">
        <h3 className="font-heading text-heading text-text-primary mb-1">
          What should we call you?
        </h3>
        <p className="font-body-sm text-body-sm text-text-muted mb-4">
          Your name is stored locally in this browser.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
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
