import { describe, it, expect } from 'vitest';
import { generateMarkdownReport } from '../reportGenerator';
import type { Change, Project, ProjectStats, Requirement } from '../../types';

function makeProject(): Project {
  return {
    id: 'p1',
    name: '测试项目',
    startDate: '2026-04-01',
    status: 'active',
    isDemo: false,
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
  };
}

function makeReq(id: string, overrides: Partial<Requirement> = {}): Requirement {
  return {
    id,
    projectId: 'p1',
    name: id,
    originalDays: 3,
    currentDays: 3,
    isAddedByChange: false,
    status: 'active',
    sortOrder: 0,
    dependsOn: null,
    pausedRemainingDays: null,
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    ...overrides,
  };
}

function makeChange(overrides: Partial<Change>): Change {
  return {
    id: 'c1',
    projectId: 'p1',
    type: 'add_days',
    targetRequirementId: 'r1',
    role: 'pm',
    personName: null,
    description: '加密变更',
    daysDelta: 2,
    date: '2026-04-15',
    metadata: null,
    screenshots: [],
    createdAt: '2026-04-15T00:00:00Z',
    updatedAt: '2026-04-15T00:00:00Z',
    ...overrides,
  };
}

const stats: ProjectStats = {
  originalTotalDays: 18,
  currentTotalDays: 23,
  inflationRate: 28,
  totalChanges: 4,
  supplementCount: 1,
};

describe('generateMarkdownReport (W3.5)', () => {
  it('contains project name + summary + key changes', () => {
    const md = generateMarkdownReport({
      project: makeProject(),
      stats,
      requirements: [makeReq('r1', { name: '登录' }), makeReq('r2', { name: '商品' })],
      changes: [makeChange({ id: 'c1', daysDelta: 2 })],
    });
    expect(md).toContain('# 测试项目 · 项目状态报告');
    expect(md).toContain('原始工期：**18 天**');
    expect(md).toContain('当前工期：**23 天**');
    expect(md).toContain('膨胀率：**+28%**');
    expect(md).toContain('「登录」');
    expect(md).toContain('+2天');
  });

  it('renders critical path section when provided', () => {
    const md = generateMarkdownReport({
      project: makeProject(),
      stats,
      requirements: [makeReq('r1', { name: '登录' }), makeReq('r2', { name: '商品' })],
      changes: [],
      criticalPath: ['r1', 'r2'],
    });
    expect(md).toContain('🔥 关键路径');
    expect(md).toContain('- 登录');
    expect(md).toContain('- 商品');
  });

  it('caps changes at 10 with explanatory line', () => {
    // Use deltas that are all non-zero so the filter keeps every entry.
    const changes = Array.from({ length: 15 }, (_, i) =>
      makeChange({ id: `c${i}`, daysDelta: i + 1, description: `变更${i}` }),
    );
    const md = generateMarkdownReport({
      project: makeProject(),
      stats,
      requirements: [makeReq('r1')],
      changes,
    });
    expect(md).toMatch(/共 15 条变更，仅展示影响最大的 10 条/);
  });

  it('skips Critical Path section when not provided', () => {
    const md = generateMarkdownReport({
      project: makeProject(),
      stats,
      requirements: [makeReq('r1')],
      changes: [],
    });
    expect(md).not.toContain('🔥 关键路径');
  });

  it('handles 0 changes gracefully', () => {
    const md = generateMarkdownReport({
      project: makeProject(),
      stats: { ...stats, totalChanges: 0 },
      requirements: [makeReq('r1')],
      changes: [],
    });
    expect(md).toContain('# 测试项目');
    // No "关键变更" section when no meaningful changes.
    expect(md).not.toContain('关键变更');
  });

  it('shows requirement counts (active/paused/cancelled)', () => {
    const md = generateMarkdownReport({
      project: makeProject(),
      stats,
      requirements: [
        makeReq('r1'),
        makeReq('r2', { status: 'paused', pausedRemainingDays: 2 }),
        makeReq('r3', { status: 'cancelled' }),
      ],
      changes: [],
    });
    expect(md).toContain('进行中：1');
    expect(md).toContain('已暂停：1');
    expect(md).toContain('已砍：1');
  });
});
