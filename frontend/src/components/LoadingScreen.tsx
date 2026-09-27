import React from 'react';

export const LoadingScreen: React.FC = () => (
  <main className="min-h-screen bg-bg-canvas px-4 py-6 text-text-primary" aria-label="Loading Courseify" role="status">
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col gap-8">
      <div className="flex items-center justify-between border-b border-border-default pb-4">
        <div className="skeleton-block h-8 w-32 rounded-lg" />
        <div className="flex gap-2">
          <div className="skeleton-block h-9 w-9 rounded-lg" />
          <div className="skeleton-block h-9 w-9 rounded-lg" />
          <div className="skeleton-block h-9 w-9 rounded-full" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-5">
          <div className="skeleton-block aspect-video w-full rounded-xl" />
          <div className="space-y-3">
            <div className="skeleton-block h-7 w-3/4 rounded" />
            <div className="skeleton-block h-4 w-1/2 rounded" />
            <div className="skeleton-block h-24 w-full rounded-xl" />
          </div>
        </div>
        <div className="hidden space-y-3 lg:block">
          <div className="skeleton-block h-24 w-full rounded-xl" />
          {Array.from({ length: 5 }, (_, index) => <div key={index} className="skeleton-block h-14 w-full rounded-lg" />)}
        </div>
      </div>
    </div>
  </main>
);

export const IngestionSkeleton: React.FC = () => (
  <div className="mt-6 grid w-full gap-3 sm:grid-cols-3" aria-label="Building course skeleton" role="status">
    {Array.from({ length: 3 }, (_, index) => (
      <div key={index} className="rounded-xl border border-border-default bg-bg-surface p-4">
        <div className="skeleton-block mb-4 aspect-video w-full rounded-lg" />
        <div className="skeleton-block mb-2 h-4 w-4/5 rounded" />
        <div className="skeleton-block h-3 w-1/2 rounded" />
      </div>
    ))}
  </div>
);