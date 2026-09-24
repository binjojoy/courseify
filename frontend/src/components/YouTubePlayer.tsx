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
  onTimeUpdate,
  onAutoComplete
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<any>(null);
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

  // Save position on unload
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

      // Create new player
      try {
        playerRef.current = new window.YT.Player(containerRef.current, {
          videoId: videoId,
          playerVars: {
            autoplay: 1,
            start: Math.floor(initialPositionSec || 0),
            modestbranding: 1,
            rel: 0,
            controls: 1,
            origin: window.location.origin
          },
          events: {
            onReady: (event: any) => {
              if (!isMounted) return;
              setIsLoading(false);
              if (initialPositionSec > 0) {
                event.target.seekTo(initialPositionSec, true);
              }
            },
            onStateChange: (event: any) => {
              if (!isMounted) return;
              // Playing: 1, Paused: 2, Ended: 0
              if (event.data === window.YT.PlayerState.PLAYING) {
                setIsLoading(false);
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                const time = event.target.getCurrentTime();
                storage.saveVideoPosition(courseId, videoId, time);
              } else if (event.data === window.YT.PlayerState.ENDED) {
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
              // 101 or 150 = embed restricted, 100 = not found/private
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

    // Interval to poll time and save progress periodically (every 5 seconds)
    intervalRef.current = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        try {
          const current = playerRef.current.getCurrentTime();
          const duration = playerRef.current.getDuration();
          if (current !== undefined && duration !== undefined) {
            lastTimeRef.current = current;
            if (onTimeUpdate) onTimeUpdate(current, duration);

            // Auto-complete at >= 90%
            if (duration > 0 && current / duration >= 0.90 && onAutoComplete) {
              onAutoComplete(videoId);
            }

            // Save position every 5s
            storage.saveVideoPosition(courseId, videoId, current);
          }
        } catch {}
      }
    }, 5000);

    return () => {
      isMounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [videoId, courseId]);

  return (
    <div className="relative w-full aspect-video bg-[#030712] overflow-hidden select-none">
      {/* Fallback Error Panel */}
      {hasError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#030712] text-[#E9ECF1] p-6 text-center z-20">
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
            <div className="absolute inset-0 flex items-center justify-center bg-[#030712] z-10">
              <span className="material-symbols-outlined text-[36px] text-accent animate-spin">
                progress_activity
              </span>
            </div>
          )}

          {/* YouTube Embed Container */}
          <div className="w-full h-full">
            <div ref={containerRef} className="w-full h-full pointer-events-auto" />
          </div>
        </>
      )}
    </div>
  );
};
