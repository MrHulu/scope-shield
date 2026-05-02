import { useEffect, useRef, useCallback } from 'react';

/**
 * Selector covering every native focusable element + anything carrying
 * `tabindex` (excluding tabindex="-1" which opts out). Order matters — the
 * first focusable becomes initial focus when the trap activates.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
].join(',');

function getFocusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('aria-hidden') && el.offsetParent !== null,
  );
}

/**
 * Focus trap hook for modal-style dialogs. When `active` is true:
 *   - Initial focus moves to the first focusable element inside the ref'd
 *     container (next animation frame, so React has a chance to mount it).
 *   - Tab + Shift+Tab cycle within the container — Tab past the last element
 *     wraps to the first; Shift+Tab past the first wraps to the last.
 *   - When `active` flips back to false (modal closes), focus is restored to
 *     whatever was focused when the trap activated.
 *
 * Wave 3 W3.1 — promotes the W2.9 a11y smoke from "structure exists" to
 * "keyboard never escapes a modal".
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  active: boolean,
): React.RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const root = ref.current;
    if (!root) return;
    const focusables = getFocusables(root);
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const activeEl = document.activeElement as HTMLElement | null;
    if (e.shiftKey) {
      if (activeEl === first || !root.contains(activeEl)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (activeEl === last || !root.contains(activeEl)) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    // Snapshot the element that had focus so we can restore it on close.
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    // Defer initial focus by one frame — useEffect fires after React commit
    // but the modal's focusable children may not be measured/painted yet.
    const focusFrame = requestAnimationFrame(() => {
      const root = ref.current;
      if (!root) return;
      const focusables = getFocusables(root);
      if (focusables.length > 0) focusables[0].focus();
      else root.focus();
    });
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown, true);
      // Restore focus only if the previously-focused element is still in DOM
      // and visible — modals that close as part of a route change shouldn't
      // pull focus back to a stale element.
      const prev = previouslyFocused.current;
      if (prev && document.contains(prev)) prev.focus();
    };
  }, [active, handleKeyDown]);

  return ref;
}
