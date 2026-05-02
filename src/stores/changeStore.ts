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
  /** W2.6 — re-apply a deleted change. Mirrors deleteChange in reverse:
   *  putChange + full replay. Re-creates an isAddedByChange requirement if
   *  the restored change is a new_requirement. */
  restoreChange: (
    change: Change,
    projectId: string,
    allRequirements: Requirement[],
  ) => Promise<{ requirements: Requirement[] } | null>;
}

// Fields that trigger a full replay when changed
const REPLAY_FIELDS = ['type', 'targetRequirementId', 'daysDelta', 'date', 'metadata'] as const;

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

    // Create snapshot
    const snapshot = createSnapshot(
      input.projectId,
      result.change.id,
      result.updatedRequirements,
    );

    // Persist requirements, snapshot, and person name in parallel
    await Promise.all([
      ...result.updatedRequirements.map((r) => requirementRepo.putRequirement(r)),
      snapshotRepo.putSnapshot(snapshot),
      ...(input.personName ? [upsertPersonName(input.personName, input.role)] : []),
    ]);

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

      // Persist: clear old snapshots first, then write all in parallel
      await snapshotRepo.deleteSnapshotsByProject(projectId);
      await Promise.all([
        ...result.snapshots.map((snap) => snapshotRepo.putSnapshot(snap)),
        ...result.changes.map((c) => changeRepo.putChange(c)),
        ...result.requirements.map((r) => requirementRepo.putRequirement(r)),
      ]);

      set({ changes: result.changes });
      return { requirements: result.requirements };
    }

    // Simple update (description, role, personName only)
    await Promise.all([
      changeRepo.putChange(updatedChange),
      ...(data.personName ? [upsertPersonName(data.personName, data.role ?? existing.role)] : []),
    ]);

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

      await Promise.all(resetReqs.map((r) => requirementRepo.putRequirement(r)));

      set({ changes: [] });
      return { requirements: resetReqs };
    }

    const result = replayChanges(reqs, remainingChanges, projectId);

    // Persist: clear old snapshots first, then write all in parallel
    await snapshotRepo.deleteSnapshotsByProject(projectId);
    await Promise.all([
      ...result.snapshots.map((snap) => snapshotRepo.putSnapshot(snap)),
      ...result.changes.map((c) => changeRepo.putChange(c)),
      ...result.requirements.map((r) => requirementRepo.putRequirement(r)),
    ]);

    set({ changes: result.changes });
    return { requirements: result.requirements };
  },

  /**
   * Re-insert a previously deleted change into IDB and full-replay. The
   * caller (Cmd+Z handler) holds the original Change object; here we
   * re-create the cascade-deleted requirement (only for new_requirement)
   * and re-run the engine so all downstream state stays consistent.
   */
  restoreChange: async (change, projectId, allRequirements) => {
    let reqs = allRequirements;
    if (change.type === 'new_requirement' && change.targetRequirementId) {
      // The deletion cascade-removed this requirement. Re-create it so the
      // replay engine can find it as a target. originalDays mirrors the
      // change's daysDelta (the requirement's worth-in-days).
      const restoredReq: Requirement = {
        id: change.targetRequirementId,
        projectId,
        name:
          (change.metadata?.newRequirementName as string | undefined) ??
          '已恢复需求',
        originalDays: change.daysDelta,
        currentDays: change.daysDelta,
        isAddedByChange: true,
        status: 'active',
        sortOrder: reqs.length,
        dependsOn: null,
        pausedRemainingDays: null,
        createdAt: change.createdAt,
        updatedAt: now(),
      };
      await requirementRepo.putRequirement(restoredReq);
      reqs = [...reqs, restoredReq];
    }

    await changeRepo.putChange(change);
    const allChanges = [...get().changes, change];
    const result = replayChanges(reqs, allChanges, projectId);

    await snapshotRepo.deleteSnapshotsByProject(projectId);
    await Promise.all([
      ...result.snapshots.map((s) => snapshotRepo.putSnapshot(s)),
      ...result.changes.map((c) => changeRepo.putChange(c)),
      ...result.requirements.map((r) => requirementRepo.putRequirement(r)),
    ]);

    set({ changes: result.changes });
    return { requirements: result.requirements };
  },
}));
