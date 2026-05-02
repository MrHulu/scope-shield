import { describe, it, expect } from 'vitest';
import {
  encodeShareLink,
  decodeShareLink,
  type SharedSnapshot,
} from '../shareLink';
import type { Project, Requirement, Change } from '../../types';

const project: Project = {
  id: 'p1',
  name: '测试项目 — Scope Shield',
  startDate: '2026-04-01',
  status: 'active',
  isDemo: false,
  targetEndDate: '2026-04-30',
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
};

const requirements: Requirement[] = [
  {
    id: 'r1',
    projectId: 'p1',
    name: '用户管理',
    originalDays: 5,
    currentDays: 5,
    isAddedByChange: false,
    dependsOn: null,
    status: 'active',
    sortOrder: 0,
    pausedRemainingDays: null,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
];

const changes: Change[] = [
  {
    id: 'c1',
    projectId: 'p1',
    type: 'add_days',
    targetRequirementId: 'r1',
    role: 'pm',
    personName: '张三',
    description: '加 RBAC',
    daysDelta: 2,
    date: '2026-04-05',
    metadata: null,
    screenshots: [],
    createdAt: '2026-04-05T00:00:00.000Z',
    updatedAt: '2026-04-05T00:00:00.000Z',
  },
];

describe('shareLink encode/decode', () => {
  const snap: SharedSnapshot = { v: 1, project, requirements, changes };

  it('roundtrips without data loss', () => {
    const token = encodeShareLink(snap);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/); // base64url charset
    const decoded = decodeShareLink(token);
    expect(decoded).toEqual(snap);
  });

  it('preserves CJK + non-ASCII in project name', () => {
    const token = encodeShareLink(snap);
    const decoded = decodeShareLink(token);
    expect(decoded?.project.name).toBe('测试项目 — Scope Shield');
  });

  it('returns null for malformed token', () => {
    expect(decodeShareLink('not-a-token')).toBeNull();
    expect(decodeShareLink('')).toBeNull();
    expect(decodeShareLink('!!!')).toBeNull();
  });

  it('returns null for token with wrong version', () => {
    const wrong = encodeShareLink({ ...snap, v: 99 as 1 });
    expect(decodeShareLink(wrong)).toBeNull();
  });
});
