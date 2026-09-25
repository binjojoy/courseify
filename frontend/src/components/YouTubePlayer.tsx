import React, { useEffect, useRef, useState, useCallback } from 'react';
import { storage } from '../services/storage';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

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
  const playerRef = useRef<any>(null);

  const [hasError, setHasError] = useState(false);
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
  const [isSeeking, setIsSeeking] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPercent, setHoverPercent] = useState(0);

  const intervalRef = useRef<any>(null);
  const hideControlsTimeoutRef = useRef<any>(null);
  const lastTimeRef = useRef<number>(initialPositionSec);
  const autoCompleteTriggeredRef = useRef(false);
  const isPlayingRef = useRef(false);
  const lastSampleTimeRef = useRef<number | null>(null);
  const lastPersistedAtRef = useRef(0);

  // Load YouTube Iframe API Script
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // Save position on window unload
  useEffect(() => {
    const handleUnload = () => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        const time = playerRef.current.getCurrentTime();
        if (time > 0) {
          storage.saveVideoPosition(courseId, videoId, time);
        }
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
    };
  }, [courseId, videoId]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Initialize or update YouTube Player
  useEffect(() => {
    let isMounted = true;
    setHasError(false);
    setIsLoading(true);
    autoCompleteTriggeredRef.current = false;

    const initPlayer = () => {
      if (!containerRef.current || !window.YT || !window.YT.Player) return;

      // If player already exists, load video directly
      if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
        try {
          playerRef.current.loadVideoById({
            videoId: videoId,
            startSeconds: initialPositionSec || 0
          });
          playerRef.current.setPlaybackQuality?.('default');
          playerRef.current.unloadModule?.('captions');
          setCcEnabled(false);
          setCurrentQuality('auto');
          setIsLoading(false);
          return;
        } catch (e) {
          console.warn('Error reusing player, recreating:', e);
        }
      }

      try {
        playerRef.current = new window.YT.Player(containerRef.current, {
          videoId: videoId,
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
            onReady: (event: any) => {
              if (!isMounted) return;
              setIsLoading(false);
              if (initialPositionSec > 0) {
                event.target.seekTo(initialPositionSec, true);
              }
              try {
                event.target.setPlaybackQuality?.('default');
                event.target.unloadModule?.('captions');
                setCcEnabled(false);
                setCurrentQuality('auto');
                const dur = event.target.getDuration();
                if (dur) setDuration(dur);
                const vol = event.target.getVolume();
                if (vol !== undefined) setVolume(vol);
                setIsMuted(event.target.isMuted());

                // Fetch available quality levels
                const qualities = event.target.getAvailableQualityLevels?.() || [];
                setAvailableQualities(qualities);
                const curQuality = event.target.getPlaybackQuality?.() || 'auto';
                setCurrentQuality(curQuality);
              } catch {}
            },
            onStateChange: (event: any) => {
              if (!isMounted) return;
              if (event.data === window.YT.PlayerState.PLAYING) {
                setIsPlaying(true);
                isPlayingRef.current = true;
                lastSampleTimeRef.current = event.target.getCurrentTime();
                setIsLoading(false);
                // Re-fetch qualities when video starts playing (they may not be available before)
                try {
                  const qualities = event.target.getAvailableQualityLevels?.() || [];
                  if (qualities.length > 0) setAvailableQualities(qualities);
                } catch {}
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                setIsPlaying(false);
                isPlayingRef.current = false;
                lastSampleTimeRef.current = null;
                const time = event.target.getCurrentTime();
                storage.saveVideoPosition(courseId, videoId, time);
              } else if (event.data === window.YT.PlayerState.ENDED) {
                setIsPlaying(false);
                isPlayingRef.current = false;
                lastSampleTimeRef.current = null;
                const time = event.target.getDuration();
                storage.saveVideoPosition(courseId, videoId, time);
                if (onAutoComplete) onAutoComplete(videoId);
                if (onEnded) onEnded();
                if (autoplayNext && onNextVideo) {
                  onNextVideo();
                }
              } else if (event.data === window.YT.PlayerState.BUFFERING) {
                setIsLoading(true);
                isPlayingRef.current = false;
                lastSampleTimeRef.current = null;
              }
            },
            onPlaybackQualityChange: (event: any) => {
              if (!isMounted) return;
              if (event.data) {
                setCurrentQuality(event.data);
              }
            },
            onError: (err: any) => {
              console.error('YouTube player error:', err.data);
              if (isMounted) {
                setHasError(true);
                setIsLoading(false);
              }
            }
          }
        });
      } catch (err) {
        console.error('Failed to instantiate YT.Player:', err);
        if (isMounted) setHasError(true);
      }
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        if (isMounted) initPlayer();
      };
    }

    // Interval to poll time, buffer, and sync controls
    intervalRef.current = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        try {
          const cur = playerRef.current.getCurrentTime();
          const dur = playerRef.current.getDuration();
          if (cur !== undefined) {
            setCurrentTime(cur);
            lastTimeRef.current = cur;
          }
          if (dur !== undefined && dur > 0) {
            setDuration(dur);
          }

          // Buffer progress
          const fraction = playerRef.current.getVideoLoadedFraction?.() || 0;
          setBufferedPercent(fraction * 100);

          // Sync current playback quality from YouTube API
          const realQuality = playerRef.current.getPlaybackQuality?.();
          if (realQuality && realQuality !== 'unknown') {
            setCurrentQuality(realQuality);
          }

          // Fetch available qualities if not loaded yet
          const avail = playerRef.current.getAvailableQualityLevels?.();
          if (avail && avail.length > 0 && availableQualities.length === 0) {
            setAvailableQualities(avail);
          }

          if (cur !== undefined && dur !== undefined) {
            if (onTimeUpdate) onTimeUpdate(cur, dur);

            // Auto-complete at >= 90%
            if (dur > 0 && cur / dur >= autoCompleteThreshold && onAutoComplete && !autoCompleteTriggeredRef.current) {
              autoCompleteTriggeredRef.current = true;
              onAutoComplete(videoId);
            }

            if (isPlayingRef.current && lastSampleTimeRef.current !== null) {
              const watchedDelta = cur - lastSampleTimeRef.current;
              if (watchedDelta > 0 && watchedDelta <= 2) {
                storage.recordWatchTime(watchedDelta);
              }
            }
            lastSampleTimeRef.current = isPlayingRef.current ? cur : null;

            // Keep UI updates frequent, but persist resume position every five seconds.
            if (isPlayingRef.current && cur - lastPersistedAtRef.current >= 5) {
              storage.saveVideoPosition(courseId, videoId, cur);
              lastPersistedAtRef.current = cur;
            }
          }
        } catch {}
      }
    }, 1000);

    return () => {
      isMounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [videoId, courseId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

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
  }, [isPlaying, volume, isMuted, ccEnabled]);

  // Controls auto-hide on inactivity
  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
    hideControlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        setIsSpeedMenuOpen(false);
        setIsSettingsOpen(false);
      }
    }, 3500);
  };

  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;
    try {
      if (isPlaying) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
    } catch {}
  }, [isPlaying]);

  const handleSeekChange = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!playerRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const targetPercent = Math.max(0, Math.min(1, clickX / rect.width));
    const targetSec = targetPercent * duration;
    try {
      playerRef.current.seekTo(targetSec, true);
      setCurrentTime(targetSec);
    } catch {}
  };

  const handleTimelineHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPercent(percent * 100);
    setHoverTime(percent * duration);
  };

  const handleTimelineKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!duration) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const current = playerRef.current?.getCurrentTime?.() || currentTime;
    const target = e.key === 'Home' ? 0 : e.key === 'End' ? duration : current + (e.key === 'ArrowRight' ? 5 : -5);
    playerRef.current?.seekTo?.(Math.max(0, Math.min(duration, target)), true);
    setCurrentTime(Math.max(0, Math.min(duration, target)));
  };

  const rewind10 = useCallback(() => {
    if (!playerRef.current) return;
    try {
      const cur = playerRef.current.getCurrentTime() || 0;
      const target = Math.max(0, cur - 10);
      playerRef.current.seekTo(target, true);
      setCurrentTime(target);
    } catch {}
  }, []);

  const forward10 = useCallback(() => {
    if (!playerRef.current || !duration) return;
    try {
      const cur = playerRef.current.getCurrentTime() || 0;
      const target = Math.min(duration, cur + 10);
      playerRef.current.seekTo(target, true);
      setCurrentTime(target);
    } catch {}
  }, [duration]);

  const toggleMute = useCallback(() => {
    if (!playerRef.current) return;
    try {
      if (isMuted) {
        playerRef.current.unMute();
        setIsMuted(false);
      } else {
        playerRef.current.mute();
        setIsMuted(true);
      }
    } catch {}
  }, [isMuted]);

  const changeVolume = (newVol: number) => {
    if (!playerRef.current) return;
    try {
      playerRef.current.setVolume(newVol);
      if (newVol > 0 && isMuted) {
        playerRef.current.unMute();
        setIsMuted(false);
      }
      setVolume(newVol);
    } catch {}
  };

  const handleVolumeChange = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const targetVol = Math.round(Math.max(0, Math.min(1, clickX / rect.width)) * 100);
    changeVolume(targetVol);
  };

  const handleRateSelect = (rate: number) => {
    if (!playerRef.current) return;
    try {
      playerRef.current.setPlaybackRate(rate);
      setPlaybackRate(rate);
      setIsSpeedMenuOpen(false);
    } catch {}
  };

  const toggleCaptions = useCallback(() => {
    if (!playerRef.current) return;
    try {
      if (ccEnabled) {
        playerRef.current.unloadModule?.('captions');
        if (typeof playerRef.current.setOption === 'function') {
          playerRef.current.setOption('captions', 'track', {});
        }
        setCcEnabled(false);
      } else {
        playerRef.current.loadModule?.('captions');
        if (typeof playerRef.current.setOption === 'function') {
          playerRef.current.setOption('captions', 'track', { languageCode: 'en' });
        }
        setCcEnabled(true);
      }
    } catch {
      setCcEnabled((prev) => !prev);
    }
  }, [ccEnabled]);

  const handleQualityChange = (quality: string) => {
    if (!playerRef.current) return;
    try {
      playerRef.current.setPlaybackQuality?.(quality);
      setCurrentQuality(quality === 'default' ? 'auto' : quality);
      setIsSettingsOpen(false);
    } catch {}
  };

  const toggleFullscreen = useCallback(() => {
    if (!wrapperRef.current) return;
    if (!document.fullscreenElement) {
      wrapperRef.current.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  // Format seconds into MM:SS or HH:MM:SS
  const formatTimeStr = (totalSec: number) => {
    const s = Math.floor(totalSec || 0);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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
    auto: 'Auto'
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={wrapperRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        if (isPlaying) {
          setShowControls(false);
          setIsSpeedMenuOpen(false);
          setIsSettingsOpen(false);
        }
        setHoverTime(null);
      }}
      className="relative w-full aspect-video bg-[#030712] overflow-hidden select-none group"
    >
      {/* Fallback Error Panel */}
      {hasError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#030712] text-[#E9ECF1] p-6 text-center z-30">
          <span className="material-symbols-outlined text-[44px] text-white mb-3">
            warning
          </span>
          <h3 className="text-lg font-semibold text-[#E9ECF1] mb-2 font-heading">
            This video can't be played here
          </h3>
          <p className="text-sm text-[#B0B7C4] max-w-[420px] mb-6 leading-relaxed">
            The owner may have disabled embedding, or the video is private or deleted.
          </p>
          <div className="flex items-center gap-3">
            <a
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-white/40 text-white hover:bg-white/10 transition-colors text-sm font-medium"
            >
              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
              <span>Open on YouTube</span>
            </a>
            {onNextVideo && (
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
            <div className="absolute inset-0 flex items-center justify-center bg-[#030712] z-20">
              <span className="material-symbols-outlined text-[36px] text-accent animate-spin">
                progress_activity
              </span>
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
                  style={{ width: `${bufferedPercent}%` }}
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
                    style={{ left: `${hoverPercent}%`, transform: 'translateX(-50%)' }}
                  >
                    {formatTimeStr(hoverTime)}
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
                  <span className="text-white font-medium">{formatTimeStr(currentTime)}</span>
                  {' / '}
                  <span>{formatTimeStr(duration)}</span>
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
