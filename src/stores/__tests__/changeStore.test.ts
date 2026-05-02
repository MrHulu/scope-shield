import { describe, it, expect, beforeEach } from 'vitest';
import { useChangeStore } from '../changeStore';
import * as changeRepo from '../../db/changeRepo';
import * as requirementRepo from '../../db/requirementRepo';
import * as snapshotRepo from '../../db/snapshotRepo';
import type { Change, Requirement } from '../../types';

/**
 * Wave 2 W2.2 — focused tests for deleteChange path. Uses fake-indexeddb
 * from src/test/setup.ts (no mocking of repos needed; the real IDB layer
 * runs against the fake driver).
 */

const PROJECT_ID = 'p1';

function makeReq(overrides: Partial<Requirement> & { id: string }): Requirement {
  return {
    projectId: PROJECT_ID,
    name: overrides.id,
    originalDays: 3,
    currentDays: 3,
    isAddedByChange: false,
    status: 'active',
    sortOrder: 0,
    dependsOn: null,
    pausedRemainingDays: null,
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    ...overrides,
  };
}

function makeChange(overrides: Partial<Change> & { id: string }): Change {
  return {
    projectId: PROJECT_ID,
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

async function seedReqs(reqs: Requirement[]) {
  for (const r of reqs) await requirementRepo.putRequirement(r);
}

async function seedChanges(changes: Change[]) {
  for (const c of changes) await changeRepo.putChange(c);
}

async function clearAll() {
  // fake-indexeddb persists across tests in the same process; reset by
  // dropping all rows we touched.
  await requirementRepo.deleteRequirementsByProject(PROJECT_ID);
  await changeRepo.deleteChangesByProject(PROJECT_ID);
  await snapshotRepo.deleteSnapshotsByProject(PROJECT_ID);
  useChangeStore.setState({ changes: [], loading: false, error: null });
}

describe('changeStore.deleteChange', () => {
  beforeEach(async () => {
    await clearAll();
  });

  it('returns null when target id does not exist', async () => {
    const result = await useChangeStore
      .getState()
      .deleteChange('nonexistent', PROJECT_ID, []);
    expect(result).toBeNull();
  });

  it('resets to baseline when no changes remain after delete', async () => {
    const reqs = [makeReq({ id: 'r1', currentDays: 5 })]; // mutated by a +2 change
    const change = makeChange({ id: 'c1', daysDelta: 2 });
    await seedReqs(reqs);
    await seedChanges([change]);
    useChangeStore.setState({ changes: [change] });

    const result = await useChangeStore
      .getState()
      .deleteChange('c1', PROJECT_ID, reqs);

    expect(result).not.toBeNull();
    expect(result!.requirements).toHaveLength(1);
    // currentDays reset to originalDays (3, not the mutated 5)
    expect(result!.requirements[0].currentDays).toBe(3);
    expect(useChangeStore.getState().changes).toEqual([]);
  });

  it('cascade-deletes the requirement when deleting a new_requirement change', async () => {
    const baseReq = makeReq({ id: 'r1', isAddedByChange: false });
    const addedReq = makeReq({ id: 'added', isAddedByChange: true });
    const newReqChange = makeChange({
      id: 'c-new',
      type: 'new_requirement',
      targetRequirementId: 'added',
      daysDelta: 3,
      metadata: { newRequirementName: 'added' },
    });
    await seedReqs([baseReq, addedReq]);
    await seedChanges([newReqChange]);
    useChangeStore.setState({ changes: [newReqChange] });

    const result = await useChangeStore
      .getState()
      .deleteChange('c-new', PROJECT_ID, [baseReq, addedReq]);

    expect(result).not.toBeNull();
    // 'added' requirement was cascade-deleted; only the base req remains.
    expect(result!.requirements.map((r) => r.id)).toEqual(['r1']);
    // The cascade-deleted req is also gone from IDB.
    expect(await requirementRepo.getRequirement('added')).toBeUndefined();
  });

  it('full-replays remaining changes and updates store + IDB', async () => {
    const reqs = [makeReq({ id: 'r1', currentDays: 9 })]; // mutated by both changes
    const c1 = makeChange({ id: 'c1', daysDelta: 2, date: '2026-04-10' });
    const c2 = makeChange({ id: 'c2', daysDelta: 4, date: '2026-04-20' });
    await seedReqs(reqs);
    await seedChanges([c1, c2]);
    useChangeStore.setState({ changes: [c1, c2] });

    const result = await useChangeStore
      .getState()
      .deleteChange('c2', PROJECT_ID, reqs);

    expect(result).not.toBeNull();
    // After deleting c2, only c1 remains; 3 (original) + 2 = 5
    expect(result!.requirements[0].currentDays).toBe(5);
    expect(useChangeStore.getState().changes.map((c) => c.id)).toEqual(['c1']);
    // c2 row gone from IDB
    expect(await changeRepo.getChange('c2')).toBeUndefined();
  });
});
