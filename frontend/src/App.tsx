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
import { fetchPlaylist } from './services/api';
import { getPlayableVideos } from './utils/course';

import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { NotFoundPage } from './pages/NotFoundPage';

type ViewMode = 'home' | 'dashboard' | 'player' | 'privacy' | 'terms' | 'notfound';

export const App: React.FC = () => {
  // Route selection is resolved after persisted courses are available.
  const [currentView, setCurrentView] = useState<ViewMode>('home');
  const [activeCourseId, setActiveCourseId] = useState<string>('');
  const [activeVideoId, setActiveVideoId] = useState<string | undefined>(undefined);

  // Dialog states
  const [resetTargetCourse, setResetTargetCourse] = useState<Course | null>(null);
  const [removeTargetCourse, setRemoveTargetCourse] = useState<Course | null>(null);
  const [isClearDataOpen, setIsClearDataOpen] = useState(false);
  const [isNamePromptOpen, setIsNamePromptOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastUndoAction, setToastUndoAction] = useState<{ label: string; onUndo: () => void; durationMs?: number } | null>(null);

  // Parse location hash on load and hashchange
  const parseRoute = () => {
    const rawHash = window.location.hash;
    const hash = rawHash.replace(/^#\/?/, '');

    if (!hash) {
      const nextHash = storage.getCourses().length > 0 ? '#/dashboard' : '#/add';
      window.history.replaceState(null, '', nextHash);
      setCurrentView(nextHash === '#/dashboard' ? 'dashboard' : 'home');
      return;
    }

    if (hash === 'add' || hash === 'home' || hash === 'import') {
      setCurrentView('home');
      return;
    }

    if (hash.startsWith('course/')) {
      const parts = hash.split('?');
      const courseId = parts[0].replace('course/', '');
      const searchParams = new URLSearchParams(parts[1] || '');
      const videoId = searchParams.get('v') || undefined;

      const course = storage.getCourse(courseId);
      if (!course) {
        setCurrentView('notfound');
        return;
      }

      const videos = storage.getCourseVideos(courseId);
      const fallback = storage.getCourseProgress(courseId).lastVideoId || getPlayableVideos(videos)[0]?.videoId;
      const selectedVideoId = videoId && videos.some(video => video.videoId === videoId && !video.unavailable) ? videoId : fallback;
      setActiveCourseId(courseId);
      setActiveVideoId(selectedVideoId);
      if (selectedVideoId && selectedVideoId !== videoId) {
        window.history.replaceState(null, '', `#/course/${courseId}?v=${selectedVideoId}`);
      }
      setCurrentView('player');
    } else if (hash === 'dashboard') {
      setCurrentView('dashboard');
    } else if (hash === 'privacy') {
      setCurrentView('privacy');
    } else if (hash === 'terms') {
      setCurrentView('terms');
    } else {
      setCurrentView('notfound');
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
      const route = `#/course/${courseId}${videoId ? `?v=${videoId}` : ''}`;
      window.location.hash = route;
    } else if (view === 'dashboard') {
      window.location.hash = '#/dashboard';
    } else if (view === 'home') {
      window.location.hash = '#/add';
    } else if (view === 'privacy') {
      window.location.hash = '#/privacy';
    } else if (view === 'terms') {
      window.location.hash = '#/terms';
    }
  };

  const handleRefreshPlaylist = async () => {
    if (!activeCourse?.source?.url) {
      showToast('This course has no saved source URL to refresh.');
      return;
    }
    try {
      const refreshed = await fetchPlaylist(activeCourse.source.url);
      const oldVideos = storage.getCourseVideos(activeCourse.id);
      const refreshedIds = new Set(refreshed.videos.map(video => video.videoId));
      const removed = oldVideos
        .filter(video => !refreshedIds.has(video.videoId))
        .map(video => ({ ...video, unavailable: true }));
      storage.addOrUpdateCourse({
        ...refreshed.course,
        id: activeCourse.id,
        videoCount: getPlayableVideos(refreshed.videos).length,
        addedAt: activeCourse.addedAt,
        lastOpenedAt: new Date().toISOString(),
        source: activeCourse.source
      });
      storage.saveCourseVideos(activeCourse.id, [...refreshed.videos, ...removed]);
      showToast('Playlist refreshed successfully.');
    } catch (error: any) {
      showToast(error?.message || 'Could not refresh this playlist.');
    }
  };

  const showToast = (
    msg: string,
    undoAction?: { label: string; onUndo: () => void; durationMs?: number }
  ) => {
    setToastMessage(msg);
    setToastUndoAction(undoAction || null);
    const duration = undoAction?.durationMs || 4000;
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
      setToastUndoAction((prev) => (prev?.label === undoAction?.label ? null : prev));
    }, duration);
  };

  const handleConfirmReset = () => {
    if (resetTargetCourse) {
      storage.resetCourseProgress(resetTargetCourse.id);
      showToast(`Progress for "${resetTargetCourse.title}" has been reset.`);
      setResetTargetCourse(null);
    }
  };

  // 5-second soft delete with Undo button
  const handleConfirmRemove = () => {
    if (!removeTargetCourse) return;

    const courseToRestore = removeTargetCourse;
    const videosToRestore = storage.getCourseVideos(courseToRestore.id);
    const progressToRestore = storage.getCourseProgress(courseToRestore.id);
    const notesToRestore = storage.getCourseNotes(courseToRestore.id);
    const favoritesToRestore = storage.getFavorites().filter(favorite => favorite.courseId === courseToRestore.id);

    // Remove from storage
    storage.removeCourse(courseToRestore.id);
    setRemoveTargetCourse(null);

    if (currentView === 'player' && activeCourseId === courseToRestore.id) {
      navigateTo('dashboard');
    }

    // Show 5-second undo prompt
    showToast(`Course "${courseToRestore.title}" deleted.`, {
      label: 'Undo',
      durationMs: 5000,
      onUndo: () => {
        // Restore course, videos, progress, notes
        storage.addOrUpdateCourse(courseToRestore);
        if (videosToRestore.length > 0) {
          storage.saveCourseVideos(courseToRestore.id, videosToRestore);
        }
        if (progressToRestore) {
          storage.saveCourseProgress(courseToRestore.id, progressToRestore);
        }
        if (notesToRestore && Object.keys(notesToRestore).length > 0) {
          storage.saveCourseNotes(courseToRestore.id, notesToRestore);
        }
        storage.saveFavorites([...storage.getFavorites().filter(favorite => favorite.courseId !== courseToRestore.id), ...favoritesToRestore]);
        showToast(`Course "${courseToRestore.title}" restored!`);
        // Trigger re-render by refreshing view or dispatching event
        window.dispatchEvent(new Event('storage'));
      },
    });
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
        onRefreshPlaylist={handleRefreshPlaylist}
        onOpenClearData={() => setIsClearDataOpen(true)}
        onShowToast={showToast}
      />

      {/* Primary Page Views */}
      <div key={currentView} className="page-transition">
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

      {currentView === 'privacy' && (
        <PrivacyPage onBack={() => navigateTo('home')} />
      )}

      {currentView === 'terms' && (
        <TermsPage onBack={() => navigateTo('home')} />
      )}

      {currentView === 'notfound' && (
        <NotFoundPage
          onGoHome={() => navigateTo('home')}
          onGoDashboard={() => navigateTo('dashboard')}
        />
      )}
      </div>

      {/* Reset Progress Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!resetTargetCourse}
        title="Reset progress?"
        body={`All completed videos and resume positions for "${resetTargetCourse?.title || ''}" will be cleared. Your notes are kept.`}
        confirmLabel="Reset progress"
        isDestructive={true}
        icon="restart_alt"
        onConfirm={handleConfirmReset}
        onCancel={() => setResetTargetCourse(null)}
      />

      <ConfirmDialog
        isOpen={isClearDataOpen}
        title="Clear all Courseify data?"
        body="This removes your courses, progress, notes, favorites, and settings from this browser. This action cannot be undone."
        confirmLabel="Clear all data"
        isDestructive={true}
        onConfirm={() => {
          storage.clearData();
          setIsClearDataOpen(false);
          navigateTo('home');
          showToast('All Courseify data has been cleared.');
        }}
        onCancel={() => setIsClearDataOpen(false)}
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

      {/* Toast Notification with Undo Action */}
      <Toast
        message={toastMessage}
        undoAction={toastUndoAction}
        onClose={() => {
          setToastMessage(null);
          setToastUndoAction(null);
        }}
      />
    </div>
  );
};
