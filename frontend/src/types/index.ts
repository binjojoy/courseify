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
}

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
