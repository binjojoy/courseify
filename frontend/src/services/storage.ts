import { Course, VideoItem, CourseProgress, CourseNotes, UserProfile, AppSettings, RecentNoteItem, LearningStats, FavoriteVideo } from '../types';
import { DEFAULT_PROFILE, DEFAULT_SETTINGS } from './sampleData';

const PREFIX = 'courseify:v1:';
const ACTIVITY_KEY = `${PREFIX}watch-activity`;
const ACCESS_DAYS_KEY = `${PREFIX}access-days`;

const getDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

class StorageService {
  private hasInitialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.hasInitialized || typeof window === 'undefined') return;
    this.hasInitialized = true;

    try {
      const existingCourses = localStorage.getItem(`${PREFIX}courses`);
      if (existingCourses) {
        try {
          const parsed = JSON.parse(existingCourses);
          if (Array.isArray(parsed) && parsed.some((c: any) => c.id === 'PL_OS_FUNDAMENTALS' || c.id === 'PL_RUST_SCRATCH')) {
            const cleaned = parsed.filter((c: any) => !['PL_OS_FUNDAMENTALS', 'PL_RUST_SCRATCH', 'PL_ORGANIC_CHEM', 'PL_SPANISH_TRAVEL', 'PL_LINEAR_ALGEBRA', 'PL_TYPE_DESIGN'].includes(c.id));
            localStorage.setItem(`${PREFIX}courses`, JSON.stringify(cleaned));
            ['PL_OS_FUNDAMENTALS', 'PL_RUST_SCRATCH', 'PL_ORGANIC_CHEM', 'PL_SPANISH_TRAVEL', 'PL_LINEAR_ALGEBRA', 'PL_TYPE_DESIGN'].forEach(id => {
              localStorage.removeItem(`${PREFIX}course:${id}:videos`);
              localStorage.removeItem(`${PREFIX}course:${id}:progress`);
              localStorage.removeItem(`${PREFIX}course:${id}:notes`);
            });
          }
        } catch {}
      }

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

  // --- Profile ---
  getProfile(): UserProfile {
    try {
      const data = localStorage.getItem(`${PREFIX}profile`);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.name === 'Asha') parsed.name = 'User';
        return parsed;
      }
      return DEFAULT_PROFILE;
    } catch {
      return DEFAULT_PROFILE;
    }
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
    try {
      const data = localStorage.getItem(`${PREFIX}settings`);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(`${PREFIX}settings`, JSON.stringify(settings));
      this.triggerUpdate();
    } catch (e) {
      this.handleQuotaError(e);
    }
  }

  // --- Courses ---
  getCourses(): Course[] {
    try {
      const data = localStorage.getItem(`${PREFIX}courses`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  saveCourses(courses: Course[]): void {
    try {
      localStorage.setItem(`${PREFIX}courses`, JSON.stringify(courses));
      this.triggerUpdate();
    } catch (e) {
      this.handleQuotaError(e);
    }
  }

  getCourse(courseId: string): Course | null {
    const courses = this.getCourses();
    return courses.find(c => c.id === courseId) || null;
  }

  addOrUpdateCourse(course: Course): void {
    const courses = this.getCourses();
    const idx = courses.findIndex(c => c.id === course.id);
    if (idx >= 0) {
      courses[idx] = { ...courses[idx], ...course, lastOpenedAt: new Date().toISOString() };
    } else {
      courses.unshift({ ...course, addedAt: new Date().toISOString(), lastOpenedAt: new Date().toISOString() });
    }
    this.saveCourses(courses);
  }

  removeCourse(courseId: string): void {
    try {
      const courses = this.getCourses().filter(c => c.id !== courseId);
      this.saveCourses(courses);
      localStorage.removeItem(`${PREFIX}course:${courseId}:videos`);
      localStorage.removeItem(`${PREFIX}course:${courseId}:progress`);
      localStorage.removeItem(`${PREFIX}course:${courseId}:notes`);
      this.triggerUpdate();
    } catch (e) {
      console.error('Error removing course:', e);
    }
  }

  // --- Course Videos ---
  getCourseVideos(courseId: string): VideoItem[] {
    try {
      const data = localStorage.getItem(`${PREFIX}course:${courseId}:videos`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  saveCourseVideos(courseId: string, videos: VideoItem[]): void {
    try {
      const sanitized = videos.map(v => ({
        ...v,
        description: (v.description || '').substring(0, 4000)
      }));
      localStorage.setItem(`${PREFIX}course:${courseId}:videos`, JSON.stringify(sanitized));
      this.triggerUpdate();
    } catch (e) {
      this.handleQuotaError(e);
    }
  }

  // --- Course Progress ---
  getCourseProgress(courseId: string): CourseProgress {
    try {
      const data = localStorage.getItem(`${PREFIX}course:${courseId}:progress`);
      if (data) return JSON.parse(data);
    } catch {}

    return {
      lastVideoId: '',
      updatedAt: new Date().toISOString(),
      completedAt: null,
      videos: {}
    };
  }

  saveCourseProgress(courseId: string, progress: CourseProgress): void {
    try {
      localStorage.setItem(`${PREFIX}course:${courseId}:progress`, JSON.stringify(progress));
      this.triggerUpdate();
    } catch (e) {
      this.handleQuotaError(e);
    }
  }

  toggleVideoCompletion(courseId: string, videoId: string): { completed: boolean; courseCompleteTriggered: boolean } {
    const progress = this.getCourseProgress(courseId);
    const videos = this.getCourseVideos(courseId);
    const currentStatus = !!progress.videos[videoId]?.completed;
    const newStatus = !currentStatus;

    if (!progress.videos[videoId]) {
      progress.videos[videoId] = { completed: newStatus, positionSec: 0 };
    } else {
      progress.videos[videoId].completed = newStatus;
      if (newStatus) {
        progress.videos[videoId].completedAt = new Date().toISOString();
      } else {
        progress.videos[videoId].completedAt = null;
      }
    }

    progress.updatedAt = new Date().toISOString();

    const totalPlayable = videos.filter(v => !v.unavailable).length;
    const completedCount = videos.filter(v => progress.videos[v.videoId]?.completed && !v.unavailable).length;

    let courseCompleteTriggered = false;
    if (totalPlayable > 0 && completedCount === totalPlayable) {
      if (!progress.completedAt) {
        progress.completedAt = new Date().toISOString();
        courseCompleteTriggered = true;
      }
    } else {
      progress.completedAt = null;
    }

    this.saveCourseProgress(courseId, progress);
    return { completed: newStatus, courseCompleteTriggered };
  }

  saveVideoPosition(courseId: string, videoId: string, positionSec: number): void {
    const progress = this.getCourseProgress(courseId);
    progress.lastVideoId = videoId;
    progress.updatedAt = new Date().toISOString();
    
    if (!progress.videos[videoId]) {
      progress.videos[videoId] = { completed: false, positionSec: Math.floor(positionSec) };
    } else {
      progress.videos[videoId].positionSec = Math.floor(positionSec);
    }

    const course = this.getCourse(courseId);
    if (course) {
      course.lastOpenedAt = new Date().toISOString();
      this.addOrUpdateCourse(course);
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
    try {
      const data = localStorage.getItem(ACTIVITY_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  private getAccessDays(): string[] {
    try {
      const data = localStorage.getItem(ACCESS_DAYS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
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
    try {
      const data = localStorage.getItem(`${PREFIX}course:${courseId}:notes`);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
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
    try {
      const data = localStorage.getItem(`${PREFIX}favorites`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
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
    localStorage.setItem(`${PREFIX}favorites`, JSON.stringify(favs));
    this.triggerUpdate();
    return isNowFav;
  }

  // --- Progress Metrics ---
  getCourseMetrics(courseId: string) {
    const course = this.getCourse(courseId);
    const videos = this.getCourseVideos(courseId);
    const progress = this.getCourseProgress(courseId);

    const totalVideos = videos.length;
    const completedVideos = videos.filter(v => progress.videos[v.videoId]?.completed).length;
    const completionPercent = totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0;

    let totalDurationSec = course?.totalDurationSec || 0;
    if (totalDurationSec === 0 && videos.length > 0) {
      totalDurationSec = videos.reduce((acc, v) => acc + (v.durationSec || 0), 0);
    }

    let watchedDurationSec = 0;
    for (const v of videos) {
      if (progress.videos[v.videoId]?.completed) {
        watchedDurationSec += v.durationSec || 0;
      } else if (progress.videos[v.videoId]?.positionSec) {
        watchedDurationSec += Math.min(progress.videos[v.videoId].positionSec, v.durationSec || 0);
      }
    }

    return {
      totalVideos,
      completedVideos,
      completionPercent,
      totalDurationSec,
      watchedDurationSec,
      isCompleted: totalVideos > 0 && completedVideos === totalVideos,
      lastVideoId: progress.lastVideoId || videos[0]?.videoId || ''
    };
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

  clearData(): void {
    Object.keys(localStorage)
      .filter(key => key.startsWith(PREFIX))
      .forEach(key => localStorage.removeItem(key));
    this.hasInitialized = false;
    this.init();
    this.triggerUpdate();
  }

  // --- Export / Import JSON Backup (ST-5) ---
  exportBackup(): string {
    const backup: Record<string, any> = {
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      profile: this.getProfile(),
      settings: this.getSettings(),
      courses: this.getCourses(),
      favorites: this.getFavorites(),
      courseData: {}
    };

    for (const course of backup.courses) {
      backup.courseData[course.id] = {
        videos: this.getCourseVideos(course.id),
        progress: this.getCourseProgress(course.id),
        notes: this.getCourseNotes(course.id)
      };
    }

    return JSON.stringify(backup, null, 2);
  }

  importBackup(jsonString: string): boolean {
    try {
      const backup = JSON.parse(jsonString);
      if (!backup || !backup.courses) return false;

      if (backup.profile) this.saveProfile(backup.profile);
      if (backup.settings) this.saveSettings(backup.settings);
      if (backup.courses) this.saveCourses(backup.courses);
      if (backup.favorites) {
        localStorage.setItem(`${PREFIX}favorites`, JSON.stringify(backup.favorites));
      }

      if (backup.courseData) {
        for (const [id, data] of Object.entries<any>(backup.courseData)) {
          if (data.videos) this.saveCourseVideos(id, data.videos);
          if (data.progress) this.saveCourseProgress(id, data.progress);
          if (data.notes) {
            localStorage.setItem(`${PREFIX}course:${id}:notes`, JSON.stringify(data.notes));
          }
        }
      }

      this.triggerUpdate();
      return true;
    } catch (e) {
      console.error('Import backup failed:', e);
      return false;
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

  private handleQuotaError(e: any) {
    console.error('LocalStorage write failed:', e);
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      alert("Storage is full! Not enough browser storage to save this course. Remove a course and try again.");
    }
  }
}

export const storage = new StorageService();
