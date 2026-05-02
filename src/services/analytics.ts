import type { Project, Requirement, Change } from '../types';
import { schedule, computeOriginalTotalDays } from '../engine/scheduler';

export interface ProjectAnalytics {
  projectId: string;
  name: string;
  status: 'active' | 'archived';
  inflationRate: number | null;
  /** Days the project is past its targetEndDate (today - targetEndDate).
   * 0 if not overdue, null if no target set. */
  overdueBy: number | null;
  totalChanges: number;
  totalDaysAdded: number;
}

export interface AnalyticsSummary {
  projectCount: number;
  activeCount: number;
  archivedCount: number;
  /** Avg inflation across active projects that have at least one change.
   * null when no qualifying projects exist. */
  avgInflationRate: number | null;
  totalChanges: number;
  totalDaysAdded: number;
  perProject: ProjectAnalytics[];
  /** Top 5 tags by change count, sorted desc. */
  topTags: { tag: string; count: number }[];
  /** Top 3 projects past their targetEndDate, sorted by overdue days desc.
   * Excludes archived projects since "overdue" is meaningless for them. */
  topOverdue: ProjectAnalytics[];
}

interface PerProjectData {
  project: Project;
  requirements: Requirement[];
  changes: Change[];
}

export function computeAnalytics(perProject: PerProjectData[]): AnalyticsSummary {
  const today = new Date().toISOString().slice(0, 10);

  const stats: ProjectAnalytics[] = perProject.map(({ project, requirements, changes }) => {
    const sched = schedule(requirements);
    const originalTotalDays = computeOriginalTotalDays(requirements);
    const inflation = originalTotalDays > 0
      ? Math.round(((sched.totalDays - originalTotalDays) / originalTotalDays) * 100)
      : null;
    const overdueBy = project.targetEndDate
      ? Math.max(0, Math.floor((Date.parse(today) - Date.parse(project.targetEndDate)) / 86400000))
      : null;
    const totalDaysAdded = changes.reduce((sum, c) => sum + (c.daysDelta > 0 ? c.daysDelta : 0), 0);
    return {
      projectId: project.id,
      name: project.name,
      status: project.status,
      inflationRate: inflation,
      overdueBy,
      totalChanges: changes.length,
      totalDaysAdded,
    };
  });

  const active = stats.filter((s) => s.status === 'active');
  const inflationsToAvg = active
    .map((s) => s.inflationRate)
    .filter((v): v is number => v !== null);
  const avgInflationRate = inflationsToAvg.length > 0
    ? Math.round(inflationsToAvg.reduce((a, b) => a + b, 0) / inflationsToAvg.length)
    : null;

  // Tag aggregation across all projects' changes.
  const tagCounts = new Map<string, number>();
  for (const { changes } of perProject) {
    for (const c of changes) {
      const tags = (c.metadata?.tags as string[] | undefined) ?? [];
      for (const t of tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
  }
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));

  const topOverdue = active
    .filter((s) => s.overdueBy !== null && s.overdueBy > 0)
    .sort((a, b) => (b.overdueBy ?? 0) - (a.overdueBy ?? 0))
    .slice(0, 3);

  return {
    projectCount: stats.length,
    activeCount: active.length,
    archivedCount: stats.length - active.length,
    avgInflationRate,
    totalChanges: stats.reduce((sum, s) => sum + s.totalChanges, 0),
    totalDaysAdded: stats.reduce((sum, s) => sum + s.totalDaysAdded, 0),
    perProject: stats,
    topTags,
    topOverdue,
  };
}
