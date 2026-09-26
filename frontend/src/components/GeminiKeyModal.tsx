import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff, KeyRound, X } from 'lucide-react';
import { getGeminiApiKey, saveGeminiApiKey, testGeminiApiKey } from '../services/ai';

interface GeminiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (message: string) => void;
}

export const GeminiKeyModal: React.FC<GeminiKeyModalProps> = ({ isOpen, onClose, onShowToast }) => {
  const [apiKey, setApiKey] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [viewport, setViewport] = useState({ top: 0, height: typeof window === 'undefined' ? 0 : window.innerHeight });

  useEffect(() => {
    if (isOpen) {
      const savedKey = getGeminiApiKey();
      setApiKey(savedKey);
      setHasSavedKey(!!savedKey);
      setTestResult(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const updateViewport = () => {
      const visible = window.visualViewport;
      setViewport({ top: visible?.offsetTop || 0, height: visible?.height || window.innerHeight });
    };
    updateViewport();
    window.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('scroll', updateViewport);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('scroll', updateViewport);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isTesting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isTesting, onClose]);

  if (!isOpen) return null;

  const handleTest = async () => {
    if (!apiKey.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const reply = await testGeminiApiKey(apiKey.trim());
      saveGeminiApiKey(apiKey.trim());
      setHasSavedKey(true);
      setTestResult({ type: 'success', message: `Key works. Gemini replied: ${reply.trim()}` });
    } catch (error) {
      setTestResult({ type: 'error', message: error instanceof Error ? error.message : 'Could not verify the Gemini key.' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    try {
      saveGeminiApiKey(apiKey);
      setHasSavedKey(!!apiKey.trim());
      onShowToast(apiKey.trim() ? 'Gemini key saved in this browser.' : 'Gemini key removed.');
      setTestResult(null);
      onClose();
    } catch (error) {
      onShowToast(error instanceof Error ? error.message : 'Could not save the Gemini key.');
    }
  };

  const handleRemove = () => {
    try {
      saveGeminiApiKey('');
      setApiKey('');
      setHasSavedKey(false);
      setTestResult(null);
      onShowToast('Gemini key removed.');
    } catch (error) {
      setTestResult({ type: 'error', message: error instanceof Error ? error.message : 'Could not remove the Gemini key.' });
    }
  };

  return (
    createPortal(
    <div className="fixed left-0 right-0 z-[80] flex items-center justify-center overflow-y-auto bg-scrim p-4 backdrop-blur-sm" style={{ top: viewport.top, height: viewport.height }} onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="gemini-key-title" className="my-auto max-h-full w-full max-w-md overflow-y-auto rounded-xl border border-border-default bg-bg-elevated p-5 shadow-2xl animate-scaleUp">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-subtle text-accent"><KeyRound size={20} /></div>
            <h2 id="gemini-key-title" className="text-lg font-semibold text-text-primary">Gemini API key</h2>
            <p className="mt-1 text-sm text-text-secondary">{hasSavedKey ? 'A key is saved in this browser. Replace it or remove it below.' : 'No key is saved yet. Your key stays in this browser and is sent directly to Google.'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-2 text-text-muted hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><X size={18} /></button>
        </div>
        <label htmlFor="gemini-api-key" className="mb-1.5 block text-sm font-medium text-text-primary">API key</label>
        <div className="flex h-11 items-center overflow-hidden rounded-lg border border-border-strong bg-bg-canvas focus-within:ring-2 focus-within:ring-accent/40">
          <input id="gemini-api-key" type={isVisible ? 'text' : 'password'} autoComplete="off" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="AIzaSy..." className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-text-primary outline-none" />
          <button type="button" onClick={() => setIsVisible(value => !value)} aria-label={isVisible ? 'Hide API key' : 'Show API key'} className="px-3 text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{isVisible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        </div>
        {testResult && <p role={testResult.type === 'error' ? 'alert' : 'status'} aria-live="polite" className={`mt-3 rounded-lg border px-3 py-2 text-sm leading-relaxed ${testResult.type === 'success' ? 'border-success/30 bg-success-subtle text-success' : 'border-error/30 bg-error-subtle text-error'}`}>{testResult.message}</p>}
        <p className="mt-2 text-xs leading-relaxed text-text-muted">AI guides use lesson titles and descriptions; transcripts are not available. The usage ring tracks tokens returned to this browser. Google does not expose remaining API quota here; check AI Studio for limits.</p>
        <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Get a key from Google AI Studio</a>
        <div className="mt-6 flex justify-end gap-2">
          {hasSavedKey && <button type="button" onClick={handleRemove} disabled={isTesting} className="mr-auto h-10 rounded-lg px-3 text-sm font-medium text-error hover:bg-error-subtle disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Remove key</button>}
          <button type="button" onClick={handleTest} disabled={!apiKey.trim() || isTesting} className="h-10 rounded-lg border border-border-strong px-3 text-sm font-medium text-text-primary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{isTesting ? 'Testing…' : 'Test key'}</button>
          <button type="button" onClick={handleSave} className="h-10 rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">Save key</button>
        </div>
      </section>
    </div>, document.body)
  );
};