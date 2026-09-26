import React, { useState, useEffect, useRef } from 'react';
import { Course, VideoItem, CourseProgress, CourseNotes, FavoriteVideo } from '../types';
import { storage } from '../services/storage';
import { fetchVideoDescription } from '../services/api';
import { getPlayableVideos } from '../utils/course';
import { YouTubePlayer } from '../components/YouTubePlayer';
import { PlaylistSidebar } from '../components/PlaylistSidebar';
import { NotesSection } from '../components/NotesSection';
import { CourseCompleteModal } from '../components/CourseCompleteModal';
import { AISessionNotes } from '../components/AISessionNotes';

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
  const routeVideoIdRef = useRef(initialVideoId);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [autoplayNext, setAutoplayNext] = useState<boolean>(storage.getSettings().autoplayNext);
  const [isCourseCompleteModalOpen, setIsCourseCompleteModalOpen] = useState(false);
  const [activeTabMobile, setActiveTabMobile] = useState<'videos' | 'notes' | 'ai' | 'flashcards'>('videos');
  const [isFav, setIsFav] = useState<boolean>(false);

  const playableVideos = getPlayableVideos(videos);

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
      setCurrentVideoId(p.lastVideoId && v.some(item => item.videoId === p.lastVideoId)
        ? p.lastVideoId
        : getPlayableVideos(v)[0]?.videoId || '');
    }
  };

  useEffect(() => {
    reloadData();
    const unsub = storage.subscribe(reloadData);
    return unsub;
  }, [courseId]);

  useEffect(() => {
    if (initialVideoId === routeVideoIdRef.current) return;
    routeVideoIdRef.current = initialVideoId;
    if (initialVideoId && videos.some(video => video.videoId === initialVideoId && !video.unavailable)) {
      setCurrentVideoId(initialVideoId);
    }
  }, [initialVideoId, videos]);

  // Check and fetch description dynamically if missing
  useEffect(() => {
    if (!currentVideoId) return;
    setIsFav(storage.isFavorite(currentVideoId));

    const current = videos.find(v => v.videoId === currentVideoId);
    if (current && (!current.description || current.description.trim() === '')) {
      const controller = new AbortController();
      fetchVideoDescription(currentVideoId, controller.signal).then(desc => {
        if (!desc || controller.signal.aborted) return;
        setVideos(currentVideos => {
          const updated = currentVideos.map(video => video.videoId === currentVideoId ? { ...video, description: desc } : video);
          storage.saveCourseVideos(courseId, updated);
          return updated;
        });
      }).catch(() => {});
      return () => controller.abort();
    }
  }, [currentVideoId, videos, courseId]);

  const currentVideo = videos.find(v => v.videoId === currentVideoId && !v.unavailable) || playableVideos[0];
  const currentIndex = currentVideo ? videos.findIndex(v => v.videoId === currentVideo.videoId) : -1;
  const playableIndex = currentVideo ? playableVideos.findIndex(v => v.videoId === currentVideo.videoId) : -1;
  const isFirstVideo = playableIndex <= 0;
  const isLastVideo = playableIndex < 0 || playableIndex >= playableVideos.length - 1;

  const activeVideoId = currentVideo?.videoId || '';
  const currentVideoProgress = progress.videos[activeVideoId];
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

  const handleAutoComplete = (videoId: string) => {
    const { courseCompleteTriggered } = storage.setVideoCompleted(courseId, videoId, true);
    setProgress(storage.getCourseProgress(courseId));
    if (courseCompleteTriggered) setIsCourseCompleteModalOpen(true);
  };

  const handleSelectVideo = (videoId: string) => {
    const selected = videos.find(video => video.videoId === videoId && !video.unavailable);
    if (!selected) return;
    setCurrentVideoId(selected.videoId);
    setCurrentTimeSec(storage.getCourseProgress(courseId).videos[videoId]?.positionSec || 0);
    setIsDescExpanded(false);
    storage.touchCourse(courseId);
    window.history.replaceState(null, '', `#/course/${courseId}?v=${selected.videoId}`);
  };

  const handleNextVideo = () => {
    if (!isLastVideo) {
      const nextVid = playableVideos[playableIndex + 1];
      if (nextVid) {
        handleSelectVideo(nextVid.videoId);
      }
    }
  };

  const handlePrevVideo = () => {
    if (!isFirstVideo) {
      const prevVid = playableVideos[playableIndex - 1];
      if (prevVid) {
        handleSelectVideo(prevVid.videoId);
      }
    }
  };

  const handleSeek = (sec: number) => {
    window.dispatchEvent(new CustomEvent('courseify:seek-player', { detail: sec }));
  };

  useEffect(() => {
    const toggleFullscreen = () => {
      const player = document.querySelector('.courseify-player') as HTMLElement | null;
      if (!player) return;
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      else player.requestFullscreen?.().catch(() => {});
    };
    document.addEventListener('courseify:toggle-fullscreen', toggleFullscreen);
    return () => document.removeEventListener('courseify:toggle-fullscreen', toggleFullscreen);
  }, []);

  const handleRewatch = () => {
    storage.resetCourseProgress(courseId);
    setProgress(storage.getCourseProgress(courseId));
    if (playableVideos[0]) {
      handleSelectVideo(playableVideos[0].videoId);
    }
    setIsCourseCompleteModalOpen(false);
    onShowToast('Course progress reset. Enjoy rewatching!');
  };

  const handleToggleFavorite = () => {
    if (!currentVideo || !course) return;
    const favItem: FavoriteVideo = {
      courseId: course.id,
      courseTitle: course.title,
      videoId: currentVideo.videoId,
      title: currentVideo.title,
      durationFormatted: currentVideo.durationFormatted,
      thumbnailUrl: currentVideo.thumbnailUrl,
      addedAt: new Date().toISOString()
    };
    const nowFav = storage.toggleFavorite(favItem);
    setIsFav(nowFav);
    onShowToast(nowFav ? 'Added lesson to Favorites' : 'Removed from Favorites');
  };

  // Convert description text: render clickable links & timestamps
  const renderDescription = (text: string) => {
    if (!text || text.trim() === '') {
      return (
        <div className="py-2 text-text-muted italic text-sm">
          No written description available for this lesson.
        </div>
      );
    }

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const timeRegex = /\b(\d{1,2}:\d{2}(?::\d{2})?)\b/g;

    const urlParts = text.split(urlRegex);

    return urlParts.map((urlPart, i) => {
      if (urlPart.match(urlRegex)) {
        return (
          <a
            key={i}
            href={urlPart}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline font-medium focus:outline-none break-all"
          >
            {urlPart}
          </a>
        );
      }

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
        return <span key={`${i}-${j}`}>{subPart}</span>;
      });
    });
  };

  const metrics = storage.getCourseMetrics(courseId);

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
            warning
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
    <main className="w-full pt-14 bg-bg-canvas min-h-screen text-text-primary selection:bg-accent-subtle selection:text-accent" data-testid="course-player">
      <div className="flex flex-col lg:flex-row w-full h-[calc(100vh-56px)] overflow-hidden bg-bg-canvas text-text-primary">
        {/* Main Column: Player and Content Stage */}
        <div className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden">
          {/* Video Player Viewport Container with Margin & Spacing */}
          <div className="sticky top-0 z-40 w-full bg-bg-canvas lg:static">
          <div className="w-full bg-bg-canvas flex justify-center px-0 py-0 sm:px-4 lg:px-6 lg:py-6">
            <section className="relative w-full max-w-[1280px] aspect-video bg-player-black select-none shrink-0 overflow-hidden">
              <div className="relative w-full h-full overflow-hidden bg-black courseify-player">
                {currentVideo ? (
                  <YouTubePlayer
                    key={`${course.id}:${currentVideo.videoId}`}
                    videoId={currentVideo.videoId}
                    courseId={course.id}
                    initialPositionSec={initialPosition}
                    autoplayNext={autoplayNext}
                    autoCompleteThreshold={storage.getSettings().autoCompleteThreshold}
                    onNextVideo={handleNextVideo}
                    onPrevVideo={handlePrevVideo}
                    onTimeUpdate={(cur) => setCurrentTimeSec(cur)}
                    onAutoComplete={handleAutoComplete}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-muted">
                    No playable video in course
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Mobile Tab Strip (Only on screens < 1024px) */}
          <div className="lg:hidden flex flex-col bg-bg-surface border-b border-border-default">
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
            <div role="tablist" aria-label="Course workspace" className="flex items-center justify-around h-11">
              <button
                type="button"
                onClick={() => setActiveTabMobile('videos')}
                role="tab"
                aria-selected={activeTabMobile === 'videos'}
                className={`flex-1 h-full font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 border-b-2 ${
                  activeTabMobile === 'videos'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <span>Videos</span>
                <span className="text-text-muted font-normal">({playableVideos.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTabMobile('notes')}
                role="tab"
                aria-selected={activeTabMobile === 'notes'}
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
                onClick={() => setActiveTabMobile('ai')}
                aria-selected={activeTabMobile === 'ai'}
                role="tab"
                className={`flex-1 h-full font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 border-b-2 ${activeTabMobile === 'ai' ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
              >
                <span>AI Notes</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTabMobile('flashcards')}
                aria-selected={activeTabMobile === 'flashcards'}
                role="tab"
                className={`flex-1 h-full font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 border-b-2 ${activeTabMobile === 'flashcards' ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
              >
                <span>Flashcards</span>
              </button>
            </div>
          </div>
          </div>

          {/* Desktop Content Stage or Active Mobile Tab Content */}
          <div className="w-full max-w-[824px] mx-auto px-4 sm:px-6 md:px-8 pt-6 pb-16 flex flex-col flex-1">
            {/* Title & Primary Header Row */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight font-title" data-testid="current-lesson-title">
                  {currentVideo?.title}
                </h1>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-text-secondary" data-testid="lesson-progress">
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

              {/* Action Buttons: Prev/Next, Favorite, Complete */}
              <div className="flex items-center gap-2 self-start shrink-0">
                {/* Favorite Star Button */}
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                  className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-colors ${
                    isFav
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                      : 'bg-bg-surface border-border-default text-text-muted hover:text-text-primary hover:bg-bg-hover'
                  }`}
                >
                  <span
                    className="material-symbols-outlined text-[20px]"
                    style={{ fontVariationSettings: isFav ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    star
                  </span>
                </button>

                {/* Prev / Next */}
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

                {/* Mark Complete */}
                <button
                  type="button"
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
              <div className="hidden lg:flex pt-6 border-t border-border-default flex-col">
                <div
                  id="descContent"
                  className={`text-sm text-text-secondary leading-relaxed transition-all whitespace-pre-line ${
                    !isDescExpanded ? 'line-clamp-4' : ''
                  }`}
                >
                  {renderDescription(currentVideo?.description || '')}
                </div>

                {currentVideo?.description && currentVideo.description.length > 150 && (
                  <div className="mt-2.5">
                    <button
                      type="button"
                      onClick={() => setIsDescExpanded(!isDescExpanded)}
                      className="text-accent hover:underline text-xs font-semibold focus:outline-none transition-colors"
                    >
                      {isDescExpanded ? 'Show less' : 'Show more'}
                    </button>
                  </div>
                )}
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

              <div className={`${activeTabMobile !== 'ai' && activeTabMobile !== 'flashcards' ? 'hidden lg:block' : 'block'}`}>
                {currentVideo && <AISessionNotes
                  courseId={course.id}
                  video={currentVideo}
                  onSeek={handleSeek}
                  onOpenKeySettings={() => window.dispatchEvent(new Event('courseify:open-gemini-settings'))}
                  onShowToast={onShowToast}
                  initialTab={activeTabMobile === 'flashcards' ? 'flashcards' : 'summary'}
                />}
              </div>

              {/* Mobile Videos Tab Content */}
              <div className={`lg:hidden mt-4 ${activeTabMobile === 'videos' ? 'block' : 'hidden'}`}>
                <PlaylistSidebar
                  videos={videos}
                  progress={progress}
                  notes={notes}
                  currentVideoId={currentVideoId}
                  autoplayNext={autoplayNext}
                  onSelectVideo={handleSelectVideo}
                  onToggleComplete={handleToggleComplete}
                  onToggleAutoplay={() => {
                    const nextVal = !autoplayNext;
                    setAutoplayNext(nextVal);
                    storage.saveSettings({ ...storage.getSettings(), autoplayNext: nextVal });
                  }}
                  totalDurationFormatted={formatDurationText(metrics.totalDurationSec)}
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
            onSelectVideo={handleSelectVideo}
            onToggleComplete={handleToggleComplete}
            onToggleAutoplay={() => {
              const nextVal = !autoplayNext;
              setAutoplayNext(nextVal);
              storage.saveSettings({ ...storage.getSettings(), autoplayNext: nextVal });
            }}
            totalDurationFormatted={formatDurationText(metrics.totalDurationSec)}
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
