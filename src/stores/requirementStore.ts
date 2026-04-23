import { create } from 'zustand';
import type { Requirement, CreateRequirementInput } from '../types';
import * as requirementRepo from '../db/requirementRepo';
import { wouldCycle } from '../engine/scheduler';
import { replayChanges } from '../engine/replayEngine';
import * as changeRepo from '../db/changeRepo';
import * as snapshotRepo from '../db/snapshotRepo';
import { now } from '../utils/date';

const MAX_REQUIREMENTS = 50;

interface RequirementStore {
  requirements: Requirement[];
  loading: boolean;
  error: string | null;
  loadRequirements: (projectId: string) => Promise<void>;
  addRequirement: (input: CreateRequirementInput) => Promise<Requirement | null>;
  updateRequirement: (id: string, data: Partial<Requirement>, projectId: string) => Promise<void>;
  deleteRequirement: (id: string, projectId: string) => Promise<void>;
  reorderRequirements: (orderedIds: string[]) => Promise<void>;
  setRequirements: (reqs: Requirement[]) => void;
}

export const useRequirementStore = create<RequirementStore>((set, get) => ({
  requirements: [],
  loading: false,
  error: null,

  loadRequirements: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const reqs = await requirementRepo.getRequirementsByProject(projectId);
      set({ requirements: reqs, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  addRequirement: async (input) => {
    const currentReqs = get().requirements;
    if (currentReqs.length >= MAX_REQUIREMENTS) {
      set({ error: `已达需求上限(${MAX_REQUIREMENTS})` });
      return null;
    }

    // Cycle check
    if (input.dependsOn && wouldCycle(currentReqs, '', input.dependsOn)) {
      set({ error: '不能设置循环依赖' });
      return null;
    }

    const req = await requirementRepo.createRequirement(input);
    set({ requirements: [...currentReqs, req] });
    return req;
  },

  updateRequirement: async (id, data, projectId) => {
    const reqs = get().requirements;
    const existing = reqs.find((r) => r.id === id);
    if (!existing) return;

    // Cycle check for dependency changes
    if (data.dependsOn !== undefined && data.dependsOn !== existing.dependsOn) {
      if (data.dependsOn && wouldCycle(reqs, id, data.dependsOn)) {
        set({ error: '不能设置循环依赖（A→B→...→A）' });
        return;
      }
    }

    const originalDaysChanged = data.originalDays !== undefined && data.originalDays !== existing.originalDays;

    // Update the requirement in DB
    await requirementRepo.updateRequirement(id, data);

    if (originalDaysChanged) {
      // Check if this requirement has any changes targeting it
      const changes = await changeRepo.getChangesByProject(projectId);
      const hasChanges = changes.some((c) => c.targetRequirementId === id);

      if (hasChanges) {
        // Full replay needed
        const allReqs = reqs.map((r) =>
          r.id === id ? { ...r, ...data, updatedAt: now() } : r,
        );
        const result = replayChanges(allReqs, changes, projectId);

        // Persist replay results
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
        set({ requirements: result.requirements });
        return;
      } else {
        // No changes — sync currentDays = originalDays
        const syncData = { ...data, currentDays: data.originalDays! };
        await requirementRepo.updateRequirement(id, syncData);
        set({
          requirements: reqs.map((r) =>
            r.id === id ? { ...r, ...syncData, updatedAt: now() } : r,
          ),
        });
        return;
      }
    }

    // Simple update (name, dependsOn, etc.)
    set({
      requirements: reqs.map((r) =>
        r.id === id ? { ...r, ...data, updatedAt: now() } : r,
      ),
    });
  },

  deleteRequirement: async (id, projectId) => {
    const reqs = get().requirements;
    const target = reqs.find((r) => r.id === id);
    if (!target) return;

    // Hard delete the requirement
    await requirementRepo.deleteRequirement(id);

    // Clear dependsOn references pointing to this requirement
    const updated = reqs
      .filter((r) => r.id !== id)
      .map((r) => {
        if (r.dependsOn === id) {
          const cleared = { ...r, dependsOn: null, updatedAt: now() };
          requirementRepo.updateRequirement(r.id, { dependsOn: null });
          return cleared;
        }
        return r;
      });

    // Write metadata.deletedRequirementName to related changes
    const changes = await changeRepo.getChangesByProject(projectId);
    for (const c of changes) {
      if (c.targetRequirementId === id) {
        await changeRepo.putChange({
          ...c,
          metadata: { ...c.metadata, deletedRequirementName: target.name },
          updatedAt: now(),
        });
      }
    }

    set({ requirements: updated });
  },

  reorderRequirements: async (orderedIds) => {
    const reqs = get().requirements;
    const reordered = reqs.map((r) => {
      const idx = orderedIds.indexOf(r.id);
      return idx >= 0 ? { ...r, sortOrder: idx, updatedAt: now() } : r;
    });

    for (const r of reordered) {
      await requirementRepo.putRequirement(r);
    }
    set({ requirements: reordered });
  },

  setRequirements: (reqs) => set({ requirements: reqs }),
}));
