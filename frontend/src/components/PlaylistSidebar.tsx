import React, { useState, useRef, useEffect } from 'react';
import { VideoItem, CourseProgress, CourseNotes } from '../types';
import { getPlayableVideos } from '../utils/course';

interface PlaylistSidebarProps {
  videos: VideoItem[];
  progress: CourseProgress;
  notes: CourseNotes;
  currentVideoId: string;
  autoplayNext: boolean;
  onSelectVideo: (videoId: string) => void;
  onToggleComplete: (videoId: string) => void;
  onToggleAutoplay: () => void;
  totalDurationFormatted: string;
  watchedDurationFormatted: string;
}

export const PlaylistSidebar: React.FC<PlaylistSidebarProps> = ({
  videos,
  progress,
  notes,
  currentVideoId,
  autoplayNext,
  onSelectVideo,
  onToggleComplete,
  onToggleAutoplay,
  totalDurationFormatted,
  watchedDurationFormatted
}) => {
  const [hideCompleted, setHideCompleted] = useState(false);
  const [showJumpPill, setShowJumpPill] = useState(false);
  const [jumpDirection, setJumpDirection] = useState<'up' | 'down'>('down');
  const listContainerRef = useRef<HTMLDivElement>(null);
  const currentItemRef = useRef<HTMLDivElement>(null);

  const playableVideos = getPlayableVideos(videos);
  const completedCount = playableVideos.filter(v => progress.videos[v.videoId]?.completed).length;
  const totalCount = playableVideos.length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isAllCompleted = totalCount > 0 && completedCount === totalCount;

  // Auto-scroll current item into view on change
  useEffect(() => {
    if (currentItemRef.current) {
      currentItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentVideoId]);

  // Monitor scroll to display "Jump to current" pill
  const handleScroll = () => {
    if (!listContainerRef.current || !currentItemRef.current) return;
    const container = listContainerRef.current;
    const item = currentItemRef.current;

    const containerRect = container.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();

    const isAbove = itemRect.bottom < containerRect.top;
    const isBelow = itemRect.top > containerRect.bottom;

    if (isAbove) {
      setShowJumpPill(true);
      setJumpDirection('up');
    } else if (isBelow) {
      setShowJumpPill(true);
      setJumpDirection('down');
    } else {
      setShowJumpPill(false);
    }
  };

  const jumpToCurrent = () => {
    if (currentItemRef.current) {
      currentItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setShowJumpPill(false);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, index: number, videoId: string) => {
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      onToggleComplete(videoId);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onSelectVideo(videoId);
    } else if (e.key === 'ArrowDown' && index < videos.length - 1) {
      e.preventDefault();
      const nextEl = document.getElementById(`playlist-item-${index + 1}`);
      nextEl?.focus();
    } else if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      const prevEl = document.getElementById(`playlist-item-${index - 1}`);
      prevEl?.focus();
    }
  };

  const filteredVideos = hideCompleted
    ? videos.filter(v => !progress.videos[v.videoId]?.completed || v.videoId === currentVideoId)
    : videos;

  return (
    <aside className="w-full lg:w-[403px] lg:shrink-0 flex flex-col h-full bg-bg-surface dark:bg-[#0F172A] border-t lg:border-t-0 lg:border-l border-border-default select-none relative">
      {/* Fixed Progress Header Card */}
      <div className="p-4 border-b border-border-default flex flex-col gap-3.5 bg-bg-surface dark:bg-[#0F172A] shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-text-secondary">Progress</span>
          <div className="flex items-center gap-2">
            {isAllCompleted && (
              <span className="material-symbols-outlined text-[16px] text-success">check_circle</span>
            )}
            <span className="text-sm font-bold text-text-primary tabular-nums">
              {completedCount} / {totalCount}
            </span>
            <span className="text-xs text-text-muted font-mono">({percent}%)</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-text-muted">Watch time</span>
          <span className="text-text-secondary font-mono">
            {watchedDurationFormatted} / {totalDurationFormatted}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-border-default dark:bg-[#1E293B] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${isAllCompleted ? 'bg-success' : 'bg-accent'}`}
            style={{ width: `${percent}%` }}
          ></div>
        </div>

        {/* Playlist Utility Controls */}
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                checked={autoplayNext}
                onChange={onToggleAutoplay}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-border-strong dark:bg-[#1E293B] border border-border-strong peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-accent peer-checked:border-accent"></div>
            </div>
            <span className="text-xs font-medium text-text-secondary">Autoplay next</span>
          </label>

          <button
            type="button"
            onClick={() => setHideCompleted(!hideCompleted)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors focus:outline-none text-xs font-medium ${
              hideCompleted ? 'bg-accent-subtle text-accent' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {hideCompleted ? 'visibility' : 'visibility_off'}
            </span>
            <span>{hideCompleted ? 'Show all' : 'Hide completed'}</span>
          </button>
        </div>
      </div>

      {/* Scrollable Playlist Items */}
      <div
        ref={listContainerRef}
        onScroll={handleScroll}
        tabIndex={0}
        aria-label="Course videos playlist"
        className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-1.5 focus:outline-none"
      >
        {filteredVideos.map((video, idx) => {
          const isCurrent = video.videoId === currentVideoId;
          const isCompleted = !video.unavailable && !!progress.videos[video.videoId]?.completed;
          const hasNote = !!notes[video.videoId]?.text;

          return (
            <div
              key={video.videoId}
              id={`playlist-item-${idx}`}
              ref={isCurrent ? currentItemRef : undefined}
              tabIndex={0}
              onKeyDown={(e) => handleKeyDown(e, idx, video.videoId)}
              onClick={() => !video.unavailable && onSelectVideo(video.videoId)}
              className={`min-h-[3.75rem] py-2.5 px-3 rounded-lg flex items-center justify-between transition-colors cursor-pointer group focus:outline-none focus:ring-2 focus:ring-accent ${
                isCurrent
                  ? 'bg-accent-subtle/80 dark:bg-[#1E293B]/90 border-l-4 border-accent shadow-sm'
                  : 'hover:bg-bg-hover'
              }`}
            >
              {/* Left Column: Index or Playing Indicator */}
              <div className="flex items-center gap-3 min-w-0 pl-0.5">
                {isCurrent ? (
                  <div className="w-5 flex items-end justify-center gap-0.5 h-3.5 shrink-0" title="Currently Playing">
                    <span className="w-[2.5px] h-3.5 bg-accent rounded-full animate-pulse"></span>
                    <span className="w-[2.5px] h-2 bg-accent rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-[2.5px] h-3 bg-accent rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></span>
                  </div>
                ) : (
                  <span className="font-mono text-xs text-text-muted w-5 text-right shrink-0 tabular-nums">
                    {video.position + 1}
                  </span>
                )}

                {/* Title & Note Badge */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`text-sm line-clamp-2 leading-snug transition-colors ${
                      isCurrent
                        ? 'font-semibold text-text-primary dark:text-white'
                        : isCompleted
                        ? 'text-text-secondary font-normal'
                        : 'text-text-primary group-hover:text-accent font-normal'
                    }`}
                  >
                    {video.title}
                  </span>

                  {hasNote && (
                    <span
                      className="material-symbols-outlined text-[14px] text-accent shrink-0"
                      title="Contains personal note"
                    >
                      sticky_note_2
                    </span>
                  )}
                </div>
              </div>

              {/* Right Column: Duration & Checkbox */}
              <div className="flex items-center gap-3 shrink-0 ml-2">
                <span className="font-mono text-xs text-text-muted tabular-nums">
                  {video.durationFormatted}
                </span>

                {/* Interactive Checkbox */}
                <button
                  type="button"
                  role="checkbox"
                  aria-label={`${isCompleted ? 'Mark incomplete' : 'Mark complete'}: ${video.title}`}
                  aria-checked={isCompleted}
                  disabled={video.unavailable}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleComplete(video.videoId);
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  className={`w-5 h-5 rounded flex items-center justify-center cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-30 disabled:cursor-not-allowed ${
                    isCompleted
                      ? 'bg-success text-white'
                      : 'border-2 border-border-strong hover:border-text-secondary bg-transparent'
                  }`}
                  title={isCompleted ? 'Mark incomplete' : 'Mark complete'}
                >
                  {isCompleted && (
                    <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                  )}
                </button>
              </div>
            </div>
          );
        })}

        {filteredVideos.length === 0 && (
          <div className="p-8 text-center text-text-muted text-sm">
            All completed videos are hidden.
          </div>
        )}
      </div>

      {/* Floating Jump to Current Pill */}
      {showJumpPill && (
        <button
          type="button"
          onClick={jumpToCurrent}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-bg-elevated shadow-lg border border-border-default text-text-primary text-xs font-semibold flex items-center gap-1.5 z-20 hover:bg-bg-hover transition-all animate-fadeIn"
        >
          <span className="material-symbols-outlined text-[16px]">
            {jumpDirection === 'up' ? 'arrow_upward' : 'arrow_downward'}
          </span>
          <span>Current video</span>
        </button>
      )}
    </aside>
  );
};
