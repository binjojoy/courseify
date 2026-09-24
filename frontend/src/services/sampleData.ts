import { Course, VideoItem, CourseProgress, CourseNotes, UserProfile, AppSettings } from '../types';

export const DEFAULT_PROFILE: UserProfile = {
  name: 'User'
};

export const DEFAULT_SETTINGS: AppSettings = {
  autoplayNext: true,
  autoCompleteOnEnd: true,
  autoCompleteThreshold: 0.90,
  theme: 'dark'
};

export const SAMPLE_INITIAL_COURSES: Course[] = [];

export const OS_VIDEOS: VideoItem[] = [];

export const OS_PROGRESS: CourseProgress = {
  lastVideoId: '',
  updatedAt: new Date().toISOString(),
  completedAt: null,
  videos: {}
};

export const OS_NOTES: CourseNotes = {};
