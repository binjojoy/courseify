import React, { useState, useRef } from 'react';
import { fetchPlaylist, ApiError } from '../services/api';
import { storage } from '../services/storage';

interface HomePageProps {
  onNavigate: (view: 'home' | 'dashboard' | 'player', courseId?: string) => void;
  onShowToast: (msg: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate, onShowToast }) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null);
  const [fetchProgress, setFetchProgress] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = url.trim();
    if (!val) {
      setErrorMessage("Please enter a YouTube playlist or video link.");
      return;
    }

    setErrorMessage(null);
    setDuplicateMessage(null);
    setIsLoading(true);
    setFetchProgress("Connecting to YouTube…");

    // Check if duplicate course already exists
    const existingCourses = storage.getCourses();
    const matchExisting = existingCourses.find(c => val.includes(c.id));

    if (matchExisting) {
      setDuplicateMessage("This playlist is already in your courses. Opening it now.");
      setIsLoading(false);
      setTimeout(() => {
        onNavigate('player', matchExisting.id);
      }, 1200);
      return;
    }

    try {
      setFetchProgress("Fetching playlist metadata and lessons…");
      const { course, videos } = await fetchPlaylist(val);

      // Save course and its videos
      storage.addOrUpdateCourse(course);
      storage.saveCourseVideos(course.id, videos);

      onShowToast(`Course "${course.title}" added successfully!`);
      // Navigate immediately to Player View at video 1 (or last watched)
      onNavigate('player', course.id);
    } catch (err: any) {
      setIsLoading(false);
      setFetchProgress(null);
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(err.message || "Couldn't reach YouTube. Check your connection and try again.");
      }
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
        setErrorMessage(null);
      }
    } catch {
      onShowToast('Could not read clipboard. Please paste directly.');
    }
  };

  const handleCancelFetch = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setIsLoading(false);
    setFetchProgress(null);
  };

  return (
    <main className="w-full pt-14 bg-bg-canvas min-h-screen text-text-primary selection:bg-accent-subtle selection:text-accent relative overflow-x-hidden">
      <div className="relative min-h-[calc(100vh-3.5rem)] w-full flex flex-col justify-between overflow-hidden">
        {/* Soft Ambient Background Glow */}
        <div className="absolute inset-0 pointer-events-none select-none z-0">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[540px] bg-gradient-to-tr from-blue-100/60 via-indigo-100/40 to-sky-100/30 dark:from-blue-950/20 dark:via-indigo-950/20 dark:to-transparent rounded-full blur-[110px] opacity-75"></div>
          <div
            className="absolute inset-0 opacity-40 dark:opacity-10"
            style={{
              backgroundImage: 'radial-gradient(rgba(148,163,184,0.25) 1px, transparent 1px)',
              backgroundSize: '28px 28px'
            }}
          ></div>
        </div>

        {/* Hero Section */}
        <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-12 flex flex-col items-center text-center">
          {/* Heading - Google Sans, Arial (no serif) */}
          <h1 className="text-4xl sm:text-5xl lg:text-[52px] font-bold text-text-primary tracking-tight leading-[1.15] max-w-2xl mb-4">
            Turn any YouTube playlist into an interactive course
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-text-secondary max-w-2xl font-normal leading-relaxed mb-8">
            Turn scattered YouTube playlists into distraction-free, structured courses with automatic progress tracking, timestamped markdown notes, and instant resumption.
          </p>

          {/* Form */}
          <div className="w-full max-w-2xl mb-4">
            <form
              id="playlist-form"
              onSubmit={handleSubmit}
              className="w-full relative group shadow-lg shadow-accent/5 rounded-2xl"
            >
              <div
                className={`w-full h-16 bg-bg-surface border ${
                  errorMessage ? 'border-error' : 'border-border-default hover:border-border-strong focus-within:border-accent'
                } rounded-2xl flex items-center px-4 transition-all duration-200`}
              >
                {/* Leading icon */}
                <div className="flex items-center justify-center shrink-0 text-text-muted group-focus-within:text-accent transition-colors pl-1">
                  <span className="material-symbols-outlined text-[22px]">
                    {errorMessage ? 'error' : 'link'}
                  </span>
                </div>

                {/* Input */}
                <input
                  type="url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  disabled={isLoading}
                  autoComplete="off"
                  spellCheck="false"
                  aria-label="YouTube Playlist URL"
                  placeholder="Paste YouTube playlist or video link (e.g. https://www.youtube.com/playlist?list=...)"
                  className="w-full px-3 bg-transparent text-text-primary placeholder:text-text-muted text-[15px] focus:outline-none min-w-0 font-medium"
                />

                {/* Actions inside input */}
                <div className="flex items-center gap-2 shrink-0">
                  {url.length > 0 && !isLoading && (
                    <button
                      type="button"
                      onClick={() => setUrl('')}
                      title="Clear input"
                      className="h-8 w-8 rounded-full text-text-muted hover:text-text-primary hover:bg-bg-hover flex items-center justify-center transition-all"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || !url.trim()}
                    aria-label="Create Course"
                    className="h-11 px-5 rounded-xl bg-accent text-white font-medium text-[14px] flex items-center gap-2 hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-50 disabled:pointer-events-none transition-all focus:outline-none shadow-sm"
                  >
                    <span>{isLoading ? 'Loading...' : 'Create Course'}</span>
                    {isLoading ? (
                      <span className="material-symbols-outlined text-[18px] animate-spin">
                        progress_activity
                      </span>
                    ) : (
                      <span className="material-symbols-outlined text-[18px] transition-transform duration-200 group-hover:translate-x-0.5">
                        arrow_forward
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Duplicate notice */}
              {duplicateMessage && (
                <div className="mt-3 p-3 rounded-lg bg-accent-subtle text-accent text-sm flex items-center gap-2 animate-fadeIn text-left">
                  <span className="material-symbols-outlined text-[18px]">info</span>
                  <span>{duplicateMessage}</span>
                </div>
              )}

              {/* Error message */}
              {errorMessage && (
                <div className="mt-2 px-2 text-error text-[13px] flex items-center gap-1.5 font-medium animate-fadeIn text-left">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Loading progress bar */}
              {isLoading && (
                <div className="mt-4 flex flex-col gap-2 animate-fadeIn text-left">
                  <div className="w-full h-1 bg-border-default rounded-full overflow-hidden">
                    <div className="h-full bg-accent animate-pulse w-3/4"></div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-text-secondary">
                    <span>{fetchProgress || 'Fetching playlist…'}</span>
                    <button
                      type="button"
                      onClick={handleCancelFetch}
                      className="text-accent hover:underline font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </form>

            {/* Utility line */}
            <div className="w-full flex items-center justify-between px-2 pt-3 text-[13px]">
              <span className="text-text-muted font-normal">
                Instant playlist or single video conversion
              </span>
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-bg-surface border border-border-default hover:bg-bg-hover text-text-primary transition-colors font-medium shadow-xs"
              >
                <span className="material-symbols-outlined text-[14px] text-accent">content_paste</span>
                <span>Paste from clipboard</span>
              </button>
            </div>
          </div>

          {/* 3 Feature Cards */}
          <div className="w-full max-w-3xl mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            <div className="p-5 rounded-xl bg-bg-surface border border-border-default shadow-xs hover:shadow-md transition-all">
              <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-accent flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-[20px]">add_link</span>
              </div>
              <h3 className="text-[15px] font-semibold text-text-primary mb-1">
                1. Paste any Playlist or Video
              </h3>
              <p className="text-[13px] text-text-muted leading-relaxed">
                Supports public or unlisted playlists and single videos with one-click conversion into an ordered lesson tree.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-bg-surface border border-border-default shadow-xs hover:shadow-md transition-all">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-[20px]">sync_saved_locally</span>
              </div>
              <h3 className="text-[15px] font-semibold text-text-primary mb-1">
                2. Auto-synced Notes
              </h3>
              <p className="text-[13px] text-text-muted leading-relaxed">
                Take rich markdown notes stamped directly with video timestamps for rapid reference.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-bg-surface border border-border-default shadow-xs hover:shadow-md transition-all">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-[20px]">shield_lock</span>
              </div>
              <h3 className="text-[15px] font-semibold text-text-primary mb-1">
                3. 100% In-Browser Privacy
              </h3>
              <p className="text-[13px] text-text-muted leading-relaxed">
                Stored locally in your browser. Zero user account, no tracking cookies, and works offline.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="w-full pb-6 pt-6 z-10 flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-bg-surface/80 border border-border-default shadow-xs text-text-muted text-[13px] font-medium">
            <span className="material-symbols-outlined text-[16px] text-text-muted">lock</span>
            <span>Courses and notes are kept private in this browser. No account needed.</span>
          </div>
        </footer>
      </div>
    </main>
  );
};
