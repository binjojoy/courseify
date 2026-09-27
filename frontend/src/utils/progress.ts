import type { CourseProgress, VideoItem } from '../types';

import { isPlayableVideo } from './course';

/**
 * Clamp a ratio to the 0..1 range. Values arriving from localStorage or an
 * imported backup are not trustworthy, so every percentage in the UI is passed
 * through here before it reaches a width, an aria-valuenow or a progress bar.
 */
export const clampRatio = (value: unknown): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric < 0) return 0;
  if (numeric > 1) return 1;
  return numeric;
};

/** Clamp an already-percentage value (0..100) and round it. */
export const clampPercent = (value: unknown): number => Math.round(clampRatio(
  typeof value === 'number' && value > 1 ? value / 100 : value
) * 100);

/** Clamp a playback position to a non-negative whole number of seconds. */
export const clampSeconds = (value: unknown, maxSeconds = Number.MAX_SAFE_INTEGER): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.min(Math.floor(numeric), Math.max(0, Math.floor(maxSeconds)));
};

export interface CourseMetrics {
  totalVideos: number;
  completedVideos: number;
  completionPercent: number;
  totalDurationSec: number;
  watchedDurationSec: number;
  isCompleted: boolean;
  lastVideoId: string;
}

/**
 * The single source of truth for course completion maths.
 *
 * PlaylistSidebar, DashboardPage, PlayerPage and ContinueLearningBanner all
 * need these numbers; computing them per-component is how they drifted apart.
 */
export function computeCourseMetrics(
  videos: VideoItem[],
  progress: CourseProgress,
  fallbackTotalDurationSec = 0
): CourseMetrics {
  const playableVideos = videos.filter(isPlayableVideo);
  const totalVideos = playableVideos.length;

  let completedVideos = 0;
  let watchedDurationSec = 0;
  let summedDurationSec = 0;
  const lastVideoId = progress.lastVideoId;

  for (const video of playableVideos) {
    const entry = progress.videos?.[video.videoId];
    const durationSec = Number.isFinite(video.durationSec) && video.durationSec > 0 ? video.durationSec : 0;
    summedDurationSec += durationSec;

    if (entry?.completed) {
      completedVideos += 1;
      watchedDurationSec += durationSec;
    } else {
      watchedDurationSec += Math.min(clampSeconds(entry?.positionSec), durationSec);
    }
  }

  const totalDurationSec = summedDurationSec > 0 ? summedDurationSec : Math.max(0, fallbackTotalDurationSec || 0);

  return {
    totalVideos,
    completedVideos,
    completionPercent: totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0,
    totalDurationSec,
    watchedDurationSec,
    isCompleted: totalVideos > 0 && completedVideos === totalVideos,
    lastVideoId: lastVideoId && playableVideos.some(v => v.videoId === lastVideoId)
      ? lastVideoId
      : playableVideos[0]?.videoId || ''
  };
}

/** `1:05:03` / `14:20` / `0:45`, with anything unparseable collapsing to 0:00. */
export const formatClock = (totalSeconds: number): string => {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  return `${hours}:${mm}:${String(seconds).padStart(2, '0')}`;
};

/**
 * Zero-padded `MM:SS` / `HH:MM:SS`.
 *
 * This is the form note timestamps are *stored* in (`[04:05](#timestamp-245)`),
 * so it deliberately differs from `formatClock`: notes already in localStorage
 * were written with padded minutes, and changing the format would break the
 * clickable-timestamp parser for every existing note.
 */
export const formatTimestamp = (totalSeconds: number): string => {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = String(Math.floor((safe % 3600) / 60)).padStart(2, '0');
  const seconds = String(safe % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
};

/** Compact human duration used for course totals: "18h 30m", "42m", "18s". */
export const formatDurationHuman = (totalSeconds: number): string => {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  if (safe < 60) return `${safe}s`;

  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

/** "3 videos" / "1 video" — avoids the "1 videos" class of copy bug. */
export const pluralize = (count: number, singular: string, plural = `${singular}s`): string =>
  `${count} ${count === 1 ? singular : plural}`;

/**
 * A lesson counts as "watched" once the playhead passes the auto-complete
 * threshold. Falls back to the video duration for a legacy 0/1 threshold.
 */
export const isVideoWatched = (positionSec: number, durationSec: number, threshold: number): boolean => {
  if (durationSec <= 0) return false;
  const ratio = threshold > 0 && threshold <= 1 ? threshold : 0.9;
  return clampRatio(positionSec / durationSec) >= ratio;
};
