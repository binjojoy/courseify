import { Course, CourseSource, VideoItem } from '../types';

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = 30000;
const DESCRIPTION_TIMEOUT_MS = 15000;
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const PLAYLIST_ID_PATTERN = /^[A-Za-z0-9_-]{8,}$/;
const YOUTUBE_HOSTS = new Set([
  'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com',
  'youtube-nocookie.com', 'www.youtube-nocookie.com'
]);
const SHORT_LINK_HOSTS = new Set(['youtu.be', 'www.youtu.be']);

export interface PlaylistResponse {
  course: Course;
  videos: VideoItem[];
}

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'ApiError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);

const asNumber = (value: unknown, fallback = 0): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

/**
 * Validate one lesson from the API. The backend is a separate deployable, so its
 * payload is untrusted: a malformed entry is dropped rather than rendered as an
 * item with `undefined` everywhere.
 */
function toVideoItem(raw: unknown, index: number): VideoItem | null {
  if (!isRecord(raw)) return null;
  const videoId = asString(raw.videoId);
  if (!VIDEO_ID_PATTERN.test(videoId)) return null;
  return {
    videoId,
    position: Math.max(0, Math.round(asNumber(raw.position, index))),
    title: asString(raw.title, 'Untitled lesson'),
    description: asString(raw.description),
    durationSec: Math.max(0, Math.round(asNumber(raw.durationSec))),
    durationFormatted: asString(raw.durationFormatted, '00:00'),
    thumbnailUrl: asString(raw.thumbnailUrl),
    unavailable: raw.unavailable === true
  };
}

/**
 * Validate a playlist response. Returns null when the shape is unusable so the
 * caller can raise a specific error instead of rendering an empty course.
 */
function toPlaylistResponse(raw: unknown, source: CourseSource): PlaylistResponse | null {
  if (!isRecord(raw) || !isRecord(raw.course)) return null;
  if (!Array.isArray(raw.videos)) return null;

  const rawCourse = raw.course;
  const courseId = asString(rawCourse.id);
  if (!courseId) return null;

  const videos: VideoItem[] = [];
  const seen = new Set<string>();
  raw.videos.forEach((entry, index) => {
    const video = toVideoItem(entry, index);
    if (!video || seen.has(video.videoId)) return;
    seen.add(video.videoId);
    videos.push(video);
  });
  if (videos.length === 0) return null;

  const declaredCount = asNumber(rawCourse.totalItemCount, 0);
  const course: Course = {
    id: courseId,
    title: asString(rawCourse.title, 'Untitled Playlist'),
    channelTitle: asString(rawCourse.channelTitle, 'YouTube Creator'),
    thumbnailUrl: asString(rawCourse.thumbnailUrl) || videos[0]?.thumbnailUrl || '',
    videoCount: Math.max(0, Math.round(asNumber(rawCourse.videoCount, videos.length))),
    totalDurationSec: Math.max(0, Math.round(asNumber(rawCourse.totalDurationSec))),
    totalDurationFormatted: typeof rawCourse.totalDurationFormatted === 'string' ? rawCourse.totalDurationFormatted : undefined,
    description: typeof rawCourse.description === 'string' ? rawCourse.description : undefined,
    addedAt: asString(rawCourse.addedAt, new Date().toISOString()),
    lastOpenedAt: asString(rawCourse.lastOpenedAt, new Date().toISOString()),
    source,
    // Surface the backend's 200-lesson cap instead of letting the UI imply the
    // course is complete.
    truncated: rawCourse.truncated === true || (declaredCount > 0 && declaredCount > videos.length),
    totalItemCount: declaredCount > 0 ? Math.round(declaredCount) : videos.length
  };

  return { course, videos };
}

/**
 * Classify a pasted link without contacting the network, so the UI can disable
 * the submit button and explain the problem before a request is made.
 */
export const getYouTubeSource = (input: string): CourseSource | null => {
  const value = input.trim();
  if (!value || value.length > 2048) return null;

  if (PLAYLIST_ID_PATTERN.test(value) && /^(?:PL|OL|UU|FL|RD|LL|LM)/.test(value)) {
    return { type: 'playlist', id: value, url: value };
  }
  if (VIDEO_ID_PATTERN.test(value)) {
    return { type: 'video', id: value, url: value };
  }

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const hostname = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(hostname) && !SHORT_LINK_HOSTS.has(hostname)) return null;

  const listParam = url.searchParams.get('list');
  if (listParam && PLAYLIST_ID_PATTERN.test(listParam)) {
    return { type: 'playlist', id: listParam, url: value };
  }

  const channelMatch = url.pathname.match(/^\/channel\/(UC[a-zA-Z0-9_-]{22})(?:\/videos)?\/?$/);
  if (channelMatch) {
    return { type: 'playlist', id: `UU${channelMatch[1].slice(2)}`, url: value };
  }

  const videoId = SHORT_LINK_HOSTS.has(hostname)
    ? url.pathname.replace(/^\//, '').split('/')[0]
    : url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];

  return videoId && VIDEO_ID_PATTERN.test(videoId)
    ? { type: 'video', id: videoId, url: value }
    : null;
};

/**
 * Run a fetch under both the caller's abort signal and a timeout, and always
 * detach the listener so a long-lived caller does not leak one per request.
 */
async function fetchWithDeadline(
  url: string,
  init: RequestInit,
  signal: AbortSignal | undefined,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  const abortHandler = () => controller.abort();
  signal?.addEventListener('abort', abortHandler, { once: true });
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', abortHandler);
  }
}

export async function fetchPlaylist(url: string, signal?: AbortSignal): Promise<PlaylistResponse> {
  const trimmed = url.trim();

  if (!trimmed) {
    throw new ApiError('INVALID_URL', "That doesn't look like a YouTube link. Paste a link like youtube.com/playlist?list=… or a video link.");
  }
  if (signal?.aborted) {
    throw new ApiError('CANCELLED', 'Fetch cancelled.');
  }
  const source = getYouTubeSource(trimmed);
  if (!source) {
    throw new ApiError('INVALID_URL', 'Courseify only reads youtube.com, youtu.be and youtube-nocookie.com links. Paste a playlist or video link.');
  }

  let res: Response;
  try {
    res = await fetchWithDeadline(
      `${API_URL}/api/playlist`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed })
      },
      signal,
      REQUEST_TIMEOUT_MS
    );
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(signal?.aborted ? 'CANCELLED' : 'TIMEOUT', signal?.aborted ? 'Fetch cancelled.' : 'The request timed out. Try again.');
    }
    throw new ApiError('API_FAILURE', "Couldn't reach the Courseify service. Check your connection and try again.");
  }

  const payload: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const error = isRecord(payload) ? asString(payload.error, 'API_FAILURE') : 'API_FAILURE';
    const fallback = error === 'RATE_LIMITED'
      ? 'Too many requests from this network. Wait a minute and try again.'
      : "Couldn't reach YouTube. Check your connection and try again.";
    throw new ApiError(error, isRecord(payload) && typeof payload.message === 'string' ? payload.message : fallback);
  }

  const parsed = toPlaylistResponse(payload, source);
  if (!parsed) {
    throw new ApiError('INVALID_RESPONSE', 'The source returned an invalid course response. Try again in a moment.');
  }
  return parsed;
}

export async function fetchVideoDescription(videoId: string, signal?: AbortSignal): Promise<string> {
  if (!VIDEO_ID_PATTERN.test(videoId)) return '';
  if (signal?.aborted) return '';
  try {
    const res = await fetchWithDeadline(
      `${API_URL}/api/video/${videoId}/description`,
      {},
      signal,
      DESCRIPTION_TIMEOUT_MS
    );
    if (!res.ok) return '';
    const payload: unknown = await res.json().catch(() => null);
    return isRecord(payload) && typeof payload.description === 'string' ? payload.description : '';
  } catch {
    // A missing description is cosmetic: the lesson still plays.
    return '';
  }
}
