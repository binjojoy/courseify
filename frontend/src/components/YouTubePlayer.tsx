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
import { clampRatio, formatClock } from '../utils/progress';

interface YouTubePlayerProps {
  videoId: string;
  courseId: string;
  initialPositionSec?: number;
  autoplayNext?: boolean;
  autoCompleteThreshold?: number;
  onEnded?: () => void;
  onNextVideo?: () => void;
  onPrevVideo?: () => void;
  onTimeUpdate?: (currentSec: number, durationSec: number) => void;
  onAutoComplete?: (videoId: string) => void;
}

type PlayerFailure = 'blocked' | 'transient';

const qualityLabels: Record<string, string> = {
  highres: '4K',
  hd2160: '2160p',
  hd1440: '1440p',
  hd1080: '1080p',
  hd720: '720p',
  large: '480p',
  medium: '360p',
  small: '240p',
  tiny: '144p',
  auto: 'Auto',
  default: 'Auto'
};

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoId,
  courseId,
  initialPositionSec = 0,
  autoplayNext = true,
  autoCompleteThreshold = 0.9,
  onEnded,
  onNextVideo,
  onPrevVideo,
  onTimeUpdate,
  onAutoComplete
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);

  const [failure, setFailure] = useState<PlayerFailure | null>(null);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialPositionSec || 0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [ccEnabled, setCcEnabled] = useState(false);
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const [currentQuality, setCurrentQuality] = useState('auto');
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPercent, setHoverPercent] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideControlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTimeRef = useRef<number>(initialPositionSec);
  const autoCompleteTriggeredRef = useRef(false);
  const isPlayingRef = useRef(false);
  const lastSampleTimeRef = useRef<number | null>(null);
  const lastPersistedAtRef = useRef(0);
  const pendingWatchTimeRef = useRef(0);
  const qualitiesLoadedRef = useRef(false);

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

  // Save position on window unload
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

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  useEffect(() => {
    const handleSeekRequest = (event: Event) => {
      const seconds = (event as CustomEvent<number>).detail;
      const player = playerRef.current;
      if (!Number.isFinite(seconds) || !player) return;
      try {
        const target = Math.max(0, seconds);
        player.seekTo(target, true);
        setCurrentTime(target);
      } catch {
        // Seeking before the player is ready is a no-op, not a failure.
      }
    };
    window.addEventListener('courseify:seek-player', handleSeekRequest);
    return () => window.removeEventListener('courseify:seek-player', handleSeekRequest);
  }, []);

  // Initialize or update YouTube Player
  useEffect(() => {
    let isMounted = true;
    setFailure(null);
    setLoadMessage(null);
    setIsLoading(true);
    setCurrentTime(initialPositionSec || 0);
    setDuration(0);
    setBufferedPercent(0);
    setCcEnabled(false);
    setCurrentQuality('auto');
    setAvailableQualities([]);
    qualitiesLoadedRef.current = false;
    autoCompleteTriggeredRef.current = false;
    lastPersistedAtRef.current = initialPositionSec || 0;
    lastSampleTimeRef.current = null;
    isPlayingRef.current = false;

    const readQualities = (player: YTPlayer) => {
      if (qualitiesLoadedRef.current) return;
      try {
        const qualities = player.getAvailableQualityLevels?.() ?? [];
        if (qualities.length > 0) {
          qualitiesLoadedRef.current = true;
          setAvailableQualities(qualities);
          setCurrentQuality(player.getPlaybackQuality?.() || 'auto');
        }
      } catch {
        // Quality discovery is optional; the settings menu simply stays empty.
      }
    };

    const createPlayer = (Player: YTPlayerConstructor) => {
      const container = containerRef.current;
      if (!container || !isMounted) return;

      try {
        playerRef.current = new Player(container, {
          videoId,
          playerVars: {
            autoplay: 1,
            start: Math.floor(initialPositionSec || 0),
            modestbranding: 1,
            rel: 0,
            controls: 0,
            disablekb: 0,
            iv_load_policy: 3,
            fs: 0,
            cc_load_policy: 0,
            enablejsapi: 1,
            playsinline: 1,
            widget_referrer: window.location.origin,
            origin: window.location.origin
          },
          events: {
            onReady: (event: YTPlayerEvent) => {
              if (!isMounted) return;
              try {
                event.target.getIframe?.()?.setAttribute('title', 'YouTube video player');
              } catch {
                // The iframe title is an a11y nicety, not a requirement.
              }
              setIsLoading(false);
              if (initialPositionSec > 0) {
                try {
                  event.target.seekTo(initialPositionSec, true);
                } catch {
                  // Seeking can be refused before metadata arrives.
                }
              }
              try {
                event.target.setPlaybackQuality?.('default');
                event.target.unloadModule?.('captions');
                const dur = event.target.getDuration();
                if (dur > 0) setDuration(dur);
                const vol = event.target.getVolume();
                if (Number.isFinite(vol)) setVolume(vol);
                setIsMuted(event.target.isMuted());
                readQualities(event.target);
              } catch {
                // A partially initialised player still plays.
              }
            },
            onStateChange: (event: YTPlayerEvent) => {
              if (!isMounted) return;
              const state = event.data as YTPlayerState | undefined;
              if (state === YTPlayerState.PLAYING) {
                setIsPlaying(true);
                isPlayingRef.current = true;
                setIsLoading(false);
                try {
                  lastSampleTimeRef.current = event.target.getCurrentTime();
                  readQualities(event.target);
                } catch {
                  lastSampleTimeRef.current = null;
                }
              } else if (state === YTPlayerState.PAUSED) {
                setIsPlaying(false);
                isPlayingRef.current = false;
                lastSampleTimeRef.current = null;
                try {
                  storage.saveVideoPosition(courseId, videoId, event.target.getCurrentTime());
                } catch { /* player torn down */ }
                flushWatchTime();
              } else if (state === YTPlayerState.ENDED) {
                setIsPlaying(false);
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
              } else if (state === YTPlayerState.BUFFERING) {
                setIsLoading(true);
                isPlayingRef.current = false;
                lastSampleTimeRef.current = null;
              }
            },
            onPlaybackQualityChange: (event: YTPlayerEvent) => {
              if (isMounted && typeof event.data === 'string') setCurrentQuality(event.data);
            },
            onError: (event: YTPlayerEvent) => {
              const code = typeof event.data === 'number' ? event.data : Number(event.data);
              if (!isMounted) return;
              setIsLoading(false);
              setIsPlaying(false);
              isPlayingRef.current = false;

              if (isPermanentPlaybackError(code)) {
                // Permanently unplayable: remember it so the sidebar stops
                // offering a dead play button on the next visit.
                storage.markVideoUnavailable(courseId, videoId);
                setFailure('blocked');
                return;
              }
              // Codes 2/5 and the network errors are usually transient. Showing
              // them as "unavailable" would wrongly disable a working lesson.
              setLoadMessage(
                'This video would not start playing. Check your connection, then try again.'
              );
              setFailure('transient');
            }
          }
        });
      } catch (err) {
        console.error('Failed to instantiate YT.Player:', err);
        if (isMounted) {
          setIsLoading(false);
          setLoadMessage('The YouTube player could not be started in this browser.');
          setFailure('transient');
        }
      }
    };

    const initPlayer = (Player: YTPlayerConstructor) => {
      if (!isMounted || !containerRef.current) return;
      createPlayer(Player);
    };

    loadYouTubeIframeApi()
      .then(api => initPlayer(api.Player))
      .catch((err: unknown) => {
        if (!isMounted) return;
        setIsLoading(false);
        setLoadMessage(err instanceof Error ? err.message : 'The YouTube player could not be loaded.');
        setFailure('transient');
      });

    // Interval to poll time, buffer, and sync controls
    intervalRef.current = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      try {
        const cur = player.getCurrentTime();
        const dur = player.getDuration();
        if (Number.isFinite(cur)) {
          setCurrentTime(cur);
          lastTimeRef.current = cur;
        }
        if (Number.isFinite(dur) && dur > 0) setDuration(dur);

        const fraction = player.getVideoLoadedFraction?.() ?? 0;
        setBufferedPercent(clampRatio(fraction) * 100);

        const realQuality = player.getPlaybackQuality?.();
        if (realQuality && realQuality !== 'unknown') setCurrentQuality(realQuality);
        readQualities(player);

        if (Number.isFinite(cur) && Number.isFinite(dur) && dur > 0) {
          const current = callbacksRef.current;
          current.onTimeUpdate?.(cur, dur);

          if (clampRatio(cur / dur) >= clampRatio(current.autoCompleteThreshold) && current.onAutoComplete && !autoCompleteTriggeredRef.current) {
            autoCompleteTriggeredRef.current = true;
            current.onAutoComplete(videoId);
          }

          if (isPlayingRef.current && lastSampleTimeRef.current !== null) {
            const watchedDelta = cur - lastSampleTimeRef.current;
            // Ignore jumps from seeking and from 2x playback between ticks.
            if (watchedDelta > 0 && watchedDelta <= 2) {
              pendingWatchTimeRef.current += watchedDelta;
              if (pendingWatchTimeRef.current >= 3) flushWatchTime();
            }
          }
          lastSampleTimeRef.current = isPlayingRef.current ? cur : null;

          // Keep UI updates frequent, but persist resume position every five seconds.
          if (isPlayingRef.current && cur - lastPersistedAtRef.current >= 5) {
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
  }, [videoId, courseId, initialPositionSec, flushWatchTime]);

  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    try {
      if (isPlaying) {
        player.pauseVideo();
      } else {
        player.playVideo();
      }
    } catch {
      // Ignore a play() rejected while the embed is still initialising.
    }
  }, [isPlaying]);

  const rewind10 = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    try {
      const target = Math.max(0, (player.getCurrentTime() || 0) - 10);
      player.seekTo(target, true);
      setCurrentTime(target);
    } catch {
      // Ignore seeks refused before the player is ready.
    }
  }, []);

  const forward10 = useCallback(() => {
    const player = playerRef.current;
    if (!player || !duration) return;
    try {
      const target = Math.min(duration, (player.getCurrentTime() || 0) + 10);
      player.seekTo(target, true);
      setCurrentTime(target);
    } catch {
      // Ignore seeks refused before the player is ready.
    }
  }, [duration]);

  const toggleMute = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    try {
      if (isMuted) {
        player.unMute();
        setIsMuted(false);
      } else {
        player.mute();
        setIsMuted(true);
      }
    } catch {
      // Ignore a refused mute on a partially initialised embed.
    }
  }, [isMuted]);

  const toggleCaptions = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    const nextEnabled = !ccEnabled;
    try {
      if (nextEnabled) {
        player.loadModule?.('captions');
        player.setOption?.('captions', 'track', { languageCode: 'en' });
      } else {
        player.unloadModule?.('captions');
        player.setOption?.('captions', 'track', {});
      }
      setCcEnabled(nextEnabled);
    } catch {
      // The captions module is optional; reflect the intent either way.
      setCcEnabled(nextEnabled);
    }
  }, [ccEnabled]);

  const toggleFullscreen = useCallback(() => {
    if (!wrapperRef.current) return;
    if (!document.fullscreenElement) {
      void wrapperRef.current.requestFullscreen?.().catch(() => {});
    } else {
      void document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable || target?.closest('button, a, [role="tab"], [role="checkbox"], [role="option"], [role="slider"], [role="dialog"]')) return;
      if (failure) return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
        case 'j':
          e.preventDefault();
          rewind10();
          break;
        case 'ArrowRight':
        case 'l':
          e.preventDefault();
          forward10();
          break;
        case 'ArrowUp':
          e.preventDefault();
          changeVolume(Math.min(100, volume + 5));
          break;
        case 'ArrowDown':
          e.preventDefault();
          changeVolume(Math.max(0, volume - 5));
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'c':
          e.preventDefault();
          toggleCaptions();
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  const changeVolume = (newVol: number) => {
    const player = playerRef.current;
    if (!player) return;
    try {
      player.setVolume(newVol);
      if (newVol > 0 && isMuted) {
        player.unMute();
        setIsMuted(false);
      }
      setVolume(newVol);
    } catch {
      // Ignore a refused volume change on a partially initialised embed.
    }
  };

  // Controls auto-hide on inactivity
  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
    hideControlsTimeoutRef.current = setTimeout(() => {
      hideControlsTimeoutRef.current = null;
      if (isPlayingRef.current) {
        setShowControls(false);
        setIsSpeedMenuOpen(false);
        setIsSettingsOpen(false);
      }
    }, 3500);
  };

  // Never leave a pending hide-controls timer behind: it used to fire
  // setState on an unmounted component and, on the dashboard, keep a detached
  // closure alive for the rest of the session.
  useEffect(() => () => {
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
      hideControlsTimeoutRef.current = null;
    }
  }, []);

  const handleSeekChange = (e: React.MouseEvent<HTMLDivElement>) => {
    const player = playerRef.current;
    if (!player || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const clickX = e.clientX - rect.left;
    const targetPercent = clampRatio(clickX / rect.width);
    const targetSec = targetPercent * duration;
    try {
      player.seekTo(targetSec, true);
      setCurrentTime(targetSec);
    } catch {
      // Ignore seeks refused before the player is ready.
    }
  };

  const handleTimelineHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const percent = clampRatio((e.clientX - rect.left) / rect.width);
    setHoverPercent(percent * 100);
    setHoverTime(percent * duration);
  };

  const handleTimelineKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!duration) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const current = playerRef.current?.getCurrentTime?.() || currentTime;
    const target = e.key === 'Home' ? 0 : e.key === 'End' ? duration : current + (e.key === 'ArrowRight' ? 5 : -5);
    const clamped = Math.max(0, Math.min(duration, target));
    try {
      playerRef.current?.seekTo?.(clamped, true);
      setCurrentTime(clamped);
    } catch {
      // Ignore seeks refused before the player is ready.
    }
  };

  const handleVolumeChange = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    changeVolume(Math.round(clampRatio((e.clientX - rect.left) / rect.width) * 100));
  };

  const handleRateSelect = (rate: number) => {
    const player = playerRef.current;
    if (!player) return;
    try {
      player.setPlaybackRate(rate);
      setPlaybackRate(rate);
      setIsSpeedMenuOpen(false);
    } catch {
      // Ignore a refused rate change on a partially initialised embed.
    }
  };

  const handleQualityChange = (quality: string) => {
    const player = playerRef.current;
    if (!player) return;
    try {
      player.setPlaybackQuality?.(quality);
      setCurrentQuality(quality === 'default' ? 'auto' : quality);
      setIsSettingsOpen(false);
    } catch {
      // Ignore a refused quality change.
    }
  };

  const progressPercent = duration > 0 ? clampRatio(currentTime / duration) * 100 : 0;

  return (
    <div
      ref={wrapperRef}
      data-testid="video-player"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        if (isPlayingRef.current) {
          setShowControls(false);
          setIsSpeedMenuOpen(false);
          setIsSettingsOpen(false);
        }
        setHoverTime(null);
      }}
      className="relative w-full aspect-video bg-[#030712] overflow-hidden select-none group"
    >
      {/* Fallback Error Panel */}
      {failure ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#030712] text-[#E9ECF1] p-6 text-center z-30" role="alert">
          <span className="material-symbols-outlined text-[44px] text-white mb-3">
            {failure === 'blocked' ? 'warning' : 'cloud_off'}
          </span>
          <h3 className="text-lg font-semibold text-[#E9ECF1] mb-2 font-heading">
            {failure === 'blocked' ? "This video can't be played here" : 'Playback could not start'}
          </h3>
          <p className="text-sm text-[#B0B7C4] max-w-[420px] mb-6 leading-relaxed">
            {failure === 'blocked'
              ? 'The owner may have disabled embedding, or the video is private or deleted. It has been marked unavailable in this course.'
              : loadMessage}
          </p>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <a
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-white/40 text-white hover:bg-white/10 transition-colors text-sm font-medium"
            >
              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
              <span>Open on YouTube</span>
            </a>
            {failure === 'transient' && onNextVideo && (
              <button
                onClick={onNextVideo}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#3B82F6] text-white hover:bg-[#2563EB] transition-colors text-sm font-medium"
                type="button"
              >
                <span>Skip to next video</span>
                <span className="material-symbols-outlined text-[18px]">skip_next</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Loading Spinner */}
          {isLoading && (
            <div className="absolute inset-0 z-20 bg-[#030712] p-4" role="status" aria-label="Loading video player">
              <div className="skeleton-block h-full w-full rounded-lg bg-white/5" />
            </div>
          )}

          {/* YouTube Embed Container — 1:1 exact aspect ratio, no zoom, original size */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
              ref={containerRef}
              className="w-full h-full"
            />
          </div>

          {/* Click-to-play/pause overlay (covers the whole video area above controls) */}
          <div
            className="absolute inset-0 z-10"
            onClick={togglePlay}
            onDoubleClick={toggleFullscreen}
          />

          {/* ============ Custom Player Controls Overlay ============ */}
          <div
            className={`absolute bottom-0 left-0 right-0 pt-12 pb-2.5 px-3 sm:px-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex flex-col gap-1.5 z-20 transition-all duration-300 ${
              showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Scrubber Timeline ── */}
            <div
              onClick={handleSeekChange}
              onMouseMove={handleTimelineHover}
              onMouseLeave={() => setHoverTime(null)}
              onKeyDown={handleTimelineKeyDown}
              role="slider"
              tabIndex={0}
              aria-label="Video progress"
              aria-valuemin={0}
              aria-valuemax={Math.floor(duration)}
              aria-valuenow={Math.floor(currentTime)}
              className="relative w-full group/timeline flex items-center cursor-pointer py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded"
            >
              <div className="w-full h-[3px] group-hover/timeline:h-[5px] bg-white/20 rounded-full overflow-visible relative transition-all duration-150">
                {/* Buffered track */}
                <div
                  className="absolute top-0 bottom-0 left-0 bg-white/30 rounded-full pointer-events-none"
                  style={{ width: `${clampRatio(bufferedPercent / 100) * 100}%` }}
                />

                {/* Progress track */}
                <div
                  className="absolute top-0 bottom-0 left-0 bg-[#3B82F6] rounded-full pointer-events-none flex items-center justify-end"
                  style={{ width: `${progressPercent}%` }}
                >
                  <div className="w-3 h-3 rounded-full bg-white shadow-lg ring-2 ring-blue-500 scale-0 group-hover/timeline:scale-100 transition-transform -mr-1.5" />
                </div>

                {/* Hover time tooltip */}
                {hoverTime !== null && (
                  <div
                    className="absolute -top-8 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono pointer-events-none whitespace-nowrap"
                    style={{ left: `${clampRatio(hoverPercent / 100) * 100}%`, transform: 'translateX(-50%)' }}
                  >
                    {formatClock(hoverTime)}
                  </div>
                )}
              </div>
            </div>

            {/* ── Controls Bar ── */}
            <div className="flex items-center justify-between text-white/95 text-xs">
              {/* Left Controls */}
              <div className="flex items-center gap-0.5 sm:gap-1.5">
                {/* Play/Pause */}
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-white transition-colors focus:outline-none"
                >
                  <span className="material-symbols-outlined text-[22px]">
                    {isPlaying ? 'pause' : 'play_arrow'}
                  </span>
                </button>

                {/* Prev Video */}
                {onPrevVideo && (
                  <button
                    type="button"
                    onClick={onPrevVideo}
                    aria-label="Previous video"
                    className="w-8 h-8 hidden sm:flex items-center justify-center rounded hover:bg-white/10 text-[#CBD5E1] hover:text-white transition-colors focus:outline-none"
                  >
                    <span className="material-symbols-outlined text-[20px]">skip_previous</span>
                  </button>
                )}

                {/* Next Video */}
                {onNextVideo && (
                  <button
                    type="button"
                    onClick={onNextVideo}
                    aria-label="Next video"
                    className="w-8 h-8 hidden sm:flex items-center justify-center rounded hover:bg-white/10 text-[#CBD5E1] hover:text-white transition-colors focus:outline-none"
                  >
                    <span className="material-symbols-outlined text-[20px]">skip_next</span>
                  </button>
                )}

                {/* Rewind 10 */}
                <button
                  type="button"
                  onClick={rewind10}
                  aria-label="Replay 10 seconds"
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-[#CBD5E1] hover:text-white transition-colors focus:outline-none"
                >
                  <span className="material-symbols-outlined text-[20px]">replay_10</span>
                </button>

                {/* Forward 10 */}
                <button
                  type="button"
                  onClick={forward10}
                  aria-label="Forward 10 seconds"
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-[#CBD5E1] hover:text-white transition-colors focus:outline-none"
                >
                  <span className="material-symbols-outlined text-[20px]">forward_10</span>
                </button>

                {/* Volume Cluster */}
                <div className="flex items-center gap-1 group/vol ml-0.5">
                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label="Mute toggle"
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-white transition-colors focus:outline-none"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {isMuted || volume === 0 ? 'volume_off' : volume < 50 ? 'volume_down' : 'volume_up'}
                    </span>
                  </button>
                  <div
                    onClick={handleVolumeChange}
                    className="w-16 h-3 hidden sm:flex items-center cursor-pointer group/volbar"
                  >
                    <div className="w-full h-[3px] bg-white/20 rounded-full overflow-hidden relative">
                      <div
                        className="h-full bg-white rounded-full transition-all"
                        style={{ width: `${isMuted ? 0 : volume}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Time Display */}
                <div className="font-mono text-[11px] text-[#94A3B8] ml-1.5 select-none whitespace-nowrap">
                  <span className="text-white font-medium">{formatClock(currentTime)}</span>
                  {' / '}
                  <span>{formatClock(duration)}</span>
                </div>
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-0.5 relative">

                {/* Closed Captions Toggle */}
                <button
                  type="button"
                  onClick={toggleCaptions}
                  aria-label="Toggle captions"
                  title={ccEnabled ? 'Turn off captions (c)' : 'Turn on captions (c)'}
                  className={`h-8 px-1.5 flex items-center gap-1 rounded hover:bg-white/10 transition-colors focus:outline-none ${
                    ccEnabled ? 'text-white' : 'text-[#CBD5E1]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[19px]">
                    {ccEnabled ? 'closed_caption' : 'closed_caption_disabled'}
                  </span>
                  <span className={`text-[10px] font-mono font-bold px-1 py-0.5 rounded leading-none ${
                    ccEnabled ? 'bg-blue-600 text-white' : 'bg-white/10 text-[#94A3B8]'
                  }`}>
                    {ccEnabled ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* Playback Speed selector */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setIsSpeedMenuOpen(!isSpeedMenuOpen); setIsSettingsOpen(false); }}
                    title="Playback speed"
                    aria-label="Playback speed"
                    className={`px-1.5 py-1 rounded text-[11px] font-mono font-semibold hover:bg-white/10 transition-colors focus:outline-none ${
                      playbackRate !== 1.0 ? 'text-[#3B82F6]' : 'text-[#CBD5E1] hover:text-white'
                    }`}
                  >
                    {playbackRate}x
                  </button>

                  {isSpeedMenuOpen && (
                    <div className="absolute right-0 bottom-9 w-24 bg-[#0F172A] border border-[#1E293B] rounded-lg shadow-2xl p-1 z-50 flex flex-col animate-fadeIn">
                      {[0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => handleRateSelect(rate)}
                          className={`w-full text-left px-2.5 py-1.5 rounded text-xs font-mono transition-colors ${
                            playbackRate === rate ? 'bg-blue-600 text-white' : 'text-[#CBD5E1] hover:bg-[#1E293B]'
                          }`}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Settings (Quality) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setIsSettingsOpen(!isSettingsOpen); setIsSpeedMenuOpen(false); }}
                    aria-label="Settings"
                    title={`Quality: ${qualityLabels[currentQuality] || currentQuality}`}
                    className="h-8 px-2 flex items-center gap-1 rounded hover:bg-white/10 text-[#CBD5E1] hover:text-white transition-colors focus:outline-none"
                  >
                    <span className={`material-symbols-outlined text-[18px] transition-transform duration-300 ${isSettingsOpen ? 'rotate-45' : ''}`}>
                      settings
                    </span>
                    <span className="text-[11px] font-mono font-medium text-white/90">
                      {qualityLabels[currentQuality] || currentQuality}
                    </span>
                  </button>

                  {isSettingsOpen && (
                    <div className="absolute right-0 bottom-9 w-36 bg-[#0F172A] border border-[#1E293B] rounded-lg shadow-2xl p-1 z-50 flex flex-col animate-fadeIn">
                      <div className="px-2.5 py-1.5 text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
                        Quality
                      </div>
                      <button
                        type="button"
                        onClick={() => handleQualityChange('default')}
                        className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors ${
                          currentQuality === 'default' || currentQuality === 'auto' ? 'bg-blue-600 text-white' : 'text-[#CBD5E1] hover:bg-[#1E293B]'
                        }`}
                      >
                        Auto
                      </button>
                      {availableQualities
                        .filter(q => q !== 'auto' && q !== 'default')
                        .map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => handleQualityChange(q)}
                            className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors ${
                              currentQuality === q ? 'bg-blue-600 text-white' : 'text-[#CBD5E1] hover:bg-[#1E293B]'
                            }`}
                          >
                            {qualityLabels[q] || q}
                          </button>
                        ))
                      }
                    </div>
                  )}
                </div>

                {/* Fullscreen */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  aria-label="Fullscreen"
                  title={isFullscreen ? 'Exit fullscreen (f)' : 'Fullscreen (f)'}
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-[#CBD5E1] hover:text-white transition-colors focus:outline-none"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
