import React, { useEffect, useState } from 'react';
import { BookOpenText, Check, ChevronRight, Copy, KeyRound, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { VideoItem } from '../types';
import { generateStudyNotes, getGeminiApiKey, getSavedStudyNotes, saveStudyNotes, StudyNotes } from '../services/ai';

interface AISessionNotesProps {
  courseId: string;
  video: VideoItem;
  onSeek: (seconds: number) => void;
  onOpenKeySettings: () => void;
  onShowToast: (message: string) => void;
  initialTab?: 'summary' | 'flashcards';
}

type StudyTab = 'summary' | 'highlights' | 'notes' | 'flashcards' | 'quiz';

export const AISessionNotes: React.FC<AISessionNotesProps> = ({ courseId, video, onSeek, onOpenKeySettings, onShowToast, initialTab = 'summary' }) => {
  const [studyNotes, setStudyNotes] = useState<StudyNotes | null>(() => getSavedStudyNotes(courseId, video.videoId));
  const [activeTab, setActiveTab] = useState<StudyTab>('summary');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [requiresKeyUpdate, setRequiresKeyUpdate] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [flippedCard, setFlippedCard] = useState<number | null>(null);

  useEffect(() => {
    setStudyNotes(getSavedStudyNotes(courseId, video.videoId));
    setActiveTab(initialTab);
    setSelectedAnswers({});
    setFlippedCard(null);
  }, [courseId, video.videoId, initialTab]);

  useEffect(() => {
    const handleGenerate = () => { void handleGenerateNotes(); };
    window.addEventListener('courseify:generate-ai-notes', handleGenerate);
    return () => window.removeEventListener('courseify:generate-ai-notes', handleGenerate);
  });

  const handleGenerateNotes = async () => {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      onOpenKeySettings();
      return;
    }
    setIsGenerating(true);
    setGenerationError(null);
    setRequiresKeyUpdate(false);
    try {
      const result = await generateStudyNotes(apiKey, video);
      saveStudyNotes(courseId, video.videoId, result);
      setStudyNotes(result);
      setSelectedAnswers({});
      setFlippedCard(null);
      setActiveTab('summary');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not generate AI notes.';
      setGenerationError(message);
      setRequiresKeyUpdate(error instanceof Error && /api key|key is invalid|API_KEY_INVALID|permission denied/i.test(error.message));
      onShowToast(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyNotes = async () => {
    if (!studyNotes) return;
    const content = `# ${video.title}\n\n${studyNotes.oneSentenceSummary}\n\n## Key takeaways\n${studyNotes.keyTakeaways.map(item => `- ${item}`).join('\n')}\n\n## Notes\n${studyNotes.detailedNotes}`;
    try {
      await navigator.clipboard.writeText(content);
      onShowToast('AI notes copied to clipboard.');
    } catch {
      onShowToast('Clipboard access is unavailable in this browser.');
    }
  };

  const tabs: Array<{ id: StudyTab; label: string }> = [
    { id: 'summary', label: 'Summary' },
    { id: 'highlights', label: 'Highlights' },
    { id: 'notes', label: 'Notes' },
    { id: 'flashcards', label: 'Flashcards' },
    { id: 'quiz', label: 'Quiz' }
  ];

  return (
    <section className="mt-6 border-t border-border-default pt-5" aria-label="AI session notes">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-accent" />
          <h2 className="text-base font-semibold text-text-primary">AI study guide</h2>
        </div>
        <div className="flex items-center gap-2">
          {studyNotes && <button type="button" onClick={copyNotes} aria-label="Copy AI notes" title="Copy AI notes" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-default text-text-secondary hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><Copy size={16} /></button>}
          <button type="button" onClick={handleGenerateNotes} disabled={isGenerating} className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3 text-sm font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
            {isGenerating ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Sparkles size={16} />}
            {isGenerating ? 'Generating…' : studyNotes ? 'Regenerate' : 'Generate study guide'}
          </button>
        </div>
      </div>

      {generationError && <div role="alert" className="mt-3 rounded-lg border border-error/30 bg-error-subtle px-3 py-2 text-sm leading-relaxed text-error">{generationError}{requiresKeyUpdate && <button type="button" onClick={onOpenKeySettings} className="ml-2 font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Update Gemini key</button>}</div>}
      {!getGeminiApiKey() && <button type="button" onClick={onOpenKeySettings} className="mt-4 inline-flex items-center gap-2 text-sm text-text-secondary hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><KeyRound size={15} />Configure Gemini key</button>}
      {!studyNotes ? (
        <div className="mt-4 flex min-h-32 flex-col items-center justify-center border-y border-border-default px-4 py-6 text-center">
          <BookOpenText size={22} className="mb-2 text-text-muted" />
          <p className="text-sm font-medium text-text-primary">Build a study guide for this lesson</p>
          <p className="mt-1 max-w-lg text-xs leading-relaxed text-text-muted">Generated from the available title and description. This app does not retrieve a video transcript.</p>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="AI study guide sections" className="mt-4 flex gap-1 overflow-x-auto border-b border-border-default">
            {tabs.map(tab => <button key={tab.id} role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${activeTab === tab.id ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>{tab.label}{tab.id === 'quiz' && studyNotes.quizQuestions.length > 0 ? ` (${studyNotes.quizQuestions.length})` : ''}</button>)}
          </div>
          <div role="tabpanel" className="min-h-48 py-4 text-sm text-text-secondary">
            {activeTab === 'summary' && <div className="space-y-4"><p className="text-base leading-relaxed text-text-primary">{studyNotes.oneSentenceSummary}</p><div><h3 className="mb-2 text-xs font-semibold uppercase text-text-muted">Key takeaways</h3><ul className="space-y-2">{studyNotes.keyTakeaways.map((item, index) => <li key={index} className="flex gap-2 leading-relaxed"><Check size={16} className="mt-0.5 shrink-0 text-success" />{item}</li>)}</ul></div></div>}
            {activeTab === 'highlights' && <div className="space-y-2">{studyNotes.timestampedHighlights.length ? studyNotes.timestampedHighlights.map((highlight, index) => <button key={`${highlight.seconds}-${index}`} type="button" onClick={() => onSeek(highlight.seconds)} className="flex w-full items-center justify-between gap-3 rounded-lg border border-border-default px-3 py-2 text-left hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><span className="font-mono text-xs text-accent">{highlight.time}</span><span className="flex-1 text-text-primary">{highlight.label}</span><ChevronRight size={15} /></button>) : <p>No reliable timestamps were available in this lesson description.</p>}</div>}
            {activeTab === 'notes' && <article className="max-w-none leading-relaxed text-text-secondary [&_a]:text-accent [&_a]:underline [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-bg-hover [&_code]:px-1 [&_code]:py-0.5 [&_h1]:mb-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:text-text-primary [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-text-primary [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:font-semibold [&_h3]:text-text-primary [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-3 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-bg-hover [&_pre]:p-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children }) => {
                    const timestamp = href?.match(/^#timestamp-(\d+)$/);
                    if (timestamp) return <button type="button" onClick={() => onSeek(Number(timestamp[1]))} className="font-mono text-xs text-accent underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{children}</button>;
                    return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
                  }
                }}
              >
                {studyNotes.detailedNotes || 'No detailed notes were generated.'}
              </ReactMarkdown>
            </article>}
            {activeTab === 'flashcards' && <div className="grid gap-3 sm:grid-cols-2">{studyNotes.quizQuestions.map((question, index) => <button key={index} type="button" aria-label={`${flippedCard === index ? 'Answer' : 'Question'} flashcard ${index + 1}`} onClick={() => setFlippedCard(flippedCard === index ? null : index)} className="flex min-h-36 flex-col items-start justify-between rounded-lg border border-border-default bg-bg-canvas p-4 text-left transition-colors hover:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><span className="text-[11px] font-semibold uppercase text-text-muted">{flippedCard === index ? 'Answer' : `Card ${index + 1} · Question`}</span><span className="py-3 text-sm leading-relaxed text-text-primary">{flippedCard === index ? question.options[question.answerIndex] || 'Answer unavailable' : question.question}</span><span className="text-xs text-accent">{flippedCard === index ? 'Show question' : 'Reveal answer'}</span></button>)}</div>}
            {activeTab === 'quiz' && <div className="space-y-5">{studyNotes.quizQuestions.map((question, index) => <fieldset key={index} className="space-y-2"><legend className="mb-2 font-medium text-text-primary">{index + 1}. {question.question}</legend>{question.options.map((option, optionIndex) => { const selected = selectedAnswers[index] === optionIndex; const answered = selectedAnswers[index] !== undefined; const correct = question.answerIndex === optionIndex; return <button key={optionIndex} type="button" disabled={answered} onClick={() => setSelectedAnswers(current => ({ ...current, [index]: optionIndex }))} className={`block w-full rounded-lg border px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${answered && correct ? 'border-success/50 bg-success-subtle text-success' : selected ? 'border-error/50 bg-error-subtle text-error' : 'border-border-default hover:bg-bg-hover'}`}>{option}</button>; })}{selectedAnswers[index] !== undefined && <p className={`text-xs ${selectedAnswers[index] === question.answerIndex ? 'text-success' : 'text-text-muted'}`}>{selectedAnswers[index] === question.answerIndex ? 'Correct.' : `Answer: ${question.options[question.answerIndex] || 'Not provided'}`}</p>}</fieldset>)}</div>}
          </div>
        </>
      )}
    </section>
  );
};