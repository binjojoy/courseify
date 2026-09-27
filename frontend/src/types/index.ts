export interface Course {
  id: string; // playlistId or videoId
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  videoCount: number;
  totalDurationSec: number;
  totalDurationFormatted?: string;
  description?: string;
  addedAt: string;
  lastOpenedAt: string;
  source?: CourseSource;
  /**
   * True when the source playlist is larger than the lessons stored locally.
   * The import cap is 200 lessons; this makes the shortfall visible instead of
   * silently handing back a short course.
   */
  truncated?: boolean;
  /** Lessons the source playlist says it has, which may exceed `videos.length`. */
  totalItemCount?: number;
}

export interface CourseSource {
  type: 'playlist' | 'video';
  id: string;
  url: string;
}

/** Views the hash router can resolve. */
export type ViewMode = 'home' | 'dashboard' | 'player' | 'privacy' | 'terms' | 'notfound' | 'audit';

/**
 * Shared navigation contract. Declared once so pages stop narrowing it to the
 * three views they happen to use and then needing `as any` to reach the rest.
 */
export type NavigateFn = (view: ViewMode, courseId?: string, videoId?: string) => void;

export interface VideoItem {
  videoId: string;
  position: number;
  title: string;
  description: string;
  durationSec: number;
  durationFormatted: string;
  thumbnailUrl: string;
  unavailable?: boolean;
}

export interface VideoProgress {
  completed: boolean;
  positionSec: number;
  completedAt?: string | null;
}

export interface CourseProgress {
  lastVideoId: string;
  updatedAt: string;
  completedAt: string | null;
  videos: Record<string, VideoProgress>;
}

export interface VideoNote {
  text: string;
  updatedAt: string;
}

export type CourseNotes = Record<string, VideoNote>;

export interface FavoriteVideo {
  courseId: string;
  courseTitle: string;
  videoId: string;
  title: string;
  durationFormatted: string;
  thumbnailUrl: string;
  addedAt: string;
}

export interface UserProfile {
  name: string;
}

export interface AppSettings {
  autoplayNext: boolean;
  autoCompleteOnEnd: boolean;
  autoCompleteThreshold: number; // e.g. 0.90 (90%)
  theme: 'light' | 'dark';
  dailyFocusGoalMinutes?: number; // e.g. 60 min
  firstAccessDate?: string;
}

export type SortOption = 'recently_watched' | 'recently_added' | 'progress' | 'title';

export interface RecentNoteItem {
  courseId: string;
  courseTitle: string;
  videoId: string;
  videoTitle: string;
  videoPosition: number;
  text: string;
  updatedAt: string;
}

export interface LearningStats {
  hoursWatched: number;
  videosCompleted: number;
  coursesCompleted: number;
  dayStreak: number;
  avgHoursPerDay: number;
  dailyMinutesStudied: number;
  weeklyHours: { day: string; hours: number }[];
}

export interface BackupData {
  schemaVersion: 3;
  exportedAt: string;
  profile: UserProfile;
  settings: AppSettings;
  courses: Course[];
  favorites: FavoriteVideo[];
  watchActivity: Record<string, number>;
  accessDays: string[];
  courseData: Record<string, {
    videos: VideoItem[];
    progress: CourseProgress;
    notes: CourseNotes;
  }>;
}
