import { create } from 'zustand';
import type { Change } from '../types';

const UNDO_TTL_MS = 8000;

interface PendingUndo {
  change: Change;
  /** ms epoch — past this point the undo is silently dropped. */
  expiresAt: number;
}

interface UndoStore {
  pending: PendingUndo | null;
  /** Called right after a change row is deleted from IDB. */
  recordDeletion: (change: Change) => void;
  /** Called by the Cmd+Z handler. Returns the change to restore (or null
   *  if nothing was deleted recently). Clears the pending state. */
  consume: () => Change | null;
  /** Drop the pending undo without consuming (e.g. user took new action). */
  clear: () => void;
}

export const useUndoStore = create<UndoStore>((set, get) => ({
  pending: null,
  recordDeletion: (change) => {
    set({ pending: { change, expiresAt: Date.now() + UNDO_TTL_MS } });
  },
  consume: () => {
    const p = get().pending;
    if (!p) return null;
    if (Date.now() > p.expiresAt) {
      set({ pending: null });
      return null;
    }
    set({ pending: null });
    return p.change;
  },
  clear: () => set({ pending: null }),
}));

export const UNDO_TTL_SECONDS = UNDO_TTL_MS / 1000;
