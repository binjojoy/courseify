import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Course } from '../types';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { formatDurationHuman, pluralize } from '../utils/progress';

interface CourseCompleteModalProps {
  course: Course;
  isOpen: boolean;
  onClose: () => void;
  onBackToDashboard: () => void;
  onRewatch: () => void;
}

export const CourseCompleteModal: React.FC<CourseCompleteModalProps> = ({
  course,
  isOpen,
  onClose,
  onBackToDashboard,
  onRewatch
}) => {
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);

  useEffect(() => {
    if (!isOpen) return undefined;
    // Fire confetti burst. It is decoration: a failure here (reduced motion,
    // a blocked canvas) must never stop the user reaching the buttons.
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#2456D6', '#1B7A4B', '#58C48C', '#7BA0FF']
      });
    } catch {
      // Intentionally ignored.
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Never invent a duration: a course stored before durations were tracked has
  // none, and showing a made-up "5h 10m" would be worse than showing nothing.
  const totalDuration = course.totalDurationSec > 0
    ? formatDurationHuman(course.totalDurationSec)
    : 'Not tracked';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim/80 backdrop-blur-xs animate-fadeIn"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-complete-title"
        tabIndex={-1}
        className="w-full max-w-[480px] bg-bg-elevated rounded-2xl border border-border-default shadow-2xl p-8 flex flex-col items-center text-center relative focus:outline-none"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 text-text-muted hover:text-text-primary p-1 rounded-lg"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        {/* Checkmark Icon Circle */}
        <div className="w-14 h-14 rounded-full bg-success-subtle flex items-center justify-center text-success mb-5">
          <span className="material-symbols-outlined text-[32px] font-bold">check</span>
        </div>

        {/* Title */}
        <h2 id="course-complete-title" className="font-display-sm text-display-sm text-text-primary tracking-tight">
          Course complete
        </h2>

        {/* Course Title */}
        <p className="font-body text-body text-text-secondary mt-2 max-w-sm">
          {course.title}
        </p>

        {/* 3 Stats Columns */}
        <div className="grid grid-cols-3 gap-2 w-full my-6 py-4 border-y border-border-default">
          <div className="flex flex-col items-center">
            <span className="font-stat text-stat text-text-primary">{course.videoCount}</span>
            <span className="font-caption text-caption text-text-muted mt-0.5">{course.videoCount === 1 ? 'video' : 'videos'}</span>
          </div>
          <div className="flex flex-col items-center border-x border-border-default">
            <span className="font-stat text-stat text-text-primary">{totalDuration}</span>
            <span className="font-caption text-caption text-text-muted mt-0.5">total time</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-stat text-stat text-success font-semibold">100%</span>
            <span className="font-caption text-caption text-text-muted mt-0.5">completed</span>
          </div>
        </div>

        {course.truncated && (
          <p className="mb-4 text-xs text-text-muted leading-relaxed">
            {pluralize(course.totalItemCount ?? course.videoCount, 'lesson')} exist in this
            playlist, but only {course.videoCount} were imported.
          </p>
        )}

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="h-11 px-5 rounded-lg bg-accent text-white font-body-sm-medium text-body-sm-medium hover:bg-accent-hover transition-colors flex-1"
          >
            Back to dashboard
          </button>
          <button
            type="button"
            onClick={onRewatch}
            className="h-11 px-5 rounded-lg border border-border-strong bg-bg-surface text-text-primary hover:bg-bg-hover transition-colors font-body-sm-medium text-body-sm-medium flex-1"
          >
            Rewatch
          </button>
        </div>
      </div>
    </div>
  );
};
