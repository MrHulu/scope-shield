import type {
  Requirement,
  Change,
  CreateChangeInput,
  ChangeMetadata,
} from '../types';
import { generateId } from '../utils/id';
import { now } from '../utils/date';

export interface ProcessResult {
  updatedRequirements: Requirement[];
  newRequirement?: Requirement;
  change: Change;
}

/**
 * Apply a single change to the requirement set. Pure function.
 *
 * Caller must persist the results to DB and create a snapshot.
 */
export function processChange(
  input: CreateChangeInput,
  requirements: Requirement[],
): ProcessResult {
  const reqs = requirements.map((r) => ({ ...r })); // shallow clone
  const timestamp = now();

  let daysDelta = input.daysDelta ?? 0;
  let targetRequirementId = input.targetRequirementId ?? null;
  let metadata: ChangeMetadata | null = input.metadata ?? null;
  let newRequirement: Requirement | undefined;

  switch (input.type) {
    case 'add_days': {
      const target = reqs.find((r) => r.id === targetRequirementId);
      if (!target || target.status === 'cancelled') break;
      target.currentDays += daysDelta;
      if (target.currentDays < 0.5) target.currentDays = 0.5;
      if (target.status === 'paused' && target.pausedRemainingDays != null) {
        target.pausedRemainingDays = Math.max(
          0.5,
          Math.min(target.pausedRemainingDays + daysDelta, target.currentDays),
        );
      }
      target.updatedAt = timestamp;
      break;
    }

    case 'new_requirement': {
      const reqName = input.newRequirementName ?? metadata?.newRequirementName ?? 'New Requirement';
      const reqDays = input.newRequirementDays ?? daysDelta;
      const maxSort = reqs.reduce((max, r) => Math.max(max, r.sortOrder), -1);
      const reqId = generateId();

      newRequirement = {
        id: reqId,
        projectId: input.projectId,
        name: reqName,
        originalDays: reqDays,
        currentDays: reqDays,
        isAddedByChange: true,
        status: 'active',
        sortOrder: maxSort + 1,
        dependsOn: null,
        pausedRemainingDays: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      reqs.push(newRequirement);

      targetRequirementId = reqId;
      daysDelta = reqDays;
      metadata = { ...metadata, newRequirementName: reqName };
      break;
    }

    case 'cancel_requirement': {
      const target = reqs.find((r) => r.id === targetRequirementId);
      if (!target || target.status !== 'active') break;

      // Cancel policy: currentDays PRESERVED (not zeroed), daysDelta = -currentDays
      daysDelta = -target.currentDays;
      metadata = {
        ...metadata,
        cancelledRequirementName: target.name,
        cancelledDays: target.currentDays,
      };
      target.status = 'cancelled';
      target.updatedAt = timestamp;

      // Clear dependsOn of requirements that depend on this one
      for (const r of reqs) {
        if (r.dependsOn === target.id) {
          r.dependsOn = null;
          r.updatedAt = timestamp;
        }
      }
      break;
    }

    case 'supplement': {
      // Supplement applies to ALL statuses (active/paused/cancelled)
      const target = reqs.find((r) => r.id === targetRequirementId);
      if (!target) break;

      if (daysDelta > 0) {
        target.currentDays += daysDelta;
        // If target is paused, also update pausedRemainingDays to stay in sync
        if (target.status === 'paused' && target.pausedRemainingDays != null) {
          target.pausedRemainingDays += daysDelta;
        }
        target.updatedAt = timestamp;
      }
      // daysDelta=0: record the fact only, no mutation

      // Cascade auto-inherit: update dependents' schedule via metadata
      if (daysDelta > 0) {
        const cascadeTargets: string[] = [];
        for (const r of reqs) {
          if (r.dependsOn === target.id && r.status === 'active') {
            cascadeTargets.push(r.id);
          }
        }
        if (cascadeTargets.length > 0) {
          metadata = { ...metadata, cascadeTargets };
        }
      }

      metadata = { ...metadata, subType: input.metadata?.subType };
      break;
    }

    case 'reprioritize': {
      const fromPos = metadata?.fromPosition;
      const toPos = metadata?.toPosition;
      if (fromPos != null && toPos != null) {
        // Reorder sortOrder: move item from fromPos to toPos
        const sorted = [...reqs].sort((a, b) => a.sortOrder - b.sortOrder);
        const item = sorted.find((r) => r.sortOrder === fromPos);
        if (item) {
          // Remove and re-insert
          const filtered = sorted.filter((r) => r.id !== item.id);
          filtered.splice(toPos, 0, item);
          filtered.forEach((r, i) => {
            r.sortOrder = i;
            r.updatedAt = timestamp;
          });
          // Apply back to reqs
          for (const r of reqs) {
            const updated = filtered.find((f) => f.id === r.id);
            if (updated) {
              r.sortOrder = updated.sortOrder;
              r.updatedAt = updated.updatedAt;
            }
          }
        }
      }
      daysDelta = 0;
      break;
    }

    case 'pause': {
      const target = reqs.find((r) => r.id === targetRequirementId);
      if (!target || target.status !== 'active') break;

      const userRemaining = metadata?.remainingDays ?? target.currentDays;
      // Clamp: max(0.5, min(userRemaining, currentDays))
      target.pausedRemainingDays = Math.max(0.5, Math.min(userRemaining, target.currentDays));
      target.status = 'paused';
      target.updatedAt = timestamp;

      metadata = { ...metadata, remainingDays: target.pausedRemainingDays };
      daysDelta = 0;

      // Lift dependencies: requirements depending on paused requirement
      // (scheduler handles this at schedule time, no mutation needed here)
      break;
    }

    case 'resume': {
      const target = reqs.find((r) => r.id === targetRequirementId);
      if (!target || target.status !== 'paused') break;

      target.status = 'active';
      target.currentDays = target.pausedRemainingDays ?? target.currentDays;
      target.pausedRemainingDays = null;
      target.updatedAt = timestamp;
      daysDelta = 0;
      break;
    }
  }

  const change: Change = {
    id: generateId(),
    projectId: input.projectId,
    type: input.type,
    targetRequirementId,
    role: input.role,
    personName: input.personName ?? null,
    description: input.description,
    daysDelta,
    date: input.date,
    metadata,
    screenshots: input.screenshots ?? [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return { updatedRequirements: reqs, newRequirement, change };
}

/**
 * Apply a change during replay (requirements mutated in place).
 * Returns the recalculated daysDelta for the change.
 */
export function applyChangeForReplay(
  change: Change,
  reqs: Requirement[],
): { daysDelta: number; newRequirement?: Requirement } {
  const timestamp = now();
  let daysDelta = change.daysDelta;
  let newRequirement: Requirement | undefined;

  // Find target; if target doesn't exist (dangling ref), skip
  const target = change.targetRequirementId
    ? reqs.find((r) => r.id === change.targetRequirementId)
    : null;

  switch (change.type) {
    case 'add_days': {
      if (!target || target.status === 'cancelled') {
        daysDelta = change.daysDelta; // preserve original delta even if skipped
        break;
      }
      target.currentDays += change.daysDelta;
      if (target.currentDays < 0.5) target.currentDays = 0.5;
      if (target.status === 'paused' && target.pausedRemainingDays != null) {
        target.pausedRemainingDays = Math.max(
          0.5,
          Math.min(target.pausedRemainingDays + change.daysDelta, target.currentDays),
        );
      }
      target.updatedAt = timestamp;
      break;
    }

    case 'new_requirement': {
      const reqName = change.metadata?.newRequirementName ?? 'New Requirement';
      const reqDays = Math.abs(change.daysDelta) || 0.5;

      newRequirement = {
        id: change.targetRequirementId!, // reuse original ID
        projectId: change.projectId,
        name: reqName,
        originalDays: reqDays,
        currentDays: reqDays,
        isAddedByChange: true,
        status: 'active',
        sortOrder: reqs.reduce((max, r) => Math.max(max, r.sortOrder), -1) + 1,
        dependsOn: null,
        pausedRemainingDays: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      reqs.push(newRequirement);
      daysDelta = reqDays;
      break;
    }

    case 'cancel_requirement': {
      if (!target || target.status !== 'active') {
        daysDelta = change.daysDelta;
        break;
      }
      // daysDelta recalculated based on current state at this point in replay
      daysDelta = -target.currentDays;
      target.status = 'cancelled';
      target.updatedAt = timestamp;

      for (const r of reqs) {
        if (r.dependsOn === target.id) {
          r.dependsOn = null;
          r.updatedAt = timestamp;
        }
      }
      break;
    }

    case 'supplement': {
      // Supplement not restricted by status — applies to active/paused/cancelled
      if (!target) {
        daysDelta = change.daysDelta;
        break;
      }
      if (change.daysDelta > 0) {
        target.currentDays += change.daysDelta;
        // Sync pausedRemainingDays if target is paused
        if (target.status === 'paused' && target.pausedRemainingDays != null) {
          target.pausedRemainingDays += change.daysDelta;
        }
        target.updatedAt = timestamp;
      }
      daysDelta = change.daysDelta;
      break;
    }

    case 'reprioritize': {
      const fromPos = change.metadata?.fromPosition;
      const toPos = change.metadata?.toPosition;
      if (fromPos != null && toPos != null) {
        const sorted = [...reqs].sort((a, b) => a.sortOrder - b.sortOrder);
        const item = sorted.find((r) => r.sortOrder === fromPos);
        if (item) {
          const filtered = sorted.filter((r) => r.id !== item.id);
          filtered.splice(toPos, 0, item);
          filtered.forEach((r, i) => {
            r.sortOrder = i;
            r.updatedAt = timestamp;
          });
          for (const r of reqs) {
            const updated = filtered.find((f) => f.id === r.id);
            if (updated) {
              r.sortOrder = updated.sortOrder;
              r.updatedAt = updated.updatedAt;
            }
          }
        }
      }
      daysDelta = 0;
      break;
    }

    case 'pause': {
      if (!target || target.status !== 'active') {
        daysDelta = 0;
        break;
      }
      const userRemaining = change.metadata?.remainingDays ?? target.currentDays;
      target.pausedRemainingDays = Math.max(0.5, Math.min(userRemaining, target.currentDays));
      target.status = 'paused';
      target.updatedAt = timestamp;
      daysDelta = 0;
      break;
    }

    case 'resume': {
      if (!target || target.status !== 'paused') {
        daysDelta = 0;
        break;
      }
      target.status = 'active';
      target.currentDays = target.pausedRemainingDays ?? target.currentDays;
      target.pausedRemainingDays = null;
      target.updatedAt = timestamp;
      daysDelta = 0;
      break;
    }
  }

  return { daysDelta, newRequirement };
}
