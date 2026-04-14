import type { Requirement, RequirementSchedule, ScheduleResult } from '../types';

export class CyclicDependencyError extends Error {
  constructor(message = 'Cyclic dependency detected') {
    super(message);
    this.name = 'CyclicDependencyError';
  }
}

/**
 * Longest-path scheduler using Kahn's topological sort.
 * Half-open intervals: [startDay, endDay) where endDay = startDay + currentDays.
 *
 * Dependency edge cases (per data-model.md):
 * - A paused → B depends on A: B's dependency temporarily lifted (startDay=0)
 * - A cancelled → B depends on A: B.dependsOn should already be null (caller handles)
 */
export function schedule(requirements: Requirement[]): ScheduleResult {
  // Only schedule active requirements
  const active = requirements.filter((r) => r.status === 'active');

  if (active.length === 0) {
    return { totalDays: 0, originalTotalDays: 0, requirementSchedules: [], criticalPath: [] };
  }

  const byId = new Map<string, Requirement>(active.map((r) => [r.id, r]));

  // Resolve effective dependency: skip if target is paused or not in active set
  function getEffectiveDep(req: Requirement): string | null {
    if (!req.dependsOn) return null;
    const dep = byId.get(req.dependsOn);
    if (!dep) return null; // target not active (deleted/cancelled)
    // Paused dependency → treat as no dependency
    const fullReq = requirements.find((r) => r.id === req.dependsOn);
    if (fullReq && fullReq.status === 'paused') return null;
    return dep.id;
  }

  // Build adjacency and in-degree for topo sort
  const children = new Map<string, string[]>(); // parent → [children]
  const inDegree = new Map<string, number>();

  for (const r of active) {
    children.set(r.id, []);
    inDegree.set(r.id, 0);
  }

  for (const r of active) {
    const dep = getEffectiveDep(r);
    if (dep) {
      children.get(dep)!.push(r.id);
      inDegree.set(r.id, (inDegree.get(r.id) || 0) + 1);
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const r of active) {
    if (inDegree.get(r.id) === 0) queue.push(r.id);
  }

  const topoOrder: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    topoOrder.push(id);
    for (const child of children.get(id) || []) {
      const deg = inDegree.get(child)! - 1;
      inDegree.set(child, deg);
      if (deg === 0) queue.push(child);
    }
  }

  if (topoOrder.length !== active.length) {
    throw new CyclicDependencyError();
  }

  // Forward pass: compute startDay/endDay
  const startDay = new Map<string, number>();
  const endDay = new Map<string, number>();

  for (const id of topoOrder) {
    const req = byId.get(id)!;
    const dep = getEffectiveDep(req);
    const sd = dep ? endDay.get(dep)! : 0;
    startDay.set(id, sd);
    endDay.set(id, sd + req.currentDays);
  }

  // Total days = max(endDay)
  let totalDays = 0;
  for (const ed of endDay.values()) {
    if (ed > totalDays) totalDays = ed;
  }

  // Build requirement schedules
  const requirementSchedules: RequirementSchedule[] = topoOrder.map((id) => ({
    requirementId: id,
    startDay: startDay.get(id)!,
    endDay: endDay.get(id)!,
  }));

  // Backward pass: find critical path (nodes where endDay == totalDays or feeds into one)
  const criticalPath = traceCriticalPath(topoOrder, byId, startDay, endDay, totalDays, getEffectiveDep);

  return { totalDays, originalTotalDays: 0, requirementSchedules, criticalPath };
}

/**
 * Compute originalTotalDays from baseline requirements.
 * Uses originalDays instead of currentDays, only for isAddedByChange=false requirements.
 */
export function computeOriginalTotalDays(requirements: Requirement[]): number {
  // Create virtual requirements with currentDays = originalDays, only baseline
  const baseline = requirements
    .filter((r) => !r.isAddedByChange)
    .map((r) => ({
      ...r,
      currentDays: r.originalDays,
      status: 'active' as const,
    }));

  if (baseline.length === 0) return 0;
  const result = schedule(baseline);
  return result.totalDays;
}

/**
 * Detect circular dependency if we were to set req.dependsOn = targetId.
 */
export function wouldCycle(
  requirements: Requirement[],
  reqId: string,
  targetId: string | null,
): boolean {
  if (!targetId) return false;
  if (reqId === targetId) return true;

  // Walk from targetId up the dependency chain; if we reach reqId, it's a cycle
  const byId = new Map(requirements.map((r) => [r.id, r]));
  let current = targetId;
  const visited = new Set<string>();

  while (current) {
    if (current === reqId) return true;
    if (visited.has(current)) return false; // already checked
    visited.add(current);
    const req = byId.get(current);
    current = req?.dependsOn ?? '';
    if (!current) break;
  }

  return false;
}

function traceCriticalPath(
  topoOrder: string[],
  byId: Map<string, Requirement>,
  startDay: Map<string, number>,
  endDay: Map<string, number>,
  totalDays: number,
  getEffectiveDep: (req: Requirement) => string | null,
): string[] {
  // Find all nodes on critical path (endDay contributes to totalDays)
  // Work backwards from nodes where endDay === totalDays
  const onCritical = new Set<string>();
  const reverseOrder = [...topoOrder].reverse();

  for (const id of reverseOrder) {
    if (endDay.get(id) === totalDays) {
      onCritical.add(id);
    }
    if (onCritical.has(id)) {
      const req = byId.get(id)!;
      const dep = getEffectiveDep(req);
      if (dep && endDay.get(dep) === startDay.get(id)) {
        onCritical.add(dep);
      }
    }
  }

  // Return in topo order
  return topoOrder.filter((id) => onCritical.has(id));
}
