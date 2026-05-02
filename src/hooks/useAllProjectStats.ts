import { useEffect, useState } from 'react';
import * as requirementRepo from '../db/requirementRepo';
import { schedule, computeOriginalTotalDays } from '../engine/scheduler';
import { onDataChange } from '../db/changeNotifier';
import type { Project } from '../types';

interface ProjectInflation {
  inflationRate: number | null;
  totalDays: number;
  originalTotalDays: number;
}

/**
 * Computes inflation stats for every project in the input list. Used by the
 * sidebar so each project pill shows a green/yellow/red chip — cross-project
 * "which projects are blowing up" at a glance.
 *
 * Implementation note: each project's requirements come from IDB in parallel;
 * the heavy work (schedule()) is pure CPU. Re-runs on `onDataChange` so the
 * sidebar stays live as the user edits.
 */
export function useAllProjectStats(projects: Project[]): Map<string, ProjectInflation> {
  const [stats, setStats] = useState<Map<string, ProjectInflation>>(new Map);

  useEffect(() => {
    let cancelled = false;
    async function compute() {
      const out = new Map<string, ProjectInflation>();
      // Sequential — usually <10 projects, IDB calls are cheap.
      for (const p of projects) {
        const reqs = await requirementRepo.getRequirementsByProject(p.id);
        const sched = schedule(reqs);
        const originalTotalDays = computeOriginalTotalDays(reqs);
        const delay = sched.totalDays - originalTotalDays;
        out.set(p.id, {
          totalDays: sched.totalDays,
          originalTotalDays,
          inflationRate:
            originalTotalDays > 0 ? Math.round((delay / originalTotalDays) * 100) : null,
        });
      }
      if (!cancelled) setStats(out);
    }
    void compute();
    const off = onDataChange(() => void compute());
    return () => {
      cancelled = true;
      off();
    };
  }, [projects]);

  return stats;
}
