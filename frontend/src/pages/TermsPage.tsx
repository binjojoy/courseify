import React from 'react';

interface TermsPageProps {
  onBack: () => void;
}

export const TermsPage: React.FC<TermsPageProps> = ({ onBack }) => {
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

        <h1 className="text-3xl font-bold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-xs text-text-muted mb-8">Effective Date: September 27, 2026</p>

        <div className="space-y-6 text-sm text-text-secondary leading-relaxed bg-bg-surface p-6 sm:p-8 rounded-2xl border border-border-default shadow-xs">
          <section>
            <h2 className="text-base font-bold text-text-primary mb-2">1. Use of Service</h2>
            <p>
              Courseify is an educational tool designed to help learners organize YouTube playlists and lessons into structured study spaces. You agree to use Courseify in compliance with applicable laws, YouTube's Terms of Service, and the terms that apply to any third-party AI service you connect.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-text-primary mb-2">2. Intellectual Property & YouTube Content</h2>
            <p>
              All video content, audio, subtitles, and channel trademarks remain the property of their respective YouTube creators and copyright holders. Courseify embeds video streams directly through YouTube’s IFrame API.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-text-primary mb-2">3. Optional Gemini Features</h2>
            <p>
              AI study guides, Markdown notes, timestamp highlights, quizzes, and flashcards are optional features powered by the Gemini API when you provide your own key. You are responsible for obtaining the key lawfully, protecting it, reviewing generated content, and complying with Google's AI Studio and Gemini terms. Do not submit confidential or sensitive information in lesson descriptions or notes.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-text-primary mb-2">4. Generated Content</h2>
            <p>
              AI-generated summaries and study materials may be incomplete, inaccurate, or unsuitable for a particular purpose. They are learning aids, not authoritative instruction. Verify important claims against the original lesson and use clickable timestamps only as navigation aids.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-text-primary mb-2">5. Disclaimer of Warranties</h2>
            <p>
              Courseify is provided "as is" without warranty of any kind. Availability of video streaming depends on YouTube's servers, content owner permissions, and third-party network conditions.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
};
