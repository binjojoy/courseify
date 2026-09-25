import React, { useState, useEffect, useRef } from 'react';
import { storage } from '../services/storage';

interface NotesSectionProps {
  courseId: string;
  videoId: string;
  currentPlayTimeSec: number;
  onSeek: (seconds: number) => void;
}

export const NotesSection: React.FC<NotesSectionProps> = ({
  courseId,
  videoId,
  currentPlayTimeSec,
  onSeek
}) => {
  const [text, setText] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [isEditing, setIsEditing] = useState(false);
  const debounceTimerRef = useRef<any>(null);
  const textRef = useRef('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load existing note when video changes
  useEffect(() => {
    const existing = storage.getVideoNote(courseId, videoId);
    setText(existing);
    textRef.current = existing;
    setIsEditing(!!existing);
    setSaveStatus('saved');
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        storage.saveVideoNote(courseId, videoId, textRef.current);
      }
    };
  }, [courseId, videoId]);

  // Format seconds to [MM:SS]
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
    textRef.current = newText;
    setSaveStatus('saving');

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      storage.saveVideoNote(courseId, videoId, newText);
      setSaveStatus('saved');
    }, 500);
  };

  const flushNote = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    storage.saveVideoNote(courseId, videoId, textRef.current);
    setSaveStatus('saved');
  };

  const handleInsertTimestamp = () => {
    const timeFormatted = formatTime(currentPlayTimeSec);
    const insertStr = ` [${timeFormatted}] `;
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = textarea.value;
    const updated = currentVal.substring(0, start) + insertStr + currentVal.substring(end);

    setText(updated);
    storage.saveVideoNote(courseId, videoId, updated);
    setSaveStatus('saved');

    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + insertStr.length;
    }, 0);
  };

  // Convert timestamp tags e.g. [12:34] into clickable seeking triggers
  const renderRenderedNote = () => {
    if (!text) return null;
    const parts = text.split(/(\[\d{1,2}:\d{2}(?::\d{2})?\])/g);
    return (
      <div className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
        {parts.map((part, i) => {
          const match = part.match(/^\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]$/);
          if (match) {
            const h = match[3] ? parseInt(match[1], 10) : 0;
            const m = match[3] ? parseInt(match[2], 10) : parseInt(match[1], 10);
            const s = match[3] ? parseInt(match[3], 10) : parseInt(match[2], 10);
            const totalSec = h * 3600 + m * 60 + s;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onSeek(totalSec)}
                className="inline-flex items-center px-1.5 py-0.5 rounded bg-accent-subtle text-accent hover:underline font-mono text-xs font-medium cursor-pointer"
              >
                {part}
              </button>
            );
          }
          return part;
        })}
      </div>
    );
  };

  return (
    <div className="pt-6 mt-6 border-t border-border-default flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-primary">Notes</h2>
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          {saveStatus === 'saved' ? (
            <>
              <span className="material-symbols-outlined text-[15px] text-success">check_circle</span>
              <span className="tracking-wide">Saved</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[15px] text-accent animate-spin">
                progress_activity
              </span>
              <span className="tracking-wide">Saving…</span>
            </>
          )}
        </div>
      </div>

      {/* Empty State vs Editing Area */}
      {!isEditing && !text ? (
        <button
          type="button"
          onClick={() => {
            setIsEditing(true);
            setTimeout(() => textareaRef.current?.focus(), 50);
          }}
          className="w-full min-h-[96px] rounded-xl border border-dashed border-border-strong bg-bg-surface hover:border-accent p-4 text-left transition-colors flex items-center gap-3 cursor-pointer group"
        >
          <span className="material-symbols-outlined text-[22px] text-text-muted group-hover:text-accent transition-colors">
            sticky_note_2
          </span>
          <span className="text-sm text-text-muted group-hover:text-text-secondary transition-colors font-medium">
            Click to add note
          </span>
        </button>
      ) : (
        <div className="w-full flex flex-col rounded-xl border border-border-default bg-bg-surface dark:bg-[#111827] focus-within:border-accent/80 focus-within:ring-1 focus-within:ring-accent/30 transition-all overflow-hidden shadow-sm">
          <textarea
            ref={textareaRef}
            data-testid="notes-editor"
            aria-label="Lesson notes"
            rows={4}
            value={text}
            onChange={handleChange}
            onBlur={flushNote}
            placeholder="Type your personal observations, memory pointers, or questions..."
            className="w-full p-4 bg-transparent text-text-primary text-sm resize-y outline-none leading-relaxed placeholder:text-text-muted font-body"
          />

          {/* Notes Toolbar */}
          <div className="flex items-center justify-between px-3.5 py-2 border-t border-border-default bg-bg-canvas/50 dark:bg-[#0F172A]/80">
            <button
              type="button"
              onClick={handleInsertTimestamp}
              className="h-8 px-3 flex items-center gap-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors focus:outline-none text-xs font-medium"
            >
              <span className="material-symbols-outlined text-[16px] text-accent">schedule</span>
              <span>Insert {formatTime(currentPlayTimeSec)}</span>
            </button>

            <span className="text-xs text-text-muted hidden sm:inline font-mono">
              Clickable timestamps enabled
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
