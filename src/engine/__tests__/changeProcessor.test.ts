import { describe, it, expect } from 'vitest';
import { processChange, applyChangeForReplay } from '../changeProcessor';
import type { Requirement, CreateChangeInput, Change } from '../../types/index';

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

function makeInput(overrides: Partial<CreateChangeInput>): CreateChangeInput {
  return {
    projectId: 'p1',
    type: 'add_days',
    role: 'pm',
    description: 'test',
    date: '2026-01-01',
    ...overrides,
  };
}

describe('processChange', () => {
  describe('add_days', () => {
    it('adds days to target requirement', () => {
      const reqs = [makeReq({ id: 'r1', currentDays: 3 })];
      const input = makeInput({
        type: 'add_days',
        targetRequirementId: 'r1',
        daysDelta: 2,
      });
      const result = processChange(input, reqs);
      const updated = result.updatedRequirements.find((r) => r.id === 'r1')!;
      expect(updated.currentDays).toBe(5);
    });

    it('half-step delta works correctly', () => {
      const reqs = [makeReq({ id: 'r1', currentDays: 3 })];
      const input = makeInput({
        type: 'add_days',
        targetRequirementId: 'r1',
        daysDelta: 1.5,
      });
      const result = processChange(input, reqs);
      expect(result.updatedRequirements[0].currentDays).toBe(4.5);
    });

    it('clamps minimum to 0.5', () => {
      const reqs = [makeReq({ id: 'r1', currentDays: 1 })];
      const input = makeInput({
        type: 'add_days',
        targetRequirementId: 'r1',
        daysDelta: -5, // would go negative
      });
      const result = processChange(input, reqs);
      expect(result.updatedRequirements[0].currentDays).toBe(0.5);
    });

    it('skips cancelled requirement', () => {
      const reqs = [makeReq({ id: 'r1', currentDays: 3, status: 'cancelled' })];
      const input = makeInput({
        type: 'add_days',
        targetRequirementId: 'r1',
        daysDelta: 2,
      });
      const result = processChange(input, reqs);
      expect(result.updatedRequirements[0].currentDays).toBe(3); // unchanged
    });

    it('does not modify other requirements', () => {
      const reqs = [
        makeReq({ id: 'r1', currentDays: 3 }),
        makeReq({ id: 'r2', currentDays: 5 }),
      ];
      const input = makeInput({
        type: 'add_days',
        targetRequirementId: 'r1',
        daysDelta: 2,
      });
      const result = processChange(input, reqs);
      expect(result.updatedRequirements.find((r) => r.id === 'r2')!.currentDays).toBe(5);
    });

    it('syncs pausedRemainingDays for paused requirement', () => {
      const reqs = [makeReq({ id: 'r1', currentDays: 5, status: 'paused', pausedRemainingDays: 3 })];
      const input = makeInput({
        type: 'add_days',
        targetRequirementId: 'r1',
        daysDelta: 2,
      });
      const result = processChange(input, reqs);
      const updated = result.updatedRequirements[0];
      expect(updated.currentDays).toBe(7);
      expect(updated.pausedRemainingDays).toBe(5);
    });

    it('clamps pausedRemainingDays when reducing paused requirement below minimum', () => {
      const reqs = [makeReq({ id: 'r1', currentDays: 1, status: 'paused', pausedRemainingDays: 0.5 })];
      const input = makeInput({
        type: 'add_days',
        targetRequirementId: 'r1',
        daysDelta: -5,
      });
      const result = processChange(input, reqs);
      const updated = result.updatedRequirements[0];
      expect(updated.currentDays).toBe(0.5);
      expect(updated.pausedRemainingDays).toBe(0.5);
    });
  });

  describe('new_requirement', () => {
    it('creates new requirement with correct days', () => {
      const reqs = [makeReq({ id: 'r1' })];
      const input = makeInput({
        type: 'new_requirement',
        newRequirementName: 'New Feature',
        newRequirementDays: 5,
      });
      const result = processChange(input, reqs);
      expect(result.newRequirement).toBeDefined();
      expect(result.newRequirement!.name).toBe('New Feature');
      expect(result.newRequirement!.originalDays).toBe(5);
      expect(result.newRequirement!.currentDays).toBe(5);
      expect(result.newRequirement!.isAddedByChange).toBe(true);
      expect(result.newRequirement!.status).toBe('active');
    });

    it('sets sortOrder after existing max', () => {
      const reqs = [
        makeReq({ id: 'r1', sortOrder: 0 }),
        makeReq({ id: 'r2', sortOrder: 3 }),
      ];
      const input = makeInput({
        type: 'new_requirement',
        newRequirementName: 'New',
        newRequirementDays: 2,
      });
      const result = processChange(input, reqs);
      expect(result.newRequirement!.sortOrder).toBe(4);
    });

    it('half-step days for new requirement', () => {
      const input = makeInput({
        type: 'new_requirement',
        newRequirementName: 'Half',
        newRequirementDays: 1.5,
      });
      const result = processChange(input, []);
      expect(result.newRequirement!.currentDays).toBe(1.5);
      expect(result.change.daysDelta).toBe(1.5);
    });
  });

  describe('cancel_requirement', () => {
    it('sets status to cancelled and preserves currentDays', () => {
      const reqs = [makeReq({ id: 'r1', currentDays: 5 })];
      const input = makeInput({
        type: 'cancel_requirement',
        targetRequirementId: 'r1',
      });
      const result = processChange(input, reqs);
      const r = result.updatedRequirements[0];
      expect(r.status).toBe('cancelled');
      expect(r.currentDays).toBe(5); // preserved, not zeroed
      expect(result.change.daysDelta).toBe(-5);
    });

    it('clears dependsOn of dependent requirements', () => {
      const reqs = [
        makeReq({ id: 'r1', currentDays: 3 }),
        makeReq({ id: 'r2', currentDays: 2, dependsOn: 'r1' }),
      ];
      const input = makeInput({
        type: 'cancel_requirement',
        targetRequirementId: 'r1',
      });
      const result = processChange(input, reqs);
      expect(result.updatedRequirements.find((r) => r.id === 'r2')!.dependsOn).toBeNull();
    });

    it('skips if already cancelled', () => {
      const reqs = [makeReq({ id: 'r1', currentDays: 5, status: 'cancelled' })];
      const input = makeInput({
        type: 'cancel_requirement',
        targetRequirementId: 'r1',
      });
      const result = processChange(input, reqs);
      expect(result.change.daysDelta).toBe(0); // default, no recalculation
    });
  });

  describe('supplement', () => {
    it('adds days to active requirement', () => {
      const reqs = [makeReq({ id: 'r1', currentDays: 3 })];
      const input = makeInput({
        type: 'supplement',
        targetRequirementId: 'r1',
        daysDelta: 2,
        metadata: { subType: 'feature_addition' },
      });
      const result = processChange(input, reqs);
      expect(result.updatedRequirements[0].currentDays).toBe(5);
    });

    it('zero-day supplement does not mutate', () => {
      const reqs = [makeReq({ id: 'r1', currentDays: 3 })];
      const input = makeInput({
        type: 'supplement',
        targetRequirementId: 'r1',
        daysDelta: 0,
        metadata: { subType: 'detail_refinement' },
      });
      const result = processChange(input, reqs);
      expect(result.updatedRequirements[0].currentDays).toBe(3);
    });

    it('applies to cancelled requirement', () => {
      const reqs = [makeReq({ id: 'r1', currentDays: 3, status: 'cancelled' })];
      const input = makeInput({
        type: 'supplement',
        targetRequirementId: 'r1',
        daysDelta: 2,
        metadata: { subType: 'condition_change' },
      });
      const result = processChange(input, reqs);
      expect(result.updatedRequirements[0].currentDays).toBe(5);
    });

    it('applies to paused requirement and syncs pausedRemainingDays', () => {
      const reqs = [makeReq({ id: 'r1', currentDays: 5, status: 'paused', pausedRemainingDays: 3 })];
      const input = makeInput({
        type: 'supplement',
        targetRequirementId: 'r1',
        daysDelta: 2,
        metadata: { subType: 'feature_addition' },
      });
      const result = processChange(input, reqs);
      const r = result.updatedRequirements[0];
      expect(r.currentDays).toBe(7);
      expect(r.pausedRemainingDays).toBe(5); // 3 + 2
    });

    it('preserves subType in change metadata', () => {
      const reqs = [makeReq({ id: 'r1' })];
      const input = makeInput({
        type: 'supplement',
        targetRequirementId: 'r1',
        daysDelta: 1,
        metadata: { subType: 'condition_change' },
      });
      const result = processChange(input, reqs);
      expect(result.change.metadata?.subType).toBe('condition_change');
    });
  });

  describe('pause', () => {
    it('pauses active requirement with custom remainingDays', () => {
      const reqs = [makeReq({ id: 'r1', currentDays: 5 })];
      const input = makeInput({
        type: 'pause',
        targetRequirementId: 'r1',
        metadata: { remainingDays: 3 },
      });
      const result = processChange(input, reqs);
      const r = result.updatedRequirements[0];
      expect(r.status).toBe('paused');
      expect(r.pausedRemainingDays).toBe(3);
      expect(result.change.daysDelta).toBe(0);
    });

    it('defaults pausedRemainingDays to currentDays when not specified', () => {
      const reqs = [makeReq({ id: 'r1', currentDays: 5 })];
      const input = makeInput({
        type: 'pause',
        targetRequirementId: 'r1',
      });
      const result = processChange(input, reqs);
      expect(result.updatedRequirements[0].pausedRemainingDays).toBe(5);
    });

    it('clamps remainingDays to [0.5, currentDays]', () => {
      const reqs = [makeReq({ id: 'r1', currentDays: 3 })];
      const input = makeInput({
        type: 'pause',
        targetRequirementId: 'r1',
        metadata: { remainingDays: 10 },
      });
      const result = processChange(input, reqs);
      expect(result.updatedRequirements[0].pausedRemainingDays).toBe(3); // clamped to currentDays
    });

    it('skips non-active requirement', () => {
      const reqs = [makeReq({ id: 'r1', currentDays: 5, status: 'cancelled' })];
      const input = makeInput({
        type: 'pause',
        targetRequirementId: 'r1',
      });
      const result = processChange(input, reqs);
      expect(result.updatedRequirements[0].status).toBe('cancelled'); // unchanged
    });
  });

  describe('resume', () => {
    it('resumes paused requirement, sets currentDays to pausedRemainingDays', () => {
      const reqs = [makeReq({ id: 'r1', currentDays: 5, status: 'paused', pausedRemainingDays: 3 })];
      const input = makeInput({
        type: 'resume',
        targetRequirementId: 'r1',
      });
      const result = processChange(input, reqs);
      const r = result.updatedRequirements[0];
      expect(r.status).toBe('active');
      expect(r.currentDays).toBe(3); // was pausedRemainingDays
      expect(r.pausedRemainingDays).toBeNull();
    });

    it('skips non-paused requirement', () => {
      const reqs = [makeReq({ id: 'r1', currentDays: 5, status: 'active' })];
      const input = makeInput({
        type: 'resume',
        targetRequirementId: 'r1',
      });
      const result = processChange(input, reqs);
      expect(result.updatedRequirements[0].status).toBe('active'); // unchanged
      expect(result.updatedRequirements[0].currentDays).toBe(5); // unchanged
    });
  });

  describe('reprioritize', () => {
    it('reorders sortOrder', () => {
      const reqs = [
        makeReq({ id: 'r1', sortOrder: 0 }),
        makeReq({ id: 'r2', sortOrder: 1 }),
        makeReq({ id: 'r3', sortOrder: 2 }),
      ];
      const input = makeInput({
        type: 'reprioritize',
        metadata: { fromPosition: 0, toPosition: 2 },
      });
      const result = processChange(input, reqs);
      const sorted = result.updatedRequirements.sort((a, b) => a.sortOrder - b.sortOrder);
      expect(sorted[0].id).toBe('r2');
      expect(sorted[1].id).toBe('r3');
      expect(sorted[2].id).toBe('r1');
      expect(result.change.daysDelta).toBe(0);
    });
  });

  describe('screenshots propagation', () => {
    it('stores screenshots on created change', () => {
      const reqs = [makeReq({ id: 'r1', currentDays: 3 })];
      const input = makeInput({
        type: 'add_days',
        targetRequirementId: 'r1',
        daysDelta: 1,
        screenshots: ['data:image/jpeg;base64,/9j/4AAQ'],
      });
      const result = processChange(input, reqs);
      expect(result.change.screenshots).toEqual(['data:image/jpeg;base64,/9j/4AAQ']);
    });

    it('defaults to empty array when no screenshots provided', () => {
      const reqs = [makeReq({ id: 'r1', currentDays: 3 })];
      const input = makeInput({
        type: 'add_days',
        targetRequirementId: 'r1',
        daysDelta: 1,
      });
      const result = processChange(input, reqs);
      expect(result.change.screenshots).toEqual([]);
    });
  });
});

describe('applyChangeForReplay', () => {
  function makeChange(overrides: Partial<Change>): Change {
    return {
      id: 'c1',
      projectId: 'p1',
      type: 'add_days',
      targetRequirementId: 'r1',
      role: 'pm',
      personName: null,
      description: 'test',
      daysDelta: 2,
      date: '2026-01-01',
      metadata: null,
      screenshots: [],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      ...overrides,
    };
  }

  it('add_days applies to requirement during replay', () => {
    const reqs = [makeReq({ id: 'r1', currentDays: 3 })];
    const change = makeChange({ type: 'add_days', daysDelta: 2 });
    applyChangeForReplay(change, reqs);
    expect(reqs[0].currentDays).toBe(5);
  });

  it('add_days during replay syncs pausedRemainingDays for paused requirement', () => {
    const reqs = [makeReq({ id: 'r1', currentDays: 5, status: 'paused', pausedRemainingDays: 3 })];
    const change = makeChange({ type: 'add_days', daysDelta: 1.5 });
    applyChangeForReplay(change, reqs);
    expect(reqs[0].currentDays).toBe(6.5);
    expect(reqs[0].pausedRemainingDays).toBe(4.5);
  });

  it('add_days during replay clamps pausedRemainingDays when currentDays hits minimum', () => {
    const reqs = [makeReq({ id: 'r1', currentDays: 1, status: 'paused', pausedRemainingDays: 0.5 })];
    const change = makeChange({ type: 'add_days', daysDelta: -5 });
    applyChangeForReplay(change, reqs);
    expect(reqs[0].currentDays).toBe(0.5);
    expect(reqs[0].pausedRemainingDays).toBe(0.5);
  });

  it('new_requirement recreates requirement with original ID', () => {
    const reqs: Requirement[] = [];
    const change = makeChange({
      type: 'new_requirement',
      targetRequirementId: 'new-r1',
      daysDelta: 3,
      metadata: { newRequirementName: 'Replayed Req' },
    });
    const result = applyChangeForReplay(change, reqs);
    expect(result.newRequirement).toBeDefined();
    expect(result.newRequirement!.id).toBe('new-r1');
    expect(result.newRequirement!.name).toBe('Replayed Req');
    expect(reqs).toHaveLength(1);
  });

  it('cancel_requirement recalculates daysDelta based on replay state', () => {
    const reqs = [makeReq({ id: 'r1', currentDays: 7 })]; // currentDays = 7 at this point in replay
    const change = makeChange({
      type: 'cancel_requirement',
      targetRequirementId: 'r1',
      daysDelta: -3, // original delta was -3
    });
    const result = applyChangeForReplay(change, reqs);
    expect(result.daysDelta).toBe(-7); // recalculated from current state
    expect(reqs[0].status).toBe('cancelled');
  });

  it('supplement applies to paused requirement and syncs pausedRemainingDays', () => {
    const reqs = [makeReq({ id: 'r1', currentDays: 5, status: 'paused', pausedRemainingDays: 3 })];
    const change = makeChange({
      type: 'supplement',
      targetRequirementId: 'r1',
      daysDelta: 1.5,
    });
    applyChangeForReplay(change, reqs);
    expect(reqs[0].currentDays).toBe(6.5);
    expect(reqs[0].pausedRemainingDays).toBe(4.5);
  });

  it('pause sets pausedRemainingDays from metadata', () => {
    const reqs = [makeReq({ id: 'r1', currentDays: 5 })];
    const change = makeChange({
      type: 'pause',
      targetRequirementId: 'r1',
      daysDelta: 0,
      metadata: { remainingDays: 2.5 },
    });
    applyChangeForReplay(change, reqs);
    expect(reqs[0].status).toBe('paused');
    expect(reqs[0].pausedRemainingDays).toBe(2.5);
  });

  it('resume restores currentDays from pausedRemainingDays', () => {
    const reqs = [makeReq({ id: 'r1', currentDays: 5, status: 'paused', pausedRemainingDays: 2 })];
    const change = makeChange({
      type: 'resume',
      targetRequirementId: 'r1',
      daysDelta: 0,
    });
    applyChangeForReplay(change, reqs);
    expect(reqs[0].status).toBe('active');
    expect(reqs[0].currentDays).toBe(2);
    expect(reqs[0].pausedRemainingDays).toBeNull();
  });

  it('skips when target not found (dangling ref)', () => {
    const reqs = [makeReq({ id: 'r1', currentDays: 3 })];
    const change = makeChange({
      type: 'add_days',
      targetRequirementId: 'nonexistent',
      daysDelta: 5,
    });
    const result = applyChangeForReplay(change, reqs);
    expect(result.daysDelta).toBe(5); // preserved
    expect(reqs[0].currentDays).toBe(3); // unchanged
  });
});
