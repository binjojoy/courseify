import React from 'react';
import { DashboardPage } from './DashboardPage';
import { HomePage } from './HomePage';
import { storage } from '../services/storage';

interface AuditPageProps {
  onNavigate: (view: 'home' | 'dashboard' | 'player', courseId?: string, videoId?: string) => void;
}

export const AuditPage: React.FC<AuditPageProps> = ({ onNavigate }) => {
  const courses = storage.getCourses();
  const route = window.location.hash;

  return (
    <main className="w-full pt-14 min-h-screen bg-bg-canvas text-text-primary" data-testid="audit-page">
      <section className="max-w-5xl mx-auto px-4 py-8">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Development diagnostics</p>
          <h1 className="text-3xl font-bold mt-2">Courseify audit surface</h1>
          <p className="text-sm text-text-secondary mt-2">This route is available only in development builds and reuses the real application pages below.</p>
        </header>

        <section aria-labelledby="audit-state-heading" className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <h2 id="audit-state-heading" className="sr-only">Application diagnostics</h2>
          <div className="p-4 rounded-xl bg-bg-surface border border-border-default"><span className="text-xs text-text-muted">Route</span><strong className="block mt-1 break-all">{route}</strong></div>
          <div className="p-4 rounded-xl bg-bg-surface border border-border-default"><span className="text-xs text-text-muted">Courses</span><strong className="block mt-1">{courses.length}</strong></div>
          <div className="p-4 rounded-xl bg-bg-surface border border-border-default"><span className="text-xs text-text-muted">Storage schema</span><strong className="block mt-1">courseify:v1</strong></div>
          <div className="p-4 rounded-xl bg-bg-surface border border-border-default"><span className="text-xs text-text-muted">API state</span><strong className="block mt-1">Inspectable through the real import flow</strong></div>
        </section>

        <section aria-labelledby="audit-pages-heading" className="space-y-8">
          <h2 id="audit-pages-heading" className="text-xl font-bold">Real page states</h2>
          <div className="border border-border-default rounded-2xl overflow-hidden">
            <HomePage onNavigate={onNavigate} onShowToast={() => {}} />
          </div>
          <div className="border border-border-default rounded-2xl overflow-hidden">
            <DashboardPage
              onNavigate={onNavigate}
              onOpenResetConfirm={() => {}}
              onOpenRemoveConfirm={() => {}}
              onShowToast={() => {}}
            />
          </div>
        </section>
      </section>
    </main>
  );
};