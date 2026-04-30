import { describe, it, expect } from 'vitest';
import { schedule, computeOriginalTotalDays, wouldCycle, CyclicDependencyError } from '../scheduler';
import type { Requirement } from '../../types/index';

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

describe('schedule', () => {
  it('returns 0 for empty requirements', () => {
    const result = schedule([]);
    expect(result.totalDays).toBe(0);
    expect(result.requirementSchedules).toHaveLength(0);
  });

  it('schedules independent requirements in parallel (max of days)', () => {
    const reqs = [
      makeReq({ id: 'r1', currentDays: 3 }),
      makeReq({ id: 'r2', currentDays: 5 }),
      makeReq({ id: 'r3', currentDays: 2 }),
    ];
    const result = schedule(reqs);
    expect(result.totalDays).toBe(5);
    // All start at day 0
    for (const rs of result.requirementSchedules) {
      expect(rs.startDay).toBe(0);
    }
  });

  it('schedules sequential dependencies correctly', () => {
    const reqs = [
      makeReq({ id: 'r1', currentDays: 3, sortOrder: 0 }),
      makeReq({ id: 'r2', currentDays: 2, sortOrder: 1, dependsOn: 'r1' }),
    ];
    const result = schedule(reqs);
    expect(result.totalDays).toBe(5); // 3 + 2

    const r1Sched = result.requirementSchedules.find((s) => s.requirementId === 'r1')!;
    const r2Sched = result.requirementSchedules.find((s) => s.requirementId === 'r2')!;
    expect(r1Sched.startDay).toBe(0);
    expect(r1Sched.endDay).toBe(3);
    expect(r2Sched.startDay).toBe(3);
    expect(r2Sched.endDay).toBe(5);
  });

  it('handles chain A→B→C', () => {
    const reqs = [
      makeReq({ id: 'r1', currentDays: 1, sortOrder: 0 }),
      makeReq({ id: 'r2', currentDays: 2, sortOrder: 1, dependsOn: 'r1' }),
      makeReq({ id: 'r3', currentDays: 1.5, sortOrder: 2, dependsOn: 'r2' }),
    ];
    const result = schedule(reqs);
    expect(result.totalDays).toBe(4.5); // 1+2+1.5
  });

  it('half-day requirements schedule correctly', () => {
    const reqs = [
      makeReq({ id: 'r1', currentDays: 0.5, sortOrder: 0 }),
      makeReq({ id: 'r2', currentDays: 0.5, sortOrder: 1, dependsOn: 'r1' }),
    ];
    const result = schedule(reqs);
    expect(result.totalDays).toBe(1);
  });

  it('ignores cancelled requirements', () => {
    const reqs = [
      makeReq({ id: 'r1', currentDays: 5, status: 'cancelled' }),
      makeReq({ id: 'r2', currentDays: 3 }),
    ];
    const result = schedule(reqs);
    expect(result.totalDays).toBe(3);
    expect(result.requirementSchedules).toHaveLength(1);
  });

  it('ignores paused requirements', () => {
    const reqs = [
      makeReq({ id: 'r1', currentDays: 5, status: 'paused', pausedRemainingDays: 3 }),
      makeReq({ id: 'r2', currentDays: 3 }),
    ];
    const result = schedule(reqs);
    expect(result.totalDays).toBe(3);
  });

  it('lifts dependency on paused requirement', () => {
    const reqs = [
      makeReq({ id: 'r1', currentDays: 5, status: 'paused', pausedRemainingDays: 3 }),
      makeReq({ id: 'r2', currentDays: 2, dependsOn: 'r1' }),
    ];
    const result = schedule(reqs);
    // r1 is paused so not scheduled; r2's dependency is lifted → starts at 0
    expect(result.totalDays).toBe(2);
  });

  it('throws CyclicDependencyError for circular deps', () => {
    const reqs = [
      makeReq({ id: 'r1', currentDays: 3, dependsOn: 'r2' }),
      makeReq({ id: 'r2', currentDays: 3, dependsOn: 'r1' }),
    ];
    expect(() => schedule(reqs)).toThrow(CyclicDependencyError);
  });

  it('returns critical path', () => {
    const reqs = [
      makeReq({ id: 'r1', currentDays: 3, sortOrder: 0 }),
      makeReq({ id: 'r2', currentDays: 2, sortOrder: 1, dependsOn: 'r1' }),
      makeReq({ id: 'r3', currentDays: 1, sortOrder: 2 }), // parallel, shorter
    ];
    const result = schedule(reqs);
    expect(result.totalDays).toBe(5);
    expect(result.criticalPath).toContain('r1');
    expect(result.criticalPath).toContain('r2');
    expect(result.criticalPath).not.toContain('r3');
  });
});

describe('computeOriginalTotalDays', () => {
  it('uses originalDays, excludes isAddedByChange', () => {
    const reqs = [
      makeReq({ id: 'r1', originalDays: 3, currentDays: 5 }),
      makeReq({ id: 'r2', originalDays: 2, currentDays: 10, isAddedByChange: true }),
    ];
    const result = computeOriginalTotalDays(reqs);
    expect(result).toBe(3); // only r1's originalDays
  });

  it('returns 0 for all change-added reqs', () => {
    const reqs = [
      makeReq({ id: 'r1', isAddedByChange: true }),
    ];
    expect(computeOriginalTotalDays(reqs)).toBe(0);
  });

  it('handles dependencies using originalDays', () => {
    const reqs = [
      makeReq({ id: 'r1', originalDays: 2, currentDays: 10, sortOrder: 0 }),
      makeReq({ id: 'r2', originalDays: 3, currentDays: 10, sortOrder: 1, dependsOn: 'r1' }),
    ];
    expect(computeOriginalTotalDays(reqs)).toBe(5); // 2 + 3
  });
});

describe('wouldCycle', () => {
  it('returns false for null target', () => {
    expect(wouldCycle([], 'r1', null)).toBe(false);
  });

  it('returns true for self-reference', () => {
    expect(wouldCycle([], 'r1', 'r1')).toBe(true);
  });

  it('detects indirect cycle', () => {
    const reqs = [
      makeReq({ id: 'r1', dependsOn: null }),
      makeReq({ id: 'r2', dependsOn: 'r1' }),
      makeReq({ id: 'r3', dependsOn: 'r2' }),
    ];
    // Setting r1.dependsOn = r3 would create r1→r3→r2→r1
    expect(wouldCycle(reqs, 'r1', 'r3')).toBe(true);
  });

  it('allows valid dependency', () => {
    const reqs = [
      makeReq({ id: 'r1', dependsOn: null }),
      makeReq({ id: 'r2', dependsOn: null }),
    ];
    expect(wouldCycle(reqs, 'r2', 'r1')).toBe(false);
  });
});
