import { describe, it, expect } from 'vitest';
import { replayChanges } from '../replayEngine';
import type { Requirement, Change } from '../../types/index';

function makeReq(overrides: Partial<Requirement> & { id: string }): Requirement {
  return {
    projectId: 'p1',
    name: overrides.id,
    originalDays: 3,
    currentDays: 3,
    isAddedByChange: false,
    status: 'active',
    sortOrder: 0,
    dependsOn: null,
    pausedRemainingDays: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeChange(overrides: Partial<Change> & { id: string }): Change {
  return {
    projectId: 'p1',
    type: 'add_days',
    targetRequirementId: 'r1',
    role: 'pm',
    personName: null,
    description: 'test',
    daysDelta: 2,
    date: '2026-01-15',
    metadata: null,
    screenshots: [],
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
    ...overrides,
  };
}

describe('replayChanges', () => {
  it('resets baseline requirements to originalDays', () => {
    const reqs = [makeReq({ id: 'r1', originalDays: 3, currentDays: 10 })];
    const changes: Change[] = [];
    const result = replayChanges(reqs, changes, 'p1');
    expect(result.requirements[0].currentDays).toBe(3); // reset to originalDays
    expect(result.requirements[0].status).toBe('active');
  });

  it('removes isAddedByChange requirements then recreates via change', () => {
    const reqs = [
      makeReq({ id: 'r1', originalDays: 3 }),
      makeReq({ id: 'r-added', originalDays: 5, isAddedByChange: true }),
    ];
    const changes = [
      makeChange({
        id: 'c1',
        type: 'new_requirement',
        targetRequirementId: 'r-added',
        daysDelta: 5,
        metadata: { newRequirementName: 'Added Req' },
      }),
    ];
    const result = replayChanges(reqs, changes, 'p1');
    // r-added should be recreated
    const addedReq = result.requirements.find((r) => r.id === 'r-added');
    expect(addedReq).toBeDefined();
    expect(addedReq!.currentDays).toBe(5);
    expect(addedReq!.isAddedByChange).toBe(true);
  });

  it('applies changes in date+createdAt order', () => {
    const reqs = [makeReq({ id: 'r1', originalDays: 3 })];
    const changes = [
      makeChange({ id: 'c2', date: '2026-01-20', daysDelta: 1, createdAt: '2026-01-20T00:00:00Z' }),
      makeChange({ id: 'c1', date: '2026-01-10', daysDelta: 2, createdAt: '2026-01-10T00:00:00Z' }),
    ];
    const result = replayChanges(reqs, changes, 'p1');
    // After reset: 3 → +2 → +1 = 6
    expect(result.requirements[0].currentDays).toBe(6);
  });

  it('generates one snapshot per change', () => {
    const reqs = [makeReq({ id: 'r1', originalDays: 3 })];
    const changes = [
      makeChange({ id: 'c1', daysDelta: 1 }),
      makeChange({ id: 'c2', daysDelta: 2, date: '2026-01-20', createdAt: '2026-01-20T00:00:00Z' }),
    ];
    const result = replayChanges(reqs, changes, 'p1');
    expect(result.snapshots).toHaveLength(2);
    expect(result.snapshots[0].changeId).toBe('c1');
    expect(result.snapshots[1].changeId).toBe('c2');
  });

  it('recalculates cancel daysDelta from replay state', () => {
    const reqs = [makeReq({ id: 'r1', originalDays: 3 })];
    const changes = [
      makeChange({ id: 'c1', type: 'add_days', daysDelta: 2 }), // 3 → 5
      makeChange({
        id: 'c2',
        type: 'cancel_requirement',
        daysDelta: -3, // original delta
        date: '2026-01-20',
        createdAt: '2026-01-20T00:00:00Z',
      }),
    ];
    const result = replayChanges(reqs, changes, 'p1');
    // cancel should recalculate: currentDays at cancel point = 5 → daysDelta = -5
    const cancelChange = result.changes.find((c) => c.type === 'cancel_requirement')!;
    expect(cancelChange.daysDelta).toBe(-5);
  });

  it('pause + resume roundtrip during replay', () => {
    const reqs = [makeReq({ id: 'r1', originalDays: 5 })];
    const changes = [
      makeChange({
        id: 'c1',
        type: 'pause',
        targetRequirementId: 'r1',
        daysDelta: 0,
        date: '2026-01-10',
        createdAt: '2026-01-10T00:00:00Z',
        metadata: { remainingDays: 3 },
      }),
      makeChange({
        id: 'c2',
        type: 'resume',
        targetRequirementId: 'r1',
        daysDelta: 0,
        date: '2026-01-20',
        createdAt: '2026-01-20T00:00:00Z',
      }),
    ];
    const result = replayChanges(reqs, changes, 'p1');
    const r = result.requirements[0];
    expect(r.status).toBe('active');
    expect(r.currentDays).toBe(3); // resumed with pausedRemainingDays
    expect(r.pausedRemainingDays).toBeNull();
  });

  it('supplement during paused state syncs pausedRemainingDays', () => {
    const reqs = [makeReq({ id: 'r1', originalDays: 5 })];
    const changes = [
      makeChange({
        id: 'c1',
        type: 'pause',
        targetRequirementId: 'r1',
        daysDelta: 0,
        date: '2026-01-10',
        createdAt: '2026-01-10T00:00:00Z',
        metadata: { remainingDays: 3 },
      }),
      makeChange({
        id: 'c2',
        type: 'supplement',
        targetRequirementId: 'r1',
        daysDelta: 1.5,
        date: '2026-01-15',
        createdAt: '2026-01-15T00:00:00Z',
        metadata: { subType: 'feature_addition' },
      }),
    ];
    const result = replayChanges(reqs, changes, 'p1');
    const r = result.requirements[0];
    expect(r.status).toBe('paused');
    expect(r.currentDays).toBe(6.5); // 5 + 1.5
    expect(r.pausedRemainingDays).toBe(4.5); // 3 + 1.5
  });

  it('computes totalDays and originalTotalDays', () => {
    const reqs = [
      makeReq({ id: 'r1', originalDays: 3 }),
      makeReq({ id: 'r2', originalDays: 2 }),
    ];
    const changes = [
      makeChange({ id: 'c1', targetRequirementId: 'r1', daysDelta: 2 }),
    ];
    const result = replayChanges(reqs, changes, 'p1');
    // r1: 3+2=5, r2: 2 → parallel → total = 5
    expect(result.totalDays).toBe(5);
    // original: max(3,2) = 3
    expect(result.originalTotalDays).toBe(3);
  });
});
