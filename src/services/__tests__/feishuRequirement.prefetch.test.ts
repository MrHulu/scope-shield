import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  prefetchLoginStatus,
  clearLoginCache,
  _getLoginCacheForTest,
  analyzeFeishuRequirementUrl,
} from '../feishuRequirement';

/**
 * Wave 2 W2.1 — verify the prefetched login probe short-circuits the slow
 * demand_fetch round trip when the user is unauthenticated.
 *
 * The cache TTL is 30s; tests must run faster than that or we'd need to
 * mock Date.now (kept simpler by trusting the wall clock here).
 */
describe('prefetchLoginStatus', () => {
  beforeEach(() => {
    clearLoginCache();
  });

  it('caches authed=true when API returns code:0', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 0, data: {} }),
    });
    const authed = await prefetchLoginStatus(fetcher as unknown as typeof fetch);
    expect(authed).toBe(true);
    expect(_getLoginCacheForTest()?.authed).toBe(true);
  });

  it('caches authed=false when API returns code:!0', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 401, msg: 'unauthenticated' }),
    });
    const authed = await prefetchLoginStatus(fetcher as unknown as typeof fetch);
    expect(authed).toBe(false);
    expect(_getLoginCacheForTest()?.authed).toBe(false);
  });

  it('caches authed=false when fetch throws', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('network down'));
    const authed = await prefetchLoginStatus(fetcher as unknown as typeof fetch);
    expect(authed).toBe(false);
    expect(_getLoginCacheForTest()?.authed).toBe(false);
  });

  it('caches authed=false when HTTP not ok', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });
    const authed = await prefetchLoginStatus(fetcher as unknown as typeof fetch);
    expect(authed).toBe(false);
  });

  it('returns cached value within TTL without re-fetching', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ code: 0 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ code: 401 }), // would flip if asked, but cache should win
      });
    const first = await prefetchLoginStatus(fetcher as unknown as typeof fetch);
    const second = await prefetchLoginStatus(fetcher as unknown as typeof fetch);
    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('clearLoginCache forces re-fetch on next call', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ code: 0 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ code: 401 }) });
    await prefetchLoginStatus(fetcher as unknown as typeof fetch);
    clearLoginCache();
    const second = await prefetchLoginStatus(fetcher as unknown as typeof fetch);
    expect(second).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('analyzeFeishuRequirementUrl uses prefetched cache', () => {
  beforeEach(() => {
    clearLoginCache();
  });

  it('returns urlOnlyDraft fast-path when cache says unauthenticated', async () => {
    // Seed cache with unauthenticated status.
    const probeFetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 401 }),
    });
    await prefetchLoginStatus(probeFetcher as unknown as typeof fetch);

    // analyze should NOT call demand_fetch — it should bail to url-only.
    const demandFetcher = vi.fn();
    const draft = await analyzeFeishuRequirementUrl(
      'https://project.feishu.cn/proj/story/detail?project_key=PAY&work_item_type_key=story&work_item_id=42',
      { fetcher: demandFetcher as unknown as typeof fetch },
    );
    expect(draft.status).toBe('url_only');
    expect(draft.error).toContain('飞书未登录');
    expect(demandFetcher).not.toHaveBeenCalled();
  });

  it('proceeds to demand_fetch when cache says authenticated', async () => {
    const probeFetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 0 }),
    });
    await prefetchLoginStatus(probeFetcher as unknown as typeof fetch);

    const demandFetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 0, data: {} }),
    });
    await analyzeFeishuRequirementUrl(
      'https://project.feishu.cn/proj/story/detail?project_key=PAY&work_item_type_key=story&work_item_id=42',
      { fetcher: demandFetcher as unknown as typeof fetch },
    );
    expect(demandFetcher).toHaveBeenCalledTimes(1);
  });

  it('proceeds to demand_fetch when no cache exists', async () => {
    const demandFetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 401 }),
    });
    await analyzeFeishuRequirementUrl(
      'https://project.feishu.cn/proj/story/detail?project_key=PAY&work_item_type_key=story&work_item_id=42',
      { fetcher: demandFetcher as unknown as typeof fetch },
    );
    expect(demandFetcher).toHaveBeenCalledTimes(1);
  });
});
