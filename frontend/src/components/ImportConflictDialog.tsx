import React, { useState } from 'react';

import { useFocusTrap } from '../hooks/useFocusTrap';
import type { ImportAnalysis, ImportStrategy } from '../services/backup';
import { pluralize } from '../utils/progress';

interface ImportConflictDialogProps {
  isOpen: boolean;
  analysis: ImportAnalysis;
  /** The backup's own export timestamp, shown so the user can tell files apart. */
  exportedAt: string | null;
  isImporting: boolean;
  onCancel: () => void;
  onConfirm: (strategy: ImportStrategy) => void;
}

const formatExportedAt = (value: string | null): string => {
  if (!value) return 'an unknown date';
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return 'an unknown date';
  return new Date(parsed).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
};

/**
 * Shown after a backup file parses but overlaps what is already stored.
 *
 * Import used to be an all-or-nothing replace behind a single confirm, so
 * restoring an old export silently destroyed newer progress. This offers the
 * two honest options: keep both, or replace.
 */
export const ImportConflictDialog: React.FC<ImportConflictDialogProps> = ({
  isOpen,
  analysis,
  exportedAt,
  isImporting,
  onCancel,
  onConfirm
}) => {
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  const [strategy, setStrategy] = useState<ImportStrategy>('merge');

  if (!isOpen) return null;

  const { conflicts, newCourseCount, updatedCourseCount } = analysis;
  const shownConflicts = conflicts.slice(0, 5);
  const hiddenConflictCount = conflicts.length - shownConflicts.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn"
      role="presentation"
      onMouseDown={e => {
        if (e.target === e.currentTarget && !isImporting) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-conflict-title"
        aria-describedby="import-conflict-body"
        data-testid="import-conflict-dialog"
        tabIndex={-1}
        onKeyDown={event => {
          if (event.key === 'Escape' && !isImporting) {
            event.stopPropagation();
            onCancel();
          }
        }}
        className="w-full max-w-[540px] max-h-[85vh] overflow-y-auto bg-bg-elevated rounded-2xl border border-border-default shadow-2xl p-6 sm:p-7 flex flex-col relative animate-scaleUp focus:outline-none"
      >
        <div className="w-11 h-11 rounded-full bg-accent-subtle text-accent flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-[24px]">merge_type</span>
        </div>
        <h3 id="import-conflict-title" className="font-heading text-heading text-text-primary text-lg font-bold mb-2">
          {conflicts.length > 0 ? 'This backup overlaps your library' : 'Review this backup'}
        </h3>
        <p id="import-conflict-body" className="font-body text-body text-text-secondary leading-relaxed text-sm mb-5">
          Exported {formatExportedAt(exportedAt)}. It contains{' '}
          {newCourseCount > 0 ? `${pluralize(newCourseCount, 'new course')}` : 'no new courses'}
          {updatedCourseCount > 0 ? ` and updates ${pluralize(updatedCourseCount, 'existing course')}` : ''}.
          {conflicts.length > 0 ? ' Some of those courses already exist here, so choosing how to combine them matters.' : ''}
        </p>

        {conflicts.length > 0 && (
          <ul className="mb-5 space-y-2" aria-label="Conflicting courses">
            {shownConflicts.map(conflict => (
              <li
                key={conflict.courseId}
                className="rounded-lg border border-border-default bg-bg-surface px-3 py-2.5 text-sm"
              >
                <div className="font-medium text-text-primary truncate">{conflict.courseTitle}</div>
                <div className="text-text-muted text-xs mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                  {conflict.incomingOnly > 0 && <span>{pluralize(conflict.incomingOnly, 'new lesson')} in the backup</span>}
                  {conflict.existingOnly > 0 && <span>{pluralize(conflict.existingOnly, 'lesson')} only here</span>}
                  {conflict.shared > 0 && <span>{pluralize(conflict.shared, 'shared lesson')}</span>}
                  {conflict.losesProgress && (
                    <span className="text-error font-medium">Replacing loses completions you earned here</span>
                  )}
                </div>
              </li>
            ))}
            {hiddenConflictCount > 0 && (
              <li className="text-xs text-text-muted pl-1">and {pluralize(hiddenConflictCount, 'more course')}</li>
            )}
          </ul>
        )}

        <fieldset className="mb-6" disabled={isImporting}>
          <legend className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2.5">
            How should this be applied?
          </legend>
          <div className="space-y-2.5">
            <label
              className={`flex gap-3 items-start rounded-lg border px-3.5 py-3 cursor-pointer transition-colors ${
                strategy === 'merge'
                  ? 'border-accent bg-accent-subtle'
                  : 'border-border-default bg-bg-surface hover:bg-bg-hover'
              } ${isImporting ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <input
                type="radio"
                name="import-strategy"
                value="merge"
                checked={strategy === 'merge'}
                onChange={() => setStrategy('merge')}
                className="mt-1 accent-[var(--color-accent)]"
                disabled={isImporting}
              />
              <span>
                <span className="block text-sm font-medium text-text-primary">Merge with my data (recommended)</span>
                <span className="block text-xs text-text-muted mt-0.5">
                  Keeps everything already here and adds anything new from the backup. Completions you earned are never downgraded.
                </span>
              </span>
            </label>
            <label
              className={`flex gap-3 items-start rounded-lg border px-3.5 py-3 cursor-pointer transition-colors ${
                strategy === 'replace'
                  ? 'border-accent bg-accent-subtle'
                  : 'border-border-default bg-bg-surface hover:bg-bg-hover'
              } ${isImporting ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <input
                type="radio"
                name="import-strategy"
                value="replace"
                checked={strategy === 'replace'}
                onChange={() => setStrategy('replace')}
                className="mt-1 accent-[var(--color-accent)]"
                disabled={isImporting}
              />
              <span>
                <span className="block text-sm font-medium text-text-primary">Replace my data</span>
                <span className="block text-xs text-text-muted mt-0.5">
                  Discards the current library and restores the backup exactly. Anything added since {formatExportedAt(exportedAt)} is lost.
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isImporting}
            className="h-10 px-4 rounded-lg border border-border-default bg-bg-surface text-text-primary hover:bg-bg-hover transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(strategy)}
            disabled={isImporting}
            className={`h-10 px-4 rounded-lg font-medium text-sm text-white transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed ${
              strategy === 'replace' ? 'bg-error hover:bg-error/90' : 'bg-accent hover:bg-accent-hover'
            }`}
          >
            {isImporting ? 'Importing…' : strategy === 'replace' ? 'Replace data' : 'Merge backup'}
          </button>
        </div>
      </div>
    </div>
  );
};
