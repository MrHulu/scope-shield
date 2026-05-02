import type { ChangeType, Requirement, SupplementSubType } from '../types';
import { schedule } from '../engine/scheduler';

/**
 * Wave 6 W6.1 — sticky per-type defaults to speed up change recording.
 *
 * Strategy:
 *   1. First-time fallback: hardcoded "most-common" values per type (see
 *      FIRST_TIME_DEFAULTS). Boss-confirmed during 2026-05-03 design pass.
 *   2. Sticky: every successful save calls `rememberType()` to persist that
 *      type's last-used values to localStorage. Next open of the same type
 *      restores those values.
 *   3. new_requirement.dependsOn: when no sticky / no manual selection, pick
 *      the requirement that finishes last (max endDay in current schedule)
 *      so the new bar slots into the critical-path tail instead of going
 *      parallel — matches Boss's "新增需求自然接最后" intuition.
 */

export interface ChangeTypeDefaults {
  /** Stringified delta — matches the form field type (number input value). */
  daysDelta?: string;
  subType?: SupplementSubType;
  newReqDays?: string;
  newReqDependsOn?: string;
}

const FIRST_TIME_DEFAULTS: Record<ChangeType, ChangeTypeDefaults> = {
  supplement: { daysDelta: '0.5', subType: 'feature_addition' },
  add_days: { daysDelta: '1' },
  new_requirement: { newReqDays: '3' /* dependsOn auto-computed below */ },
  cancel_requirement: {}, // daysDelta auto-recalculated by engine
  reprioritize: {},
  pause: {},
  resume: {},
};

const STORAGE_PREFIX = 'scope-shield:change-defaults:';

function storageKey(type: ChangeType): string {
  return `${STORAGE_PREFIX}${type}`;
}

/** Pick the requirement with the largest endDay (active + non-isAddedByChange).
 * Returns '' when there are no eligible reqs. */
export function lastFinishingRequirementId(requirements: Requirement[]): string {
  const eligibleIds = new Set(
    requirements.filter((r) => r.status === 'active' && !r.isAddedByChange).map((r) => r.id),
  );
  if (eligibleIds.size === 0) return '';
  try {
    const sched = schedule(requirements);
    let bestId = '';
    let bestEnd = -1;
    for (const item of sched.requirementSchedules) {
      if (!eligibleIds.has(item.requirementId)) continue;
      if (item.endDay > bestEnd) {
        bestEnd = item.endDay;
        bestId = item.requirementId;
      }
    }
    return bestId;
  } catch {
    // schedule throws on cyclic deps — fall back gracefully.
    return '';
  }
}

/** Read sticky defaults for the given type, falling back to first-time
 * defaults. For new_requirement, also auto-fills dependsOn when not set. */
export function getDefaultsForType(
  type: ChangeType,
  requirements: Requirement[],
): ChangeTypeDefaults {
  const firstTime = FIRST_TIME_DEFAULTS[type];
  let sticky: ChangeTypeDefaults = {};
  try {
    const raw = localStorage.getItem(storageKey(type));
    if (raw) sticky = JSON.parse(raw) as ChangeTypeDefaults;
  } catch {
    // Corrupt JSON — ignore, fall through to first-time.
  }
  const merged: ChangeTypeDefaults = { ...firstTime, ...sticky };

  // For new_requirement, prefer sticky dependsOn but validate it still exists
  // and fall back to "last finishing" requirement when missing/stale.
  if (type === 'new_requirement') {
    const stickyDep = merged.newReqDependsOn;
    const stickyValid = stickyDep && requirements.some((r) => r.id === stickyDep && r.status === 'active');
    if (!stickyValid) {
      merged.newReqDependsOn = lastFinishingRequirementId(requirements);
    }
  }

  return merged;
}

/** Persist sticky values for a type after a successful save. Empty / undefined
 * fields are skipped so partial inputs don't pollute future opens. */
export function rememberType(type: ChangeType, values: ChangeTypeDefaults): void {
  try {
    const filtered: ChangeTypeDefaults = {};
    if (values.daysDelta) filtered.daysDelta = values.daysDelta;
    if (values.subType) filtered.subType = values.subType;
    if (values.newReqDays) filtered.newReqDays = values.newReqDays;
    if (values.newReqDependsOn) filtered.newReqDependsOn = values.newReqDependsOn;
    if (Object.keys(filtered).length === 0) return;
    localStorage.setItem(storageKey(type), JSON.stringify(filtered));
  } catch {
    // Storage quota / privacy mode — silently skip; sticky is best-effort.
  }
}

/** Clear all sticky defaults (used by tests + Settings page reset). */
export function clearAllChangeDefaults(): void {
  try {
    for (const t of Object.keys(FIRST_TIME_DEFAULTS) as ChangeType[]) {
      localStorage.removeItem(storageKey(t));
    }
  } catch {
    // ignore
  }
}

/** Picker order — supplement first since it's the highest-frequency type
 * and matches the new modal default. The numeric key (1-7) maps in this
 * order. CHANGE_TYPES const stays in its original order to avoid breaking
 * any consumer that depends on legacy indexing. */
export const CHANGE_TYPE_PICKER_ORDER = [
  'supplement',
  'add_days',
  'new_requirement',
  'cancel_requirement',
  'reprioritize',
  'pause',
  'resume',
] as const satisfies readonly ChangeType[];
