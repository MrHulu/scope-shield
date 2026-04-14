import { create } from 'zustand';
import type { Change, CreateChangeInput, Requirement } from '../types';
import * as changeRepo from '../db/changeRepo';
import * as requirementRepo from '../db/requirementRepo';
import * as snapshotRepo from '../db/snapshotRepo';
import { processChange } from '../engine/changeProcessor';
import { createSnapshot } from '../engine/snapshotManager';
import { replayChanges } from '../engine/replayEngine';
import { upsertPersonName } from '../db/personNameRepo';
import { now } from '../utils/date';

const MAX_CHANGES = 200;

interface ChangeStore {
  changes: Change[];
  loading: boolean;
  error: string | null;
  loadChanges: (projectId: string) => Promise<void>;
  recordChange: (
    input: CreateChangeInput,
    requirements: Requirement[],
  ) => Promise<{ change: Change; updatedRequirements: Requirement[] } | null>;
  updateChange: (
    id: string,
    data: Partial<Change>,
    projectId: string,
    allRequirements: Requirement[],
  ) => Promise<{ requirements: Requirement[] } | null>;
  deleteChange: (
    id: string,
    projectId: string,
    allRequirements: Requirement[],
  ) => Promise<{ requirements: Requirement[] } | null>;
}

// Fields that trigger a full replay when changed
const REPLAY_FIELDS = ['type', 'targetRequirementId', 'daysDelta', 'date'] as const;

function needsReplay(data: Partial<Change>): boolean {
  return REPLAY_FIELDS.some((f) => f in data);
}

export const useChangeStore = create<ChangeStore>((set, get) => ({
  changes: [],
  loading: false,
  error: null,

  loadChanges: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const changes = await changeRepo.getChangesByProject(projectId);
      set({ changes, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  recordChange: async (input, requirements) => {
    if (get().changes.length >= MAX_CHANGES) {
      set({ error: `已达变更记录上限(${MAX_CHANGES})` });
      return null;
    }

    const result = processChange(input, requirements);

    // Persist change
    await changeRepo.putChange(result.change);

    // Persist updated requirements
    for (const r of result.updatedRequirements) {
      await requirementRepo.putRequirement(r);
    }

    // Create and persist snapshot
    const snapshot = createSnapshot(
      input.projectId,
      result.change.id,
      result.updatedRequirements,
    );
    await snapshotRepo.putSnapshot(snapshot);

    // Update person name cache
    if (input.personName) {
      await upsertPersonName(input.personName, input.role);
    }

    set({ changes: [...get().changes, result.change] });
    return { change: result.change, updatedRequirements: result.updatedRequirements };
  },

  updateChange: async (id, data, projectId, allRequirements) => {
    const changes = get().changes;
    const existing = changes.find((c) => c.id === id);
    if (!existing) return null;

    const updatedChange: Change = { ...existing, ...data, updatedAt: now() };

    if (needsReplay(data)) {
      // Full replay
      const updatedChanges = changes.map((c) => (c.id === id ? updatedChange : c));
      const result = replayChanges(allRequirements, updatedChanges, projectId);

      // Persist
      await snapshotRepo.deleteSnapshotsByProject(projectId);
      for (const snap of result.snapshots) {
        await snapshotRepo.putSnapshot(snap);
      }
      for (const c of result.changes) {
        await changeRepo.putChange(c);
      }
      for (const r of result.requirements) {
        await requirementRepo.putRequirement(r);
      }

      set({ changes: result.changes });
      return { requirements: result.requirements };
    }

    // Simple update (description, role, personName only)
    await changeRepo.putChange(updatedChange);

    if (data.personName && data.role) {
      await upsertPersonName(data.personName, data.role);
    }

    set({
      changes: changes.map((c) => (c.id === id ? updatedChange : c)),
    });
    return { requirements: allRequirements };
  },

  deleteChange: async (id, projectId, allRequirements) => {
    const changes = get().changes;
    const target = changes.find((c) => c.id === id);
    if (!target) return null;

    // If deleting a new_requirement change, cascade delete the associated requirement
    let reqs = allRequirements;
    if (target.type === 'new_requirement' && target.targetRequirementId) {
      await requirementRepo.deleteRequirement(target.targetRequirementId);
      reqs = reqs.filter((r) => r.id !== target.targetRequirementId);
    }

    // Delete the change
    await changeRepo.deleteChange(id);

    // Also delete the associated snapshot
    const snapshots = await snapshotRepo.getSnapshotsByProject(projectId);
    const snap = snapshots.find((s) => s.changeId === id);
    if (snap) {
      // We'll delete all snapshots anyway during replay
    }

    // Full replay with remaining changes
    const remainingChanges = changes.filter((c) => c.id !== id);

    if (remainingChanges.length === 0) {
      // No changes left — reset to baseline
      await snapshotRepo.deleteSnapshotsByProject(projectId);
      const resetReqs = reqs
        .filter((r) => !r.isAddedByChange)
        .map((r) => ({
          ...r,
          currentDays: r.originalDays,
          status: 'active' as const,
          pausedRemainingDays: null,
          updatedAt: now(),
        }));

      for (const r of resetReqs) {
        await requirementRepo.putRequirement(r);
      }

      set({ changes: [] });
      return { requirements: resetReqs };
    }

    const result = replayChanges(reqs, remainingChanges, projectId);

    // Persist
    await snapshotRepo.deleteSnapshotsByProject(projectId);
    for (const snap of result.snapshots) {
      await snapshotRepo.putSnapshot(snap);
    }
    for (const c of result.changes) {
      await changeRepo.putChange(c);
    }
    for (const r of result.requirements) {
      await requirementRepo.putRequirement(r);
    }

    set({ changes: result.changes });
    return { requirements: result.requirements };
  },
}));
