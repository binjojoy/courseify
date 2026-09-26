import { VideoItem } from '../types';

const API_KEY_STORAGE = 'courseify:gemini-api-key';
const MODEL = 'gemini-2.5-flash';

export interface StudyNotes {
  oneSentenceSummary: string;
  keyTakeaways: string[];
  detailedNotes: string;
  timestampedHighlights: Array<{ time: string; seconds: number; label: string }>;
  quizQuestions: Array<{ question: string; options: string[]; answerIndex: number }>;
}

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
  } catch {
    throw new Error('Could not save the key in this browser. Check local storage permissions.');
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
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: contents }] }],
      ...(json ? { generationConfig: { responseMimeType: 'application/json' } } : {})
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = result?.error?.message;
    if (response.status === 400 || response.status === 403) {
      throw new Error(message || 'Gemini rejected this API key. Check it in AI settings.');
    }
    throw new Error(message || 'Gemini could not complete the request. Please try again.');
  }
  return result?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('') || '';
};

export const testGeminiApiKey = async (apiKey: string) => {
  const response = await requestGemini(apiKey, 'Reply with exactly: Hello');
  if (!response.trim()) throw new Error('Gemini returned an empty response.');
};

export const generateStudyNotes = async (apiKey: string, video: VideoItem): Promise<StudyNotes> => {
  const prompt = `Create a concise study guide for this YouTube lesson. The source contains only the title and description, not a transcript. Do not invent specific claims, timestamps, or events; use timestamps only when they are present in the source description. Clearly qualify any general background knowledge. Return JSON with keys oneSentenceSummary (string), keyTakeaways (string array), detailedNotes (Markdown string), timestampedHighlights (array of {time, seconds, label}), and quizQuestions (array of {question, options: four strings, answerIndex: integer}). Include 3-5 quiz questions.\n\nTitle: ${video.title}\nDescription: ${(video.description || 'No description available.').slice(0, 4000)}`;
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
      quizQuestions: parsed.quizQuestions.filter(question => question.question && Array.isArray(question.options) && Number.isInteger(question.answerIndex))
    };
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Gemini returned an unreadable study guide. Try generating it again.');
    throw error;
  }
};