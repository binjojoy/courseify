import React, { useState, useRef, useEffect } from 'react';
import { Course } from '../types';
import { clampPercent, formatDurationHuman, pluralize, type CourseMetrics } from '../utils/progress';

interface CourseCardProps {
  course: Course;
  /**
   * Completion maths and the resume-point title are resolved by the dashboard,
   * which already memoises them per course. Recomputing them here re-read and
   * re-parsed every course's lesson list from localStorage on each render, once
   * per card.
   */
  metrics: CourseMetrics;
  lastVideoTitle: string;
  onOpen: (courseId: string) => void;
  onResetProgress: (course: Course) => void;
  onRemoveCourse: (course: Course) => void;
}

export const CourseCard: React.FC<CourseCardProps> = ({
  course,
  metrics,
  lastVideoTitle,
  onOpen,
  onResetProgress,
  onRemoveCourse
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click / Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const isCompleted = metrics.isCompleted;
  const isUnstarted = metrics.completedVideos === 0 && (!metrics.lastVideoId || metrics.watchedDurationSec === 0);
  // Already clamped inside computeCourseMetrics; re-clamped so a card can never
  // render an over-wide bar even if a caller hands us hand-built metrics.
  const percent = clampPercent(metrics.completionPercent);
  const totalDurationLabel = course.totalDurationFormatted
    || formatDurationHuman(metrics.totalDurationSec || course.totalDurationSec || 0);

  return (
    <article
      data-testid="course-card"
      aria-label={`Course ${course.title}`}
      className="group flex flex-col justify-between bg-bg-surface rounded-xl p-3 shadow-sm hover:shadow-md transition-all border border-border-default relative"
    >
      <div className="flex flex-col">
        {/*
          The card used to be an interactive <article role="group" tabIndex={0}>
          wrapping three buttons, which is invalid: a group is not a widget, and
          the whole-card click target trapped keyboard users on a non-interactive
          element. The thumbnail is now the real button for "open this course";
          the two actions below are ordinary siblings.
        */}
        <button
          type="button"
          onClick={() => onOpen(course.id)}
          aria-label={`Open ${course.title}`}
          className="relative block w-full aspect-[16/9] rounded-lg overflow-hidden bg-surface-container mb-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface"
        >
          <img
            alt=""
            src={course.thumbnailUrl || 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />

          {/* Overlay Badge */}
          {isCompleted ? (
            <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-success text-white font-caption-medium text-caption-medium flex items-center gap-1 shadow-sm">
              <span className="material-symbols-outlined text-[13px]" aria-hidden="true">check_circle</span>
              <span>Completed</span>
            </span>
          ) : (
            <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur-sm text-white font-caption text-caption">
              {pluralize(metrics.totalVideos, 'video')}
            </span>
          )}

          {/* Bottom Thumbnail Progress Bar */}
          <span
            role="progressbar"
            aria-label={`${course.title} completion`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-valuetext={`${percent}% complete`}
            className="absolute bottom-0 left-0 right-0 h-1 bg-surface-container-highest"
          >
            <span
              className={`block h-full ${isCompleted ? 'bg-success' : 'bg-accent'}`}
              style={{ width: `${percent}%` }}
            ></span>
          </span>
        </button>

        {/* Card Content */}
        <div className="px-1">
          <div className="flex items-center justify-between">
            <span className="font-caption text-caption text-text-muted block truncate max-w-[85%]">
              {course.channelTitle || 'YouTube Creator'}
            </span>

            {/* Overflow Menu Button */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                aria-label="Course options"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(!menuOpen);
                }}
                className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">more_vert</span>
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  aria-label="Course options"
                  className="absolute right-0 top-6 w-44 bg-bg-elevated rounded-lg shadow-xl border border-border-default p-1 text-sm z-30 animate-fadeIn"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpen(course.id);
                    }}
                    className="w-full text-left px-3 py-1.5 rounded hover:bg-bg-hover text-text-primary flex items-center gap-2 text-xs"
                  >
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">play_arrow</span>
                    <span>Open</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onResetProgress(course);
                    }}
                    className="w-full text-left px-3 py-1.5 rounded hover:bg-bg-hover text-text-primary flex items-center gap-2 text-xs"
                  >
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">restart_alt</span>
                    <span>Reset progress</span>
                  </button>
                  <div className="h-[1px] bg-border-default my-1" role="separator"></div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onRemoveCourse(course);
                    }}
                    className="w-full text-left px-3 py-1.5 rounded hover:bg-error-subtle text-error flex items-center gap-2 text-xs"
                  >
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">delete</span>
                    <span>Remove course</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <h3 className="font-card-title text-card-title text-text-primary mt-0.5 line-clamp-1 group-hover:text-accent transition-colors">
            {course.title}
          </h3>

          <div className="flex items-center gap-2 mt-2 text-caption font-caption text-text-secondary">
            <span>{metrics.completedVideos} / {metrics.totalVideos} videos</span>
            <span className="text-outline-variant" aria-hidden="true">•</span>
            {isCompleted ? (
              <span className="font-caption-medium text-success">100% finished</span>
            ) : (
              <span className="flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[13px]" aria-hidden="true">schedule</span>
                {totalDurationLabel}
              </span>
            )}
          </div>

          {/* Progress Bar */}
          <div role="progressbar" aria-label={`${course.title} completion`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${percent}% complete`} className="w-full h-1 bg-surface-container rounded-full overflow-hidden mt-2">
            <div
              className={`h-full ${isCompleted ? 'bg-success' : 'bg-accent'}`}
              style={{ width: `${percent}%` }}
            ></div>
          </div>

          {/* Last Watched Pill / Text */}
          {isCompleted ? (
            <p className="font-caption text-caption text-text-muted mt-2 line-clamp-1 bg-success-subtle/60 text-success px-2 py-1 rounded">
              Completed · Ready to rewatch
            </p>
          ) : isUnstarted ? (
            <p className="font-caption text-caption text-text-muted mt-2 line-clamp-2 min-h-[2.25rem] bg-surface-container-low px-2 py-1 rounded leading-relaxed">
              Unstarted · Ready to begin
            </p>
          ) : (
            <p className="font-caption text-caption text-text-muted mt-2 line-clamp-1 bg-surface-container-low px-2 py-1 rounded">
              <span className="font-semibold">Last watched:</span>{' '}
              <span className="break-words">{lastVideoTitle || 'Next video'}</span>
            </p>
          )}
        </div>
      </div>

      {/* Action Button */}
      <div className="pt-4 px-1 pb-1">
        {isCompleted ? (
          <button
            type="button"
            onClick={() => onOpen(course.id)}
            className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-surface-container text-text-primary font-body-sm-medium text-body-sm-medium hover:bg-bg-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">replay</span>
            <span>Rewatch</span>
          </button>
        ) : isUnstarted ? (
          <button
            type="button"
            onClick={() => onOpen(course.id)}
            className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-accent text-white font-body-sm-medium text-body-sm-medium hover:bg-accent-hover transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">play_circle</span>
            <span>Start learning</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onOpen(course.id)}
            className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-accent-subtle text-accent font-body-sm-medium text-body-sm-medium hover:bg-accent hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
              play_arrow
            </span>
            <span>Continue learning</span>
          </button>
        )}
      </div>
    </article>
  );
};
