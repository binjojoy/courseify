import React, { useState, useEffect } from 'react';
import { storage } from './services/storage';
import { Course } from './types';
import { Navbar } from './components/Navbar';
import { HomePage } from './pages/HomePage';
import { DashboardPage } from './pages/DashboardPage';
import { PlayerPage } from './pages/PlayerPage';
import { ConfirmDialog } from './components/ConfirmDialog';
import { NamePromptModal } from './components/NamePromptModal';
import { Toast } from './components/Toast';

type ViewMode = 'home' | 'dashboard' | 'player';

export const App: React.FC = () => {
  // Always start on create course page ('home' / '#/add') by default
  const [currentView, setCurrentView] = useState<ViewMode>('home');
  const [activeCourseId, setActiveCourseId] = useState<string>('');
  const [activeVideoId, setActiveVideoId] = useState<string | undefined>(undefined);

  // Dialog states
  const [resetTargetCourse, setResetTargetCourse] = useState<Course | null>(null);
  const [removeTargetCourse, setRemoveTargetCourse] = useState<Course | null>(null);
  const [isNamePromptOpen, setIsNamePromptOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Parse location hash on load and hashchange
  const parseRoute = () => {
    const rawHash = window.location.hash;
    const hash = rawHash.replace(/^#\/?/, '');

    if (!hash || hash === 'add' || hash === 'home' || hash === 'import') {
      // Default / root page is create course page ('#/add')
      if (window.location.hash !== '#/add') {
        window.location.hash = '#/add';
      }
      setCurrentView('home');
      return;
    }

    if (hash.startsWith('course/')) {
      const parts = hash.split('?');
      const courseId = parts[0].replace('course/', '');
      const searchParams = new URLSearchParams(parts[1] || '');
      const videoId = searchParams.get('v') || undefined;

      setActiveCourseId(courseId);
      setActiveVideoId(videoId);
      setCurrentView('player');
    } else if (hash === 'dashboard') {
      setCurrentView('dashboard');
    } else {
      setCurrentView('home');
    }
  };

  useEffect(() => {
    // Initial theme check
    const theme = storage.getSettings().theme;
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    parseRoute();
    window.addEventListener('hashchange', parseRoute);
    return () => window.removeEventListener('hashchange', parseRoute);
  }, []);

  const navigateTo = (view: ViewMode, courseId?: string, videoId?: string) => {
    if (view === 'player' && courseId) {
      setActiveCourseId(courseId);
      setActiveVideoId(videoId);
      window.location.hash = `#/course/${courseId}${videoId ? `?v=${videoId}` : ''}`;
    } else if (view === 'dashboard') {
      window.location.hash = '#/dashboard';
    } else if (view === 'home') {
      window.location.hash = '#/add';
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  const handleConfirmReset = () => {
    if (resetTargetCourse) {
      storage.resetCourseProgress(resetTargetCourse.id);
      showToast(`Progress for "${resetTargetCourse.title}" has been reset.`);
      setResetTargetCourse(null);
    }
  };

  const handleConfirmRemove = () => {
    if (removeTargetCourse) {
      storage.removeCourse(removeTargetCourse.id);
      showToast(`Course "${removeTargetCourse.title}" was removed.`);
      setRemoveTargetCourse(null);
      if (currentView === 'player' && activeCourseId === removeTargetCourse.id) {
        navigateTo('dashboard');
      }
    }
  };

  const activeCourse = activeCourseId ? storage.getCourse(activeCourseId) : null;

  return (
    <div className="min-h-screen flex flex-col bg-bg-canvas text-text-primary">
      {/* Global Navigation Bar */}
      <Navbar
        currentView={currentView}
        courseTitle={activeCourse?.title}
        courseId={activeCourseId}
        onNavigate={navigateTo}
        onOpenNamePrompt={() => setIsNamePromptOpen(true)}
        onOpenRemoveCourse={(cId) => {
          const c = storage.getCourse(cId);
          if (c) setRemoveTargetCourse(c);
        }}
        onRefreshPlaylist={() => {
          showToast('Playlist is synced with YouTube.');
        }}
        onShowToast={showToast}
      />

      {/* Primary Page Views */}
      {currentView === 'home' && (
        <HomePage onNavigate={navigateTo} onShowToast={showToast} />
      )}

      {currentView === 'dashboard' && (
        <DashboardPage
          onNavigate={navigateTo}
          onOpenResetConfirm={(c) => setResetTargetCourse(c)}
          onOpenRemoveConfirm={(c) => setRemoveTargetCourse(c)}
          onShowToast={showToast}
        />
      )}

      {currentView === 'player' && (
        <PlayerPage
          courseId={activeCourseId}
          initialVideoId={activeVideoId}
          onNavigate={navigateTo}
          onShowToast={showToast}
        />
      )}

      {/* Reset Progress Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!resetTargetCourse}
        title="Reset progress?"
        body={`All completed videos and resume positions for "${resetTargetCourse?.title || ''}" will be cleared. Your notes are kept.`}
        confirmLabel="Reset progress"
        isDestructive={true}
        onConfirm={handleConfirmReset}
        onCancel={() => setResetTargetCourse(null)}
      />

      {/* Remove Course Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!removeTargetCourse}
        title="Remove this course?"
        body={`Progress and notes for "${removeTargetCourse?.title || ''}" will be deleted from this browser. This can't be undone.`}
        confirmLabel="Remove course"
        isDestructive={true}
        onConfirm={handleConfirmRemove}
        onCancel={() => setRemoveTargetCourse(null)}
      />

      {/* Name Prompt Modal */}
      <NamePromptModal
        isOpen={isNamePromptOpen}
        initialName={storage.getProfile().name}
        onSave={(name) => {
          storage.saveProfile({ name: name || 'User' });
          setIsNamePromptOpen(false);
          showToast(`Name updated to "${name || 'User'}".`);
        }}
        onSkip={() => setIsNamePromptOpen(false)}
      />

      {/* Toast Notification */}
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
    </div>
  );
};
