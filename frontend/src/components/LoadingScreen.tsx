import React, { useEffect, useState } from 'react';

/**
 * The app-shell skeleton.
 *
 * This is the static twin of the boot shell in index.html: same fixed bar, same
 * video-and-sidebar grid, same status line. The shell cannot use Tailwind classes
 * (it has to paint before the stylesheet arrives), so the two are kept in step by
 * eye and by the shared copy below. If one changes, change both.
 *
 * It is deliberately a skeleton of the real layout rather than a spinner: the
 * player page is the app's densest screen, so matching its shape means the
 * hand-off reads as content arriving instead of a different page replacing a
 * placeholder.
 */

/** How long before we admit the wait is unusual and explain it. */
const SLOW_BOOT_MS = 2500;

export const LoadingScreen: React.FC = () => {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    // Reading the library is synchronous but not free: a large course means
    // parsing a few hundred video records. On a slow device that can outlast the
    // usual boot, and a motionless skeleton with no explanation is the thing
    // users report as "stuck".
    const timer = window.setTimeout(() => setIsSlow(true), SLOW_BOOT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-bg-canvas text-text-primary" role="status" aria-live="polite" aria-label="Loading Courseify">
      {/* Mirrors Navbar: fixed, 3.5rem tall, surface background, bottom border. */}
      <div className="fixed inset-x-0 top-0 z-50 h-14 border-b border-border-default bg-bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1240px] items-center justify-between px-4 md:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-accent text-white"
              aria-hidden="true"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" focusable="false">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </span>
            <span className="truncate text-sm font-semibold tracking-tight text-text-primary">Courseify</span>
          </div>
          <div className="flex items-center gap-2" aria-hidden="true">
            <div className="skeleton-block h-9 w-9 rounded-lg" />
            <div className="skeleton-block h-9 w-9 rounded-lg" />
            <div className="skeleton-block h-9 w-9 rounded-full" />
          </div>
        </div>
      </div>

      <div className="boot-progress" aria-hidden="true"><span /></div>

      <main className="mx-auto w-full max-w-[1240px] px-4 pb-12 pt-[calc(3.5rem+1.5rem)] md:px-6 lg:px-8 lg:pt-[calc(3.5rem+2.5rem)]">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            {/* 16:9, matching the player frame's aspect ratio. */}
            <div className="skeleton-block aspect-video w-full rounded-xl" />
            <div className="mt-5 space-y-3">
              <div className="skeleton-block h-7 w-3/4 rounded" />
              <div className="skeleton-block h-4 w-1/2 rounded" />
              <div className="skeleton-block h-24 w-full rounded-xl" />
            </div>
          </div>
          {/* The playlist sidebar only exists on wide viewports, so the skeleton
              for it should not either. */}
          <div className="hidden space-y-3 lg:block">
            <div className="skeleton-block h-24 w-full rounded-xl" />
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="skeleton-block h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-[34rem] text-center">
          <p className="text-[15px] font-semibold text-text-primary">Loading your library</p>
          {/* Both lines are additive rather than swapped, so the first explanation is
              never thrown away once the wait turns out to be long. */}
          <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">
            Reading your courses, progress and notes from this browser.
          </p>
          {isSlow && (
            <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">
              Still starting up &mdash; a large library takes a moment to read. Nothing is
              being uploaded, so it is safe to wait.
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export const IngestionSkeleton: React.FC = () => (
  <div className="mt-6 grid w-full gap-3 sm:grid-cols-3" aria-label="Building course skeleton" role="status">
    {Array.from({ length: 3 }, (_, index) => (
      <div key={index} className="rounded-xl border border-border-default bg-bg-surface p-4">
        <div className="skeleton-block mb-4 aspect-video w-full rounded-lg" />
        <div className="skeleton-block mb-2 h-4 w-4/5 rounded" />
        <div className="skeleton-block h-3 w-1/2 rounded" />
      </div>
    ))}
  </div>
);
