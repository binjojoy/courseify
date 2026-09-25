import { Course, CourseSource, VideoItem } from '../types';

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

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

export const getYouTubeSource = (input: string): CourseSource | null => {
  const value = input.trim();
  if (!value) return null;
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`);
    const playlistId = url.searchParams.get('list');
    const videoId = url.hostname.includes('youtu.be')
      ? url.pathname.slice(1).split('/')[0]
      : url.searchParams.get('v') || url.pathname.match(/\/(?:embed|shorts)\/([^/]+)/)?.[1];
    if (playlistId && /^[A-Za-z0-9_-]{12,}$/.test(playlistId)) {
      return { type: 'playlist', id: playlistId, url: value };
    }
    if (videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      return { type: 'video', id: videoId, url: value };
    }
  } catch {}
  if (/^[A-Za-z0-9_-]{12,}$/.test(value) && value.startsWith('PL')) {
    return { type: 'playlist', id: value, url: value };
  }
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) {
    return { type: 'video', id: value, url: value };
  }
  return null;
};

export async function fetchPlaylist(url: string, signal?: AbortSignal): Promise<PlaylistResponse> {
  const trimmed = url.trim();

  if (!trimmed) {
    throw new ApiError('INVALID_URL', "That doesn't look like a YouTube link. Paste a link like youtube.com/playlist?list=… or a video link.");
  }
  if (signal?.aborted) {
    throw new ApiError('CANCELLED', 'Fetch cancelled.');
  }

  try {
    const timeoutController = new AbortController();
    const timeout = window.setTimeout(() => timeoutController.abort(), 30000);
    const abortHandler = () => timeoutController.abort();
    signal?.addEventListener('abort', abortHandler, { once: true });
    const res = await fetch(`${API_URL}/api/playlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: trimmed }),
      signal: timeoutController.signal
    });
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', abortHandler);

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const code = data.error || 'API_FAILURE';
      const message = data.message || "Couldn't reach YouTube. Check your connection and try again.";
      throw new ApiError(code, message);
    }

    const source = getYouTubeSource(trimmed);
    if (!source || !data.course || !Array.isArray(data.videos)) {
      throw new ApiError('INVALID_RESPONSE', 'The source returned an invalid course response.');
    }
    return { course: { ...data.course, source }, videos: data.videos } as PlaylistResponse;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new ApiError(signal?.aborted ? 'CANCELLED' : 'TIMEOUT', signal?.aborted ? 'Fetch cancelled.' : 'The request timed out. Try again.');
    }
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError('API_FAILURE', "Couldn't reach YouTube. Check your connection and try again.");
  }
}

export async function fetchVideoDescription(videoId: string, signal?: AbortSignal): Promise<string> {
  if (!videoId) return '';
  if (signal?.aborted) return '';
  try {
    const timeoutController = new AbortController();
    const timeout = window.setTimeout(() => timeoutController.abort(), 15000);
    const abortHandler = () => timeoutController.abort();
    signal?.addEventListener('abort', abortHandler, { once: true });
    const res = await fetch(`${API_URL}/api/video/${videoId}/description`, { signal: timeoutController.signal });
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', abortHandler);
    if (!res.ok) return '';
    const data = await res.json().catch(() => ({}));
    return data.description || '';
  } catch {
    return '';
  }
}
