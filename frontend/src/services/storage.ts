import { BackupData, Course, CourseSource, VideoItem, CourseProgress, CourseNotes, UserProfile, AppSettings, RecentNoteItem, LearningStats, FavoriteVideo, VideoProgress, VideoNote } from '../types';
import { DEFAULT_PROFILE, DEFAULT_SETTINGS } from './sampleData';
import { getPlayableVideos } from '../utils/course';
import { clampRatio, clampSeconds, computeCourseMetrics, type CourseMetrics } from '../utils/progress';
import {
  BackupValidationError,
  analyzeImport,
  parseBackupFile,
  resolveImportCourses,
  type ImportAnalysis,
  type ImportStrategy
} from './backup';

const PREFIX = 'courseify:v1:';
const GEMINI_API_KEY = 'courseify:gemini-api-key';
const AI_NOTES_PREFIX = 'courseify:ai-notes:';
const GEMINI_USAGE_PREFIX = 'courseify:gemini-usage:';
const ACTIVITY_KEY = `${PREFIX}watch-activity`;
const ACCESS_DAYS_KEY = `${PREFIX}access-days`;
// Deliberately outside PREFIX: it is device bookkeeping, not user course data, so
// a "replace" import must not wipe the record of the last real backup file.
const LAST_BACKUP_KEY = 'courseify:last-backup-at';

const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const getDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A timestamp we are willing to show in the UI. Anything else becomes `fallback`. */
function safeTimestamp(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !ISO_TIMESTAMP_PATTERN.test(value)) return fallback;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? fallback : value;
}

function safeDateKey(value: unknown): string | null {
  return typeof value === 'string' && DATE_KEY_PATTERN.test(value) ? value : null;
}

function safeNumber(value: unknown, fallback = 0): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/**
 * Reads are the trust boundary.
 *
 * Everything below localStorage can be hand-edited, written by an older version
 * of the app, or arrive from an imported backup. Each getter therefore coerces
 * and range-checks its value instead of handing a half-typed object to React,
 * which is what previously let a corrupt `positionSec: "abc"` reach the player
 * and produce a NaN progress bar.
 */
class StorageService {
  private hasInitialized = false;

  constructor() {
    this.init();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key?.startsWith(PREFIX) || event.key === null) this.triggerUpdate();
      });
    }
  }

  private init() {
    if (this.hasInitialized || typeof window === 'undefined') return;
    this.hasInitialized = true;

    try {
      if (!localStorage.getItem(`${PREFIX}profile`)) {
        this.saveProfile(DEFAULT_PROFILE);
      } else {
        try {
          const prof = JSON.parse(localStorage.getItem(`${PREFIX}profile`) || '{}');
          if (prof.name === 'Asha') {
            this.saveProfile({ ...prof, name: 'User' });
          }
        } catch {}
      }

      if (!localStorage.getItem(`${PREFIX}settings`)) {
        this.saveSettings(DEFAULT_SETTINGS);
      }

      const today = getDateKey();
      const settings = this.getSettings();
      if (!settings.firstAccessDate) {
        this.saveSettings({ ...settings, firstAccessDate: today });
      }
      const accessDays = this.getAccessDays();
      if (!accessDays.includes(today)) {
        localStorage.setItem(ACCESS_DAYS_KEY, JSON.stringify([...accessDays, today]));
      }
    } catch (e) {
      console.warn('LocalStorage initialization warning:', e);
    }
  }

  private readJson<T>(key: string): unknown {
    try {
      const data = localStorage.getItem(key);
      if (data === null) return null;
      return JSON.parse(data);
    } catch {
      // Corrupt or unreadable payloads behave as "no data" instead of
      // propagating a parse error into a render.
      return null;
    }
  }

  // --- Profile ---
  getProfile(): UserProfile {
    const parsed = this.readJson(`${PREFIX}profile`);
    if (isRecord(parsed) && typeof parsed.name === 'string') {
      const name = parsed.name.trim();
      return { name: name === 'Asha' || !name ? 'User' : name };
    }
    return DEFAULT_PROFILE;
  }

  saveProfile(profile: UserProfile): void {
    try {
      localStorage.setItem(`${PREFIX}profile`, JSON.stringify(profile));
      this.triggerUpdate();
    } catch (e) {
      this.handleQuotaError(e);
    }
  }

  // --- Settings ---
  getSettings(): AppSettings {
    const parsed = this.readJson(`${PREFIX}settings`);
    if (!isRecord(parsed)) return DEFAULT_SETTINGS;
    return normalizeSettings(parsed, DEFAULT_SETTINGS);
  }

  saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(`${PREFIX}settings`, JSON.stringify(normalizeSettings({ ...settings }, DEFAULT_SETTINGS)));
      this.triggerUpdate();
    } catch (e) {
      this.handleQuotaError(e);
    }
  }

  // --- Courses ---
  getCourses(): Course[] {
    const parsed = this.readJson(`${PREFIX}courses`);
    if (!Array.isArray(parsed)) return [];
    const now = new Date().toISOString();
    const seen = new Set<string>();
    const courses: Course[] = [];
    for (const value of parsed) {
      const course = normalizeCourse(value, now);
      if (!course || seen.has(course.id)) continue;
      seen.add(course.id);
      courses.push(course);
    }
    return courses;
  }

  /** @returns false when the write failed (quota/private mode) so callers can roll back. */
  saveCourses(courses: Course[]): boolean {
    try {
      localStorage.setItem(`${PREFIX}courses`, JSON.stringify(courses));
      this.triggerUpdate();
      return true;
    } catch (e) {
      this.handleQuotaError(e);
      return false;
    }
  }

  getCourse(courseId: string): Course | null {
    const courses = this.getCourses();
    return courses.find(c => c.id === courseId) || null;
  }

  addOrUpdateCourse(course: Course): boolean {
    const courses = this.getCourses();
    const idx = courses.findIndex(c => c.id === course.id);
    if (idx >= 0) {
      // Merge so a re-import refreshes metadata without wiping local fields
      // such as lastOpenedAt that the import does not carry.
      courses[idx] = { ...courses[idx], ...course, addedAt: courses[idx].addedAt };
    } else {
      courses.unshift({ ...course, addedAt: new Date().toISOString(), lastOpenedAt: new Date().toISOString() });
    }
    return this.saveCourses(courses);
  }

  /**
   * Persist a freshly ingested course and its lessons as one unit.
   *
   * The lesson list is written first: if that write fails (usually a quota
   * error) the course is never registered, so the user cannot end up with a
   * course card that opens onto an empty player. The previous lesson list is
   * snapshotted and restored if registering the course then fails.
   *
   * @returns true when both writes landed.
   */
  addCourseWithVideos(course: Course, videos: VideoItem[]): boolean {
    const videosKey = `${PREFIX}course:${course.id}:videos`;
    const previousVideos = localStorage.getItem(videosKey);

    if (!this.saveCourseVideos(course.id, videos)) {
      if (previousVideos === null) localStorage.removeItem(videosKey);
      else localStorage.setItem(videosKey, previousVideos);
      return false;
    }

    if (this.addOrUpdateCourse(course)) return true;

    if (previousVideos === null) localStorage.removeItem(videosKey);
    else localStorage.setItem(videosKey, previousVideos);
    return false;
  }

  touchCourse(courseId: string): void {
    const course = this.getCourse(courseId);
    if (!course) return;
    const courses = this.getCourses().map(item => item.id === courseId
      ? { ...item, lastOpenedAt: new Date().toISOString() }
      : item);
    this.saveCourses(courses);
  }

  removeCourse(courseId: string): void {
    try {
      const courses = this.getCourses().filter(c => c.id !== courseId);
      this.saveCourses(courses);
      localStorage.removeItem(`${PREFIX}course:${courseId}:videos`);
      localStorage.removeItem(`${PREFIX}course:${courseId}:progress`);
      localStorage.removeItem(`${PREFIX}course:${courseId}:notes`);
      // AI session notes are keyed by course, not by the v1 prefix, so they
      // used to survive "remove course" and reappear on re-import.
      this.removeKeysWithPrefix(AI_NOTES_PREFIX, courseId);
      const favorites = this.getFavorites().filter(favorite => favorite.courseId !== courseId);
      localStorage.setItem(`${PREFIX}favorites`, JSON.stringify(favorites));
      this.triggerUpdate();
    } catch (e) {
      console.error('Error removing course:', e);
    }
  }

  // --- Course Videos ---
  getCourseVideos(courseId: string): VideoItem[] {
    const parsed = this.readJson(`${PREFIX}course:${courseId}:videos`);
    if (!Array.isArray(parsed)) return [];
    const videos: VideoItem[] = [];
    const seen = new Set<string>();
    parsed.forEach((value, index) => {
      const video = normalizeVideoItem(value, index);
      if (!video || seen.has(video.videoId)) return;
      seen.add(video.videoId);
      videos.push(video);
    });
    return videos;
  }

  /** @returns false when the write failed (quota/private mode) so callers can roll back. */
  saveCourseVideos(courseId: string, videos: VideoItem[]): boolean {
    try {
      const sanitized = videos.map((v, index) => ({
        ...v,
        position: Number.isFinite(v.position) ? v.position : index,
        description: (v.description || '').substring(0, 4000)
      }));
      localStorage.setItem(`${PREFIX}course:${courseId}:videos`, JSON.stringify(sanitized));
      this.triggerUpdate();
      return true;
    } catch (e) {
      this.handleQuotaError(e);
      return false;
    }
  }

  /**
   * Record that a lesson can no longer be played, so the sidebar can label it
   * instead of offering a dead play button.
   *
   * Only ever called for the player's permanent error codes (100/101/150); a
   * transient network failure must not permanently disable a lesson.
   *
   * @returns true when the stored list actually changed.
   */
  markVideoUnavailable(courseId: string, videoId: string): boolean {
    const videos = this.getCourseVideos(courseId);
    const target = videos.find(v => v.videoId === videoId);
    if (!target || target.unavailable) return false;

    this.saveCourseVideos(courseId, videos.map(v => (
      v.videoId === videoId
        ? { ...v, unavailable: true, title: v.title || 'Unavailable video', durationSec: 0, durationFormatted: '00:00' }
        : v
    )));
    return true;
  }

  // --- Course Progress ---
  getCourseProgress(courseId: string): CourseProgress {
    const parsed = this.readJson(`${PREFIX}course:${courseId}:progress`);
    if (!isRecord(parsed)) {
      return {
        lastVideoId: '',
        updatedAt: new Date().toISOString(),
        completedAt: null,
        videos: {}
      };
    }
    return normalizeCourseProgress(parsed);
  }

  saveCourseProgress(courseId: string, progress: CourseProgress): void {
    try {
      localStorage.setItem(`${PREFIX}course:${courseId}:progress`, JSON.stringify(progress));
      this.triggerUpdate();
    } catch (e) {
      this.handleQuotaError(e);
    }
  }

  private updateCourseCompletion(progress: CourseProgress, videos: VideoItem[]): boolean {
    const playableVideos = getPlayableVideos(videos);
    const completedCount = playableVideos.filter(video => progress.videos[video.videoId]?.completed).length;
    const wasComplete = !!progress.completedAt;
    const isComplete = playableVideos.length > 0 && completedCount === playableVideos.length;
    progress.completedAt = isComplete ? (progress.completedAt || new Date().toISOString()) : null;
    return !wasComplete && isComplete;
  }

  setVideoCompleted(courseId: string, videoId: string, completed: boolean): { completed: boolean; courseCompleteTriggered: boolean } {
    const progress = this.getCourseProgress(courseId);
    const videos = this.getCourseVideos(courseId);

    if (!progress.videos[videoId]) {
      progress.videos[videoId] = { completed, positionSec: 0 };
    } else {
      progress.videos[videoId].completed = completed;
      progress.videos[videoId].completedAt = completed ? new Date().toISOString() : null;
    }

    progress.updatedAt = new Date().toISOString();

    const courseCompleteTriggered = this.updateCourseCompletion(progress, videos);
    this.saveCourseProgress(courseId, progress);
    return { completed, courseCompleteTriggered };
  }

  toggleVideoCompletion(courseId: string, videoId: string): { completed: boolean; courseCompleteTriggered: boolean } {
    const progress = this.getCourseProgress(courseId);
    return this.setVideoCompleted(courseId, videoId, !progress.videos[videoId]?.completed);
  }

  saveVideoPosition(courseId: string, videoId: string, positionSec: number): void {
    const progress = this.getCourseProgress(courseId);
    const video = this.getCourseVideos(courseId).find(v => v.videoId === videoId);
    // A resume point beyond the lesson length lands the user on the ended
    // screen, so clamp to the duration we actually know about.
    const clamped = clampSeconds(positionSec, video?.durationSec || undefined);
    progress.lastVideoId = videoId;
    progress.updatedAt = new Date().toISOString();

    if (!progress.videos[videoId]) {
      progress.videos[videoId] = { completed: false, positionSec: clamped };
    } else {
      progress.videos[videoId].positionSec = clamped;
    }

    this.saveCourseProgress(courseId, progress);
  }

  recordWatchTime(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    try {
      const activity = this.getWatchActivity();
      const today = getDateKey();
      activity[today] = (activity[today] || 0) + Math.min(seconds, 5);
      localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activity));
      this.triggerUpdate();
    } catch (e) {
      this.handleQuotaError(e);
    }
  }

  private getWatchActivity(): Record<string, number> {
    const parsed = this.readJson(ACTIVITY_KEY);
    if (!isRecord(parsed)) return {};
    const activity: Record<string, number> = {};
    for (const [date, value] of Object.entries(parsed)) {
      if (!safeDateKey(date)) continue;
      const seconds = safeNumber(value);
      if (seconds > 0) activity[date] = Math.min(seconds, 86400);
    }
    return activity;
  }

  private getAccessDays(): string[] {
    const parsed = this.readJson(ACCESS_DAYS_KEY);
    if (!Array.isArray(parsed)) return [];
    const days = new Set<string>();
    for (const day of parsed) {
      const key = safeDateKey(day);
      if (key) days.add(key);
    }
    return [...days].sort();
  }

  resetCourseProgress(courseId: string): void {
    const progress: CourseProgress = {
      lastVideoId: '',
      updatedAt: new Date().toISOString(),
      completedAt: null,
      videos: {}
    };
    this.saveCourseProgress(courseId, progress);
  }

  // --- Course Notes ---
  getCourseNotes(courseId: string): CourseNotes {
    const parsed = this.readJson(`${PREFIX}course:${courseId}:notes`);
    if (!isRecord(parsed)) return {};
    const notes: CourseNotes = {};
    for (const [videoId, value] of Object.entries(parsed)) {
      if (!isRecord(value) || typeof value.text !== 'string' || !value.text) continue;
      notes[videoId] = {
        text: value.text,
        updatedAt: safeTimestamp(value.updatedAt, new Date().toISOString())
      } satisfies VideoNote;
    }
    return notes;
  }

  saveCourseNotes(courseId: string, notes: CourseNotes): void {
    try {
      localStorage.setItem(`${PREFIX}course:${courseId}:notes`, JSON.stringify(notes));
      this.triggerUpdate();
    } catch (e) {
      this.handleQuotaError(e);
    }
  }

  getVideoNote(courseId: string, videoId: string): string {
    const notes = this.getCourseNotes(courseId);
    return notes[videoId]?.text || '';
  }

  saveVideoNote(courseId: string, videoId: string, text: string): void {
    try {
      const notes = this.getCourseNotes(courseId);
      if (!text || text.trim() === '') {
        delete notes[videoId];
      } else {
        notes[videoId] = {
          text,
          updatedAt: new Date().toISOString()
        };
      }
      localStorage.setItem(`${PREFIX}course:${courseId}:notes`, JSON.stringify(notes));
      this.triggerUpdate();
    } catch (e) {
      this.handleQuotaError(e);
    }
  }

  // --- Favorites (Videos Across Courses) ---
  getFavorites(): FavoriteVideo[] {
    const parsed = this.readJson(`${PREFIX}favorites`);
    if (!Array.isArray(parsed)) return [];
    const now = new Date().toISOString();
    const favorites: FavoriteVideo[] = [];
    const seen = new Set<string>();
    for (const value of parsed) {
      if (!isRecord(value) || typeof value.videoId !== 'string' || !value.videoId) continue;
      if (seen.has(value.videoId)) continue;
      seen.add(value.videoId);
      favorites.push({
        courseId: safeString(value.courseId),
        courseTitle: safeString(value.courseTitle, 'Course'),
        videoId: value.videoId,
        title: safeString(value.title, 'Untitled lesson'),
        durationFormatted: safeString(value.durationFormatted, '00:00'),
        thumbnailUrl: safeString(value.thumbnailUrl),
        addedAt: safeTimestamp(value.addedAt, now)
      });
    }
    return favorites;
  }

  isFavorite(videoId: string): boolean {
    const favs = this.getFavorites();
    return favs.some(f => f.videoId === videoId);
  }

  toggleFavorite(fav: FavoriteVideo): boolean {
    const favs = this.getFavorites();
    const idx = favs.findIndex(f => f.videoId === fav.videoId);
    let isNowFav = false;
    if (idx >= 0) {
      favs.splice(idx, 1);
      isNowFav = false;
    } else {
      favs.unshift(fav);
      isNowFav = true;
    }
    this.saveFavorites(favs);
    return isNowFav;
  }

  saveFavorites(favorites: FavoriteVideo[]): void {
    try {
      localStorage.setItem(`${PREFIX}favorites`, JSON.stringify(favorites));
      this.triggerUpdate();
    } catch (e) {
      this.handleQuotaError(e);
    }
  }

  // --- Progress Metrics ---
  /**
   * All completion maths lives in {@link computeCourseMetrics} so the sidebar,
   * dashboard and player cannot disagree about the same course.
   */
  getCourseMetrics(courseId: string): CourseMetrics {
    const course = this.getCourse(courseId);
    const videos = this.getCourseVideos(courseId);
    const progress = this.getCourseProgress(courseId);
    return computeCourseMetrics(videos, progress, course?.totalDurationSec);
  }

  // --- Recent Notes Query ---
  getRecentNotes(limit = 4): RecentNoteItem[] {
    const courses = this.getCourses();
    const result: RecentNoteItem[] = [];

    for (const course of courses) {
      const notes = this.getCourseNotes(course.id);
      const videos = this.getCourseVideos(course.id);

      for (const [videoId, note] of Object.entries(notes)) {
        if (!note.text) continue;
        const vid = videos.find(v => v.videoId === videoId);
        result.push({
          courseId: course.id,
          courseTitle: course.title,
          videoId,
          videoTitle: vid?.title || 'Video',
          videoPosition: vid ? vid.position + 1 : 1,
          text: note.text,
          updatedAt: note.updatedAt
        });
      }
    }

    result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return result.slice(0, limit);
  }

  // --- Fully Dynamic Learning Stats & Weekly Activity ---
  getLearningStats(): LearningStats {
    const courses = this.getCourses();
    const activity = this.getWatchActivity();
    const totalWatchedSec = Object.values(activity).reduce((total, seconds) => total + seconds, 0);
    let completedVideosCount = 0;
    let completedCoursesCount = 0;

    for (const course of courses) {
      const metrics = this.getCourseMetrics(course.id);
      completedVideosCount += metrics.completedVideos;
      if (metrics.isCompleted) completedCoursesCount++;
    }

    const totalHours = +(totalWatchedSec / 3600).toFixed(1);
    const todaySeconds = activity[getDateKey()] || 0;
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const todayIndex = now.getDay();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - todayIndex);
    const weeklyHours = dayNames.map((day, idx) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + idx);
      return { day, hours: +(idx <= todayIndex ? ((activity[getDateKey(date)] || 0) / 3600).toFixed(1) : 0) };
    });

    const accessDays = new Set(this.getAccessDays());
    let dayStreak = 0;
    for (let offset = 0; offset <= todayIndex + 365; offset++) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
      if (!accessDays.has(getDateKey(date))) break;
      dayStreak++;
    }
    const activeDaysCount = weeklyHours.filter(d => d.hours > 0).length;
    const avgHoursPerDay = activeDaysCount > 0 ? +(weeklyHours.reduce((total, d) => total + d.hours, 0) / activeDaysCount).toFixed(1) : 0;

    return {
      hoursWatched: Math.round(totalHours),
      videosCompleted: completedVideosCount,
      coursesCompleted: completedCoursesCount,
      dayStreak,
      avgHoursPerDay,
      dailyMinutesStudied: Math.floor(todaySeconds / 60),
      weeklyHours
    };
  }

  private removeKeysWithPrefix(prefix: string, suffix?: string): number {
    if (typeof localStorage === 'undefined') return 0;
    let removed = 0;
    // localStorage enumeration is a live key list, so collect first, then write.
    const doomed = Object.keys(localStorage).filter(key => {
      if (!key.startsWith(prefix)) return false;
      return suffix === undefined || key === `${prefix}${suffix}` || key.startsWith(`${prefix}${suffix}:`);
    });
    for (const key of doomed) {
      localStorage.removeItem(key);
      removed += 1;
    }
    return removed;
  }

  /**
   * Wipe every Courseify key.
   *
   * AI session notes are stored under `courseify:ai-notes:*` and the Gemini key
   * under `courseify:gemini-api-key`, neither of which carries the `v1` prefix.
   * They were previously left behind, so "clear all my data" still surfaced
   * old AI answers and kept the user's API key on the device.
   */
  clearData(): void {
    this.removeKeysWithPrefix(PREFIX);
    this.removeKeysWithPrefix(AI_NOTES_PREFIX);
    this.removeKeysWithPrefix(GEMINI_USAGE_PREFIX);
    localStorage.removeItem(GEMINI_API_KEY);
    localStorage.removeItem('courseify:last-seen-release');
    localStorage.removeItem(LAST_BACKUP_KEY);
    window.dispatchEvent(new Event('courseify:gemini-key-changed'));
    window.dispatchEvent(new Event('courseify:gemini-usage-updated'));
    this.hasInitialized = false;
    this.init();
    this.triggerUpdate();
  }

  // --- Export / Import JSON Backup (ST-5) ---

  /**
   * When the user last exported a backup file, or null if never.
   *
   * Courseify only stores data in this browser, so clearing site data (or
   * switching browsers/devices) is unrecoverable without a file. The dashboard
   * uses this to surface a reminder rather than quietly hoping they remember.
   */
  getLastBackupAt(): string | null {
    try {
      const value = localStorage.getItem(LAST_BACKUP_KEY);
      if (!value) return null;
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? null : value;
    } catch {
      return null;
    }
  }

  recordBackupExport(): void {
    try {
      localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
      this.triggerUpdate();
    } catch {
      // A full quota must not break the export the user just completed.
    }
  }

  exportBackup(): BackupData {
    const backup: BackupData = {
      schemaVersion: 3,
      exportedAt: new Date().toISOString(),
      profile: this.getProfile(),
      settings: this.getSettings(),
      courses: this.getCourses(),
      favorites: this.getFavorites(),
      watchActivity: this.getWatchActivity(),
      accessDays: this.getAccessDays(),
      courseData: {}
    };

    for (const course of backup.courses) {
      backup.courseData[course.id] = {
        videos: this.getCourseVideos(course.id),
        progress: this.getCourseProgress(course.id),
        notes: this.getCourseNotes(course.id)
      };
    }

    return backup;
  }

  /**
   * Validate a candidate file without writing anything, so the UI can show the
   * conflict summary before the user commits to an import strategy.
   */
  inspectBackup(jsonString: string): { backup: BackupData; analysis: ImportAnalysis } {
    const backup = parseBackupFile(jsonString);
    const existingCourses = this.getCourses();
    const existingCourseData: BackupData['courseData'] = {};
    for (const course of existingCourses) {
      existingCourseData[course.id] = {
        videos: this.getCourseVideos(course.id),
        progress: this.getCourseProgress(course.id),
        notes: this.getCourseNotes(course.id)
      };
    }
    return { backup, analysis: analyzeImport(backup, existingCourses, existingCourseData) };
  }

  /**
   * Import a validated backup.
   *
   * Writes are staged through a snapshot so a quota error halfway through
   * restores the previous data instead of leaving the user with a half-imported
   * library.
   *
   * @throws {BackupValidationError} when the file is not a usable backup.
   */
  importBackup(jsonString: string, strategy: ImportStrategy = 'replace'): ImportAnalysis {
    const { backup, analysis } = this.inspectBackup(jsonString);
    const existingCourses = this.getCourses();
    const existingCourseData: BackupData['courseData'] = {};
    for (const course of existingCourses) {
      existingCourseData[course.id] = {
        videos: this.getCourseVideos(course.id),
        progress: this.getCourseProgress(course.id),
        notes: this.getCourseNotes(course.id)
      };
    }

    const resolved = strategy === 'merge'
      ? resolveImportCourses(backup, existingCourses, existingCourseData, 'merge')
      : resolveImportCourses(backup, existingCourses, existingCourseData, 'replace');

    const previous = new Map<string, string>();
    try {
      for (const key of Object.keys(localStorage).filter(key => key.startsWith(PREFIX))) {
        const value = localStorage.getItem(key);
        if (value !== null) previous.set(key, value);
      }

      if (strategy === 'replace') {
        for (const key of Object.keys(localStorage).filter(key => key.startsWith(PREFIX))) {
          localStorage.removeItem(key);
        }
      }

      localStorage.setItem(`${PREFIX}profile`, JSON.stringify(backup.profile));
      localStorage.setItem(`${PREFIX}settings`, JSON.stringify(backup.settings));
      localStorage.setItem(`${PREFIX}courses`, JSON.stringify(resolved.courses));
      const favorites = strategy === 'merge' ? dedupeFavorites([...this.getFavorites(), ...backup.favorites]) : backup.favorites;
      localStorage.setItem(`${PREFIX}favorites`, JSON.stringify(favorites));
      localStorage.setItem(ACTIVITY_KEY, JSON.stringify(mergeCounters(this.getWatchActivity(), backup.watchActivity, strategy)));
      localStorage.setItem(ACCESS_DAYS_KEY, JSON.stringify([...new Set([...this.getAccessDays(), ...backup.accessDays])].sort()));
      for (const [id, data] of Object.entries(resolved.courseData)) {
        localStorage.setItem(`${PREFIX}course:${id}:videos`, JSON.stringify(data.videos));
        localStorage.setItem(`${PREFIX}course:${id}:progress`, JSON.stringify(data.progress));
        localStorage.setItem(`${PREFIX}course:${id}:notes`, JSON.stringify(data.notes));
      }
      this.triggerUpdate();
      return analysis;
    } catch (e) {
      for (const key of Object.keys(localStorage).filter(key => key.startsWith(PREFIX))) {
        localStorage.removeItem(key);
      }
      previous.forEach((value, key) => localStorage.setItem(key, value));
      throw new BackupValidationError(
        'INVALID_COURSE_DATA',
        'There was not enough browser storage to finish importing. Nothing was changed - try exporting a smaller backup.'
      );
    }
  }

  // --- Multi-tab and Event sync ---
  private listeners: Array<() => void> = [];

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private triggerUpdate() {
    this.listeners.forEach(l => {
      try { l(); } catch {}
    });
  }

  private handleQuotaError(e: unknown) {
    const isQuota = typeof DOMException !== 'undefined'
      && e instanceof DOMException
      && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22);
    // A silent failure here is how a user loses a note without being told, so
    // the write failure is surfaced as an event the shell turns into a toast.
    this.notifyStorageError(isQuota
      ? 'This browser is out of storage space, so the last change was not saved. Export a backup and clear old data to free space.'
      : 'This browser refused to save the last change. Check that site data is allowed for this page.');
    console.error('LocalStorage write failed:', e);
  }

  private notifyStorageError(message: string) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('courseify:storage-error', { detail: { message } }));
  }
}

function dedupeFavorites(favorites: FavoriteVideo[]): FavoriteVideo[] {
  const seen = new Set<string>();
  const result: FavoriteVideo[] = [];
  for (const favorite of favorites) {
    if (seen.has(favorite.videoId)) continue;
    seen.add(favorite.videoId);
    result.push(favorite);
  }
  return result;
}

function mergeCounters(
  existing: Record<string, number>,
  incoming: Record<string, number>,
  strategy: ImportStrategy
): Record<string, number> {
  if (strategy === 'replace') return incoming;
  const merged: Record<string, number> = { ...existing };
  for (const [date, seconds] of Object.entries(incoming)) {
    // Keep the larger of the two: a merge should not erase watched time.
    merged[date] = Math.max(merged[date] ?? 0, seconds);
  }
  return merged;
}

function normalizeSettings(raw: Record<string, unknown>, defaults: AppSettings): AppSettings {
  const threshold = safeNumber(raw.autoCompleteThreshold, defaults.autoCompleteThreshold);
  const goal = safeNumber(raw.dailyFocusGoalMinutes, defaults.dailyFocusGoalMinutes ?? 60);
  const firstAccessDate = safeDateKey(raw.firstAccessDate);
  return {
    autoplayNext: typeof raw.autoplayNext === 'boolean' ? raw.autoplayNext : defaults.autoplayNext,
    autoCompleteOnEnd: typeof raw.autoCompleteOnEnd === 'boolean' ? raw.autoCompleteOnEnd : defaults.autoCompleteOnEnd,
    // Outside 0.5..1 the auto-complete rule fires on load or effectively never.
    autoCompleteThreshold: Math.min(1, Math.max(0.5, clampRatio(threshold || defaults.autoCompleteThreshold))),
    theme: raw.theme === 'dark' ? 'dark' : 'light',
    dailyFocusGoalMinutes: Math.min(1440, Math.max(1, Math.round(goal))),
    firstAccessDate: firstAccessDate ?? defaults.firstAccessDate
  };
}

function normalizeCourse(raw: unknown, now: string): Course | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id) return null;
  const rawSource = isRecord(raw.source) ? raw.source : undefined;
  const sourceType = rawSource?.type;
  const source: CourseSource | undefined = sourceType === 'playlist' || sourceType === 'video'
    ? { type: sourceType, id: safeString(rawSource?.id), url: safeString(rawSource?.url) }
    : undefined;
  const totalItemCount = safeNumber(raw.totalItemCount, 0);

  return {
    id: raw.id,
    title: safeString(raw.title, 'Untitled course'),
    channelTitle: safeString(raw.channelTitle, 'YouTube Creator'),
    thumbnailUrl: safeString(raw.thumbnailUrl),
    videoCount: Math.max(0, Math.round(safeNumber(raw.videoCount))),
    totalDurationSec: Math.max(0, Math.round(safeNumber(raw.totalDurationSec))),
    totalDurationFormatted: typeof raw.totalDurationFormatted === 'string' ? raw.totalDurationFormatted : undefined,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    addedAt: safeTimestamp(raw.addedAt, now),
    lastOpenedAt: safeTimestamp(raw.lastOpenedAt, now),
    source,
    truncated: raw.truncated === true || undefined,
    totalItemCount: totalItemCount > 0 ? Math.round(totalItemCount) : undefined
  };
}

function normalizeVideoItem(raw: unknown, index: number): VideoItem | null {
  if (!isRecord(raw) || typeof raw.videoId !== 'string' || !raw.videoId) return null;
  return {
    videoId: raw.videoId,
    position: Math.max(0, Math.round(safeNumber(raw.position, index))),
    title: safeString(raw.title, 'Untitled lesson'),
    description: safeString(raw.description),
    durationSec: Math.max(0, Math.round(safeNumber(raw.durationSec))),
    durationFormatted: safeString(raw.durationFormatted, '00:00'),
    thumbnailUrl: safeString(raw.thumbnailUrl),
    unavailable: raw.unavailable === true
  };
}

function normalizeCourseProgress(raw: Record<string, unknown>): CourseProgress {
  const now = new Date().toISOString();
  const videos: Record<string, VideoProgress> = {};
  if (isRecord(raw.videos)) {
    for (const [videoId, value] of Object.entries(raw.videos)) {
      if (!isRecord(value)) continue;
      // Clamped to a sane ceiling here; `saveVideoPosition` tightens it further
      // once the matching lesson duration is known.
      videos[videoId] = {
        completed: value.completed === true,
        positionSec: clampSeconds(value.positionSec),
        completedAt: typeof value.completedAt === 'string' ? value.completedAt : null
      };
    }
  }
  return {
    lastVideoId: safeString(raw.lastVideoId),
    updatedAt: safeTimestamp(raw.updatedAt, now),
    completedAt: typeof raw.completedAt === 'string' ? raw.completedAt : null,
    videos
  };
}

export const storage = new StorageService();
export type { CourseMetrics };
