import React, { useState, useEffect } from 'react';
import { Course, FavoriteVideo } from '../types';
import { storage } from '../services/storage';
import { CourseCard } from '../components/CourseCard';
import { ContinueLearningBanner } from '../components/ContinueLearningBanner';
import { fetchPlaylist, ApiError } from '../services/api';

interface DashboardPageProps {
  onNavigate: (view: 'home' | 'dashboard' | 'player', courseId?: string, videoId?: string) => void;
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

  // Quick Add Course Form in Dashboard
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickUrl, setQuickUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Focus Timer / Goal
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState<number>(
    storage.getSettings().dailyFocusGoalMinutes || 60
  );
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [tempGoalMinutes, setTempGoalMinutes] = useState(dailyGoalMinutes);

  const loadData = () => {
    setCourses(storage.getCourses());
    setProfile(storage.getProfile());
    setRecentNotes(storage.getRecentNotes(3));
    setStats(storage.getLearningStats());
    setFavorites(storage.getFavorites());
  };

  useEffect(() => {
    loadData();
    const unsub = storage.subscribe(loadData);
    return unsub;
  }, []);

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = quickUrl.trim();
    if (!val) return;

    setIsAdding(true);
    setAddError(null);

    try {
      const { course, videos } = await fetchPlaylist(val);
      storage.addOrUpdateCourse(course);
      storage.saveCourseVideos(course.id, videos);
      onShowToast(`Course "${course.title}" added successfully!`);
      setQuickUrl('');
      setIsQuickAddOpen(false);
      onNavigate('player', course.id);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setAddError(err.message);
      } else {
        setAddError(err.message || "Couldn't reach YouTube. Check link and try again.");
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleSaveGoal = () => {
    setDailyGoalMinutes(tempGoalMinutes);
    storage.saveSettings({ ...storage.getSettings(), dailyFocusGoalMinutes: tempGoalMinutes });
    setIsGoalModalOpen(false);
    onShowToast(`Daily focus goal set to ${tempGoalMinutes} minutes.`);
  };

  // Sort courses
  const sortedCourses = [...courses].sort((a, b) => {
    if (sortOption === 'recently_watched') {
      const timeA = new Date(a.lastOpenedAt || a.addedAt).getTime();
      const timeB = new Date(b.lastOpenedAt || b.addedAt).getTime();
      return timeB - timeA;
    }
    if (sortOption === 'recently_added') {
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    }
    if (sortOption === 'progress') {
      const pA = storage.getCourseMetrics(a.id).completionPercent;
      const pB = storage.getCourseMetrics(b.id).completionPercent;
      return pB - pA;
    }
    if (sortOption === 'title') {
      return a.title.localeCompare(b.title);
    }
    return 0;
  });

  const continueCourse = sortedCourses.find(c => {
    const metrics = storage.getCourseMetrics(c.id);
    return !metrics.isCompleted;
  }) || sortedCourses[0];

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

  const goalProgressPercent = Math.min(100, Math.round((stats.dailyMinutesStudied / (dailyGoalMinutes || 60)) * 100));

  return (
    <main className="w-full pt-14 bg-bg-canvas min-h-screen">
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
              onClick={() => setIsQuickAddOpen(!isQuickAddOpen)}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-accent text-white font-medium text-sm hover:bg-accent-hover active:bg-accent-pressed transition-colors shadow-sm focus:outline-none"
            >
              <span className="material-symbols-outlined text-[18px]">
                {isQuickAddOpen ? 'close' : 'add'}
              </span>
              <span>{isQuickAddOpen ? 'Close' : 'Add course'}</span>
            </button>
          </div>
        </header>

        {/* Quick Add Course Panel (Expandable directly in dashboard without full redirection) */}
        {isQuickAddOpen && (
          <section className="mb-8 p-5 sm:p-6 rounded-2xl bg-bg-surface border border-accent/30 shadow-lg shadow-accent/5 animate-fadeIn">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-accent text-[20px]">add_link</span>
                <h3 className="font-semibold text-text-primary text-base">Add New Course</h3>
              </div>
              <span className="text-xs text-text-muted">Instant conversion</span>
            </div>

            <form onSubmit={handleQuickAddSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row items-center gap-2.5">
                <input
                  type="url"
                  value={quickUrl}
                  onChange={(e) => {
                    setQuickUrl(e.target.value);
                    if (addError) setAddError(null);
                  }}
                  disabled={isAdding}
                  placeholder="Paste YouTube playlist or video link (e.g. https://www.youtube.com/playlist?list=...)"
                  className="w-full h-11 px-3.5 bg-bg-canvas border border-border-default rounded-xl text-sm text-text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                />
                <button
                  type="submit"
                  disabled={isAdding || !quickUrl.trim()}
                  className="w-full sm:w-auto h-11 px-5 rounded-xl bg-accent text-white font-medium text-sm hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-50 disabled:pointer-events-none transition-all shrink-0 flex items-center justify-center gap-2 shadow-sm"
                >
                  {isAdding ? (
                    <>
                      <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                      <span>Adding...</span>
                    </>
                  ) : (
                    <>
                      <span>Import Course</span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </>
                  )}
                </button>
              </div>

              {addError && (
                <div className="text-error text-xs flex items-center gap-1.5 font-medium animate-fadeIn">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span>{addError}</span>
                </div>
              )}
            </form>
          </section>
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
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-bg-surface text-text-primary text-xs font-medium hover:bg-bg-hover transition-colors shadow-xs border border-border-default focus:outline-none"
                  >
                    <span className="text-text-muted">Sort:</span>
                    <span>{getSortLabel()}</span>
                    <span className="material-symbols-outlined text-[16px] text-text-secondary">expand_more</span>
                  </button>

                  {isSortMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-bg-elevated rounded-lg shadow-xl border border-border-default p-1 text-sm z-30 animate-fadeIn">
                      {(['recently_watched', 'recently_added', 'progress', 'title'] as const).map((opt) => (
                        <button
                          key={opt}
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
                <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setIsFavoritesExpanded(!isFavoritesExpanded)}>
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-amber-500 text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    <h2 className="text-lg font-bold text-text-primary">
                      Favorited Lessons ({favorites.length})
                    </h2>
                  </div>
                  <button type="button" className="text-text-muted hover:text-text-primary flex items-center gap-1 text-xs font-medium">
                    <span>{isFavoritesExpanded ? 'Collapse' : 'Expand'}</span>
                    <span className="material-symbols-outlined text-[18px]">
                      {isFavoritesExpanded ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>
                </div>

                {isFavoritesExpanded && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2 animate-fadeIn">
                    {favorites.map((fav) => (
                      <div
                        key={fav.videoId}
                        onClick={() => onNavigate('player', fav.courseId, fav.videoId)}
                        className="flex items-center gap-3 p-3 rounded-xl bg-bg-canvas hover:bg-bg-hover transition-colors cursor-pointer border border-border-default/70 group"
                      >
                        <div className="w-16 h-10 rounded-md overflow-hidden bg-black shrink-0 relative">
                          <img src={fav.thumbnailUrl} alt={fav.title} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-semibold text-text-primary truncate group-hover:text-accent transition-colors">
                            {fav.title}
                          </h4>
                          <span className="text-[11px] text-text-muted block truncate mt-0.5">
                            {fav.courseTitle} • {fav.durationFormatted}
                          </span>
                        </div>
                        <span className="material-symbols-outlined text-[18px] text-text-muted group-hover:text-accent shrink-0">
                          play_circle
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* 5. Activity & Analytics Section (2 Columns: 8/12 and 4/12) */}
            <section className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Recent Notes (8/12) */}
              <div className="lg:col-span-8 bg-bg-surface rounded-2xl p-6 shadow-xs border border-border-default">
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
                  <div className="p-8 text-center text-text-muted text-sm border border-dashed border-border-default rounded-xl">
                    Notes you write while watching lessons appear here automatically.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3.5">
                    {recentNotes.map((note, idx) => (
                      <article
                        key={idx}
                        onClick={() => onNavigate('player', note.courseId, note.videoId)}
                        className="p-4 rounded-xl bg-bg-canvas hover:bg-bg-hover transition-colors cursor-pointer border border-border-default/60 group"
                      >
                        <p className="text-sm text-text-primary leading-relaxed">
                          “{note.text}”
                        </p>
                        <div className="mt-2.5 flex items-center gap-2 text-xs text-text-secondary">
                          <span className="material-symbols-outlined text-[14px] text-accent">bookmark</span>
                          <span className="font-medium group-hover:text-accent transition-colors">{note.courseTitle}, lesson {note.videoPosition}</span>
                          <span className="text-border-strong">•</span>
                          <span className="text-text-muted">
                            {new Date(note.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Fully Dynamic Learning Stats & Daily Focus Goals */}
              <div className="lg:col-span-4 bg-bg-surface rounded-2xl p-6 shadow-xs border border-border-default flex flex-col gap-5">
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
                      <span className="text-xs text-text-muted">Target: 3</span>
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
                  <div className="w-full h-2 bg-border-default rounded-full overflow-hidden">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
            <div className="w-full max-w-sm bg-bg-elevated rounded-2xl border border-border-default p-6 shadow-2xl animate-scaleUp">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-text-primary">Set Daily Focus Goal</h3>
                <button onClick={() => setIsGoalModalOpen(false)} className="text-text-muted hover:text-text-primary p-1">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              <p className="text-xs text-text-secondary mb-4 leading-relaxed">
                Choose how many minutes you want to dedicate to watching and learning each day.
              </p>
              <div className="flex items-center gap-3 mb-6">
                <input
                  type="number"
                  min="15"
                  max="480"
                  step="15"
                  value={tempGoalMinutes}
                  onChange={(e) => setTempGoalMinutes(Math.max(15, parseInt(e.target.value) || 15))}
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
