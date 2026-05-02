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
    expect(useUndoStore.getState().pending).toBeNull();
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

  it('subsequent recordDeletion overwrites previous pending', () => {
    useUndoStore.getState().recordDeletion(makeChange({ id: 'c1' }));
    useUndoStore.getState().recordDeletion(makeChange({ id: 'c2' }));
    expect(useUndoStore.getState().consume()?.id).toBe('c2');
  });
});
