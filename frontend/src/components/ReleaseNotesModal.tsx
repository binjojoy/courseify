import React, { useEffect, useRef } from 'react';
import { Check, X } from 'lucide-react';
import { APP_VERSION } from '../config/app';

interface ReleaseNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReleaseNotesModal: React.FC<ReleaseNotesModalProps> = ({ isOpen, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-scrim p-4 backdrop-blur-md animate-fadeIn" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="release-notes-title" tabIndex={-1} className="w-full max-w-md rounded-2xl border border-border-default bg-bg-elevated p-6 shadow-2xl animate-scaleUp focus:outline-none">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <span className="mb-3 inline-flex rounded-lg bg-accent-subtle px-2.5 py-1 text-xs font-semibold text-accent">{APP_VERSION}</span>
            <h2 id="release-notes-title" className="text-xl font-bold text-text-primary">A note from the Courseify team</h2>
            <p className="mt-1 text-sm text-text-secondary">Your learning workspace just got a little more capable.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close release notes" className="rounded-lg p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><X size={18} /></button>
        </div>
        <ul className="space-y-3 text-sm leading-relaxed text-text-secondary">
          {[
            'AI study guides now include richer Markdown notes, interactive highlights, quizzes, and flashcards.',
            'Gemini key testing is clearer, with local token usage shown in the top bar and reset by Clear All Data.',
            'Mobile playback, lesson switching, timestamp seeking, and keyboard navigation are more reliable.',
            'YouTube imports now handle more link types, large playlists, unavailable embeds, and cached results.'
          ].map(change => <li key={change} className="flex gap-2"><Check size={17} className="mt-0.5 shrink-0 text-success" />{change}</li>)}
        </ul>
        <button type="button" onClick={onClose} className="mt-6 h-10 w-full rounded-lg bg-accent text-sm font-semibold text-white hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Continue learning</button>
      </div>
    </div>
  );
};