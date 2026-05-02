/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDefaultsForType,
  rememberType,
  clearAllChangeDefaults,
  lastFinishingRequirementId,
} from '../changeDefaults';
import type { Requirement } from '../../types';

// Vitest's jsdom localStorage doesn't persist setItem/getItem in this repo's
// setup (warns about missing --localstorage-file path). Install an
// in-memory shim so sticky-defaults tests are deterministic.
beforeEach(() => {
  const store = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => { store.clear(); },
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() { return store.size; },
    },
  });
});

function req(id: string, days: number, dependsOn: string | null = null): Requirement {
  return {
    id,
    projectId: 'p',
    name: id,
    originalDays: days,
    currentDays: days,
    isAddedByChange: false,
    dependsOn,
    status: 'active',
    sortOrder: 0,
    pausedRemainingDays: null,
    createdAt: '',
    updatedAt: '',
  };
}

describe('changeDefaults', () => {
  beforeEach(() => {
    clearAllChangeDefaults();
  });

  it('returns first-time defaults for supplement', () => {
    expect(getDefaultsForType('supplement', [])).toMatchObject({
      daysDelta: '0.5',
      subType: 'feature_addition',
    });
  });

  it('returns first-time defaults for add_days', () => {
    expect(getDefaultsForType('add_days', [])).toMatchObject({ daysDelta: '1' });
  });

  it('returns sticky values after rememberType', () => {
    rememberType('add_days', { daysDelta: '5' });
    expect(getDefaultsForType('add_days', []).daysDelta).toBe('5');
  });

  it('sticky values for one type do not leak to another', () => {
    rememberType('add_days', { daysDelta: '5' });
    expect(getDefaultsForType('supplement', []).daysDelta).toBe('0.5');
  });

  it('lastFinishingRequirementId picks highest endDay (chained)', () => {
    // r1 (5d) → r2 (10d) → r3 (3d): r3 ends last at day 17
    const reqs = [req('r1', 5), { ...req('r2', 10, 'r1') }, { ...req('r3', 3, 'r2') }];
    expect(lastFinishingRequirementId(reqs)).toBe('r3');
  });

  it('lastFinishingRequirementId handles parallel reqs (picks longest)', () => {
    // r1, r2 both at root, r1 longer
    const reqs = [req('r1', 10), req('r2', 3)];
    expect(lastFinishingRequirementId(reqs)).toBe('r1');
  });

  it('lastFinishingRequirementId returns empty when no eligible reqs', () => {
    expect(lastFinishingRequirementId([])).toBe('');
  });

  it('new_requirement default picks last-finishing when no sticky', () => {
    const reqs = [req('r1', 5), { ...req('r2', 10, 'r1') }];
    const defaults = getDefaultsForType('new_requirement', reqs);
    expect(defaults.newReqDependsOn).toBe('r2');
    expect(defaults.newReqDays).toBe('3');
  });

  it('new_requirement falls back to last-finishing if sticky id stale', () => {
    rememberType('new_requirement', { newReqDependsOn: 'deleted-id' });
    const reqs = [req('r1', 5)];
    expect(getDefaultsForType('new_requirement', reqs).newReqDependsOn).toBe('r1');
  });

  it('rememberType skips empty values', () => {
    rememberType('add_days', { daysDelta: '' });
    expect(getDefaultsForType('add_days', []).daysDelta).toBe('1'); // first-time
  });
});
