import { describe, it, expect } from 'vitest';
import { schedule } from '../scheduler';
import type { Requirement } from '../../types';

/**
 * The DetailChart highlights `schedule.criticalPath` in red so the user can
 * see which requirements determine total project duration. This test locks
 * down the contract: the longest dependency chain wins.
 */

function r(id: string, days: number, dependsOn: string | null = null, sortOrder = 0): Requirement {
  return {
    id,
    projectId: 'p1',
    name: id,
    originalDays: days,
    currentDays: days,
    isAddedByChange: false,
    status: 'active',
    sortOrder,
    dependsOn,
    pausedRemainingDays: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

describe('schedule.criticalPath', () => {
  it('single linear chain → all requirements on critical path', () => {
    const reqs = [r('a', 3, null, 0), r('b', 2, 'a', 1), r('c', 4, 'b', 2)];
    const result = schedule(reqs);
    expect(result.totalDays).toBe(9);
    expect(result.criticalPath.sort()).toEqual(['a', 'b', 'c'].sort());
  });

  it('two parallel chains → only the longer one is critical', () => {
    // chain 1: a (5d) — solo
    // chain 2: b (2d) → c (2d) — total 4d
    // chain 1 wins; only "a" is critical
    const reqs = [r('a', 5, null, 0), r('b', 2, null, 1), r('c', 2, 'b', 2)];
    const result = schedule(reqs);
    expect(result.totalDays).toBe(5);
    expect(result.criticalPath).toEqual(['a']);
  });

  it('cancelled requirements are excluded from critical path', () => {
    const reqs = [
      r('a', 3, null, 0),
      { ...r('b', 100, 'a', 1), status: 'cancelled' as const }, // would be longest IF active
      r('c', 2, 'a', 2),
    ];
    const result = schedule(reqs);
    expect(result.criticalPath).not.toContain('b');
  });

  it('empty input → empty critical path', () => {
    expect(schedule([]).criticalPath).toEqual([]);
  });
});
