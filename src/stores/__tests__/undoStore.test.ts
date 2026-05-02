import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUndoStore } from '../undoStore';
import type { Change } from '../../types';

function makeChange(overrides: Partial<Change> = {}): Change {
  return {
    id: 'c1',
    projectId: 'p1',
    type: 'add_days',
    targetRequirementId: 'r1',
    role: 'pm',
    personName: null,
    description: '+',
    daysDelta: 2,
    date: '2026-04-15',
    metadata: null,
    screenshots: [],
    createdAt: '2026-04-15T00:00:00Z',
    updatedAt: '2026-04-15T00:00:00Z',
    ...overrides,
  };
}

describe('undoStore', () => {
  beforeEach(() => {
    useUndoStore.getState().clear();
  });

  it('records a deletion and consume returns it', () => {
    const change = makeChange();
    useUndoStore.getState().recordDeletion(change);
    const consumed = useUndoStore.getState().consume();
    expect(consumed).toEqual(change);
    expect(useUndoStore.getState().pending).toEqual([]);
  });

  it('consume returns null when nothing recorded', () => {
    expect(useUndoStore.getState().consume()).toBeNull();
  });

  it('consume returns null after expiry (8s default)', () => {
    const change = makeChange();
    const realNow = Date.now;
    Date.now = vi.fn().mockReturnValue(1_000_000);
    useUndoStore.getState().recordDeletion(change);
    // Jump past TTL
    Date.now = vi.fn().mockReturnValue(1_000_000 + 8_500);
    const consumed = useUndoStore.getState().consume();
    expect(consumed).toBeNull();
    Date.now = realNow;
  });

  it('clear drops pending without consuming', () => {
    useUndoStore.getState().recordDeletion(makeChange());
    useUndoStore.getState().clear();
    expect(useUndoStore.getState().consume()).toBeNull();
  });

  it('multi-step: consume pops in LIFO order (W3.2)', () => {
    useUndoStore.getState().recordDeletion(makeChange({ id: 'c1' }));
    useUndoStore.getState().recordDeletion(makeChange({ id: 'c2' }));
    useUndoStore.getState().recordDeletion(makeChange({ id: 'c3' }));
    expect(useUndoStore.getState().consume()?.id).toBe('c3');
    expect(useUndoStore.getState().consume()?.id).toBe('c2');
    expect(useUndoStore.getState().consume()?.id).toBe('c1');
    expect(useUndoStore.getState().consume()).toBeNull();
  });

  it('stack capped at 10 entries — oldest evicted (W3.2)', () => {
    for (let i = 0; i < 12; i++) {
      useUndoStore.getState().recordDeletion(makeChange({ id: `c${i}` }));
    }
    // 12 pushes → c0/c1 evicted, c2..c11 retained
    const consumed: string[] = [];
    while (true) {
      const next = useUndoStore.getState().consume();
      if (!next) break;
      consumed.push(next.id);
    }
    expect(consumed).toEqual(['c11', 'c10', 'c9', 'c8', 'c7', 'c6', 'c5', 'c4', 'c3', 'c2']);
  });

  it('expired entries are silently skipped during consume (W3.2)', () => {
    const realNow = Date.now;
    Date.now = vi.fn().mockReturnValue(1_000_000);
    useUndoStore.getState().recordDeletion(makeChange({ id: 'old' }));
    Date.now = vi.fn().mockReturnValue(1_005_000);
    useUndoStore.getState().recordDeletion(makeChange({ id: 'fresh' }));
    // Jump 8.5s past 'old' but only 3.5s past 'fresh'
    Date.now = vi.fn().mockReturnValue(1_009_500);
    expect(useUndoStore.getState().consume()?.id).toBe('fresh');
    // Now 'old' is also expired (past 1_008_000) — consume returns null
    expect(useUndoStore.getState().consume()).toBeNull();
    Date.now = realNow;
  });
});
