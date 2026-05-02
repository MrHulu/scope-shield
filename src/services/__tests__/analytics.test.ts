import { describe, it, expect } from 'vitest';
import { computeAnalytics } from '../analytics';
import type { Project, Requirement, Change } from '../../types';

function project(id: string, overrides: Partial<Project> = {}): Project {
  return {
    id,
    name: id,
    startDate: '2026-01-01',
    status: 'active',
    isDemo: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function req(id: string, days: number, projectId: string): Requirement {
  return {
    id,
    projectId,
    name: id,
    originalDays: days,
    currentDays: days,
    isAddedByChange: false,
    dependsOn: null,
    status: 'active',
    sortOrder: 0,
    pausedRemainingDays: null,
    createdAt: '',
    updatedAt: '',
  };
}

function change(id: string, projectId: string, daysDelta: number, tags: string[] = []): Change {
  return {
    id,
    projectId,
    type: 'add_days',
    targetRequirementId: null,
    role: 'pm',
    personName: null,
    description: id,
    daysDelta,
    date: '2026-04-01',
    metadata: tags.length > 0 ? { tags } : null,
    screenshots: [],
    createdAt: '',
    updatedAt: '',
  };
}

describe('computeAnalytics', () => {
  it('returns zeroed summary for no projects', () => {
    const summary = computeAnalytics([]);
    expect(summary.projectCount).toBe(0);
    expect(summary.activeCount).toBe(0);
    expect(summary.avgInflationRate).toBeNull();
    expect(summary.topTags).toEqual([]);
  });

  it('computes per-project inflation and totals', () => {
    const p1 = project('p1');
    const r1 = req('r1', 10, 'p1');
    r1.currentDays = 13;
    const c1 = change('c1', 'p1', 3, ['需求方反复']);
    const summary = computeAnalytics([{ project: p1, requirements: [r1], changes: [c1] }]);
    expect(summary.totalChanges).toBe(1);
    expect(summary.totalDaysAdded).toBe(3);
    expect(summary.perProject[0].inflationRate).toBe(30);
  });

  it('aggregates tags across projects and ranks them', () => {
    const p1 = project('p1');
    const p2 = project('p2');
    const data = [
      {
        project: p1,
        requirements: [req('r1', 5, 'p1')],
        changes: [
          change('c1', 'p1', 1, ['需求方反复', '上线问题']),
          change('c2', 'p1', 2, ['需求方反复']),
        ],
      },
      {
        project: p2,
        requirements: [req('r2', 5, 'p2')],
        changes: [change('c3', 'p2', 1, ['需求方反复', '技术债'])],
      },
    ];
    const summary = computeAnalytics(data);
    expect(summary.topTags[0].tag).toBe('需求方反复');
    expect(summary.topTags[0].count).toBe(3);
    expect(summary.topTags.find((t) => t.tag === '上线问题')?.count).toBe(1);
  });

  it('flags overdue projects', () => {
    const past = '2020-01-01';
    const p1 = project('p1', { targetEndDate: past });
    const summary = computeAnalytics([
      { project: p1, requirements: [req('r1', 5, 'p1')], changes: [] },
    ]);
    expect(summary.topOverdue.length).toBe(1);
    expect(summary.topOverdue[0].overdueBy).toBeGreaterThan(0);
  });

  it('excludes archived projects from avg + topOverdue', () => {
    const p1 = project('p1', { status: 'archived', targetEndDate: '2020-01-01' });
    const r1 = req('r1', 10, 'p1');
    r1.currentDays = 20;
    const summary = computeAnalytics([{ project: p1, requirements: [r1], changes: [] }]);
    expect(summary.avgInflationRate).toBeNull();
    expect(summary.topOverdue).toEqual([]);
    expect(summary.archivedCount).toBe(1);
  });
});
