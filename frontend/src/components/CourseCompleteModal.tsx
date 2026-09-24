import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Course } from '../types';

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
  useEffect(() => {
    if (isOpen) {
      // Fire confetti burst
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#2456D6', '#1B7A4B', '#58C48C', '#7BA0FF']
        });
      } catch {}
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim/80 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-[480px] bg-bg-elevated rounded-2xl border border-border-default shadow-2xl p-8 flex flex-col items-center text-center relative">
        {/* Close Button */}
        <button
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
        <h2 className="font-display-sm text-display-sm text-text-primary tracking-tight">
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
            <span className="font-caption text-caption text-text-muted mt-0.5">videos</span>
          </div>
          <div className="flex flex-col items-center border-x border-border-default">
            <span className="font-stat text-stat text-text-primary">{course.totalDurationFormatted || '5h 10m'}</span>
            <span className="font-caption text-caption text-text-muted mt-0.5">total time</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-stat text-stat text-success font-semibold">100%</span>
            <span className="font-caption text-caption text-text-muted mt-0.5">completed</span>
          </div>
        </div>

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
