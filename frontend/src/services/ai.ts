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
    return value ? { ...EMPTY_USAGE, ...JSON.parse(value) } : EMPTY_USAGE;
  } catch {
    return EMPTY_USAGE;
  }
};

const recordGeminiUsage = (apiKey: string, usage: { totalTokenCount?: number } | undefined) => {
  try {
    const current = getGeminiUsage(apiKey);
    const updated: GeminiUsage = {
      requestCount: current.requestCount + 1,
      totalTokens: current.totalTokens + (Number.isFinite(usage?.totalTokenCount) ? usage!.totalTokenCount! : 0),
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

export const getSavedStudyNotes = (courseId: string, videoId: string): StudyNotes | null => {
  try {
    const value = localStorage.getItem(notesStorageKey(courseId, videoId));
    return value ? JSON.parse(value) as StudyNotes : null;
  } catch {
    return null;
  }
};

export const saveStudyNotes = (courseId: string, videoId: string, notes: StudyNotes) => {
  localStorage.setItem(notesStorageKey(courseId, videoId), JSON.stringify(notes));
};

const requestGemini = async (apiKey: string, contents: string, json = false) => {
  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: contents }] }],
        ...(json ? { generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 8192 } } : {})
      })
    });
  } catch {
    throw new Error('Could not reach Gemini. Check your internet connection, browser extensions, and API key restrictions.');
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = result?.error?.message;
    if (response.status === 401 || response.status === 403) {
      throw new Error(message || 'Gemini rejected this key or it lacks access to the selected model. Check key settings in AI Studio.');
    }
    if (response.status === 429) {
      throw new Error(message || 'Gemini rate limit or quota reached. Check usage and limits in Google AI Studio, then retry later.');
    }
    if (response.status === 400) {
      throw new Error(message || `Gemini rejected the request for ${MODEL}. Check the model name and request settings.`);
    }
    throw new Error(message || 'Gemini could not complete the request. Please try again.');
  }

  const candidate = result?.candidates?.[0];
  const text = candidate?.content?.parts?.map((part: { text?: string }) => part.text || '').join('') || '';
  if (!text.trim()) {
    const reason = candidate?.finishReason || result?.promptFeedback?.blockReason;
    throw new Error(reason ? `Gemini returned no text (${reason}). Try a different lesson description.` : 'Gemini returned an empty response. Please try again.');
  }
  recordGeminiUsage(apiKey, result?.usageMetadata);
  return text;
};

export const testGeminiApiKey = async (apiKey: string) => {
  const response = await requestGemini(apiKey, 'Reply with exactly: Hello');
  if (!response.trim()) throw new Error('Gemini returned an empty response.');
  return response;
};

export const generateStudyNotes = async (apiKey: string, video: VideoItem): Promise<StudyNotes> => {
  const prompt = `Create a substantial, accurate study guide for this YouTube lesson. The available source is only the title and description, not a transcript. Never claim you watched the video, invent lesson events, or invent timestamps. Use only timestamps explicitly present in the description. Where useful, add clearly labeled general background context without presenting it as a fact from the video. Return valid JSON with these keys: oneSentenceSummary (string), keyTakeaways (8-12 specific strings), detailedNotes (Markdown string), timestampedHighlights (array of {time, seconds, label}), and quizQuestions (exactly 10 items with {question, options: four distinct strings, answerIndex: integer}). Make detailedNotes useful rather than repetitive: start with a # heading, use ## section headings, explanatory paragraphs, nested bullets where appropriate, and a short ## Review section. Cover definitions, relationships, examples, common misunderstandings, and practical applications that are supported by the available source.\n\nLesson title: ${video.title}\nLesson description: ${(video.description || 'No description available.').slice(0, 4000)}`;
  const text = await requestGemini(apiKey, prompt, true);
  try {
    const parsed = JSON.parse(text) as StudyNotes;
    if (!parsed.oneSentenceSummary || !Array.isArray(parsed.keyTakeaways) || !Array.isArray(parsed.quizQuestions)) {
      throw new Error('The response did not include the expected study guide fields.');
    }
    return {
      oneSentenceSummary: parsed.oneSentenceSummary,
      keyTakeaways: parsed.keyTakeaways,
      detailedNotes: parsed.detailedNotes || '',
      timestampedHighlights: Array.isArray(parsed.timestampedHighlights) ? parsed.timestampedHighlights : [],
      quizQuestions: parsed.quizQuestions.filter(question => question.question && Array.isArray(question.options) && question.options.length === 4 && Number.isInteger(question.answerIndex) && question.answerIndex >= 0 && question.answerIndex < 4).slice(0, 10)
    };
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Gemini returned an unreadable study guide. Try generating it again.');
    throw error;
  }
};