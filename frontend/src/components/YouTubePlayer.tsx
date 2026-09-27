import React, { useEffect, useRef, useState, useCallback } from 'react';
import { storage } from '../services/storage';
import {
  YTPlayer,
  YTPlayerConstructor,
  YTPlayerEvent,
  YTPlayerState,
  isPermanentPlaybackError,
  loadYouTubeIframeApi
} from '../types/youtube';
import { clampRatio } from '../utils/progress';

interface YouTubePlayerProps {
  videoId: string;
  courseId: string;
  initialPositionSec?: number;
  autoplayNext?: boolean;
  autoCompleteThreshold?: number;
  onEnded?: () => void;
  onNextVideo?: () => void;
  onTimeUpdate?: (currentSec: number, durationSec: number) => void;
  onAutoComplete?: (videoId: string) => void;
}

type PlayerFailure = 'blocked' | 'transient';

/** Resume points are written at most this often while a lesson is playing. */
const PERSIST_INTERVAL_SEC = 5;
/**
 * A gap larger than this between two samples is a seek or a stall rather than
 * continuous playback, so it must not be billed as watch time.
 */
const MAX_SAMPLE_GAP_SEC = 2;
/** Watch time is written to storage once it accumulates to this many seconds. */
const WATCH_TIME_FLUSH_SEC = 3;

/**
 * YouTube's own player draws the video and the control surface.
 *
 * An earlier version hid YouTube's controls (`controls: 0`) and reimplemented
 * them. That did not hold together: YouTube keeps rendering overlays the
 * embed cannot suppress (the centred play button, the watermark, end-screen
 * cards), so two control surfaces were stacked on top of each other and visibly
 * disagreed. Owning the controls also meant owning playback state, which is
 * what produced the reload loop documented on the init effect below. Letting
 * YouTube drive playback leaves this component responsible only for reading
 * progress, which it can do without a scrubber or a play button.
 */
export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoId,
  courseId,
  initialPositionSec = 0,
  autoplayNext = true,
  autoCompleteThreshold = 0.9,
  onEnded,
  onNextVideo,
  onTimeUpdate,
  onAutoComplete
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);

  const [failure, setFailure] = useState<PlayerFailure | null>(null);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  /** Bumped by the retry button to rebuild the embed after a transient error. */
  const [reloadToken, setReloadToken] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoCompleteTriggeredRef = useRef(false);
  const isPlayingRef = useRef(false);
  const lastSampleTimeRef = useRef<number | null>(null);
  const lastPersistedAtRef = useRef(0);
  const pendingWatchTimeRef = useRef(0);
  /** The resume point for the current video, sampled once at creation time. */
  const resumeAtRef = useRef(0);

  // Latest-callback refs so the long-lived polling interval never captures stale
  // props, which previously made the interval restart on every render.
  const callbacksRef = useRef({ onEnded, onNextVideo, onTimeUpdate, onAutoComplete, autoplayNext, autoCompleteThreshold });
  callbacksRef.current = { onEnded, onNextVideo, onTimeUpdate, onAutoComplete, autoplayNext, autoCompleteThreshold };

  const flushWatchTime = useCallback(() => {
    if (pendingWatchTimeRef.current > 0) {
      storage.recordWatchTime(pendingWatchTimeRef.current);
      pendingWatchTimeRef.current = 0;
    }
  }, []);

  // Sample the resume point once per lesson, ahead of the init effect.
  //
  // `initialPositionSec` is not an input to playback: it is the value this
  // component writes to storage as the lesson runs, and PlayerPage feeds the
  // stored value straight back in as a prop. Treating it as a dependency of the
  // effect that owns the embed therefore destroyed and rebuilt the iframe — with
  // `autoplay: 1` — on every pause and every five seconds of playback, which is
  // exactly why pausing bounced straight back to playing and why the video kept
  // visibly reloading. Reading it here means a position update can no longer
  // reach the effect that controls the embed's lifetime.
  //
  // `initialPositionSec` is intentionally absent from the dependency list: it is
  // sampled once per lesson rather than tracked.
  useEffect(() => {
    resumeAtRef.current = initialPositionSec > 0 && Number.isFinite(initialPositionSec) ? initialPositionSec : 0;
  }, [courseId, videoId]);

  // Save position when the tab goes away, so a closed tab still resumes.
  useEffect(() => {
    const saveCurrentPosition = () => {
      const player = playerRef.current;
      if (!player) return;
      try {
        const time = player.getCurrentTime();
        if (time > 0) storage.saveVideoPosition(courseId, videoId, time);
      } catch {
        // The iframe can be torn down before unload; nothing to persist.
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveCurrentPosition();
        flushWatchTime();
      }
    };
    window.addEventListener('beforeunload', saveCurrentPosition);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', saveCurrentPosition);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      saveCurrentPosition();
      flushWatchTime();
    };
  }, [courseId, videoId, flushWatchTime]);

  // Timestamp links in the description and notes seek the lesson.
  useEffect(() => {
    const handleSeekRequest = (event: Event) => {
      const seconds = (event as CustomEvent<number>).detail;
      const player = playerRef.current;
      if (!Number.isFinite(seconds) || !player) return;
      try {
        player.seekTo(Math.max(0, seconds), true);
      } catch {
        // Seeking before the player is ready is a no-op, not a failure.
      }
    };
    window.addEventListener('courseify:seek-player', handleSeekRequest);
    return () => window.removeEventListener('courseify:seek-player', handleSeekRequest);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => {});
    } else {
      void wrapper.requestFullscreen?.().catch(() => {});
    }
  }, []);

  // The command palette's "Toggle fullscreen" entry.
  useEffect(() => {
    const handle = () => toggleFullscreen();
    document.addEventListener('courseify:toggle-fullscreen', handle);
    return () => document.removeEventListener('courseify:toggle-fullscreen', handle);
  }, [toggleFullscreen]);

  // Create the embed. Runs once per lesson.
  useEffect(() => {
    let isMounted = true;
    const resumeAt = resumeAtRef.current;

    setFailure(null);
    setLoadMessage(null);
    setIsReady(false);
    autoCompleteTriggeredRef.current = false;
    isPlayingRef.current = false;
    lastSampleTimeRef.current = null;
    lastPersistedAtRef.current = resumeAt;
    pendingWatchTimeRef.current = 0;

    const markTransient = (message: string) => {
      if (!isMounted) return;
      setIsReady(false);
      setLoadMessage(message);
      setFailure('transient');
    };

    const createPlayer = (Player: YTPlayerConstructor) => {
      const container = containerRef.current;
      if (!container || !isMounted) return;

      try {
        playerRef.current = new Player(container, {
          videoId,
          playerVars: {
            autoplay: 1,
            start: Math.floor(resumeAt),
            controls: 1,
            // 3 keeps the YouTube badge off the video until the pointer moves,
            // which is the one part of the embed we can legitimately quieten.
            iv_load_policy: 3,
            fs: 1,
            rel: 0,
            disablekb: 0,
            playsinline: 1,
            cc_load_policy: 0,
            enablejsapi: 1,
            widget_referrer: window.location.origin,
            origin: window.location.origin
          },
          events: {
            onReady: (event: YTPlayerEvent) => {
              if (!isMounted) return;
              try {
                event.target.getIframe?.()?.setAttribute('title', 'Course lesson video');
              } catch {
                // The iframe title is an a11y nicety, not a requirement.
              }
              setIsReady(true);
              if (resumeAt > 0) {
                try {
                  // `start` normally lands on the resume point already; only
                  // correct a real gap so a redundant seek cannot flash a frame.
                  const landed = event.target.getCurrentTime();
                  if (!Number.isFinite(landed) || Math.abs(landed - resumeAt) > 1) {
                    event.target.seekTo(resumeAt, true);
                  }
                } catch {
                  // Seeking can be refused before metadata arrives.
                }
              }
            },
            onStateChange: (event: YTPlayerEvent) => {
              if (!isMounted) return;
              const state = event.data as YTPlayerState | undefined;
              if (state === YTPlayerState.PLAYING) {
                isPlayingRef.current = true;
                setIsReady(true);
                try {
                  lastSampleTimeRef.current = event.target.getCurrentTime();
                } catch {
                  lastSampleTimeRef.current = null;
                }
              } else if (state === YTPlayerState.PAUSED) {
                isPlayingRef.current = false;
                lastSampleTimeRef.current = null;
                try {
                  // Write the resume point, but do not let that write re-enter
                  // the effect that owns this embed: `initialPositionSec` is
                  // sampled once per lesson precisely so it cannot.
                  storage.saveVideoPosition(courseId, videoId, event.target.getCurrentTime());
                } catch { /* player torn down */ }
                flushWatchTime();
              } else if (state === YTPlayerState.ENDED) {
                isPlayingRef.current = false;
                lastSampleTimeRef.current = null;
                try {
                  storage.saveVideoPosition(courseId, videoId, event.target.getDuration());
                } catch { /* player torn down */ }
                flushWatchTime();
                const current = callbacksRef.current;
                current.onAutoComplete?.(videoId);
                current.onEnded?.();
                if (current.autoplayNext) current.onNextVideo?.();
              }
              // BUFFERING is deliberately ignored: YouTube draws its own
              // spinner, and covering the embed with ours is what used to
              // flash a skeleton over the controls on every rebuffer.
            },
            onError: (event: YTPlayerEvent) => {
              const code = typeof event.data === 'number' ? event.data : Number(event.data);
              if (!isMounted) return;
              isPlayingRef.current = false;

              if (isPermanentPlaybackError(code)) {
                // Permanently unplayable: remember it so the sidebar stops
                // offering a dead play button on the next visit.
                storage.markVideoUnavailable(courseId, videoId);
                setIsReady(false);
                setFailure('blocked');
                return;
              }
              // Codes 2/5 and the network errors are usually transient. Showing
              // them as "unavailable" would wrongly disable a working lesson.
              markTransient('This video would not start playing. Check your connection, then try again.');
            }
          }
        });
      } catch (err) {
        console.error('Failed to instantiate YT.Player:', err);
        markTransient('The YouTube player could not be started in this browser.');
      }
    };

    loadYouTubeIframeApi()
      .then(api => {
        if (!isMounted || !containerRef.current) return;
        createPlayer(api.Player);
      })
      .catch((err: unknown) => {
        markTransient(err instanceof Error ? err.message : 'The YouTube player could not be loaded.');
      });

    // Read-only progress tracking. The embed is never driven from here.
    intervalRef.current = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      try {
        const cur = player.getCurrentTime();
        const dur = player.getDuration();
        if (!Number.isFinite(cur) || !Number.isFinite(dur) || dur <= 0) return;

        const current = callbacksRef.current;
        current.onTimeUpdate?.(cur, dur);

        if (
          current.onAutoComplete
          && !autoCompleteTriggeredRef.current
          && clampRatio(cur / dur) >= clampRatio(current.autoCompleteThreshold)
        ) {
          autoCompleteTriggeredRef.current = true;
          current.onAutoComplete(videoId);
        }

        if (isPlayingRef.current) {
          const previous = lastSampleTimeRef.current;
          if (previous !== null) {
            const delta = cur - previous;
            if (delta > 0 && delta <= MAX_SAMPLE_GAP_SEC) {
              pendingWatchTimeRef.current += delta;
              if (pendingWatchTimeRef.current >= WATCH_TIME_FLUSH_SEC) flushWatchTime();
            }
          }
          lastSampleTimeRef.current = cur;

          if (cur - lastPersistedAtRef.current >= PERSIST_INTERVAL_SEC) {
            storage.saveVideoPosition(courseId, videoId, cur);
            lastPersistedAtRef.current = cur;
          }
        }
      } catch {
        // A destroyed player throws on every call; the next tick is a no-op.
      }
    }, 1000);

    return () => {
      isMounted = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      const player = playerRef.current;
      playerRef.current = null;
      if (player) {
        try {
          player.destroy();
        } catch {
          // Already destroyed by the iframe teardown.
        }
      }
    };
  }, [videoId, courseId, reloadToken, flushWatchTime]);

  // Keyboard shortcuts for when focus is outside the embed. Keys pressed inside
  // the iframe never reach this listener, so YouTube keeps handling its own.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable || target?.closest('button, a, [role="tab"], [role="checkbox"], [role="option"], [role="slider"], [role="dialog"], iframe')) return;
      if (failure) return;

      const player = playerRef.current;
      if (!player) return;

      const nudgeVolume = (delta: number) => {
        try {
          const next = Math.max(0, Math.min(100, player.getVolume() + delta));
          player.setVolume(next);
          if (next > 0 && player.isMuted()) player.unMute();
        } catch {
          // A refused volume change on a partially initialised embed.
        }
      };

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          try {
            // `isPlayingRef` is driven by the player's own state-change events,
            // so it is the same source of truth the progress tick uses. Asking
            // the embed instead would be a second, cross-frame answer that can
            // disagree with the one already tracked.
            if (isPlayingRef.current) player.pauseVideo();
            else player.playVideo();
          } catch { /* play() refused while the embed initialises */ }
          break;
        case 'ArrowLeft':
        case 'j':
          e.preventDefault();
          try { player.seekTo(Math.max(0, player.getCurrentTime() - 10), true); } catch { /* pre-ready */ }
          break;
        case 'ArrowRight':
        case 'l':
          e.preventDefault();
          try { player.seekTo(Math.min(player.getDuration(), player.getCurrentTime() + 10), true); } catch { /* pre-ready */ }
          break;
        case 'ArrowUp':
          e.preventDefault();
          nudgeVolume(5);
          break;
        case 'ArrowDown':
          e.preventDefault();
          nudgeVolume(-5);
          break;
        case 'm':
          e.preventDefault();
          try { if (player.isMuted()) player.unMute(); else player.mute(); } catch { /* pre-ready */ }
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [failure, toggleFullscreen]);

  return (
    <div
      ref={wrapperRef}
      data-testid="video-player"
      className="relative w-full aspect-video overflow-hidden bg-player-black"
    >
      {failure ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-player-black text-white p-6 text-center z-10" role="alert">
          <span className="material-symbols-outlined text-[44px] mb-3" aria-hidden="true">
            {failure === 'blocked' ? 'warning' : 'cloud_off'}
          </span>
          <h3 className="text-lg font-semibold mb-2 font-heading">
            {failure === 'blocked' ? "This video can't be played here" : 'Playback could not start'}
          </h3>
          <p className="text-sm text-white/70 max-w-[420px] mb-6 leading-relaxed">
            {failure === 'blocked'
              ? 'The owner may have disabled embedding, or the video is private or deleted. It has been marked unavailable in this course.'
              : loadMessage}
          </p>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            {failure === 'transient' && (
              <button
                onClick={() => setReloadToken(n => n + 1)}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-accent text-on-accent hover:bg-accent-hover transition-colors text-sm font-medium"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">refresh</span>
                <span>Try again</span>
              </button>
            )}
            <a
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-white/40 text-white hover:bg-white/10 transition-colors text-sm font-medium"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">open_in_new</span>
              <span>Open on YouTube</span>
            </a>
            {failure === 'transient' && onNextVideo && (
              <button
                onClick={onNextVideo}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-bg-surface text-text-primary border border-border-default hover:bg-bg-hover transition-colors text-sm font-medium"
                type="button"
              >
                <span>Skip to next video</span>
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">skip_next</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {!isReady && (
            <div className="absolute inset-0 z-10 bg-player-black p-4" role="status" aria-label="Loading video player">
              <div className="skeleton-block h-full w-full rounded-lg bg-white/5" />
            </div>
          )}
          {/* The IFrame API replaces this node with the YouTube iframe. */}
          <div ref={containerRef} className="h-full w-full" />
        </>
      )}
    </div>
  );
};
