import React, { useState, useRef, useEffect } from 'react';
import { storage } from '../services/storage';
import { UserProfile, AppSettings } from '../types';
import { ImportConflictDialog } from './ImportConflictDialog';
import { BackupValidationError, downloadBackup, MAX_BACKUP_BYTES, type ImportAnalysis, type ImportStrategy } from '../services/backup';
import { KeyRound, Search, Sparkles } from 'lucide-react';
import { GeminiUsage, getGeminiApiKey, getGeminiUsage } from '../services/ai';

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
  onOpenGeminiSettings: () => void;
  onOpenCommandPalette: () => void;
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
  onOpenClearData,
  onOpenGeminiSettings,
  onOpenCommandPalette
}) => {
  const [profile, setProfile] = useState<UserProfile>(storage.getProfile());
  const [settings, setSettings] = useState<AppSettings>(storage.getSettings());
  const [isAvatarOpen, setIsAvatarOpen] = useState(false);
  const [isCourseMenuOpen, setIsCourseMenuOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const [importAnalysis, setImportAnalysis] = useState<ImportAnalysis | null>(null);
  const [importExportedAt, setImportExportedAt] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [hasGeminiKey, setHasGeminiKey] = useState(() => !!getGeminiApiKey());
  const [geminiUsage, setGeminiUsage] = useState<GeminiUsage>(() => getGeminiUsage());
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

  useEffect(() => {
    const refreshAiStatus = () => {
      setHasGeminiKey(!!getGeminiApiKey());
      setGeminiUsage(getGeminiUsage());
    };
    window.addEventListener('courseify:gemini-key-changed', refreshAiStatus);
    window.addEventListener('courseify:gemini-usage-updated', refreshAiStatus);
    return () => {
      window.removeEventListener('courseify:gemini-key-changed', refreshAiStatus);
      window.removeEventListener('courseify:gemini-usage-updated', refreshAiStatus);
    };
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
    try {
      const backup = storage.exportBackup();
      downloadBackup(backup);
      // The file exists now, so the dashboard can stop nagging about a backup.
      storage.recordBackupExport();
      setIsAvatarOpen(false);
      onShowToast('Backup exported successfully.');
    } catch {
      onShowToast('Could not export your backup. Check available browser storage and try again.');
    }
  };

  const resetImportState = () => {
    setPendingImport(null);
    setImportAnalysis(null);
    setImportExportedAt(null);
    setImportError(null);
    setIsImporting(false);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setIsAvatarOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    // Reject on size before reading: a 500MB file would otherwise be loaded
    // into memory as a string and blow past the localStorage quota anyway.
    if (file.size > MAX_BACKUP_BYTES) {
      onShowToast(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Backups must be 10 MB or smaller.`);
      return;
    }

    setImportError(null);
    const reader = new FileReader();
    reader.onerror = () => {
      setImportError('That file could not be read. Check you have permission to open it, then try again.');
    };
    reader.onload = (evt) => {
      const content = typeof evt.target?.result === 'string' ? evt.target.result : '';
      try {
        // Validate first, so nothing is written until the user has chosen a
        // strategy and the file is known to be a real backup.
        const { backup, analysis } = storage.inspectBackup(content);
        setPendingImport(content);
        setImportAnalysis(analysis);
        setImportExportedAt(backup.exportedAt);
      } catch (err) {
        setImportError(err instanceof BackupValidationError
          ? err.message
          : "That file isn't a readable Courseify backup. Pick the .json file exported from the backup menu.");
      }
    };
    reader.readAsText(file);
  };

  const confirmImport = (strategy: ImportStrategy) => {
    if (!pendingImport) return;
    setIsImporting(true);
    try {
      const analysis = storage.importBackup(pendingImport, strategy);
      resetImportState();
      onShowToast(strategy === 'merge'
        ? `Backup merged: ${analysis.summary}.`
        : 'Backup imported successfully.');
    } catch (err) {
      setIsImporting(false);
      setImportError(err instanceof BackupValidationError
        ? err.message
        : "That backup could not be imported. Nothing was changed - check available browser storage and try again.");
    }
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
            onClick={onOpenCommandPalette}
            aria-label="Search lessons and commands"
            title="Search lessons and commands (Ctrl+K)"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors focus:outline-none"
            type="button"
          >
            <Search size={19} />
          </button>

          <button
            onClick={onOpenGeminiSettings}
            aria-label={`${hasGeminiKey ? 'Update' : 'Configure'} Gemini API key. ${geminiUsage.totalTokens.toLocaleString()} tokens used by this key in this browser; remaining Google quota is not available here.`}
            title={`This browser: ${geminiUsage.totalTokens.toLocaleString()} tokens across ${geminiUsage.requestCount} request${geminiUsage.requestCount === 1 ? '' : 's'}. Google does not expose remaining quota here.`}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors focus:outline-none"
            type="button"
          >
            <span className="relative flex h-8 w-8 items-center justify-center text-accent">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
                <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
                <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 15}`} strokeDashoffset={`${2 * Math.PI * 15 * (1 - Math.min(geminiUsage.totalTokens / 100000, 1))}`} />
              </svg>
              {hasGeminiKey ? <Sparkles size={14} aria-hidden="true" /> : <KeyRound size={14} aria-hidden="true" />}
            </span>
          </button>

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
            aria-label="Import backup file"
            className="hidden"
            onChange={handleImportFile}
          />
        </nav>
      </div>
    </header>
    {importError && (
      <div
        role="alert"
        className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] w-[min(560px,calc(100%-2rem))] flex items-start gap-3 rounded-xl border border-error/40 bg-bg-elevated px-4 py-3 shadow-xl animate-fadeIn"
      >
        <span className="material-symbols-outlined text-[20px] text-error shrink-0 mt-px">error</span>
        <p className="text-sm text-text-primary leading-relaxed flex-1">{importError}</p>
        <button
          type="button"
          onClick={() => setImportError(null)}
          aria-label="Dismiss import error"
          className="shrink-0 text-text-muted hover:text-text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
    )}
    {importAnalysis && (
      <ImportConflictDialog
        isOpen
        analysis={importAnalysis}
        exportedAt={importExportedAt}
        isImporting={isImporting}
        onCancel={resetImportState}
        onConfirm={confirmImport}
      />
    )}
    </>
  );
};
