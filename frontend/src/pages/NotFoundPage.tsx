import React from 'react';

interface NotFoundPageProps {
  onGoHome: () => void;
  onGoDashboard: () => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onGoHome, onGoDashboard }) => {
  return (
    <main className="w-full pt-14 bg-bg-canvas min-h-screen flex items-center justify-center p-6 text-center text-text-primary">
      <div className="max-w-md flex flex-col items-center">
        <div className="w-20 h-20 rounded-full bg-accent-subtle text-accent flex items-center justify-center mb-5">
          <span className="material-symbols-outlined text-[44px]">sentiment_dissatisfied</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">404</h1>
        <h2 className="text-lg font-bold text-text-primary mb-2">Page Not Found</h2>
        <p className="text-sm text-text-secondary mb-6 leading-relaxed">
          The view or course you requested could not be located in this browser.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={onGoHome}
            className="h-10 px-5 rounded-xl bg-accent text-white font-medium text-xs hover:bg-accent-hover shadow-sm transition-all"
          >
            Create Course
          </button>
          <button
            onClick={onGoDashboard}
            className="h-10 px-5 rounded-xl border border-border-default bg-bg-surface text-text-primary font-medium text-xs hover:bg-bg-hover transition-all"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </main>
  );
};
