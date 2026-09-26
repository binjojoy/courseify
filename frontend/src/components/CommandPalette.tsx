import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, KeyRound, Maximize, Moon, Search, Sparkles, Sun, X } from 'lucide-react';
import { Course } from '../types';
import { storage } from '../services/storage';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  courses: Course[];
  onNavigate: (courseId: string, videoId?: string) => void;
  onOpenGeminiSettings: () => void;
  onToggleTheme: () => void;
}

interface PaletteCommand {
  id: string;
  label: string;
  detail: string;
  searchText?: string;
  icon: React.ReactNode;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, courses, onNavigate, onOpenGeminiSettings, onToggleTheme }) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        window.dispatchEvent(new Event('courseify:open-command-palette'));
      } else if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    const open = () => {
      setQuery('');
      setActiveIndex(0);
    };
    window.addEventListener('courseify:open-command-palette', open);
    return () => window.removeEventListener('courseify:open-command-palette', open);
  }, []);

  const commands = useMemo<PaletteCommand[]>(() => {
    const theme = storage.getSettings().theme;
    const items: PaletteCommand[] = [
      { id: 'generate', label: 'Generate AI study guide', detail: 'Current lesson', icon: <Sparkles size={17} />, action: () => window.dispatchEvent(new Event('courseify:generate-ai-notes')) },
      { id: 'key', label: 'Configure Gemini API key', detail: 'AI settings', icon: <KeyRound size={17} />, action: onOpenGeminiSettings },
      { id: 'theme', label: `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`, detail: 'Appearance', icon: theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />, action: onToggleTheme },
      { id: 'fullscreen', label: 'Toggle fullscreen', detail: 'Current lesson', icon: <Maximize size={17} />, action: () => document.dispatchEvent(new Event('courseify:toggle-fullscreen')) }
    ];
    courses.forEach(course => {
      storage.getCourseVideos(course.id).forEach(video => {
        if (video.unavailable) return;
        const noteText = storage.getVideoNote(course.id, video.videoId);
        items.push({
          id: `${course.id}:${video.videoId}`,
          label: video.title,
          detail: course.title,
          icon: <BookOpen size={17} />,
          action: () => onNavigate(course.id, video.videoId)
        });
        if (noteText) items.push({
          id: `note:${course.id}:${video.videoId}`,
          label: `Note: ${video.title}`,
          detail: `Saved note · ${course.title}`,
          searchText: noteText,
          icon: <BookOpen size={17} />,
          action: () => onNavigate(course.id, video.videoId)
        });
      });
    });
    return items;
  }, [courses, onNavigate, onOpenGeminiSettings, onToggleTheme]);

  const filtered = commands.filter(command => `${command.label} ${command.detail} ${command.searchText || ''}`.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => setActiveIndex(0), [query]);

  if (!isOpen) return null;

  const run = (command?: PaletteCommand) => {
    if (!command) return;
    onClose();
    command.action();
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-start justify-center bg-scrim p-3 pt-[12vh] backdrop-blur-sm sm:p-6 sm:pt-[16vh]" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="command-palette-title" className="w-full max-w-xl overflow-hidden rounded-xl border border-border-default bg-bg-elevated shadow-2xl animate-scaleUp">
        <h2 id="command-palette-title" className="sr-only">Command palette</h2>
        <div className="flex h-14 items-center gap-3 border-b border-border-default px-4">
          <Search size={18} className="shrink-0 text-text-muted" />
          <input autoFocus value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex(index => Math.min(index + 1, filtered.length - 1)); }
            if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex(index => Math.max(index - 1, 0)); }
            if (event.key === 'Enter') { event.preventDefault(); run(filtered[activeIndex]); }
          }} placeholder="Search lessons or actions..." aria-label="Search commands and lessons" className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted" />
          <button type="button" onClick={onClose} aria-label="Close command palette" className="rounded-md p-1.5 text-text-muted hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><X size={17} /></button>
        </div>
        <div className="max-h-[min(60vh,28rem)] overflow-y-auto p-2" role="listbox" aria-label="Commands and lessons">
          {filtered.length ? filtered.map((command, index) => (
            <button key={command.id} type="button" role="option" aria-selected={activeIndex === index} onMouseEnter={() => setActiveIndex(index)} onClick={() => run(command)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${activeIndex === index ? 'bg-bg-hover' : 'hover:bg-bg-hover/70'}`}>
              <span className="text-accent">{command.icon}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-text-primary">{command.label}</span><span className="block truncate text-xs text-text-muted">{command.detail}</span></span>
              {index === activeIndex && <span className="text-xs text-text-muted">Enter</span>}
            </button>
          )) : <p className="px-3 py-8 text-center text-sm text-text-muted">No matching lessons or commands.</p>}
        </div>
        <div className="flex items-center justify-between border-t border-border-default px-4 py-2.5 text-[11px] text-text-muted">
          <span>Navigate lessons and actions</span>
          <span>Ctrl K / Cmd K</span>
        </div>
      </section>
    </div>
  );
};