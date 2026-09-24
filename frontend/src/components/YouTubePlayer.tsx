import React, { useEffect, useRef, useState } from 'react';
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

  const intervalRef = useRef<any>(null);
  const hideControlsTimeoutRef = useRef<any>(null);
  const lastTimeRef = useRef<number>(initialPositionSec);

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

  // Initialize or update YouTube Player
  useEffect(() => {
    let isMounted = true;
    setHasError(false);
    setIsLoading(true);

    const initPlayer = () => {
      if (!containerRef.current || !window.YT || !window.YT.Player) return;

      // If player already exists, load video directly
      if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
        try {
          playerRef.current.loadVideoById({
            videoId: videoId,
            startSeconds: initialPositionSec || 0
          });
          setIsLoading(false);
          return;
        } catch (e) {
          console.warn('Error reusing player, recreating:', e);
        }
      }

      // Create new player with modestbranding and controls=1 to allow official ad skipping & video decoders
      try {
        playerRef.current = new window.YT.Player(containerRef.current, {
          videoId: videoId,
          playerVars: {
            autoplay: 1,
            start: Math.floor(initialPositionSec || 0),
            modestbranding: 1,
            rel: 0,
            controls: 1,
            enablejsapi: 1,
            playsinline: 1,
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
                const dur = event.target.getDuration();
                if (dur) setDuration(dur);
                const vol = event.target.getVolume();
                if (vol !== undefined) setVolume(vol);
                setIsMuted(event.target.isMuted());
              } catch {}
            },
            onStateChange: (event: any) => {
              if (!isMounted) return;
              // Playing: 1, Paused: 2, Ended: 0, Buffering: 3
              if (event.data === window.YT.PlayerState.PLAYING) {
                setIsPlaying(true);
                setIsLoading(false);
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                setIsPlaying(false);
                const time = event.target.getCurrentTime();
                storage.saveVideoPosition(courseId, videoId, time);
              } else if (event.data === window.YT.PlayerState.ENDED) {
                setIsPlaying(false);
                const time = event.target.getDuration();
                storage.saveVideoPosition(courseId, videoId, time);
                if (onAutoComplete) onAutoComplete(videoId);
                if (onEnded) onEnded();
                if (autoplayNext && onNextVideo) {
                  onNextVideo();
                }
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

    // Interval to poll time and sync controls
    intervalRef.current = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        try {
          const cur = playerRef.current.getCurrentTime();
          const dur = playerRef.current.getDuration();
          if (cur !== undefined) {
            setCurrentTime(cur);
            lastTimeRef.current = cur;
          }
          if (dur !== undefined && dur > 0 && dur !== duration) {
            setDuration(dur);
          }

          if (cur !== undefined && dur !== undefined) {
            if (onTimeUpdate) onTimeUpdate(cur, dur);

            // Auto-complete at >= 90%
            if (dur > 0 && cur / dur >= 0.90 && onAutoComplete) {
              onAutoComplete(videoId);
            }

            // Save position every 5s
            storage.saveVideoPosition(courseId, videoId, cur);
          }
        } catch {}
      }
    }, 1000);

    return () => {
      isMounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [videoId, courseId]);

  // Controls auto-hide on inactivity
  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
    hideControlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        setIsSpeedMenuOpen(false);
      }
    }, 3500);
  };

  const togglePlay = () => {
    if (!playerRef.current) return;
    try {
      if (isPlaying) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
    } catch {}
  };

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

  const rewind10 = () => {
    if (!playerRef.current) return;
    try {
      const cur = playerRef.current.getCurrentTime() || 0;
      const target = Math.max(0, cur - 10);
      playerRef.current.seekTo(target, true);
      setCurrentTime(target);
    } catch {}
  };

  const forward10 = () => {
    if (!playerRef.current || !duration) return;
    try {
      const cur = playerRef.current.getCurrentTime() || 0;
      const target = Math.min(duration, cur + 10);
      playerRef.current.seekTo(target, true);
      setCurrentTime(target);
    } catch {}
  };

  const toggleMute = () => {
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
  };

  const handleVolumeChange = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!playerRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const targetVol = Math.round(Math.max(0, Math.min(1, clickX / rect.width)) * 100);
    try {
      playerRef.current.setVolume(targetVol);
      if (targetVol > 0 && isMuted) {
        playerRef.current.unMute();
        setIsMuted(false);
      }
      setVolume(targetVol);
    } catch {}
  };

  const handleRateSelect = (rate: number) => {
    if (!playerRef.current) return;
    try {
      playerRef.current.setPlaybackRate(rate);
      setPlaybackRate(rate);
      setIsSpeedMenuOpen(false);
    } catch {}
  };

  const toggleFullscreen = () => {
    if (!wrapperRef.current) return;
    if (!document.fullscreenElement) {
      wrapperRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

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

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={wrapperRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
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

          {/* YouTube Embed Container */}
          <div className="w-full h-full pointer-events-auto">
            <div ref={containerRef} className="w-full h-full" />
          </div>

          {/* Custom Polished Player Overlay Controls (from player.html specification) */}
          <div
            className={`absolute bottom-0 left-0 right-0 pt-10 pb-2.5 px-4 bg-gradient-to-t from-black/95 via-black/70 to-transparent flex flex-col gap-2 z-20 transition-all duration-300 pointer-events-auto ${
              showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
            }`}
          >
            {/* Scrubber Timeline Bar */}
            <div
              onClick={handleSeekChange}
              className="relative w-full h-2 group/timeline flex items-center cursor-pointer transition-all duration-150 py-2"
            >
              <div className="w-full h-1 group-hover/timeline:h-2 bg-white/20 rounded-full overflow-visible relative transition-all duration-150">
                {/* Progress track */}
                <div
                  className="absolute top-0 bottom-0 left-0 bg-[#3B82F6] rounded-full pointer-events-none flex items-center justify-end"
                  style={{ width: `${progressPercent}%` }}
                >
                  <div className="w-3.5 h-3.5 rounded-full bg-white shadow-lg ring-2 ring-blue-500 scale-0 group-hover/timeline:scale-100 transition-transform -mr-1.5"></div>
                </div>
              </div>
            </div>

            {/* Player Action Controls Bar */}
            <div className="flex items-center justify-between text-white/95 text-xs">
              {/* Left Action Buttons */}
              <div className="flex items-center gap-1 sm:gap-2">
                {/* Play / Pause */}
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

                {/* Volume Cluster */}
                <div className="flex items-center gap-1.5 group/vol ml-1">
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
                    className="w-16 h-1 bg-white/20 rounded-full overflow-hidden hidden sm:block cursor-pointer py-1"
                  >
                    <div
                      className="h-1 bg-white rounded-full transition-all"
                      style={{ width: `${isMuted ? 0 : volume}%` }}
                    />
                  </div>
                </div>

                {/* Current Time / Duration */}
                <div className="font-mono text-xs text-[#94A3B8] ml-2 select-none">
                  <span className="text-white font-medium">{formatTimeStr(currentTime)}</span> / <span>{formatTimeStr(duration)}</span>
                </div>
              </div>

              {/* Right Action Controls */}
              <div className="flex items-center gap-1 relative">
                {/* Playback Speed selector */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsSpeedMenuOpen(!isSpeedMenuOpen)}
                    className="px-2 py-1 rounded text-[11px] font-mono font-semibold text-[#CBD5E1] hover:text-white hover:bg-white/10 transition-colors focus:outline-none"
                  >
                    {playbackRate}x
                  </button>

                  {isSpeedMenuOpen && (
                    <div className="absolute right-0 bottom-9 w-24 bg-[#0F172A] border border-[#1E293B] rounded-lg shadow-2xl p-1 z-50 flex flex-col animate-fadeIn">
                      {[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((rate) => (
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

                {/* Fullscreen Button */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  aria-label="Fullscreen"
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
