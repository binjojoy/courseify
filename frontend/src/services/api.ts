import { Course, VideoItem } from '../types';

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

export async function fetchPlaylist(url: string): Promise<PlaylistResponse> {
  const trimmed = url.trim();

  if (!trimmed) {
    throw new ApiError('INVALID_URL', "That doesn't look like a YouTube link. Paste a link like youtube.com/playlist?list=… or a video link.");
  }

  try {
    const res = await fetch('/api/playlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: trimmed })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const code = data.error || 'API_FAILURE';
      const message = data.message || "Couldn't reach YouTube. Check your connection and try again.";
      throw new ApiError(code, message);
    }

    return data as PlaylistResponse;
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError('API_FAILURE', "Couldn't reach YouTube. Check your connection and try again.");
  }
}

export async function fetchVideoDescription(videoId: string): Promise<string> {
  if (!videoId) return '';
  try {
    const res = await fetch(`/api/video/${videoId}/description`);
    if (!res.ok) return '';
    const data = await res.json().catch(() => ({}));
    return data.description || '';
  } catch {
    return '';
  }
}
