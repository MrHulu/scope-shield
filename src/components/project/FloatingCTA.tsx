import { useEffect } from 'react';
import { Plus } from 'lucide-react';

const REQUEST_OPEN = 'scope-shield:open-change-modal';

interface FloatingCTAProps {
  /** Hide when there's nothing to record against (no requirements yet, archived). */
  disabled?: boolean;
}

/**
 * Always-visible "记录变更" button pinned to the bottom-right of the
 * viewport. Also wires the global ⌘⇧C / Ctrl+Shift+C shortcut so power users
 * never have to scroll to the change list.
 *
 * Both entry points dispatch a `scope-shield:open-change-modal` window event,
 * which the active ChangeList handles by opening its modal.
 */
export function FloatingCTA({ disabled = false }: FloatingCTAProps) {
  // Global keyboard shortcut: ⌘⇧C (mac) / Ctrl+Shift+C (other). Skip when an
  // input is focused so it doesn't fight with text-field hot keys.
  useEffect(() => {
    if (disabled) return;
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || !e.shiftKey) return;
      if (e.key.toLowerCase() !== 'c') return;
      const tag = (e.target as HTMLElement | null)?.tagName ?? '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      window.dispatchEvent(new CustomEvent(REQUEST_OPEN));
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [disabled]);

  if (disabled) return null;

  return (
    <button
      type="button"
      aria-label="记录变更（⌘⇧C）"
      data-testid="floating-cta-record-change"
      onClick={() => window.dispatchEvent(new CustomEvent(REQUEST_OPEN))}
      className="fixed bottom-6 right-6 flex items-center gap-2 px-5 py-3 rounded-full font-medium text-white text-sm transition-all hover:scale-[1.03] active:scale-[0.98]"
      style={{
        zIndex: 'var(--z-fab)',
        background: 'var(--gradient-plan)',
        boxShadow: 'var(--shadow-fab)',
      }}
    >
      <Plus size={16} strokeWidth={2.5} />
      记录变更
      <kbd className="ml-1 px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/20 text-white/90">
        ⌘⇧C
      </kbd>
    </button>
  );
}
