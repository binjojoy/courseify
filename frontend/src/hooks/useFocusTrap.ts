import { useEffect, useRef } from 'react';

/**
 * Elements that can receive focus, in DOM order. Anything with a positive
 * tabindex counts so custom controls are not skipped.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

const isVisible = (element: HTMLElement): boolean => {
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') return false;
  // offsetParent is null for display:none subtrees; fixed elements report null
  // too, so fall back to the client rect.
  return element.offsetParent !== null || element.getClientRects().length > 0;
};

export const getFocusableElements = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isVisible);

/**
 * Trap Tab focus inside a dialog and restore it to the opener on close.
 *
 * Courseify renders several modals (import confirm, Gemini key, release notes,
 * clear data, name prompt) and without this, Tab walks into the inert page
 * behind the overlay while the overlay is still visually on top.
 *
 * The previously focused element is captured on activation and restored on
 * cleanup, so dismissing a dialog returns the user exactly where they were.
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const containerRef = useRef<T | null>(null);

  useEffect(() => {
    if (!active) return undefined;

    const container = containerRef.current;
    if (!container) return undefined;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Move focus in on open: prefer the first control, fall back to the dialog
    // itself so screen readers still announce something.
    const initial = getFocusableElements(container)[0];
    (initial ?? container).focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = getFocusableElements(container);
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;

      if (event.shiftKey && (current === first || current === container)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    // A click landing on the backdrop should not focus the inert page either.
    const onFocusIn = (event: FocusEvent) => {
      if (container.contains(event.target as Node)) return;
      const focusable = getFocusableElements(container);
      (focusable[0] ?? container).focus({ preventScroll: true });
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocusIn);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocusIn);
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [active]);

  return containerRef;
}
