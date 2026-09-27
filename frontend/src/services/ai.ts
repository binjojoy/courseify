import { VideoItem } from '../types';

const API_KEY_STORAGE = 'courseify:gemini-api-key';
const USAGE_STORAGE = 'courseify:gemini-usage';
const MODEL = 'gemini-3.8-flash';

export interface GeminiUsage {
  requestCount: number;
  totalTokens: number;
  updatedAt: string | null;
}

export interface StudyNotes {
  oneSentenceSummary: string;
  keyTakeaways: string[];
  detailedNotes: string;
  timestampedHighlights: Array<{ time: string; seconds: number; label: string }>;
  quizQuestions: Array<{ question: string; options: string[]; answerIndex: number }>;
}

const EMPTY_USAGE: GeminiUsage = { requestCount: 0, totalTokens: 0, updatedAt: null };

export const getGeminiApiKey = () => {
  try {
    return localStorage.getItem(API_KEY_STORAGE) || '';
  } catch {
    return '';
  }
};

export const saveGeminiApiKey = (apiKey: string) => {
  try {
    if (apiKey.trim()) localStorage.setItem(API_KEY_STORAGE, apiKey.trim());
    else localStorage.removeItem(API_KEY_STORAGE);
    window.dispatchEvent(new Event('courseify:gemini-key-changed'));
  } catch {
    throw new Error('Could not save the key in this browser. Check local storage permissions.');
  }
};

const usageStorageKey = (apiKey: string) => {
  let hash = 2166136261;
  for (let index = 0; index < apiKey.length; index += 1) {
    hash = Math.imul(hash ^ apiKey.charCodeAt(index), 16777619);
  }
  return `${USAGE_STORAGE}:${(hash >>> 0).toString(16)}`;
};

export const getGeminiUsage = (apiKey = getGeminiApiKey()): GeminiUsage => {
  if (!apiKey) return EMPTY_USAGE;
  try {
    const value = localStorage.getItem(usageStorageKey(apiKey));
    if (!value) return EMPTY_USAGE;
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null) return EMPTY_USAGE;
    const raw = parsed as Record<string, unknown>;
    const count = Number(raw.requestCount);
    const tokens = Number(raw.totalTokens);
    return {
      requestCount: Number.isFinite(count) && count > 0 ? Math.floor(count) : 0,
      totalTokens: Number.isFinite(tokens) && tokens > 0 ? Math.floor(tokens) : 0,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null
    };
  } catch {
    return EMPTY_USAGE;
  }
};

const recordGeminiUsage = (apiKey: string, usage: { totalTokenCount?: number } | undefined) => {
  try {
    const current = getGeminiUsage(apiKey);
    const reported = usage?.totalTokenCount;
    const updated: GeminiUsage = {
      requestCount: current.requestCount + 1,
      totalTokens: current.totalTokens + (typeof reported === 'number' && Number.isFinite(reported) ? reported : 0),
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(usageStorageKey(apiKey), JSON.stringify(updated));
    window.dispatchEvent(new Event('courseify:gemini-usage-updated'));
  } catch {
    // Reporting usage must not block a successful response.
  }
};

const notesStorageKey = (courseId: string, videoId: string) =>
  `courseify:ai-notes:${encodeURIComponent(courseId)}:${encodeURIComponent(videoId)}`;

const MAX_TEXT_FIELD = 20000;

/**
 * Retry policy for transient Gemini failures.
 *
 * Google documents 429 / 408 / 5xx as retryable and asks for exponential
 * backoff with jitter; their official SDKs do this automatically. Courseify
 * calls the REST endpoint directly, so it has to do it itself — otherwise a
 * momentary capacity blip ("this model is currently experiencing high demand")
 * fails instantly and the user has to press Generate again by hand.
 *
 * 429 is deliberately excluded. In practice it means the quota or rate limit is
 * exhausted rather than the model being briefly busy, and a backoff measured in
 * seconds cannot refill a daily quota. Retrying it would only delay the one
 * message that tells the user what went wrong, so it is surfaced immediately.
 *
 * The remaining 4xx are permanent — a bad key, no access, a malformed request —
 * and retrying those only burns quota.
 */
const RETRYABLE_STATUS = new Set([408, 500, 502, 503, 504]);
/** One initial request plus three retries, at most ~7s of waiting in total. */
const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 8000;

const isRetryableStatus = (status: number) => RETRYABLE_STATUS.has(status);

/** Full jitter, so simultaneous clients do not all retry on the same tick. */
const retryDelay = (attempt: number) => {
  const ceiling = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attempt - 1));
  return Math.round(Math.random() * ceiling);
};

const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) {
    reject(new DOMException('Aborted', 'AbortError'));
    return;
  }
  const onAbort = () => {
    clearTimeout(timer);
    reject(new DOMException('Aborted', 'AbortError'));
  };
  const timer = setTimeout(() => {
    signal?.removeEventListener('abort', onAbort);
    resolve();
  }, ms);
  signal?.addEventListener('abort', onAbort, { once: true });
});

export interface GeminiRequestOptions {
  /** Called before each retry so the UI can say why it is waiting. */
  onRetry?: (attempt: number, delayMs: number, status: number) => void;
  signal?: AbortSignal;
}

const asText = (value: unknown, fallback = '', maxLength = MAX_TEXT_FIELD): string =>
  typeof value === 'string' ? value.slice(0, maxLength) : fallback;

/**
 * Coerce a stored/parsed study guide into the shape the UI relies on.
 *
 * Everything in this file arrives from somewhere untrusted: localStorage can be
 * hand-edited or written by an older build, and `generateStudyNotes` parses a
 * model response. `AISessionNotes` maps over `keyTakeaways` and `quizQuestions`
 * without a guard, so an unexpected value would throw during render and blank
 * the whole lesson page.
 */
const normalizeStudyNotes = (value: unknown): StudyNotes | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;

  const keyTakeaways = Array.isArray(raw.keyTakeaways)
    ? raw.keyTakeaways.filter((item): item is string => typeof item === 'string' && item.trim() !== '').slice(0, 20)
    : [];

  const highlights = Array.isArray(raw.timestampedHighlights)
    ? raw.timestampedHighlights.flatMap((item): Array<{ time: string; seconds: number; label: string }> => {
      if (typeof item !== 'object' || item === null) return [];
      const entry = item as Record<string, unknown>;
      const seconds = Number(entry.seconds);
      if (!Number.isFinite(seconds) || seconds < 0) return [];
      return [{ time: asText(entry.time, '0:00', 20), seconds: Math.floor(seconds), label: asText(entry.label, 'Moment', 300) }];
    }).slice(0, 50)
    : [];

  const quizQuestions = Array.isArray(raw.quizQuestions)
    ? raw.quizQuestions.flatMap((item): Array<StudyNotes['quizQuestions'][number]> => {
      if (typeof item !== 'object' || item === null) return [];
      const entry = item as Record<string, unknown>;
      const options = Array.isArray(entry.options)
        ? entry.options.filter((option): option is string => typeof option === 'string').slice(0, 8)
        : [];
      const answerIndex = Number(entry.answerIndex);
      if (typeof entry.question !== 'string' || !entry.question.trim()) return [];
      if (options.length < 2 || !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= options.length) return [];
      return [{ question: entry.question.slice(0, 1000), options, answerIndex }];
    }).slice(0, 20)
    : [];

  return {
    oneSentenceSummary: asText(raw.oneSentenceSummary, 'No summary was generated.'),
    keyTakeaways,
    detailedNotes: asText(raw.detailedNotes),
    timestampedHighlights: highlights,
    quizQuestions
  };
};

export const getSavedStudyNotes = (courseId: string, videoId: string): StudyNotes | null => {
  try {
    const value = localStorage.getItem(notesStorageKey(courseId, videoId));
    if (!value) return null;
    return normalizeStudyNotes(JSON.parse(value));
  } catch {
    return null;
  }
};

/**
 * @throws when the browser refuses the write, so the caller can say the guide
 * was generated but not saved instead of implying the request failed.
 */
export const saveStudyNotes = (courseId: string, videoId: string, notes: StudyNotes) => {
  try {
    localStorage.setItem(notesStorageKey(courseId, videoId), JSON.stringify(notes));
  } catch {
    throw new Error('The study guide was generated but could not be saved in this browser. Clear some storage and try again.');
  }
};

const requestGemini = async (apiKey: string, contents: string, json = false, options: GeminiRequestOptions = {}) => {
  let attempt = 0;

  // One extra pass for each retry. Anything that is not transient escapes on
  // the first attempt via the throw below.
  for (;;) {
    attempt += 1;
    let response: Response;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: contents }] }],
          ...(json ? { generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 8192 } } : {})
        }),
        signal: options.signal
      });
    } catch (error) {
      // An abort is the caller changing their mind, never a transient fault.
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      if (attempt < MAX_ATTEMPTS) {
        const delayMs = retryDelay(attempt);
        options.onRetry?.(attempt, delayMs, 0);
        await sleep(delayMs, options.signal);
        continue;
      }
      throw new Error('Could not reach Gemini. Check your internet connection, browser extensions, and API key restrictions.');
    }

    if (response.ok) {
      const result = await response.json().catch(() => ({}));
      const candidate = result?.candidates?.[0];
      const text = candidate?.content?.parts?.map((part: { text?: string }) => part.text || '').join('') || '';
      if (!text.trim()) {
        const reason = candidate?.finishReason || result?.promptFeedback?.blockReason;
        throw new Error(reason ? `Gemini returned no text (${reason}). Try a different lesson description.` : 'Gemini returned an empty response. Please try again.');
      }
      recordGeminiUsage(apiKey, result?.usageMetadata);
      return text;
    }

    const result = await response.json().catch(() => ({}));
    const message = result?.error?.message;

    if (isRetryableStatus(response.status) && attempt < MAX_ATTEMPTS) {
      const delayMs = retryDelay(attempt);
      options.onRetry?.(attempt, delayMs, response.status);
      await sleep(delayMs, options.signal);
      continue;
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error(message || 'Gemini rejected this key or it lacks access to the selected model. Check key settings in AI Studio.');
    }
    if (response.status === 429) {
      throw new Error(message || 'Gemini rate limit or quota reached. Check usage and limits in Google AI Studio, then retry later.');
    }
    if (response.status === 400) {
      throw new Error(message || `Gemini rejected the request for ${MODEL}. Check the model name and request settings.`);
    }
    if (response.status === 503) {
      // Survived every retry, so this is sustained load rather than a blip.
      throw new Error('Gemini is unusually busy right now. This is on Google\u2019s side and usually clears within a few minutes \u2014 press Generate again shortly.');
    }
    throw new Error(message || 'Gemini could not complete the request. Please try again.');
  }
};

export const testGeminiApiKey = async (apiKey: string, options: GeminiRequestOptions = {}) => {
  const response = await requestGemini(apiKey, 'Reply with exactly: Hello', false, options);
  if (!response.trim()) throw new Error('Gemini returned an empty response.');
  return response;
};

export const generateStudyNotes = async (
  apiKey: string,
  video: VideoItem,
  options: GeminiRequestOptions = {}
): Promise<StudyNotes> => {
  const prompt = `Create a substantial, accurate study guide for this YouTube lesson. The available source is only the title and description, not a transcript. Never claim you watched the video, invent lesson events, or invent timestamps. Use only timestamps explicitly present in the description. Where useful, add clearly labeled general background context without presenting it as a fact from the video. Return valid JSON with these keys: oneSentenceSummary (string), keyTakeaways (8-12 specific strings), detailedNotes (Markdown string), timestampedHighlights (array of {time, seconds, label}), and quizQuestions (exactly 10 items with {question, options: four distinct strings, answerIndex: integer}). Make detailedNotes useful rather than repetitive: start with a # heading, use ## section headings, explanatory paragraphs, nested bullets where appropriate, and a short ## Review section. Cover definitions, relationships, examples, common misunderstandings, and practical applications that are supported by the available source.\n\nLesson title: ${video.title}\nLesson description: ${(video.description || 'No description available.').slice(0, 4000)}`;
  const text = await requestGemini(apiKey, prompt, true, options);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Gemini returned an unreadable study guide. Try generating it again.');
  }
  // The same coercion used for stored notes guards the model response, so a
  // malformed array here cannot crash the tabs that map over it.
  const notes = normalizeStudyNotes(parsed);
  if (!notes || !notes.quizQuestions.length) {
    throw new Error('The response did not include usable study guide content. Try generating it again.');
  }
  return notes;
};
