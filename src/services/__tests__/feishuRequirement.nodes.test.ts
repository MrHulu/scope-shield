import { describe, it, expect } from 'vitest';
import {
  extractScheduleFromNodes,
  extractCurrentNodeOwnersByRole,
  msToIsoDate,
  urlOnlyDraft,
} from '../feishuRequirement';
import type { RequirementSource } from '../../types';

/**
 * Node-level extraction is the part of the feishu pipeline that bit us hardest
 * during reverse engineering — work hours and current owners do NOT live on
 * the workitem, they live on biz_data[key=node]. Lock the shape so any future
 * payload drift trips a test instead of silently producing 0d / "" owners.
 */

function nodeEntry(opts: {
  uuid?: string;
  workHourPoints?: number | string;
  scheduleV3Points?: number | string;
  startMs?: number | null;
  endMs?: number | null;
  ownerValue?: string | null;
}) {
  const workHour =
    opts.workHourPoints !== undefined
      ? {
          attributes: {
            points: { value: opts.workHourPoints },
            schedule_start: opts.startMs != null ? { timestamp_in_ms: opts.startMs } : undefined,
            schedule_end: opts.endMs != null ? { timestamp_in_ms: opts.endMs } : undefined,
          },
        }
      : undefined;
  const scheduleV3 =
    opts.scheduleV3Points !== undefined
      ? {
          attributes: {
            points: { value: opts.scheduleV3Points },
            schedule_start: opts.startMs != null ? { timestamp_in_ms: opts.startMs } : undefined,
            schedule_end: opts.endMs != null ? { timestamp_in_ms: opts.endMs } : undefined,
          },
        }
      : undefined;
  return {
    key: 'node',
    uuid: opts.uuid ?? 'node-1',
    value: {
      data: workHour ? { work_hour: workHour } : undefined,
      scheduleV3,
      owner: opts.ownerValue !== undefined ? { value: opts.ownerValue } : undefined,
    },
  };
}

describe('extractScheduleFromNodes', () => {
  it('reads numeric points from work_hour.attributes', () => {
    const data = {
      biz_data: [
        nodeEntry({ workHourPoints: 5, startMs: 1735689600000, endMs: 1736208000000 }),
      ],
    };
    expect(extractScheduleFromNodes(data)).toEqual({
      points: 5,
      startMs: 1735689600000,
      endMs: 1736208000000,
    });
  });

  it('coerces string points to number', () => {
    const data = {
      biz_data: [nodeEntry({ workHourPoints: '3.5' })],
    };
    expect(extractScheduleFromNodes(data).points).toBe(3.5);
  });

  it('falls back to scheduleV3.attributes when work_hour absent', () => {
    const data = {
      biz_data: [nodeEntry({ scheduleV3Points: 2 })],
    };
    expect(extractScheduleFromNodes(data).points).toBe(2);
  });

  it('skips nodes with points < 0.5 and continues to next', () => {
    const data = {
      biz_data: [
        nodeEntry({ uuid: 'tiny', workHourPoints: 0.2 }),
        nodeEntry({ uuid: 'real', workHourPoints: 4 }),
      ],
    };
    expect(extractScheduleFromNodes(data).points).toBe(4);
  });

  it('returns null points when nothing meaningful found', () => {
    expect(extractScheduleFromNodes({ biz_data: [] })).toEqual({
      points: null,
      startMs: null,
      endMs: null,
    });
  });

  it('treats NaN string points as missing (not as 0)', () => {
    const data = {
      biz_data: [nodeEntry({ workHourPoints: 'abc' })],
    };
    expect(extractScheduleFromNodes(data).points).toBeNull();
  });

  it('non-finite startMs/endMs become null', () => {
    const data = {
      biz_data: [nodeEntry({ workHourPoints: 3, startMs: NaN, endMs: NaN })],
    };
    const result = extractScheduleFromNodes(data);
    expect(result.points).toBe(3);
    expect(result.startMs).toBeNull();
    expect(result.endMs).toBeNull();
  });

  it('biz_data not array → empty result', () => {
    expect(extractScheduleFromNodes({ biz_data: 'oops' as unknown as never[] })).toEqual({
      points: null,
      startMs: null,
      endMs: null,
    });
  });
});

describe('extractCurrentNodeOwnersByRole', () => {
  it('uses doing-node owner role to look up role_owners names', () => {
    const data = {
      biz_data: [
        nodeEntry({
          uuid: 'node-doing-1',
          ownerValue: JSON.stringify({ roles: ['developer'] }),
        }),
      ],
    };
    const bizWorkItem = {
      role_owners: [
        { role: 'developer', owners: [{ name: 'Alice' }, { name: 'Bob' }] },
      ],
    };
    expect(extractCurrentNodeOwnersByRole(data, bizWorkItem)).toEqual(['Alice', 'Bob']);
  });

  it('falls back to last node when no doing-node uuid present', () => {
    const data = {
      biz_data: [
        nodeEntry({ uuid: 'node-1', ownerValue: JSON.stringify({ roles: ['pm'] }) }),
        nodeEntry({ uuid: 'node-final', ownerValue: JSON.stringify({ roles: ['qa'] }) }),
      ],
    };
    const bizWorkItem = {
      role_owners: [
        { role: 'pm', owners: [{ name: 'Should not pick' }] },
        { role: 'qa', owners: [{ name: 'Tester' }] },
      ],
    };
    expect(extractCurrentNodeOwnersByRole(data, bizWorkItem)).toEqual(['Tester']);
  });

  it('returns [] when owner.value is malformed JSON (silent swallow)', () => {
    const data = {
      biz_data: [nodeEntry({ uuid: 'node-doing', ownerValue: '{not valid json' })],
    };
    expect(extractCurrentNodeOwnersByRole(data, { role_owners: [] })).toEqual([]);
  });

  it('returns [] when owner.value missing entirely', () => {
    const data = {
      biz_data: [nodeEntry({ uuid: 'node-doing' })],
    };
    expect(extractCurrentNodeOwnersByRole(data, { role_owners: [] })).toEqual([]);
  });

  it('only includes role_owners whose role matches a roleKey', () => {
    const data = {
      biz_data: [
        nodeEntry({ uuid: 'node-doing', ownerValue: JSON.stringify({ roles: ['developer'] }) }),
      ],
    };
    const bizWorkItem = {
      role_owners: [
        { role: 'pm', owners: [{ name: 'PM Person' }] }, // wrong role — skip
        { role: 'developer', owners: [{ name: 'Dev Person' }] },
      ],
    };
    expect(extractCurrentNodeOwnersByRole(data, bizWorkItem)).toEqual(['Dev Person']);
  });

  it('returns [] on empty biz_data', () => {
    expect(extractCurrentNodeOwnersByRole({ biz_data: [] }, { role_owners: [] })).toEqual([]);
  });
});

describe('msToIsoDate', () => {
  it('converts a valid ms timestamp to YYYY-MM-DD', () => {
    // 2026-01-01T00:00:00Z → epoch 1767225600000
    expect(msToIsoDate(1767225600000)).toBe('2026-01-01');
  });

  it('null input → null', () => {
    expect(msToIsoDate(null)).toBeNull();
  });

  it('NaN → null', () => {
    expect(msToIsoDate(NaN)).toBeNull();
  });

  it('Infinity → null', () => {
    expect(msToIsoDate(Infinity)).toBeNull();
    expect(msToIsoDate(-Infinity)).toBeNull();
  });

  it('invalid date (out-of-range) → null', () => {
    // 1e15 is past JS Date max range, throws on toISOString
    expect(msToIsoDate(1e16)).toBeNull();
  });
});

describe('urlOnlyDraft', () => {
  function source(workItemId: string): RequirementSource {
    return {
      type: 'feishu',
      url: `https://project.feishu.cn/proj/story/detail?work_item_id=${workItemId}`,
      projectKey: 'PAY',
      workItemTypeKey: 'story',
      workItemId,
    };
  }

  it('builds placeholder name from workItemId', () => {
    const draft = urlOnlyDraft(source('42'));
    expect(draft.name).toBe('飞书需求 #42');
    expect(draft.status).toBe('url_only');
    expect(draft.originalDays).toBeNull();
  });

  it('attaches error message when provided', () => {
    const draft = urlOnlyDraft(source('100'), '飞书未登录');
    expect(draft.error).toBe('飞书未登录');
  });

  it('empty workItemId → empty placeholder name (UI handles)', () => {
    const draft = urlOnlyDraft({ ...source(''), workItemId: '' });
    expect(draft.name).toBe('');
  });
});
