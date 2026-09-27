import React, { useState, useRef, useCallback, useEffect } from 'react';
import { fetchPlaylist, ApiError, getYouTubeSource } from '../services/api';
import { getCourseSourceKey } from '../utils/course';
import { storage } from '../services/storage';
import { IngestionSkeleton } from '../components/LoadingScreen';
import { APP_VERSION } from '../config/app';
import type { NavigateFn } from '../types';

interface HomePageProps {
  onNavigate: NavigateFn;
  onShowToast: (msg: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate, onShowToast }) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null);
  const [fetchProgress, setFetchProgress] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Latches synchronously: `isLoading` is only visible to the next render, so a
  // double Enter could otherwise start two ingests of the same playlist.
  const submittingRef = useRef(false);
  const duplicateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (submittingRef.current) return;

    const val = url.trim();
    if (!val) {
      setErrorMessage("Please enter a YouTube playlist or video link.");
      return;
    }

    setErrorMessage(null);
    setDuplicateMessage(null);

    // Check if duplicate course already exists
    const source = getYouTubeSource(val);
    if (!source) {
      setErrorMessage('Enter a valid YouTube playlist or video URL.');
      return;
    }

    const existingCourses = storage.getCourses();
    const matchExisting = existingCourses.find(c => getCourseSourceKey(c) === `${source.type}:${source.id}` || c.id === source.id || c.id === `video_${source.id}`);

    if (matchExisting) {
      setDuplicateMessage("This playlist is already in your courses. Opening it now.");
      if (duplicateTimerRef.current) clearTimeout(duplicateTimerRef.current);
      duplicateTimerRef.current = setTimeout(() => {
        duplicateTimerRef.current = null;
        onNavigate('player', matchExisting.id);
      }, 1200);
      return;
    }

    submittingRef.current = true;
    setIsLoading(true);
    setFetchProgress("Fetching playlist metadata and lessons…");
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const { course, videos } = await fetchPlaylist(val, controller.signal);

      // Course and lessons land together, or not at all — a failed lesson write
      // must never leave a course card that opens onto an empty player.
      if (!storage.addCourseWithVideos(course, videos)) {
        throw new ApiError(
          'STORAGE_FULL',
          "This browser is out of storage space for the course. Remove a course or clear data, then try again."
        );
      }

      onShowToast(`Course "${course.title}" added successfully!`);
      // Navigate immediately to Player View at video 1 (or last watched)
      onNavigate('player', course.id);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'CANCELLED') return;
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(
          err instanceof Error && err.message
            ? err.message
            : "Couldn't reach YouTube. Check your connection and try again."
        );
      }
    } finally {
      abortControllerRef.current = null;
      submittingRef.current = false;
      setIsLoading(false);
      setFetchProgress(null);
    }
  }, [onNavigate, onShowToast, url]);

  const handleRetry = useCallback(() => {
    if (submittingRef.current) return;
    void handleSubmit();
  }, [handleSubmit]);

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
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    submittingRef.current = false;
    setIsLoading(false);
    setFetchProgress(null);
  };

  // An in-flight fetch that resolves after unmount, or the "already added"
  // redirect, must not fire into a dead component.
  useEffect(() => () => {
    abortControllerRef.current?.abort();
    if (duplicateTimerRef.current) clearTimeout(duplicateTimerRef.current);
  }, []);

  return (
    <main className="w-full pt-14 bg-bg-canvas min-h-screen text-text-primary selection:bg-accent-subtle selection:text-accent relative overflow-x-hidden" data-testid="add-course-page">
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
              aria-label="Add a YouTube course"
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
                  data-testid="playlist-url-input"
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
                    data-testid="import-playlist-button"
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
                <div role="alert" aria-live="assertive" className="mt-2 px-1 text-error text-[13px] flex items-start gap-1.5 font-medium animate-fadeIn text-left">
                  <span className="material-symbols-outlined text-[16px] mt-px">error</span>
                  <span className="flex-1">{errorMessage}</span>
                  {url.trim() && (
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="shrink-0 underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                    >
                      Try again
                    </button>
                  )}
                </div>
              )}

              {/* Loading progress bar */}
              {isLoading && (
                <div className="mt-4 flex flex-col gap-2 animate-fadeIn text-left">
                  <div className="skeleton-block h-2 w-full rounded-full" />
                  <div className="flex items-center justify-between text-xs text-text-secondary" role="status" aria-live="polite">
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

            {isLoading && <IngestionSkeleton />}

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
        <footer className="w-full pb-8 pt-6 z-10 flex flex-col items-center gap-3">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-bg-surface/80 border border-border-default shadow-xs text-text-muted text-[13px] font-medium">
            <span className="material-symbols-outlined text-[16px] text-text-muted">lock</span>
            <span>Courses and notes are kept private in this browser. No account needed.</span>
          </div>

          <div className="flex items-center gap-4 text-xs text-text-muted">
            <button
              type="button"
              onClick={() => onNavigate('privacy')}
              className="hover:text-accent transition-colors hover:underline"
            >
              Privacy Policy
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => onNavigate('terms')}
              className="hover:text-accent transition-colors hover:underline"
            >
              Terms of Service
            </button>
          </div>
          <span className="text-[11px] font-medium tracking-wide text-text-muted">Courseify {APP_VERSION}</span>
        </footer>
      </div>
    </main>
  );
};
