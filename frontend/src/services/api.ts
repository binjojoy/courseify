import { Course, VideoItem } from '../types';
import { SAMPLE_INITIAL_COURSES, OS_VIDEOS } from './sampleData';

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

  // Client-side quick check
  if (!trimmed) {
    throw new ApiError('INVALID_URL', "That doesn't look like a YouTube link. Paste a link like youtube.com/playlist?list=…");
  }

  // Attempt backend API call
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

    // Fallback if backend server is unreachable: match sample courses
    console.warn('Backend /api/playlist unreachable, falling back to local resolver:', err.message);
    const lower = trimmed.toLowerCase();

    if (lower.includes('operating') || lower.includes('os_fundamentals') || lower.includes('pl_os')) {
      const course = SAMPLE_INITIAL_COURSES.find(c => c.id === 'PL_OS_FUNDAMENTALS')!;
      return { course, videos: OS_VIDEOS };
    }

    if (lower.includes('rust')) {
      const course = SAMPLE_INITIAL_COURSES.find(c => c.id === 'PL_RUST_SCRATCH')!;
      return { course, videos: [] };
    }

    if (lower.includes('organic') || lower.includes('chem')) {
      const course = SAMPLE_INITIAL_COURSES.find(c => c.id === 'PL_ORGANIC_CHEM')!;
      return { course, videos: [] };
    }

    // If genuinely failed and not a sample
    throw new ApiError('API_FAILURE', "Couldn't reach YouTube. Check your connection and try again.");
  }
}
