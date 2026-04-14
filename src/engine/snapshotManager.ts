import type { Requirement, Change, Snapshot, SnapshotData } from '../types';
import { schedule, computeOriginalTotalDays } from './scheduler';
import { generateId } from '../utils/id';
import { now } from '../utils/date';

/**
 * Create a snapshot capturing the current state of requirements after a change.
 */
export function createSnapshot(
  projectId: string,
  changeId: string,
  requirements: Requirement[],
): Snapshot {
  const scheduleResult = schedule(requirements);
  const originalTotalDays = computeOriginalTotalDays(requirements);

  const data: SnapshotData = {
    requirements: requirements.map((r) => ({
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
      originalTotalDays,
      requirementSchedules: scheduleResult.requirementSchedules,
    },
  };

  return {
    id: generateId(),
    projectId,
    changeId,
    data,
    totalDays: scheduleResult.totalDays,
    createdAt: now(),
  };
}
