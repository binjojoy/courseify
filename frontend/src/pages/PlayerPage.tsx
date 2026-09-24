import React, { useState, useEffect, useRef } from 'react';
import { Course, VideoItem, CourseProgress, CourseNotes } from '../types';
import { storage } from '../services/storage';
import { YouTubePlayer } from '../components/YouTubePlayer';
import { PlaylistSidebar } from '../components/PlaylistSidebar';
import { NotesSection } from '../components/NotesSection';
import { CourseCompleteModal } from '../components/CourseCompleteModal';

interface PlayerPageProps {
  courseId: string;
  initialVideoId?: string;
  onNavigate: (view: 'home' | 'dashboard' | 'player', courseId?: string) => void;
  onShowToast: (msg: string) => void;
}

export const PlayerPage: React.FC<PlayerPageProps> = ({
  courseId,
  initialVideoId,
  onNavigate,
  onShowToast
}) => {
  const [course, setCourse] = useState<Course | null>(storage.getCourse(courseId));
  const [videos, setVideos] = useState<VideoItem[]>(storage.getCourseVideos(courseId));
  const [progress, setProgress] = useState<CourseProgress>(storage.getCourseProgress(courseId));
  const [notes, setNotes] = useState<CourseNotes>(storage.getCourseNotes(courseId));

  const [currentVideoId, setCurrentVideoId] = useState<string>(
    initialVideoId || progress.lastVideoId || videos[0]?.videoId || ''
  );
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [autoplayNext, setAutoplayNext] = useState<boolean>(storage.getSettings().autoplayNext);
  const [isCourseCompleteModalOpen, setIsCourseCompleteModalOpen] = useState(false);
  const [activeTabMobile, setActiveTabMobile] = useState<'videos' | 'notes' | 'about'>('videos');

  const playerSeekFuncRef = useRef<((sec: number) => void) | null>(null);

  // Sync state if courseId changes or data updates
  const reloadData = () => {
    const c = storage.getCourse(courseId);
    const v = storage.getCourseVideos(courseId);
    const p = storage.getCourseProgress(courseId);
    const n = storage.getCourseNotes(courseId);

    setCourse(c);
    setVideos(v);
    setProgress(p);
    setNotes(n);

    if (!currentVideoId || !v.some(item => item.videoId === currentVideoId)) {
      setCurrentVideoId(p.lastVideoId || v[0]?.videoId || '');
    }
  };

  useEffect(() => {
    reloadData();
    const unsub = storage.subscribe(reloadData);
    return unsub;
  }, [courseId]);

  const currentVideo = videos.find(v => v.videoId === currentVideoId) || videos[0];
  const currentIndex = videos.findIndex(v => v.videoId === currentVideoId);
  const isFirstVideo = currentIndex <= 0;
  const isLastVideo = currentIndex >= videos.length - 1;

  const currentVideoProgress = progress.videos[currentVideoId];
  const isCurrentVideoCompleted = !!currentVideoProgress?.completed;
  const initialPosition = currentVideoProgress?.positionSec || 0;

  // Toggle video complete
  const handleToggleComplete = (videoIdToToggle: string) => {
    const { completed, courseCompleteTriggered } = storage.toggleVideoCompletion(courseId, videoIdToToggle);
    setProgress(storage.getCourseProgress(courseId));
    if (courseCompleteTriggered) {
      setIsCourseCompleteModalOpen(true);
    }
  };

  const handleNextVideo = () => {
    if (!isLastVideo) {
      const nextVid = videos[currentIndex + 1];
      if (nextVid) {
        setCurrentVideoId(nextVid.videoId);
      }
    }
  };

  const handlePrevVideo = () => {
    if (!isFirstVideo) {
      const prevVid = videos[currentIndex - 1];
      if (prevVid) {
        setCurrentVideoId(prevVid.videoId);
      }
    }
  };

  const handleSeek = (sec: number) => {
    // Seek YouTube player
    const iframe = document.querySelector('iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'seekTo', args: [sec, true] }),
        '*'
      );
    }
  };

  const handleRewatch = () => {
    storage.resetCourseProgress(courseId);
    setProgress(storage.getCourseProgress(courseId));
    if (videos[0]) {
      setCurrentVideoId(videos[0].videoId);
    }
    setIsCourseCompleteModalOpen(false);
    onShowToast('Course progress reset. Enjoy rewatching!');
  };

  // Convert description text: render clickable links & timestamps
  const renderDescription = (text: string) => {
    if (!text) return 'No description provided for this lesson.';

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const timeRegex = /\b(\d{1,2}:\d{2}(?::\d{2})?)\b/g;

    // Split by URLs first
    const urlParts = text.split(urlRegex);

    return urlParts.map((urlPart, i) => {
      if (urlPart.match(urlRegex)) {
        return (
          <a
            key={i}
            href={urlPart}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline font-medium focus:outline-none"
          >
            {urlPart}
          </a>
        );
      }

      // Then split by timestamps
      const timeParts = urlPart.split(timeRegex);
      return timeParts.map((subPart, j) => {
        const timeMatch = subPart.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
        if (timeMatch) {
          const h = timeMatch[3] ? parseInt(timeMatch[1], 10) : 0;
          const m = timeMatch[3] ? parseInt(timeMatch[2], 10) : parseInt(timeMatch[1], 10);
          const s = timeMatch[3] ? parseInt(timeMatch[3], 10) : parseInt(timeMatch[2], 10);
          const sec = h * 3600 + m * 60 + s;

          return (
            <button
              key={`${i}-${j}`}
              type="button"
              onClick={() => handleSeek(sec)}
              className="inline-flex items-center px-1.5 py-0.5 rounded bg-accent-subtle text-accent hover:underline font-mono text-xs font-semibold cursor-pointer mx-0.5"
            >
              {subPart}
            </button>
          );
        }
        return subPart;
      });
    });
  };

  const metrics = storage.getCourseMetrics(courseId);

  // Format watched vs total duration
  const formatDurationText = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m.toString().padStart(2, '0')}m`;
  };

  if (!course) {
    return (
      <main className="w-full pt-14 bg-bg-canvas min-h-screen flex items-center justify-center p-6 text-center">
        <div className="max-w-md flex flex-col items-center">
          <span className="material-symbols-outlined text-[48px] text-text-muted mb-4">
            alert_circle
          </span>
          <h2 className="text-xl font-bold text-text-primary mb-2">We couldn't find that course</h2>
          <p className="text-sm text-text-secondary mb-6">
            It may have been removed from this browser.
          </p>
          <button
            onClick={() => onNavigate('dashboard')}
            className="h-10 px-5 rounded-lg bg-accent text-white font-medium text-sm"
          >
            Back to dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full pt-14 bg-bg-canvas min-h-screen text-text-primary selection:bg-accent-subtle selection:text-accent">
      <div className="flex flex-col lg:flex-row w-full h-[calc(100vh-56px)] overflow-hidden bg-bg-canvas text-text-primary">
        {/* Main Column: Player and Content Stage */}
        <div className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden">
          {/* Pinned Video Player Viewport */}
          <section className="relative w-full aspect-video bg-player-black select-none shrink-0 overflow-hidden border-b border-border-default">
            {currentVideo ? (
              <YouTubePlayer
                videoId={currentVideo.videoId}
                courseId={course.id}
                initialPositionSec={initialPosition}
                autoplayNext={autoplayNext}
                onNextVideo={handleNextVideo}
                onTimeUpdate={(cur) => setCurrentTimeSec(cur)}
                onAutoComplete={(vid) => {
                  if (!progress.videos[vid]?.completed) {
                    handleToggleComplete(vid);
                  }
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-text-muted">
                No playable video in course
              </div>
            )}
          </section>

          {/* Mobile Tab Strip (Only on small screens < 1024px) */}
          <div className="lg:hidden flex flex-col bg-bg-surface border-b border-border-default sticky top-0 z-30">
            {/* Progress strip */}
            <div className="h-11 px-4 flex items-center justify-between text-xs border-b border-border-default">
              <span className="font-semibold text-text-primary">
                {metrics.completedVideos} / {metrics.totalVideos} videos
              </span>
              <div className="w-1/3 h-1.5 bg-border-default rounded-full overflow-hidden mx-2">
                <div
                  className="h-full bg-accent"
                  style={{ width: `${metrics.completionPercent}%` }}
                ></div>
              </div>
              <span className="font-mono text-text-muted">{metrics.completionPercent}%</span>
            </div>

            {/* Tabs */}
            <div className="flex items-center justify-around h-11">
              <button
                type="button"
                onClick={() => setActiveTabMobile('videos')}
                className={`flex-1 h-full font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 border-b-2 ${
                  activeTabMobile === 'videos'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <span>Videos</span>
                <span className="text-text-muted font-normal">({videos.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTabMobile('notes')}
                className={`flex-1 h-full font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 border-b-2 ${
                  activeTabMobile === 'notes'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <span>Notes</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTabMobile('about')}
                className={`flex-1 h-full font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 border-b-2 ${
                  activeTabMobile === 'about'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <span>About</span>
              </button>
            </div>
          </div>

          {/* Desktop Content Stage or Active Mobile Tab Content */}
          <div className="w-full max-w-[824px] mx-auto px-4 sm:px-6 md:px-8 pt-6 pb-16 flex flex-col flex-1">
            {/* Title & Primary Header Row */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight font-title">
                  {currentVideo?.title}
                </h1>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-text-secondary">
                  <span className="font-medium text-text-primary">
                    Video {currentIndex + 1} of {videos.length}
                  </span>
                  <span className="inline-block w-1 h-1 rounded-full bg-border-strong"></span>
                  <span className="flex items-center gap-1 font-mono">
                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                    {currentVideo?.durationFormatted}
                  </span>
                </div>
              </div>

              {/* Prev/Next and Mark Complete Buttons */}
              <div className="flex items-center gap-2 self-start shrink-0">
                <div className="flex items-center rounded-lg bg-bg-surface border border-border-default p-0.5 shadow-xs">
                  <button
                    type="button"
                    onClick={handlePrevVideo}
                    disabled={isFirstVideo}
                    aria-label="Previous video"
                    className="w-9 h-9 flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-40 disabled:pointer-events-none focus:outline-none"
                  >
                    <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                  </button>
                  <div className="h-4 w-[1px] bg-border-default"></div>
                  <button
                    type="button"
                    onClick={handleNextVideo}
                    disabled={isLastVideo}
                    aria-label="Next video"
                    className="w-9 h-9 flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-40 disabled:pointer-events-none focus:outline-none"
                  >
                    <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                  </button>
                </div>

                <button
                  type="button"
                  id="markCompleteBtn"
                  onClick={() => currentVideo && handleToggleComplete(currentVideo.videoId)}
                  className={`h-10 px-4 flex items-center gap-2 rounded-lg border text-sm font-medium transition-colors focus:outline-none cursor-pointer shadow-xs ${
                    isCurrentVideoCompleted
                      ? 'bg-success-subtle border-success/40 text-success'
                      : 'bg-bg-surface border-border-strong text-text-primary hover:bg-bg-hover'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {isCurrentVideoCompleted ? 'check_circle' : 'check'}
                  </span>
                  <span>{isCurrentVideoCompleted ? 'Completed' : 'Mark complete'}</span>
                </button>
              </div>
            </div>

            {/* Mobile Tab Conditionals or Desktop Default view */}
            <div className="lg:block">
              {/* Description Block */}
              <div className={`pt-6 border-t border-border-default flex flex-col ${activeTabMobile !== 'about' ? 'hidden lg:flex' : 'flex'}`}>
                <div
                  id="descContent"
                  className={`text-sm text-text-secondary leading-relaxed transition-all ${
                    !isDescExpanded ? 'line-clamp-3' : ''
                  }`}
                >
                  {renderDescription(currentVideo?.description || '')}
                </div>

                <div className="mt-2.5">
                  <button
                    type="button"
                    onClick={() => setIsDescExpanded(!isDescExpanded)}
                    className="text-accent hover:underline text-xs font-semibold focus:outline-none transition-colors"
                  >
                    {isDescExpanded ? 'Show less' : 'Show more'}
                  </button>
                </div>
              </div>

              {/* Notes Workspace Block */}
              <div className={`${activeTabMobile !== 'notes' ? 'hidden lg:block' : 'block'}`}>
                {currentVideo && (
                  <NotesSection
                    courseId={course.id}
                    videoId={currentVideo.videoId}
                    currentPlayTimeSec={currentTimeSec}
                    onSeek={handleSeek}
                  />
                )}
              </div>

              {/* Mobile Videos Tab Content */}
              <div className={`lg:hidden mt-4 ${activeTabMobile === 'videos' ? 'block' : 'hidden'}`}>
                <PlaylistSidebar
                  videos={videos}
                  progress={progress}
                  notes={notes}
                  currentVideoId={currentVideoId}
                  autoplayNext={autoplayNext}
                  onSelectVideo={(vid) => setCurrentVideoId(vid)}
                  onToggleComplete={handleToggleComplete}
                  onToggleAutoplay={() => {
                    const nextVal = !autoplayNext;
                    setAutoplayNext(nextVal);
                    storage.saveSettings({ ...storage.getSettings(), autoplayNext: nextVal });
                  }}
                  totalDurationFormatted={course.totalDurationFormatted || formatDurationText(metrics.totalDurationSec)}
                  watchedDurationFormatted={formatDurationText(metrics.watchedDurationSec)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Anchored Playlist Sidebar (Desktop column) */}
        <div className="hidden lg:block">
          <PlaylistSidebar
            videos={videos}
            progress={progress}
            notes={notes}
            currentVideoId={currentVideoId}
            autoplayNext={autoplayNext}
            onSelectVideo={(vid) => setCurrentVideoId(vid)}
            onToggleComplete={handleToggleComplete}
            onToggleAutoplay={() => {
              const nextVal = !autoplayNext;
              setAutoplayNext(nextVal);
              storage.saveSettings({ ...storage.getSettings(), autoplayNext: nextVal });
            }}
            totalDurationFormatted={course.totalDurationFormatted || formatDurationText(metrics.totalDurationSec)}
            watchedDurationFormatted={formatDurationText(metrics.watchedDurationSec)}
          />
        </div>
      </div>

      {/* Course Completion Celebration Modal */}
      <CourseCompleteModal
        course={course}
        isOpen={isCourseCompleteModalOpen}
        onClose={() => setIsCourseCompleteModalOpen(false)}
        onBackToDashboard={() => {
          setIsCourseCompleteModalOpen(false);
          onNavigate('dashboard');
        }}
        onRewatch={handleRewatch}
      />
    </main>
  );
};
