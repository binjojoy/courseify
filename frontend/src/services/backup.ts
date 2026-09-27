import type {
  AppSettings,
  BackupData,
  Course,
  CourseNotes,
  CourseProgress,
  CourseSource,
  FavoriteVideo,
  UserProfile,
  VideoItem,
  VideoNote,
  VideoProgress
} from '../types';

import { DEFAULT_PROFILE, DEFAULT_SETTINGS } from './sampleData';
import { clampSeconds } from '../utils/progress';

export const CURRENT_BACKUP_SCHEMA_VERSION = 3;
export const MIN_SUPPORTED_BACKUP_SCHEMA_VERSION = 2;

/** Import caps: a 10MB JSON file of hand-written keys can otherwise exhaust the quota. */
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const MAX_COURSES = 500;
const MAX_VIDEOS_PER_COURSE = 1000;
const MAX_NOTES = 20000;
const MAX_NOTE_LENGTH = 10000;

/**
 * The export timestamp is in both the filename and the payload, so two
 * downloads in the same folder are tellable apart.
 */
export const backupFilename = (exportedAt: string): string =>
  `courseify-backup-${exportedAt.slice(0, 19).replace(/[:T]/g, '-')}.json`;

/**
 * Hand a backup payload to the browser as a download.
 *
 * Deliberately free of any storage dependency: the caller supplies the payload
 * and decides what to record afterwards, so this stays usable from the navbar
 * menu and the dashboard reminder alike without either duplicating the other.
 *
 * @throws if the browser refuses to create the object URL, so the caller can
 * report a failed export rather than silently doing nothing.
 */
export const downloadBackup = (backup: BackupData): void => {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = backupFilename(backup.exportedAt);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Revoke on the next tick: revoking synchronously can cancel the download
    // in some browsers before it starts reading the blob.
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
};

/**
 * A rejected import, carrying a reason code so the UI can offer the right
 * remedy (try again vs. re-export from a Courseify browser) rather than a
 * generic "import failed".
 */
export class BackupValidationError extends Error {
  readonly code: BackupErrorCode;
  readonly detail?: string;

  constructor(code: BackupErrorCode, message: string, detail?: string) {
    super(message);
    this.name = 'BackupValidationError';
    this.code = code;
    this.detail = detail;
  }
}

export type BackupErrorCode =
  | 'EMPTY_FILE'
  | 'TOO_LARGE'
  | 'NOT_JSON'
  | 'NOT_AN_OBJECT'
  | 'UNSUPPORTED_SCHEMA'
  | 'INVALID_PROFILE'
  | 'INVALID_SETTINGS'
  | 'INVALID_COURSES'
  | 'INVALID_COURSE_DATA'
  | 'INVALID_FAVORITES'
  | 'INVALID_HISTORY';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const asFiniteNumber = (value: unknown, fallback = 0): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const asIsoDate = (value: unknown, fallback: string): string => {
  const text = asString(value);
  if (!text) return fallback;
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? fallback : new Date(parsed).toISOString();
};

/**
 * Declared with an explicit type so TypeScript's control-flow analysis treats a
 * call to it as proof the value was validated, which is what lets the callers
 * below read `value.x` without a cast.
 */
const fail: (code: BackupErrorCode, message: string, detail?: string) => never = (code, message, detail) => {
  throw new BackupValidationError(code, message, detail);
};

function normalizeSettings(value: unknown): AppSettings {
  if (!isRecord(value)) {
    fail('INVALID_SETTINGS', 'The backup has a broken settings block, so it cannot be restored safely.');
  }
  const theme = value.theme === 'dark' ? 'dark' : 'light';
  const threshold = asFiniteNumber(value.autoCompleteThreshold, DEFAULT_SETTINGS.autoCompleteThreshold);
  const goal = asFiniteNumber(value.dailyFocusGoalMinutes, DEFAULT_SETTINGS.dailyFocusGoalMinutes ?? 60);

  return {
    autoplayNext: typeof value.autoplayNext === 'boolean' ? value.autoplayNext : DEFAULT_SETTINGS.autoplayNext,
    autoCompleteOnEnd: typeof value.autoCompleteOnEnd === 'boolean' ? value.autoCompleteOnEnd : DEFAULT_SETTINGS.autoCompleteOnEnd,
    // A threshold outside 0..1 would make auto-complete fire on load or never.
    autoCompleteThreshold: Math.min(1, Math.max(0.5, threshold)),
    theme,
    dailyFocusGoalMinutes: Math.min(1440, Math.max(1, Math.round(goal))),
    firstAccessDate: typeof value.firstAccessDate === 'string' ? value.firstAccessDate : undefined
  };
}

function normalizeProfile(value: unknown): UserProfile {
  if (!isRecord(value) || typeof value.name !== 'string') {
    fail('INVALID_PROFILE', 'The backup has a broken profile block, so it cannot be restored safely.');
  }
  const name = value.name.trim();
  if (name === 'Asha') return { ...DEFAULT_PROFILE, name: 'User' };
  return { name: name.substring(0, 80) || DEFAULT_PROFILE.name };
}

function normalizeVideo(raw: unknown, courseId: string, index: number): VideoItem {
  if (!isRecord(raw) || typeof raw.videoId !== 'string' || !raw.videoId) {
    fail('INVALID_COURSE_DATA', `A lesson in course "${courseId}" has no video id, so it cannot be restored.`);
  }
  const durationSec = Math.max(0, Math.round(asFiniteNumber(raw.durationSec)));
  return {
    videoId: raw.videoId,
    position: Math.max(0, Math.round(asFiniteNumber(raw.position, index))),
    title: asString(raw.title, 'Untitled lesson').substring(0, 500),
    description: asString(raw.description).substring(0, 4000),
    durationSec,
    durationFormatted: asString(raw.durationFormatted, '00:00'),
    thumbnailUrl: asString(raw.thumbnailUrl),
    unavailable: raw.unavailable === true
  };
}

function normalizeProgress(raw: unknown, courseId: string, videos: VideoItem[]): CourseProgress {
  const now = new Date().toISOString();
  if (!isRecord(raw)) {
    fail('INVALID_COURSE_DATA', `Course "${courseId}" has broken progress data, so it cannot be restored.`);
  }

  const knownIds = new Set(videos.map(v => v.videoId));
  const entries: Record<string, VideoProgress> = {};
  if (isRecord(raw.videos)) {
    for (const [videoId, value] of Object.entries(raw.videos)) {
      if (!isRecord(value)) continue;
      const durationSec = videos.find(v => v.videoId === videoId)?.durationSec ?? 0;
      entries[videoId] = {
        completed: value.completed === true,
        // An imported position beyond the lesson length would resume on the
        // "ended" screen; clamp it instead.
        positionSec: clampSeconds(value.positionSec, durationSec || undefined),
        completedAt: typeof value.completedAt === 'string' ? value.completedAt : null
      };
    }
  }

  const requestedLast = asString(raw.lastVideoId);
  return {
    lastVideoId: knownIds.has(requestedLast) ? requestedLast : '',
    updatedAt: asIsoDate(raw.updatedAt, now),
    completedAt: typeof raw.completedAt === 'string' ? raw.completedAt : null,
    videos: entries
  };
}

function normalizeNotes(raw: unknown, courseId: string): CourseNotes {
  if (!isRecord(raw)) {
    fail('INVALID_COURSE_DATA', `Course "${courseId}" has broken notes, so it cannot be restored.`);
  }
  const notes: CourseNotes = {};
  let count = 0;
  for (const [videoId, value] of Object.entries(raw)) {
    if (count >= MAX_NOTES) break;
    if (!isRecord(value)) continue;
    const text = asString(value.text);
    if (!text.trim()) continue;
    notes[videoId] = {
      text: text.substring(0, MAX_NOTE_LENGTH),
      updatedAt: asIsoDate(value.updatedAt, new Date().toISOString())
    } satisfies VideoNote;
    count += 1;
  }
  return notes;
}

function normalizeCourse(raw: unknown, index: number): Course {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id) {
    fail('INVALID_COURSES', 'A course in this backup has no id, so it cannot be restored.');
  }
  if (typeof raw.title !== 'string') {
    fail('INVALID_COURSES', `Course "${raw.id}" has no title, so it cannot be restored.`);
  }
  const now = new Date().toISOString();
  const rawSource = isRecord(raw.source) ? raw.source : undefined;
  const sourceType = rawSource?.type;
  const source: CourseSource | undefined = sourceType === 'playlist' || sourceType === 'video'
    ? { type: sourceType, id: asString(rawSource?.id), url: asString(rawSource?.url) }
    : undefined;

  return {
    id: raw.id,
    title: raw.title.substring(0, 500),
    channelTitle: asString(raw.channelTitle, 'YouTube Creator').substring(0, 200),
    thumbnailUrl: asString(raw.thumbnailUrl),
    videoCount: Math.max(0, Math.round(asFiniteNumber(raw.videoCount))),
    totalDurationSec: Math.max(0, Math.round(asFiniteNumber(raw.totalDurationSec))),
    totalDurationFormatted: typeof raw.totalDurationFormatted === 'string' ? raw.totalDurationFormatted : undefined,
    description: typeof raw.description === 'string' ? raw.description.substring(0, 4000) : undefined,
    addedAt: asIsoDate(raw.addedAt, now),
    lastOpenedAt: asIsoDate(raw.lastOpenedAt, now),
    source,
    truncated: raw.truncated === true ? true : undefined,
    totalItemCount: Number.isFinite(raw.totalItemCount) ? Math.max(0, Math.round(raw.totalItemCount as number)) : undefined
  } satisfies Course & { truncated?: boolean; totalItemCount?: number };
}

function normalizeFavorites(raw: unknown): FavoriteVideo[] {
  if (!Array.isArray(raw)) {
    fail('INVALID_FAVORITES', 'The backup has a broken favourites list, so it cannot be restored.');
  }
  const seen = new Set<string>();
  const favorites: FavoriteVideo[] = [];
  for (const value of raw) {
    if (!isRecord(value) || typeof value.videoId !== 'string' || !value.videoId) continue;
    if (seen.has(value.videoId)) continue;
    seen.add(value.videoId);
    favorites.push({
      courseId: asString(value.courseId),
      courseTitle: asString(value.courseTitle, 'Course'),
      videoId: value.videoId,
      title: asString(value.title, 'Untitled lesson').substring(0, 500),
      durationFormatted: asString(value.durationFormatted, '00:00'),
      thumbnailUrl: asString(value.thumbnailUrl),
      addedAt: asIsoDate(value.addedAt, new Date().toISOString())
    });
  }
  return favorites;
}

function normalizeWatchActivity(raw: Record<string, unknown>): Record<string, number> {
  if (raw.watchActivity === undefined) return {};
  const value = raw.watchActivity;
  if (!isRecord(value)) {
    fail('INVALID_HISTORY', 'The backup has a broken watch history, so it cannot be restored.');
  }
  const activity: Record<string, number> = {};
  for (const [date, seconds] of Object.entries(value)) {
    // Only `YYYY-MM-DD` keys are meaningful; anything else would render as a
    // NaN bar on the dashboard.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const numeric = asFiniteNumber(seconds);
    if (numeric > 0) activity[date] = Math.min(numeric, 86400);
  }
  return activity;
}

function normalizeAccessDays(raw: Record<string, unknown>): string[] {
  if (raw.accessDays === undefined) return [];
  const value = raw.accessDays;
  if (!Array.isArray(value)) {
    fail('INVALID_HISTORY', 'The backup has a broken access history, so it cannot be restored.');
  }
  const days = new Set<string>();
  for (const day of value) {
    if (typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)) days.add(day);
  }
  return [...days].sort();
}

/**
 * Parse and fully validate a backup file.
 *
 * Throws {@link BackupValidationError} with a specific code and message; never
 * returns a partially-trusted object. Every field that reaches localStorage
 * afterwards has been range-checked, so a hand-edited or corrupt file cannot
 * inject NaN percentages, out-of-range resume positions or prototype keys.
 */
export function parseBackupFile(jsonString: string): BackupData {
  const trimmed = jsonString.trim();
  if (!trimmed) {
    fail('EMPTY_FILE', 'That file is empty. Export a backup from Courseify and try again.');
  }
  if (trimmed.length > MAX_BACKUP_BYTES) {
    fail('TOO_LARGE', 'That file is larger than 10 MB. Export a fresh backup and try again.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    fail('NOT_JSON', "That file isn't valid JSON. Make sure you picked the .json file Courseify exported, not a renamed one.");
  }
  if (!isRecord(parsed)) {
    fail('NOT_AN_OBJECT', "That file isn't a Courseify backup. Pick the .json file exported from the backup menu.");
  }

  const version = parsed.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    fail('UNSUPPORTED_SCHEMA', 'That file has no schema version, so it is not a Courseify backup.');
  }
  if (version < MIN_SUPPORTED_BACKUP_SCHEMA_VERSION || version > CURRENT_BACKUP_SCHEMA_VERSION) {
    fail(
      'UNSUPPORTED_SCHEMA',
      version > CURRENT_BACKUP_SCHEMA_VERSION
        ? `That backup was made by a newer version of Courseify. Update the app, then import it.`
        : 'That backup is too old for this version of Courseify.'
    );
  }

  if (!Array.isArray(parsed.courses)) {
    fail('INVALID_COURSES', "That backup has no readable courses list, so it can't be restored.");
  }
  if (parsed.courses.length > MAX_COURSES) {
    fail('INVALID_COURSES', `That backup claims ${parsed.courses.length} courses, which is more than Courseify supports.`);
  }
  if (!isRecord(parsed.courseData)) {
    fail('INVALID_COURSE_DATA', "That backup has no readable course data, so it can't be restored.");
  }

  const courses = parsed.courses.map(normalizeCourse);

  const courseData: BackupData['courseData'] = {};
  for (const course of courses) {
    const rawData = parsed.courseData[course.id];
    if (rawData === undefined) {
      courseData[course.id] = { videos: [], progress: emptyProgress(), notes: {} };
      continue;
    }
    if (!isRecord(rawData) || !Array.isArray(rawData.videos)) {
      fail('INVALID_COURSE_DATA', `Course "${course.title}" has unreadable lesson data, so it can't be restored.`);
    }
    if (rawData.videos.length > MAX_VIDEOS_PER_COURSE) {
      fail('INVALID_COURSE_DATA', `Course "${course.title}" has more lessons than Courseify can store.`);
    }
    const videos = rawData.videos.map((video, index) => normalizeVideo(video, course.id, index));
    courseData[course.id] = {
      videos,
      progress: normalizeProgress(rawData.progress, course.id, videos),
      notes: normalizeNotes(rawData.notes, course.id)
    };
  }

  return {
    schemaVersion: CURRENT_BACKUP_SCHEMA_VERSION,
    exportedAt: asIsoDate(parsed.exportedAt, new Date().toISOString()),
    profile: normalizeProfile(parsed.profile),
    settings: normalizeSettings(parsed.settings),
    courses,
    favorites: normalizeFavorites(parsed.favorites),
    watchActivity: normalizeWatchActivity(parsed),
    accessDays: normalizeAccessDays(parsed),
    courseData
  };
}

export function emptyProgress(): CourseProgress {
  return {
    lastVideoId: '',
    updatedAt: new Date().toISOString(),
    completedAt: null,
    videos: {}
  };
}

export type ImportStrategy = 'replace' | 'merge';

export interface ImportConflict {
  courseId: string;
  courseTitle: string;
  /** Videos the incoming file has that this browser does not. */
  incomingOnly: number;
  /** Videos this browser has that the incoming file does not. */
  existingOnly: number;
  /** Videos present in both. */
  shared: number;
  /** True when existing watch progress would be lost by overwriting. */
  losesProgress: boolean;
}

export interface ImportAnalysis {
  hasConflicts: boolean;
  conflicts: ImportConflict[];
  newCourseCount: number;
  updatedCourseCount: number;
  summary: string;
}

/**
 * Compare an incoming backup against what is already stored so the UI can ask
 * "replace everything or merge?" instead of silently destroying local progress.
 */
export function analyzeImport(
  backup: BackupData,
  existingCourses: Course[],
  existingCourseData: BackupData['courseData']
): ImportAnalysis {
  const byId = new Map(existingCourses.map(course => [course.id, course]));
  const conflicts: ImportConflict[] = [];
  let newCourseCount = 0;
  let updatedCourseCount = 0;

  for (const course of backup.courses) {
    const existing = byId.get(course.id);
    if (!existing) {
      newCourseCount += 1;
      continue;
    }
    updatedCourseCount += 1;

    const incomingIds = new Set(backup.courseData[course.id]?.videos.map(v => v.videoId));
    const existingIds = new Set(existingCourseData[course.id]?.videos.map(v => v.videoId));
    let shared = 0;
    for (const id of incomingIds) {
      if (existingIds.has(id)) shared += 1;
    }

    const incomingCompleted = Object.values(backup.courseData[course.id]?.progress.videos ?? {})
      .filter(entry => entry.completed).length;
    const existingCompleted = Object.values(existingCourseData[course.id]?.progress.videos ?? {})
      .filter(entry => entry.completed).length;

    const conflict: ImportConflict = {
      courseId: course.id,
      courseTitle: course.title,
      incomingOnly: [...incomingIds].filter(id => !existingIds.has(id)).length,
      existingOnly: [...existingIds].filter(id => !incomingIds.has(id)).length,
      shared,
      losesProgress: existingCompleted > incomingCompleted
    };
    if (conflict.incomingOnly > 0 || conflict.existingOnly > 0 || conflict.losesProgress) {
      conflicts.push(conflict);
    }
  }

  const hasConflicts = conflicts.length > 0;
  const parts: string[] = [];
  if (newCourseCount > 0) parts.push(`${newCourseCount} new course${newCourseCount === 1 ? '' : 's'}`);
  if (updatedCourseCount > 0) parts.push(`${updatedCourseCount} existing course${updatedCourseCount === 1 ? '' : 's'} updated`);
  if (hasConflicts) parts.push(`${conflicts.length} course${conflicts.length === 1 ? ' has' : 's have'} changes`);

  return {
    hasConflicts,
    conflicts,
    newCourseCount,
    updatedCourseCount,
    summary: parts.length > 0 ? parts.join(', ') : 'No courses in this backup'
  };
}

/**
 * Resolve the final course set for a given strategy. `merge` keeps lessons the
 * incoming file does not know about and unions the two progress maps, so a
 * merge never loses a completion.
 */
export function resolveImportCourses(
  backup: BackupData,
  existingCourses: Course[],
  existingCourseData: BackupData['courseData'],
  strategy: ImportStrategy
): { courses: Course[]; courseData: BackupData['courseData'] } {
  if (strategy === 'replace') {
    return { courses: backup.courses, courseData: backup.courseData };
  }

  const byId = new Map(existingCourses.map(course => [course.id, course]));
  const mergedData: BackupData['courseData'] = {};
  for (const course of backup.courses) {
    const existingData = existingCourseData[course.id];
    const incoming = backup.courseData[course.id] ?? { videos: [], progress: emptyProgress(), notes: {} };
    if (!existingData) {
      byId.set(course.id, course);
      mergedData[course.id] = incoming;
      continue;
    }

    const videosById = new Map(existingData.videos.map(v => [v.videoId, v]));
    for (const video of incoming.videos) videosById.set(video.videoId, video);

    const videos: VideoItem[] = [...videosById.values()].sort((a, b) => a.position - b.position)
      .map((video, index) => ({ ...video, position: index }));

    const progressMap: Record<string, VideoProgress> = { ...existingData.progress.videos };
    for (const [videoId, entry] of Object.entries(incoming.progress.videos)) {
      const existingEntry = progressMap[videoId];
      // A completion already earned locally is never downgraded by a merge.
      if (existingEntry?.completed) continue;
      const durationSec = videosById.get(videoId)?.durationSec ?? 0;
      progressMap[videoId] = {
        completed: entry.completed,
        positionSec: Math.max(existingEntry?.positionSec ?? 0, clampSeconds(entry.positionSec, durationSec || undefined)),
        completedAt: entry.completedAt
      };
    }

    mergedData[course.id] = {
      videos,
      progress: {
        lastVideoId: incoming.progress.lastVideoId || existingData.progress.lastVideoId,
        updatedAt: incoming.progress.updatedAt,
        completedAt: incoming.progress.completedAt ?? existingData.progress.completedAt,
        videos: progressMap
      },
      notes: { ...existingData.notes, ...incoming.notes }
    };
    // Refresh the metadata, keep the local timestamps a merge should not move.
    const existingCourse = byId.get(course.id)!;
    byId.set(course.id, {
      ...existingCourse,
      ...course,
      addedAt: existingCourse.addedAt,
      videoCount: course.videoCount > 0 ? course.videoCount : videos.length
    });
  }

  // Courses that only exist locally survive a merge untouched.
  for (const course of existingCourses) {
    if (!mergedData[course.id]) mergedData[course.id] = existingCourseData[course.id];
  }

  return { courses: [...byId.values()], courseData: mergedData };
}
