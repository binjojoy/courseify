import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (isOpen) setApiKey(getGeminiApiKey());
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
    try {
      await testGeminiApiKey(apiKey.trim());
      saveGeminiApiKey(apiKey.trim());
      onShowToast('Gemini key verified and saved in this browser.');
    } catch (error) {
      onShowToast(error instanceof Error ? error.message : 'Could not verify the Gemini key.');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    try {
      saveGeminiApiKey(apiKey);
      onShowToast(apiKey.trim() ? 'Gemini key saved in this browser.' : 'Gemini key removed.');
      onClose();
    } catch (error) {
      onShowToast(error instanceof Error ? error.message : 'Could not save the Gemini key.');
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-scrim p-4 backdrop-blur-sm" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="gemini-key-title" className="w-full max-w-md rounded-xl border border-border-default bg-bg-elevated p-5 shadow-2xl animate-scaleUp">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-subtle text-accent"><KeyRound size={20} /></div>
            <h2 id="gemini-key-title" className="text-lg font-semibold text-text-primary">Gemini API key</h2>
            <p className="mt-1 text-sm text-text-secondary">Your key stays in this browser and is sent directly to Google for AI requests.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-2 text-text-muted hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><X size={18} /></button>
        </div>
        <label htmlFor="gemini-api-key" className="mb-1.5 block text-sm font-medium text-text-primary">API key</label>
        <div className="flex h-11 items-center overflow-hidden rounded-lg border border-border-strong bg-bg-canvas focus-within:ring-2 focus-within:ring-accent/40">
          <input id="gemini-api-key" type={isVisible ? 'text' : 'password'} autoComplete="off" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="AIzaSy..." className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-text-primary outline-none" />
          <button type="button" onClick={() => setIsVisible(value => !value)} aria-label={isVisible ? 'Hide API key' : 'Show API key'} className="px-3 text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{isVisible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-text-muted">AI guides are generated from lesson titles and descriptions; transcripts are not available to this app. Review Google AI Studio's terms before using your key.</p>
        <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Get a key from Google AI Studio</a>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={handleTest} disabled={!apiKey.trim() || isTesting} className="h-10 rounded-lg border border-border-strong px-3 text-sm font-medium text-text-primary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{isTesting ? 'Testing…' : 'Test key'}</button>
          <button type="button" onClick={handleSave} className="h-10 rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">Save key</button>
        </div>
      </section>
    </div>
  );
};