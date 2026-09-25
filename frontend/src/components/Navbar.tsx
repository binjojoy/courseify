import React, { useState, useRef, useEffect } from 'react';
import { storage } from '../services/storage';
import { UserProfile, AppSettings } from '../types';
import { ConfirmDialog } from './ConfirmDialog';

interface NavbarProps {
  currentView: string;
  courseTitle?: string;
  courseId?: string;
  onNavigate: (view: 'home' | 'dashboard' | 'player' | 'privacy' | 'terms', courseId?: string) => void;
  onOpenNamePrompt: () => void;
  onOpenRemoveCourse?: (courseId: string) => void;
  onRefreshPlaylist?: () => void;
  onShowToast: (msg: string) => void;
  onOpenClearData: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  courseTitle,
  courseId,
  onNavigate,
  onOpenNamePrompt,
  onOpenRemoveCourse,
  onRefreshPlaylist,
  onShowToast,
  onOpenClearData
}) => {
  const [profile, setProfile] = useState<UserProfile>(storage.getProfile());
  const [settings, setSettings] = useState<AppSettings>(storage.getSettings());
  const [isAvatarOpen, setIsAvatarOpen] = useState(false);
  const [isCourseMenuOpen, setIsCourseMenuOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const courseMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = storage.subscribe(() => {
      setProfile(storage.getProfile());
      setSettings(storage.getSettings());
    });
    return unsub;
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setIsAvatarOpen(false);
      }
      if (courseMenuRef.current && !courseMenuRef.current.contains(e.target as Node)) {
        setIsCourseMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleTheme = () => {
    const newTheme: 'light' | 'dark' = settings.theme === 'dark' ? 'light' : 'dark';
    const updated: AppSettings = { ...settings, theme: newTheme };
    setSettings(updated);
    storage.saveSettings(updated);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleExportBackup = () => {
    const json = storage.exportBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `courseify-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setIsAvatarOpen(false);
    onShowToast('Backup exported successfully.');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      setPendingImport(content);
    };
    reader.readAsText(file);
    setIsAvatarOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const displayName = profile.name || 'User';
  const initialLetter = displayName.trim().charAt(0).toUpperCase() || 'U';

  return (
    <>
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-bg-surface/95 dark:bg-[#0F172A]/95 backdrop-blur-md border-b border-border-default dark:border-slate-800">
      <div className={`h-14 ${currentView === 'player' ? 'w-full px-4 sm:px-6' : 'max-w-[1240px] mx-auto px-4 md:px-6 lg:px-8'} flex items-center justify-between`}>
        {/* Left Side: Logo & Navigation */}
        <div className="flex items-center gap-3 min-w-0 max-w-[calc(100%-180px)]">
          {currentView === 'player' ? (
            <>
              <button
                onClick={() => onNavigate('dashboard')}
                aria-label="Back to dashboard"
                className="w-9 h-9 flex items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors focus:outline-none"
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </button>
              <div className="h-5 w-[1px] bg-border-default hidden sm:block"></div>
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  onClick={() => onNavigate('dashboard')}
                  className="w-6 h-6 rounded bg-accent flex items-center justify-center text-white cursor-pointer shrink-0 hidden sm:flex"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                </div>
                <span className="text-sm font-semibold text-text-primary truncate max-w-[240px] sm:max-w-[480px] tracking-tight">
                  {courseTitle || 'Course'}
                </span>
              </div>
            </>
          ) : (
            <a
              href="#/add"
              onClick={() => onNavigate('home')}
              className="flex items-center gap-2.5 focus:outline-none group"
              aria-label="Courseify add course"
            >
              <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-white shadow-sm shrink-0 transition-transform group-hover:scale-105">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <polygon points="6 4 20 12 6 20 6 4"></polygon>
                </svg>
              </div>
              <span className="text-[18px] font-bold text-text-primary tracking-tight">
                Courseify
              </span>
            </a>
          )}
        </div>

        {/* Right Side: Dashboard Link, Theme Toggle, Avatar Menu */}
        <nav aria-label="Primary navigation" className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Dashboard Icon Button on Right Side */}
          {currentView !== 'player' && (
            <button
              onClick={() => onNavigate(currentView === 'dashboard' ? 'home' : 'dashboard')}
              aria-label={currentView === 'dashboard' ? 'Create course' : 'Go to dashboard'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                currentView === 'dashboard'
                  ? 'text-accent bg-accent-subtle font-semibold'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              <span className="material-symbols-outlined text-[19px]">grid_view</span>
              <span className="hidden sm:inline">Dashboard</span>
            </button>
          )}

          {/* Player Course Overflow Menu */}
          {currentView === 'player' && (
            <div className="relative" ref={courseMenuRef}>
              <button
                onClick={() => setIsCourseMenuOpen(!isCourseMenuOpen)}
                aria-label="Course options"
                className="w-9 h-9 flex items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors focus:outline-none"
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">more_vert</span>
              </button>

              {isCourseMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-bg-elevated rounded-lg shadow-xl border border-border-default p-1 text-sm z-50 animate-fadeIn">
                  <button
                    onClick={() => {
                      setIsCourseMenuOpen(false);
                      onNavigate('dashboard');
                    }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-bg-hover text-text-primary flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">grid_view</span>
                    <span>Back to dashboard</span>
                  </button>
                  {onRefreshPlaylist && (
                    <button
                      onClick={() => {
                        setIsCourseMenuOpen(false);
                        onRefreshPlaylist();
                      }}
                      className="w-full text-left px-3 py-2 rounded hover:bg-bg-hover text-text-primary flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[18px]">refresh</span>
                      <span>Refresh playlist</span>
                    </button>
                  )}
                  <div className="h-[1px] bg-border-default my-1"></div>
                  {courseId && onOpenRemoveCourse && (
                    <button
                      onClick={() => {
                        setIsCourseMenuOpen(false);
                        onOpenRemoveCourse(courseId);
                      }}
                      className="w-full text-left px-3 py-2 rounded hover:bg-error-subtle text-error flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                      <span>Remove course</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors focus:outline-none"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">
              {settings.theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>

          {/* User Profile Avatar with visible status indicator badge */}
          <div className="relative" ref={avatarMenuRef}>
            <div className="relative inline-flex items-center">
              <button
                onClick={() => setIsAvatarOpen(!isAvatarOpen)}
                aria-label={`User profile: ${displayName}`}
                className="relative rounded-full ring-2 ring-border-default hover:ring-accent transition-all focus:outline-none flex items-center justify-center w-8 h-8 bg-blue-600 text-white font-semibold text-xs select-none"
                type="button"
              >
                <span>{initialLetter}</span>
              </button>
              {/* Fully visible green status dot positioned outside overflow */}
              <span
                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-bg-surface dark:border-[#0F172A] shadow-xs pointer-events-none z-10"
                title="Active workspace"
              ></span>
            </div>

            {isAvatarOpen && (
              <div className="absolute right-0 mt-2 w-60 bg-bg-elevated rounded-lg shadow-xl border border-border-default p-1 text-sm z-50 animate-fadeIn">
                <div className="px-3 py-2 border-b border-border-default mb-1">
                  <div className="font-semibold text-text-primary">{displayName}</div>
                  <div className="text-xs text-text-muted">Local browser storage</div>
                </div>

                <button
                  onClick={() => {
                    setIsAvatarOpen(false);
                    onOpenNamePrompt();
                  }}
                  className="w-full text-left px-3 py-2 rounded hover:bg-bg-hover text-text-primary flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                  <span>Edit your name</span>
                </button>

                <button
                  onClick={handleExportBackup}
                  className="w-full text-left px-3 py-2 rounded hover:bg-bg-hover text-text-primary flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  <span>Export backup (JSON)</span>
                </button>

                <button
                  onClick={() => {
                    setIsAvatarOpen(false);
                    fileInputRef.current?.click();
                  }}
                  className="w-full text-left px-3 py-2 rounded hover:bg-bg-hover text-text-primary flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">upload</span>
                  <span>Import backup (JSON)</span>
                </button>

                <button
                  onClick={() => {
                    setIsAvatarOpen(false);
                    onOpenClearData();
                  }}
                  className="w-full text-left px-3 py-2 rounded hover:bg-error-subtle text-error flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
                  <span>Clear all data</span>
                </button>

                <div className="h-[1px] bg-border-default my-1"></div>

                <div className="px-3 py-2 text-xs text-text-muted flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">lock</span>
                  <span>Your data stays in this browser</span>
                </div>
              </div>
            )}
          </div>

          {/* Hidden file input for backup restoration */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImportFile}
          />
        </nav>
      </div>
    </header>
    <ConfirmDialog
      isOpen={!!pendingImport}
      title="Replace local Courseify data?"
      body="Importing this backup replaces your current courses, progress, notes, favorites, settings, and analytics in this browser."
      confirmLabel="Replace data"
      isDestructive
      onCancel={() => setPendingImport(null)}
      onConfirm={() => {
        const success = pendingImport ? storage.importBackup(pendingImport) : false;
        setPendingImport(null);
        onShowToast(success ? 'Backup imported successfully.' : 'Failed to import backup: invalid file format.');
      }}
    />
    </>
  );
};
