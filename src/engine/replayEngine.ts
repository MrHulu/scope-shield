import type { Requirement, Change, Snapshot, SnapshotData } from '../types';
import { applyChangeForReplay } from './changeProcessor';
import { schedule, computeOriginalTotalDays } from './scheduler';
import { generateId } from '../utils/id';
import { now } from '../utils/date';

export interface ReplayResult {
  requirements: Requirement[];
  changes: Change[];
  snapshots: Snapshot[];
  totalDays: number;
  originalTotalDays: number;
}

/**
 * Full snapshot replay.
 *
 * Algorithm (per data-model.md §变更重算策略):
 * 1. Reset baseline requirements (isAddedByChange=false): currentDays=originalDays,
 *    status=active, pausedRemainingDays=null. Preserve dependsOn and sortOrder.
 * 2. Remove all isAddedByChange=true requirements (new_requirement recreates them).
 * 3. Sort changes by date + createdAt ascending.
 * 4. Apply each change sequentially.
 * 5. Update change.daysDelta (cancel recalculated based on replay state).
 * 6. Compute schedule.
 * 7. Generate new snapshots (one per change).
 */
export function replayChanges(
  allRequirements: Requirement[],
  changes: Change[],
  projectId: string,
): ReplayResult {
  const timestamp = now();

  // Step 1: Reset baseline requirements
  const baseReqs = allRequirements
    .filter((r) => !r.isAddedByChange)
    .map((r) => ({
      ...r,
      currentDays: r.originalDays,
      status: 'active' as const,
      pausedRemainingDays: null,
      updatedAt: timestamp,
      // dependsOn and sortOrder preserved
    }));

  // Step 2: isAddedByChange=true requirements are dropped (not in baseReqs)

  // Step 3: Sort changes by date + createdAt
  const sortedChanges = [...changes].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.createdAt.localeCompare(b.createdAt);
  });

  // Working set of requirements (mutated during replay)
  const reqs: Requirement[] = baseReqs;
  const updatedChanges: Change[] = [];
  const snapshots: Snapshot[] = [];

  // Step 4-5: Apply each change and build snapshots
  for (const change of sortedChanges) {
    const { daysDelta } = applyChangeForReplay(change, reqs);

    // Update change's daysDelta if recalculated
    const updatedChange: Change = {
      ...change,
      daysDelta,
      updatedAt: timestamp,
    };
    if (change.type === 'cancel_requirement') {
      updatedChange.metadata = {
        ...change.metadata,
        cancelledDays: Math.abs(daysDelta),
      };
    }
    updatedChanges.push(updatedChange);

    // Step 7: Generate snapshot for this change
    const scheduleResult = schedule(reqs);
    const origTotal = computeOriginalTotalDays(reqs);

    const snapshotData: SnapshotData = {
      requirements: reqs.map((r) => ({
        id: r.id,
        name: r.name,
        originalDays: r.originalDays,
        currentDays: r.currentDays,
        status: r.status,
        isAddedByChange: r.isAddedByChange,
        dependsOn: r.dependsOn,
        sortOrder: r.sortOrder,
        pausedRemainingDays: r.pausedRemainingDays,
      })),
      schedule: {
        totalDays: scheduleResult.totalDays,
        originalTotalDays: origTotal,
        requirementSchedules: scheduleResult.requirementSchedules,
      },
    };

    snapshots.push({
      id: generateId(),
      projectId,
      changeId: updatedChange.id,
      data: snapshotData,
      totalDays: scheduleResult.totalDays,
      createdAt: timestamp,
    });
  }

  // Step 6: Final schedule
  const finalSchedule = schedule(reqs);
  const originalTotalDays = computeOriginalTotalDays(reqs);

  return {
    requirements: reqs,
    changes: updatedChanges,
    snapshots,
    totalDays: finalSchedule.totalDays,
    originalTotalDays,
  };
}
