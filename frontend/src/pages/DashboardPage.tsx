import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Course, FavoriteVideo, NavigateFn } from '../types';
import { storage } from '../services/storage';
import { CourseCard } from '../components/CourseCard';
import { ContinueLearningBanner } from '../components/ContinueLearningBanner';
import { fetchPlaylist, ApiError, getYouTubeSource } from '../services/api';
import { getCourseSourceKey } from '../utils/course';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { clampPercent, type CourseMetrics } from '../utils/progress';

/** Days without an export before the dashboard asks for one again. */
const BACKUP_REMINDER_DAYS = 14;

/** Fallback for the impossible "listed course with no metrics" case. */
const EMPTY_METRICS: CourseMetrics = {
  totalVideos: 0,
  completedVideos: 0,
  completionPercent: 0,
  totalDurationSec: 0,
  watchedDurationSec: 0,
  isCompleted: false,
  lastVideoId: ''
};

interface DashboardPageProps {
  onNavigate: NavigateFn;
  onOpenResetConfirm: (course: Course) => void;
  onOpenRemoveConfirm: (course: Course) => void;
  onShowToast: (msg: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  onOpenResetConfirm,
  onOpenRemoveConfirm,
  onShowToast
}) => {
  const [courses, setCourses] = useState<Course[]>(storage.getCourses());
  const [profile, setProfile] = useState(storage.getProfile());
  const [sortOption, setSortOption] = useState<'recently_watched' | 'recently_added' | 'progress' | 'title'>('recently_watched');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [recentNotes, setRecentNotes] = useState(storage.getRecentNotes(3));
  const [stats, setStats] = useState(storage.getLearningStats());
  const [favorites, setFavorites] = useState<FavoriteVideo[]>(storage.getFavorites());
  const [isFavoritesExpanded, setIsFavoritesExpanded] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() => storage.getLastBackupAt());
  const [isBackupReminderDismissed, setIsBackupReminderDismissed] = useState(false);

  // Quick Add Course Form in Dashboard
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickUrl, setQuickUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const quickAddAbortRef = useRef<AbortController | null>(null);
  const quickAddSubmittingRef = useRef(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Focus Timer / Goal
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState<number>(
    storage.getSettings().dailyFocusGoalMinutes || 60
  );
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [tempGoalMinutes, setTempGoalMinutes] = useState(dailyGoalMinutes);

  const quickAddDialogRef = useFocusTrap<HTMLDivElement>(isQuickAddOpen);
  const goalDialogRef = useFocusTrap<HTMLDivElement>(isGoalModalOpen);

  const loadData = useCallback(() => {
    setCourses(storage.getCourses());
    setProfile(storage.getProfile());
    setRecentNotes(storage.getRecentNotes(3));
    setStats(storage.getLearningStats());
    setFavorites(storage.getFavorites());
    setLastBackupAt(storage.getLastBackupAt());
  }, []);

  useEffect(() => {
    loadData();
    const unsub = storage.subscribe(loadData);
    return unsub;
  }, [loadData]);

  // Dismiss the sort menu on Escape or an outside click.
  useEffect(() => {
    if (!isSortMenuOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSortMenuOpen(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setIsSortMenuOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [isSortMenuOpen]);

  /** Close the quick-add dialog and abandon any fetch behind it. */
  const closeQuickAdd = useCallback(() => {
    quickAddAbortRef.current?.abort();
    quickAddAbortRef.current = null;
    quickAddSubmittingRef.current = false;
    setIsAdding(false);
    setIsQuickAddOpen(false);
  }, []);

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quickAddSubmittingRef.current) return;
    const val = quickUrl.trim();
    if (!val) return;
    const source = getYouTubeSource(val);
    if (!source) {
      setAddError('Enter a valid YouTube playlist or video URL.');
      return;
    }
    const duplicate = storage.getCourses().find(course => getCourseSourceKey(course) === `${source.type}:${source.id}` || course.id === source.id || course.id === `video_${source.id}`);
    if (duplicate) {
      setAddError('This source is already in your courses.');
      return;
    }

    quickAddSubmittingRef.current = true;
    setIsAdding(true);
    setAddError(null);
    const controller = new AbortController();
    quickAddAbortRef.current = controller;

    try {
      const { course, videos } = await fetchPlaylist(val, controller.signal);
      if (!storage.addCourseWithVideos(course, videos)) {
        throw new ApiError(
          'STORAGE_FULL',
          'This browser is out of storage space for the course. Remove a course or clear data, then try again.'
        );
      }
      onShowToast(`Course "${course.title}" added successfully!`);
      setQuickUrl('');
      setIsQuickAddOpen(false);
      onNavigate('player', course.id);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'CANCELLED') return;
      if (err instanceof ApiError) {
        setAddError(err.message);
      } else {
        setAddError(err instanceof Error && err.message
          ? err.message
          : "Couldn't reach YouTube. Check the link and try again.");
      }
    } finally {
      quickAddAbortRef.current = null;
      quickAddSubmittingRef.current = false;
      setIsAdding(false);
    }
  };

  const handleCancelQuickAdd = () => {
    quickAddAbortRef.current?.abort();
    quickAddAbortRef.current = null;
    quickAddSubmittingRef.current = false;
    setIsAdding(false);
    setAddError(null);
  };

  useEffect(() => () => quickAddAbortRef.current?.abort(), []);

  const handleSaveGoal = () => {
    setDailyGoalMinutes(tempGoalMinutes);
    storage.saveSettings({ ...storage.getSettings(), dailyFocusGoalMinutes: tempGoalMinutes });
    setIsGoalModalOpen(false);
    onShowToast(`Daily focus goal set to ${tempGoalMinutes} minutes.`);
  };

  /**
   * Completion metrics for every course, read once per data change.
   *
   * These used to be recomputed inside the sort comparator and the "continue
   * learning" lookup, which meant up to n*log(n) complete localStorage reads
   * (each one a JSON.parse of the whole lesson list) on every render.
   */
  const metricsByCourseId = useMemo(() => {
    const map = new Map<string, CourseMetrics>();
    for (const course of courses) {
      map.set(course.id, storage.getCourseMetrics(course.id));
    }
    return map;
  }, [courses]);

  /**
   * Title of the lesson each card should offer as "continue where you left
   * off". Resolved here, alongside the metrics, so CourseCard stays free of
   * localStorage reads.
   */
  const resumeTitleByCourseId = useMemo(() => {
    const map = new Map<string, string>();
    for (const course of courses) {
      const videos = storage.getCourseVideos(course.id);
      const lastVideoId = metricsByCourseId.get(course.id)?.lastVideoId;
      const match = videos.find(v => v.videoId === lastVideoId) || videos[0];
      map.set(course.id, match?.title || '');
    }
    return map;
  }, [courses, metricsByCourseId]);

  const continueCourse = useMemo(() => {
    const byRecency = [...courses].sort((a, b) =>
      new Date(b.lastOpenedAt || b.addedAt).getTime() - new Date(a.lastOpenedAt || a.addedAt).getTime()
    );
    return byRecency.find(course => !metricsByCourseId.get(course.id)?.isCompleted);
  }, [courses, metricsByCourseId]);

  // Sort courses
  const sortedCourses = useMemo(() => [...courses].sort((a, b) => {
    if (sortOption === 'recently_watched') {
      const timeA = new Date(a.lastOpenedAt || a.addedAt).getTime();
      const timeB = new Date(b.lastOpenedAt || b.addedAt).getTime();
      return timeB - timeA;
    }
    if (sortOption === 'recently_added') {
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    }
    if (sortOption === 'progress') {
      const pA = metricsByCourseId.get(a.id)?.completionPercent ?? 0;
      const pB = metricsByCourseId.get(b.id)?.completionPercent ?? 0;
      return pB - pA;
    }
    if (sortOption === 'title') {
      return a.title.localeCompare(b.title);
    }
    return 0;
  }), [courses, sortOption, metricsByCourseId]);

  const handleOpenCourse = (courseId: string, videoId?: string) => {
    onNavigate('player', courseId, videoId);
  };

  const getSortLabel = () => {
    switch (sortOption) {
      case 'recently_watched': return 'Recently watched';
      case 'recently_added': return 'Recently added';
      case 'progress': return 'Progress';
      case 'title': return 'Title';
    }
  };

  const goalProgressPercent = clampPercent((stats.dailyMinutesStudied / (dailyGoalMinutes || 60)) * 100);

  // Escape closes either overlay; the backdrop does too.
  useEffect(() => {
    if (!isQuickAddOpen && !isGoalModalOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (isQuickAddOpen) closeQuickAdd();
      else setIsGoalModalOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isQuickAddOpen, isGoalModalOpen, closeQuickAdd]);

  /**
   * Everything lives in this browser, so a cleared profile or a new device means
   * the library is gone. Show a reminder rather than relying on memory.
   */
  const backupReminder = useMemo(() => {
    if (courses.length === 0 || isBackupReminderDismissed) return null;
    if (!lastBackupAt) {
      return 'You have not exported a backup yet. Your courses, progress and notes only exist in this browser.';
    }
    const ageDays = (Date.now() - Date.parse(lastBackupAt)) / 86_400_000;
    if (ageDays < BACKUP_REMINDER_DAYS) return null;
    const lastBackupDate = new Date(lastBackupAt).toLocaleDateString();
    return `Your last backup was exported on ${lastBackupDate}. Exporting again keeps it current.`;
  }, [courses.length, isBackupReminderDismissed, lastBackupAt]);

  return (
    <main className="w-full pt-14 bg-bg-canvas min-h-screen" data-testid="dashboard">
      <div className="w-full max-w-[1240px] mx-auto px-4 md:px-6 lg:px-8 pb-16">
        {/* 1. Page Header */}
        <header className="pt-10 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col">
            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
              Welcome back{profile.name ? `, ${profile.name}` : ''}
            </h1>
            <p className="text-sm text-text-muted mt-1">
              Pick up right where you paused your study sessions.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setAddError(null);
                setQuickUrl('');
                setIsQuickAddOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-accent text-white font-medium text-sm hover:bg-accent-hover active:bg-accent-pressed transition-colors shadow-sm focus:outline-none"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Add course</span>
            </button>
          </div>
        </header>

        {/* Backup reminder: this app has no server copy of the user's library */}
        {backupReminder && (
          <div
            role="status"
            className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-text-primary animate-fadeIn"
          >
            <span className="material-symbols-outlined text-[20px] text-amber-500" aria-hidden="true">backup</span>
            <p className="flex-1 min-w-[220px] leading-relaxed">{backupReminder}</p>
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="h-8 px-3 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              How to back up
            </button>
            <button
              type="button"
              onClick={() => setIsBackupReminderDismissed(true)}
              aria-label="Dismiss backup reminder"
              className="text-text-muted hover:text-text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
            </button>
          </div>
        )}

        {/* Add Course Modal (Centered with Backdrop Blur) */}
        {isQuickAddOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeQuickAdd();
            }}
          >
            <div
              ref={quickAddDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="quick-add-title"
              tabIndex={-1}
              className="w-full max-w-lg bg-bg-surface dark:bg-[#0F172A] rounded-2xl border border-border-default dark:border-slate-800 p-6 sm:p-7 shadow-2xl animate-scaleUp"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-accent-subtle dark:bg-blue-950/60 text-accent flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">add_link</span>
                  </div>
                  <div>
                    <h3 id="quick-add-title" className="font-bold text-text-primary text-base">Add New Course</h3>
                    <p className="text-xs text-text-muted mt-0.5">Turn any YouTube playlist or video into a course</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeQuickAdd}
                  aria-label="Close add course dialog"
                  className="text-text-muted hover:text-text-primary p-1.5 rounded-lg hover:bg-bg-hover transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <form onSubmit={handleQuickAddSubmit} aria-label="Add a YouTube course from the dashboard" className="flex flex-col gap-4 mt-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="quick-course-url" className="text-xs font-semibold text-text-secondary">
                    YouTube URL
                  </label>
                  <input
                    data-testid="quick-playlist-url-input"
                    id="quick-course-url"
                    type="url"
                    value={quickUrl}
                    onChange={(e) => {
                      setQuickUrl(e.target.value);
                      if (addError) setAddError(null);
                    }}
                    disabled={isAdding}
                    autoFocus
                    placeholder="https://www.youtube.com/playlist?list=... or video link"
                    className="w-full h-11 px-3.5 bg-bg-canvas border border-border-default dark:border-slate-800 rounded-xl text-sm text-text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all placeholder:text-text-muted font-medium"
                  />
                </div>

                {addError && (
                  <div role="alert" aria-live="assertive" className="text-error text-xs flex items-center gap-1.5 font-medium animate-fadeIn bg-error/10 p-2.5 rounded-lg border border-error/20">
                    <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
                    <span>{addError}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => isAdding ? handleCancelQuickAdd() : setIsQuickAddOpen(false)}
                    className="h-10 px-4 rounded-xl border border-border-default dark:border-slate-800 text-text-primary text-xs font-semibold hover:bg-bg-hover transition-colors"
                  >
                    {isAdding ? 'Cancel fetch' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={isAdding || !quickUrl.trim()}
                    className="h-10 px-5 rounded-xl bg-accent text-white font-medium text-xs hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    {isAdding ? (
                      <>
                        <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                        <span>Adding...</span>
                      </>
                    ) : (
                      <>
                        <span>Create Course</span>
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {courses.length === 0 ? (
          /* Empty State Pattern */
          <div className="w-full max-w-md mx-auto py-24 flex flex-col items-center text-center animate-fadeIn">
            <div className="w-20 h-20 rounded-full border border-border-default flex items-center justify-center text-text-muted mb-5 bg-bg-surface">
              <span className="material-symbols-outlined text-[40px]">library_books</span>
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-2">
              No courses yet
            </h2>
            <p className="text-sm text-text-secondary mb-6 max-w-sm leading-relaxed">
              Paste a YouTube playlist or single video link to create your interactive course with auto progress and timestamped notes.
            </p>
            <button
              type="button"
              onClick={() => setIsQuickAddOpen(true)}
              className="h-11 px-5 rounded-xl bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors flex items-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Add your first course</span>
            </button>
          </div>
        ) : (
          <>
            {/* 2. Continue Learning Banner */}
            {continueCourse && (
              <ContinueLearningBanner
                course={continueCourse}
                onResume={(cId, vId) => handleOpenCourse(cId, vId)}
              />
            )}

            {/* 3. Your Courses Section with Increased Font Size */}
            <section className="mt-12">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-baseline gap-2.5">
                  <h2 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
                    Your courses
                  </h2>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent-subtle text-accent">
                    {courses.length} enrolled
                  </span>
                </div>

                {/* Sort Dropdown */}
                <div className="relative" ref={sortMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                    aria-expanded={isSortMenuOpen}
                    aria-haspopup="menu"
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-bg-surface text-text-primary text-xs font-medium hover:bg-bg-hover transition-colors shadow-xs border border-border-default focus:outline-none"
                  >
                    <span className="text-text-muted">Sort:</span>
                    <span>{getSortLabel()}</span>
                    <span className="material-symbols-outlined text-[16px] text-text-secondary" aria-hidden="true">expand_more</span>
                  </button>

                  {isSortMenuOpen && (
                    <div role="menu" aria-label="Sort courses" className="absolute right-0 mt-2 w-48 bg-bg-elevated rounded-lg shadow-xl border border-border-default p-1 text-sm z-30 animate-fadeIn">
                      {(['recently_watched', 'recently_added', 'progress', 'title'] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          role="menuitemradio"
                          aria-checked={sortOption === opt}
                          onClick={() => {
                            setSortOption(opt);
                            setIsSortMenuOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded text-xs flex items-center justify-between ${
                            sortOption === opt ? 'bg-accent-subtle text-accent font-medium' : 'hover:bg-bg-hover text-text-primary'
                          }`}
                        >
                          <span>{opt === 'recently_watched' ? 'Recently watched' : opt === 'recently_added' ? 'Recently added' : opt === 'progress' ? 'Progress' : 'Title'}</span>
                          {sortOption === opt && (
                            <span className="material-symbols-outlined text-[16px]">check</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Course Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {sortedCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    metrics={metricsByCourseId.get(course.id) ?? EMPTY_METRICS}
                    lastVideoTitle={resumeTitleByCourseId.get(course.id) ?? ''}
                    onOpen={handleOpenCourse}
                    onResetProgress={onOpenResetConfirm}
                    onRemoveCourse={onOpenRemoveConfirm}
                  />
                ))}

                {/* Add Course Tile (Dashed) */}
                <button
                  type="button"
                  onClick={() => setIsQuickAddOpen(true)}
                  className="group relative flex flex-col items-center justify-center min-h-[300px] h-full rounded-xl border border-dashed border-border-strong hover:border-accent bg-bg-surface/50 hover:bg-bg-surface transition-all p-6 text-center focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <div className="w-12 h-12 rounded-full bg-bg-surface group-hover:bg-accent group-hover:text-white text-accent shadow-sm flex items-center justify-center mb-3 transition-colors border border-border-default">
                    <span className="material-symbols-outlined text-[24px]">add</span>
                  </div>
                  <span className="text-[15px] font-semibold text-text-primary group-hover:text-accent transition-colors">
                    Add course
                  </span>
                  <span className="text-xs text-text-muted mt-1 max-w-[180px]">
                    Paste a playlist link or YouTube video URL to begin
                  </span>
                </button>
              </div>
            </section>

            {/* 4. Favorites Expandable List Section */}
            {favorites.length > 0 && (
              <section className="mt-12 bg-bg-surface rounded-2xl p-6 border border-border-default shadow-xs">
                  <button type="button" aria-expanded={isFavoritesExpanded} aria-controls="favorites-list" onClick={() => setIsFavoritesExpanded(!isFavoritesExpanded)} className="w-full flex items-center justify-between mb-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-amber-500 text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">star</span>
                    <h2 className="text-lg font-bold text-text-primary">
                      Favorited Lessons ({favorites.length})
                    </h2>
                  </div>
                  {/* A <span>, not a nested <button>: the browser hoists a nested
                      button out of its parent, which broke the whole header. */}
                  <span className="text-text-muted hover:text-text-primary flex items-center gap-1 text-xs font-medium">
                    <span>{isFavoritesExpanded ? 'Collapse' : 'Expand'}</span>
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                      {isFavoritesExpanded ? 'expand_less' : 'expand_more'}
                    </span>
                  </span>
                </button>

                {isFavoritesExpanded && (
                  <div id="favorites-list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2 animate-fadeIn">
                    {favorites.map((fav) => (
                      <button
                        type="button"
                        key={fav.videoId}
                        onClick={() => onNavigate('player', fav.courseId, fav.videoId)}
                        className="w-full text-left flex items-center gap-3 p-3 rounded-xl bg-bg-canvas hover:bg-bg-hover transition-colors border border-border-default/70 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <div className="w-16 h-10 rounded-md overflow-hidden bg-black shrink-0 relative">
                          <img src={fav.thumbnailUrl} alt={fav.title} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold text-text-primary truncate group-hover:text-accent transition-colors">
                            {fav.title}
                          </span>
                          <span className="text-[11px] text-text-muted block truncate mt-0.5">
                            {fav.courseTitle} • {fav.durationFormatted}
                          </span>
                        </div>
                        <span className="material-symbols-outlined text-[18px] text-text-muted group-hover:text-accent shrink-0">
                          play_circle
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* 5. Activity & Analytics Section (2 Columns: 8/12 and 4/12) */}
            <section className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Recent Notes (8/12) */}
              <div className="lg:col-span-8 bg-bg-surface rounded-2xl p-6 shadow-xs border border-border-default dark:border-slate-800">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-accent text-[22px]">edit_note</span>
                    <h2 className="text-lg font-bold text-text-primary">
                      Recent notes
                    </h2>
                  </div>
                  <span className="text-xs text-text-muted font-medium">
                    Synced automatically
                  </span>
                </div>

                {recentNotes.length === 0 ? (
                  <div className="p-8 text-center text-text-muted text-sm border border-dashed border-border-default dark:border-slate-800 rounded-xl">
                    Notes you write while watching lessons appear here automatically.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3.5">
                    {recentNotes.map((note, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => onNavigate('player', note.courseId, note.videoId)}
                        className="w-full text-left p-4 rounded-xl bg-bg-canvas hover:bg-bg-hover transition-colors border border-border-default/60 dark:border-slate-800/80 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <p className="text-sm text-text-primary leading-relaxed">
                          “{note.text}”
                        </p>
                        <div className="mt-2.5 flex items-center gap-2 text-xs text-text-secondary">
                          <span className="material-symbols-outlined text-[14px] text-accent">bookmark</span>
                          <span className="font-medium group-hover:text-accent transition-colors">{note.courseTitle}, lesson {note.videoPosition}</span>
                          <span className="text-border-strong dark:text-slate-700">•</span>
                          <span className="text-text-muted">
                            {new Date(note.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Fully Dynamic Learning Stats & Daily Focus Goals */}
              <div className="lg:col-span-4 bg-bg-surface rounded-2xl p-6 shadow-xs border border-border-default dark:border-slate-800 flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-500 text-[22px]">insights</span>
                    <h2 className="text-lg font-bold text-text-primary">
                      Study Analytics
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTempGoalMinutes(dailyGoalMinutes);
                      setIsGoalModalOpen(true);
                    }}
                    className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
                  >
                    <span>Goal: {dailyGoalMinutes}m</span>
                    <span className="material-symbols-outlined text-[14px]">edit</span>
                  </button>
                </div>

                {/* 2x2 Metrics Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col p-3.5 rounded-xl bg-bg-canvas hover:bg-bg-hover transition-colors border border-border-default/60">
                    <div className="flex items-center justify-between text-text-muted mb-1.5">
                      <span className="material-symbols-outlined text-[18px]">timelapse</span>
                      <span className="text-xs text-emerald-500 font-semibold">{stats.hoursWatched}h total</span>
                    </div>
                    <span className="text-xl font-bold text-text-primary tabular-nums">
                      {stats.hoursWatched}h
                    </span>
                    <span className="text-xs text-text-muted mt-0.5">hours watched</span>
                  </div>

                  <div className="flex flex-col p-3.5 rounded-xl bg-bg-canvas hover:bg-bg-hover transition-colors border border-border-default/60">
                    <div className="flex items-center justify-between text-text-muted mb-1.5">
                      <span className="material-symbols-outlined text-[18px]">smart_display</span>
                      <span className="text-xs text-blue-500 font-semibold">{stats.videosCompleted} done</span>
                    </div>
                    <span className="text-xl font-bold text-text-primary tabular-nums">
                      {stats.videosCompleted}
                    </span>
                    <span className="text-xs text-text-muted mt-0.5">lessons completed</span>
                  </div>

                  <div className="flex flex-col p-3.5 rounded-xl bg-bg-canvas hover:bg-bg-hover transition-colors border border-border-default/60">
                    <div className="flex items-center justify-between text-text-muted mb-1.5">
                      <span className="material-symbols-outlined text-[18px]">workspace_premium</span>
                      <span className="text-xs text-text-muted">All courses</span>
                    </div>
                    <span className="text-xl font-bold text-text-primary tabular-nums">
                      {stats.coursesCompleted}
                    </span>
                    <span className="text-xs text-text-muted mt-0.5">courses completed</span>
                  </div>

                  <div className="flex flex-col p-3.5 rounded-xl bg-bg-canvas hover:bg-bg-hover transition-colors border border-border-default/60">
                    <div className="flex items-center justify-between text-text-muted mb-1.5">
                      <span className="material-symbols-outlined text-[18px] text-amber-500">local_fire_department</span>
                      <span className="text-xs text-amber-600 font-semibold">Streak</span>
                    </div>
                    <span className="text-xl font-bold text-text-primary tabular-nums">
                      {stats.dayStreak}
                    </span>
                    <span className="text-xs text-text-muted mt-0.5">day streak</span>
                  </div>
                </div>

                {/* Daily Goal Focus Bar */}
                <div className="p-3.5 rounded-xl bg-bg-canvas border border-border-default/60 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-text-secondary flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-accent">alarm</span>
                      Daily Focus Goal
                    </span>
                    <span className="text-text-primary font-semibold">
                      {stats.dailyMinutesStudied} / {dailyGoalMinutes} min ({goalProgressPercent}%)
                    </span>
                  </div>
                  <div role="progressbar" aria-label="Daily focus goal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={goalProgressPercent} aria-valuetext={`${stats.dailyMinutesStudied} of ${dailyGoalMinutes} minutes`} className="w-full h-2 bg-border-default rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${goalProgressPercent >= 100 ? 'bg-emerald-500' : 'bg-accent'}`}
                      style={{ width: `${goalProgressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Dynamic Weekly Momentum Bar Chart */}
                <div className="p-3.5 rounded-xl bg-bg-canvas border border-border-default/60 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between text-xs text-text-secondary">
                    <span className="font-medium">Weekly Study Hours</span>
                    <span className="font-semibold text-text-primary">{stats.avgHoursPerDay} hrs/day avg</span>
                  </div>

                  {/* Dynamic Bars for Mon-Sun */}
                  <div className="h-20 flex items-end justify-between gap-2 pt-2 px-1">
                    {stats.weeklyHours.map((d, i) => {
                      const maxH = 3.5;
                      const barH = Math.min(100, Math.round((d.hours / maxH) * 100));
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                          <div className="w-full bg-border-default/60 rounded-t-md h-full flex items-end overflow-hidden">
                            <div
                              className="w-full bg-accent hover:bg-accent-hover transition-all rounded-t-md"
                              style={{ height: `${Math.max(barH, d.hours > 0 ? 15 : 6)}%` }}
                              title={`${d.day}: ${d.hours} hours`}
                            />
                          </div>
                          <span className="text-[10px] text-text-muted font-medium">{d.day}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {/* Daily Focus Goal Modal */}
        {isGoalModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setIsGoalModalOpen(false);
            }}
          >
            <div
              ref={goalDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="goal-modal-title"
              tabIndex={-1}
              className="w-full max-w-sm bg-bg-elevated rounded-2xl border border-border-default p-6 shadow-2xl animate-scaleUp"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 id="goal-modal-title" className="text-base font-bold text-text-primary">Set Daily Focus Goal</h3>
                <button
                  type="button"
                  onClick={() => setIsGoalModalOpen(false)}
                  aria-label="Close daily focus goal dialog"
                  className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-bg-hover transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              <p className="text-xs text-text-secondary mb-4 leading-relaxed">
                Choose how many minutes you want to dedicate to watching and learning each day.
              </p>
              <div className="flex items-center gap-3 mb-6">
                <label htmlFor="daily-goal-input" className="sr-only">Minutes per day</label>
                <input
                  id="daily-goal-input"
                  type="number"
                  inputMode="numeric"
                  min={15}
                  max={480}
                  step={15}
                  value={tempGoalMinutes}
                  onChange={(e) => {
                    const parsed = Number.parseInt(e.target.value, 10);
                    setTempGoalMinutes(Number.isNaN(parsed) ? 15 : Math.min(480, Math.max(15, parsed)));
                  }}
                  className="w-24 h-11 px-3 bg-bg-canvas border border-border-default rounded-xl font-bold text-center text-text-primary focus:outline-none focus:border-accent"
                />
                <span className="text-sm font-semibold text-text-primary">Minutes per day</span>
              </div>
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsGoalModalOpen(false)}
                  className="h-10 px-4 rounded-xl border border-border-default text-text-primary text-xs font-semibold hover:bg-bg-hover"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveGoal}
                  className="h-10 px-4 rounded-xl bg-accent text-white text-xs font-semibold hover:bg-accent-hover shadow-sm"
                >
                  Save Goal
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
