import React, { useState, useEffect } from 'react';
import { Course, SortOption, RecentNoteItem, LearningStats } from '../types';
import { storage } from '../services/storage';
import { CourseCard } from '../components/CourseCard';
import { ContinueLearningBanner } from '../components/ContinueLearningBanner';

interface DashboardPageProps {
  onNavigate: (view: 'home' | 'dashboard' | 'player', courseId?: string) => void;
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
  const [sortOption, setSortOption] = useState<SortOption>('recently_watched');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [recentNotes, setRecentNotes] = useState<RecentNoteItem[]>([]);
  const [stats, setStats] = useState<LearningStats>(storage.getLearningStats());

  const loadData = () => {
    setCourses(storage.getCourses());
    setProfile(storage.getProfile());
    setRecentNotes(storage.getRecentNotes(3));
    setStats(storage.getLearningStats());
  };

  useEffect(() => {
    loadData();
    const unsub = storage.subscribe(loadData);
    return unsub;
  }, []);

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

  // Pick continue learning course: the most recently opened course that has videos
  const continueCourse = sortedCourses.find(c => {
    const metrics = storage.getCourseMetrics(c.id);
    return !metrics.isCompleted || c.id === 'PL_OS_FUNDAMENTALS';
  }) || sortedCourses[0];

  const handleOpenCourse = (courseId: string, videoId?: string) => {
    onNavigate('player', courseId);
  };

  const getSortLabel = () => {
    switch (sortOption) {
      case 'recently_watched': return 'Recently watched';
      case 'recently_added': return 'Recently added';
      case 'progress': return 'Progress';
      case 'title': return 'Title';
    }
  };

  return (
    <main className="w-full pt-14 bg-bg-canvas min-h-screen">
      <div className="w-full max-w-[1240px] mx-auto px-4 md:px-6 lg:px-8 pb-16">
        {/* 1. Page Header */}
        <header className="pt-12 flex flex-row items-baseline justify-between gap-space-lg">
          <div className="flex flex-col">
            <h1 className="font-display-md text-display-md text-text-primary tracking-tight">
              Welcome back{profile.name ? `, ${profile.name}` : ''}
            </h1>
            <p className="font-body-sm text-body-sm text-text-muted mt-1">
              Pick up right where you paused your study sessions.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="inline-flex items-center justify-center gap-space-xs h-10 px-4 rounded-lg bg-accent text-white font-body-sm-medium text-body-sm-medium hover:bg-accent-hover active:bg-accent-pressed transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Add course</span>
          </button>
        </header>

        {courses.length === 0 ? (
          /* Empty State Pattern matching design.md Section 7 */
          <div className="w-full max-w-md mx-auto py-24 flex flex-col items-center text-center animate-fadeIn">
            <div className="w-24 h-24 rounded-full border border-border-default flex items-center justify-center text-text-muted mb-6 bg-bg-surface">
              <span className="material-symbols-outlined text-[48px]">library_books</span>
            </div>
            <h2 className="font-heading text-heading text-text-primary mb-2">
              No courses yet
            </h2>
            <p className="font-body text-body text-text-secondary mb-6 max-w-sm">
              Paste a YouTube playlist link and it becomes a course with progress, notes, and a resume point.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="h-12 px-6 rounded-lg bg-accent text-white font-body-sm-medium hover:bg-accent-hover transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
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

            {/* 3. Your Courses Section */}
            <section className="mt-12">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-baseline gap-2">
                  <h2 className="font-heading text-heading text-text-primary">
                    Your courses
                  </h2>
                  <span className="font-caption text-caption text-text-muted">
                    {courses.length} enrolled
                  </span>
                </div>

                {/* Sort Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-bg-surface text-text-primary font-body-sm text-body-sm hover:bg-bg-hover transition-colors shadow-xs border border-border-default focus:outline-none"
                  >
                    <span className="text-text-muted font-caption">Sort:</span>
                    <span className="font-body-sm-medium">{getSortLabel()}</span>
                    <span className="material-symbols-outlined text-[18px] text-text-secondary">expand_more</span>
                  </button>

                  {isSortMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-bg-elevated rounded-lg shadow-xl border border-border-default p-1 text-sm z-30 animate-fadeIn">
                      {(['recently_watched', 'recently_added', 'progress', 'title'] as SortOption[]).map((opt) => (
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
                  onClick={() => onNavigate('home')}
                  className="group relative flex flex-col items-center justify-center min-h-[300px] h-full rounded-xl border border-dashed border-border-strong hover:border-accent bg-surface-container-low/60 hover:bg-bg-surface transition-all p-6 text-center focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <div className="w-12 h-12 rounded-full bg-bg-surface group-hover:bg-accent group-hover:text-white text-accent shadow-sm flex items-center justify-center mb-3 transition-colors">
                    <span className="material-symbols-outlined text-[24px]">add</span>
                  </div>
                  <span className="font-card-title text-card-title text-text-primary group-hover:text-accent transition-colors font-medium">
                    Add course
                  </span>
                  <span className="font-caption text-caption text-text-muted mt-1 max-w-[180px]">
                    Paste a playlist link or YouTube course URL to begin
                  </span>
                </button>
              </div>
            </section>

            {/* 4. Activity Section (2 Columns: 8/12 and 4/12) */}
            <section className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Recent Notes (8/12) */}
              <div className="lg:col-span-8 bg-bg-surface rounded-xl p-6 shadow-sm border border-border-default">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-accent text-[22px]">edit_note</span>
                    <h2 className="font-heading text-heading text-text-primary">
                      Recent notes
                    </h2>
                  </div>
                  <span className="font-caption text-caption text-text-muted">
                    Synced automatically
                  </span>
                </div>

                {/* Notes list */}
                {recentNotes.length === 0 ? (
                  <div className="p-8 text-center text-text-muted text-sm">
                    Notes you write while watching appear here.
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {recentNotes.map((note, idx) => (
                      <article
                        key={idx}
                        onClick={() => onNavigate('player', note.courseId)}
                        className="p-3.5 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer"
                      >
                        <p className="font-body text-body text-text-primary leading-relaxed">
                          “{note.text}”
                        </p>
                        <div className="mt-2.5 flex items-center gap-2 font-caption text-caption text-text-secondary">
                          <span className="material-symbols-outlined text-[14px] text-accent">bookmark</span>
                          <span>{note.courseTitle}, video {note.videoPosition}</span>
                          <span className="text-outline-variant">•</span>
                          <span className="text-text-muted">
                            {new Date(note.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Learning Stats (4/12) */}
              <div className="lg:col-span-4 bg-bg-surface rounded-xl p-6 shadow-sm border border-border-default">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-success text-[22px]">insights</span>
                    <h2 className="font-heading text-heading text-text-primary">
                      Learning stats
                    </h2>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-surface-container text-text-muted font-caption text-caption">
                    This month
                  </span>
                </div>

                {/* 2x2 Clean Metrics Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col p-4 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors">
                    <div className="flex items-center justify-between text-text-muted mb-2">
                      <span className="material-symbols-outlined text-[18px]">timelapse</span>
                      <span className="font-caption text-caption text-success font-medium">+14h</span>
                    </div>
                    <span className="font-stat text-stat text-text-primary tabular-nums">
                      {stats.hoursWatched}h
                    </span>
                    <span className="font-caption text-caption text-text-secondary mt-1">hours watched</span>
                  </div>

                  <div className="flex flex-col p-4 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors">
                    <div className="flex items-center justify-between text-text-muted mb-2">
                      <span className="material-symbols-outlined text-[18px]">smart_display</span>
                      <span className="font-caption text-caption text-success font-medium">+12</span>
                    </div>
                    <span className="font-stat text-stat text-text-primary tabular-nums">
                      {stats.videosCompleted}
                    </span>
                    <span className="font-caption text-caption text-text-secondary mt-1">videos completed</span>
                  </div>

                  <div className="flex flex-col p-4 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors">
                    <div className="flex items-center justify-between text-text-muted mb-2">
                      <span className="material-symbols-outlined text-[18px]">workspace_premium</span>
                      <span className="font-caption text-caption text-text-muted">Target: 3</span>
                    </div>
                    <span className="font-stat text-stat text-text-primary tabular-nums">
                      {stats.coursesCompleted}
                    </span>
                    <span className="font-caption text-caption text-text-secondary mt-1">courses completed</span>
                  </div>

                  <div className="flex flex-col p-4 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors">
                    <div className="flex items-center justify-between text-text-muted mb-2">
                      <span className="material-symbols-outlined text-[18px] text-amber-500">local_fire_department</span>
                      <span className="font-caption text-caption text-amber-600 font-medium">Personal best</span>
                    </div>
                    <span className="font-stat text-stat text-text-primary tabular-nums">
                      {stats.dayStreak}
                    </span>
                    <span className="font-caption text-caption text-text-secondary mt-1">day streak</span>
                  </div>
                </div>

                {/* Inline Visual Momentum Chart (SVG under 2KB) */}
                <div className="mt-5 p-3.5 rounded-lg bg-surface-container-low flex flex-col gap-2">
                  <div className="flex items-center justify-between font-caption text-caption text-text-secondary">
                    <span>Daily focus momentum</span>
                    <span className="font-caption-medium text-text-primary">{stats.avgHoursPerDay} hrs/day avg</span>
                  </div>
                  <svg className="w-full h-8 text-accent" preserveAspectRatio="none" viewBox="0 0 200 32">
                    <path
                      d="M0,28 L30,22 L60,26 L90,12 L120,18 L150,6 L180,10 L200,4"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                    />
                    <path
                      d="M0,28 L30,22 L60,26 L90,12 L120,18 L150,6 L180,10 L200,4 L200,32 L0,32 Z"
                      fill="currentColor"
                      fillOpacity="0.1"
                    />
                  </svg>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
};
