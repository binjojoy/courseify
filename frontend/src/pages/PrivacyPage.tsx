import React from 'react';

interface PrivacyPageProps {
  onBack: () => void;
}

export const PrivacyPage: React.FC<PrivacyPageProps> = ({ onBack }) => {
  return (
    <main className="w-full pt-14 bg-bg-canvas min-h-screen text-text-primary">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline mb-8"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Back to Home</span>
        </button>

        <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-xs text-text-muted mb-8">Effective Date: September 27, 2026</p>

        <div className="space-y-6 text-sm text-text-secondary leading-relaxed bg-bg-surface p-6 sm:p-8 rounded-2xl border border-border-default shadow-xs">
          <section>
            <h2 className="text-base font-bold text-text-primary mb-2">1. 100% In-Browser Storage</h2>
            <p>
              Courseify operates strictly within your browser. Courses, watch history, progress, playback timestamps, personal notes, AI study guides, preferences, and release-notice state are saved locally on your device using browser storage. Clear All Data removes this local Courseify data.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-text-primary mb-2">2. Zero Account & Zero Tracking</h2>
            <p>
              We do not require you to register, sign in, or provide an email address. We do not use third-party analytics trackers, invasive advertising cookies, or fingerprinting scripts.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-text-primary mb-2">3. YouTube Data</h2>
            <p>
              When you paste a YouTube link, Courseify fetches publicly accessible playlist metadata, titles, durations, and lesson lists solely to organize your study curriculum. Embedded videos are delivered through YouTube's official IFrame Player API. Some private, deleted, or embedding-restricted videos may be unavailable.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-text-primary mb-2">4. Gemini AI Features</h2>
            <p>
              If you choose to use AI study guides, your Gemini API key is stored locally in this browser and sent directly to Google from your browser. Courseify does not receive or store the key on its servers. Lesson titles and descriptions are sent to Gemini to generate summaries, notes, highlights, quizzes, and flashcards. Courseify does not retrieve video transcripts. Token usage reported by Gemini is tracked locally for the usage indicator and is not a statement of your remaining Google quota.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-text-primary mb-2">5. Data Export & Portability</h2>
            <p>
              You own your data completely. You can export your full course history and personal notes at any time as a portable JSON file via the user profile menu and restore it on another machine. API keys and Gemini usage records are intentionally excluded from backups.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
};
