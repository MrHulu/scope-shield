import { bench, describe } from 'vitest';
import { schedule } from '../scheduler';
import { processChange, applyChangeForReplay } from '../changeProcessor';
import type { Requirement, CreateChangeInput, Change } from '../../types';

/**
 * Wave 2 W2.10 — performance baseline. The numbers vitest reports here
 * become the regression detector for engine changes (anything that 5×s a
 * critical path is going to show up loud in the next CI). Run with:
 *
 *   npx vitest bench
 *
 * Baseline captured 2026-05-02 — see .review/perf-baseline.txt.
 */

function makeReqs(n: number, withDeps = false): Requirement[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `r${i}`,
    projectId: 'p1',
    name: `req-${i}`,
    originalDays: 1 + (i % 5),
    currentDays: 1 + (i % 5),
    isAddedByChange: false,
    status: 'active' as const,
    sortOrder: i,
    // Half the chain depends linearly when deps requested — exercises critical
    // path tracing instead of trivial parallel maxing.
    dependsOn: withDeps && i > 0 ? `r${i - 1}` : null,
    pausedRemainingDays: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }));
}

describe('schedule()', () => {
  const reqs100Parallel = makeReqs(100, false);
  const reqs100Linear = makeReqs(100, true);
  const reqs500Parallel = makeReqs(500, false);
  const reqs500Linear = makeReqs(500, true);
  const reqs1000Parallel = makeReqs(1000, false);

  bench('100 reqs · parallel', () => {
    schedule(reqs100Parallel);
  });

  bench('100 reqs · linear chain', () => {
    schedule(reqs100Linear);
  });

  bench('500 reqs · parallel', () => {
    schedule(reqs500Parallel);
  });

  bench('500 reqs · linear chain (critical-path heavy)', () => {
    schedule(reqs500Linear);
  });

  bench('1000 reqs · parallel', () => {
    schedule(reqs1000Parallel);
  });
});

function makeChange(overrides: Partial<Change> = {}): Change {
  return {
    id: 'c1',
    projectId: 'p1',
    type: 'add_days',
    targetRequirementId: 'r0',
    role: 'pm',
    personName: null,
    description: '+',
    daysDelta: 1,
    date: '2026-04-15',
    metadata: null,
    screenshots: [],
    createdAt: '2026-04-15T00:00:00Z',
    updatedAt: '2026-04-15T00:00:00Z',
    ...overrides,
  };
}

describe('processChange()', () => {
  const reqs100 = makeReqs(100, true);
  const input: CreateChangeInput = {
    projectId: 'p1',
    type: 'add_days',
    targetRequirementId: 'r50',
    role: 'pm',
    description: '+',
    daysDelta: 1,
    date: '2026-04-15',
  };

  bench('add_days on 100-req chain', () => {
    processChange(input, reqs100);
  });

  bench('cancel_requirement cascade on 100 chain', () => {
    processChange(
      { ...input, type: 'cancel_requirement', targetRequirementId: 'r10' },
      reqs100,
    );
  });
});

describe('applyChangeForReplay()', () => {
  const reqs500 = makeReqs(500, false);
  const change = makeChange({ targetRequirementId: 'r100', daysDelta: 1 });

  bench('replay 1 add_days against 500 reqs', () => {
    // Clone — applyChangeForReplay mutates in place
    const cloned = reqs500.map((r) => ({ ...r }));
    applyChangeForReplay(change, cloned);
  });
});
