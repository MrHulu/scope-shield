import { create } from 'zustand';
import type { Change } from '../types';

const UNDO_TTL_MS = 8000;
const MAX_STACK = 10;

interface PendingUndo {
  change: Change;
  /** ms epoch — past this point the entry is silently dropped on consume. */
  expiresAt: number;
}

interface UndoStore {
  /** LIFO stack of recent deletions. Newest at the end. */
  pending: PendingUndo[];
  /** Push a new deletion onto the stack; oldest evicted past MAX_STACK. */
  recordDeletion: (change: Change) => void;
  /** Pop the newest non-expired entry. Skips and discards expired entries
   *  on the way (they're silently dead anyway). */
  consume: () => Change | null;
  /** Drop everything without consuming. */
  clear: () => void;
}

export const useUndoStore = create<UndoStore>((set, get) => ({
  pending: [],
  recordDeletion: (change) => {
    const next: PendingUndo = { change, expiresAt: Date.now() + UNDO_TTL_MS };
    const stack = [...get().pending, next];
    if (stack.length > MAX_STACK) stack.splice(0, stack.length - MAX_STACK);
    set({ pending: stack });
  },
  consume: () => {
    const stack = [...get().pending];
    const now = Date.now();
    while (stack.length > 0) {
      const top = stack.pop()!;
      if (top.expiresAt > now) {
        set({ pending: stack });
        return top.change;
      }
      // Expired — discard and keep popping.
    }
    set({ pending: [] });
    return null;
  },
  clear: () => set({ pending: [] }),
}));

export const UNDO_TTL_SECONDS = UNDO_TTL_MS / 1000;
export const UNDO_MAX_STACK = MAX_STACK;
