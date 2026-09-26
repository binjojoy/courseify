import React, { useState, useRef, useEffect } from 'react';
import { Course } from '../types';
import { storage } from '../services/storage';

interface CourseCardProps {
  course: Course;
  onOpen: (courseId: string) => void;
  onResetProgress: (course: Course) => void;
  onRemoveCourse: (course: Course) => void;
}

export const CourseCard: React.FC<CourseCardProps> = ({
  course,
  onOpen,
  onResetProgress,
  onRemoveCourse
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const metrics = storage.getCourseMetrics(course.id);
  const videos = storage.getCourseVideos(course.id);
  const lastVideo = videos.find(v => v.videoId === metrics.lastVideoId) || videos[0];

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isCompleted = metrics.isCompleted;
  const isUnstarted = metrics.completedVideos === 0 && (!metrics.lastVideoId || metrics.watchedDurationSec === 0);

  return (
    <article
      onClick={() => onOpen(course.id)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(course.id);
        }
      }}
      data-testid="course-card"
      aria-label={`Course ${course.title}`}
      tabIndex={0}
      role="group"
      className="group flex flex-col justify-between bg-bg-surface rounded-xl p-3 shadow-sm hover:shadow-md transition-all border border-border-default relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="flex flex-col">
        {/* 16:9 Thumbnail Frame */}
        <div className="relative aspect-[16/9] w-full rounded-lg overflow-hidden bg-surface-container mb-3">
          <img
            alt={course.title}
            src={course.thumbnailUrl || 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />

          {/* Overlay Badge */}
          {isCompleted ? (
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-success text-white font-caption-medium text-caption-medium flex items-center gap-1 shadow-sm">
              <span className="material-symbols-outlined text-[13px]">check_circle</span>
              <span>Completed</span>
            </div>
          ) : (
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur-sm text-white font-caption text-caption">
              {course.videoCount} videos
            </div>
          )}

          {/* Bottom Thumbnail Progress Bar */}
          <div role="progressbar" aria-label={`${course.title} completion`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={metrics.completionPercent} aria-valuetext={`${metrics.completionPercent}% complete`} className="absolute bottom-0 left-0 right-0 h-1 bg-surface-container-highest">
            <div
              className={`h-full ${isCompleted ? 'bg-success' : 'bg-accent'}`}
              style={{ width: `${metrics.completionPercent}%` }}
            ></div>
          </div>
        </div>

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
                  className="absolute right-0 top-6 w-44 bg-bg-elevated rounded-lg shadow-xl border border-border-default p-1 text-sm z-30 animate-fadeIn"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onOpen(course.id);
                    }}
                    className="w-full text-left px-3 py-1.5 rounded hover:bg-bg-hover text-text-primary flex items-center gap-2 text-xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                    <span>Open</span>
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onResetProgress(course);
                    }}
                    className="w-full text-left px-3 py-1.5 rounded hover:bg-bg-hover text-text-primary flex items-center gap-2 text-xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                    <span>Reset progress</span>
                  </button>
                  <div className="h-[1px] bg-border-default my-1"></div>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onRemoveCourse(course);
                    }}
                    className="w-full text-left px-3 py-1.5 rounded hover:bg-error-subtle text-error flex items-center gap-2 text-xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
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
            <span className="text-outline-variant">•</span>
            {isCompleted ? (
              <span className="font-caption-medium text-success">100% finished</span>
            ) : (
              <span className="flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[13px]">schedule</span>
                {course.totalDurationFormatted || '0m'}
              </span>
            )}
          </div>

          {/* Progress Bar */}
          <div role="progressbar" aria-label={`${course.title} completion`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={metrics.completionPercent} aria-valuetext={`${metrics.completionPercent}% complete`} className="w-full h-1 bg-surface-container rounded-full overflow-hidden mt-2">
            <div
              className={`h-full ${isCompleted ? 'bg-success' : 'bg-accent'}`}
              style={{ width: `${metrics.completionPercent}%` }}
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
              <span className="break-words">{lastVideo?.title || 'Next video'}</span>
            </p>
          )}
        </div>
      </div>

      {/* Action Button */}
      <div className="pt-4 px-1 pb-1">
        {isCompleted ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(course.id);
            }}
            className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-surface-container text-text-primary font-body-sm-medium text-body-sm-medium hover:bg-bg-hover transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">replay</span>
            <span>Rewatch</span>
          </button>
        ) : isUnstarted ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(course.id);
            }}
            className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-accent text-white font-body-sm-medium text-body-sm-medium hover:bg-accent-hover transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">play_circle</span>
            <span>Start learning</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(course.id);
            }}
            className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-accent-subtle text-accent font-body-sm-medium text-body-sm-medium hover:bg-accent hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              play_arrow
            </span>
            <span>Continue learning</span>
          </button>
        )}
      </div>
    </article>
  );
};
