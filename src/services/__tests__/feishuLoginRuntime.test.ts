import { describe, expect, it, vi } from 'vitest';
import {
  getFeishuRuntimeStatus,
  startFeishuLogin,
  waitForFeishuLogin,
} from '../feishuLoginRuntime';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('feishu login runtime', () => {
  it('starts login with a short POST request', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ ok: true, started: true }, { status: 202 }));

    await expect(startFeishuLogin(fetcher as typeof fetch)).resolves.toMatchObject({
      ok: true,
      started: true,
    });
    expect(fetcher).toHaveBeenCalledWith('/__feishu/login', { method: 'POST' });
  });

  it('reads runtime login status', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ ok: true, enabled: true, loggedIn: true }));

    await expect(getFeishuRuntimeStatus(fetcher as typeof fetch)).resolves.toMatchObject({
      enabled: true,
      loggedIn: true,
    });
    expect(fetcher).toHaveBeenCalledWith('/__feishu/status', { cache: 'no-store' });
  });

  it('waits until the background login script has written credentials', async () => {
    let now = 0;
    const responses = [
      { ok: true, enabled: true, loggedIn: false, login: { running: true } },
      { ok: true, enabled: true, loggedIn: true, login: { running: false } },
    ];
    const fetcher = vi.fn(async () => jsonResponse(responses.shift()));
    const sleep = vi.fn(async (ms: number) => { now += ms; });

    await expect(waitForFeishuLogin({
      fetcher: fetcher as typeof fetch,
      timeoutMs: 5000,
      pollMs: 1000,
      sleep,
      now: () => now,
    })).resolves.toMatchObject({ loggedIn: true });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it('surfaces background login script failures during polling', async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      ok: true,
      enabled: true,
      loggedIn: false,
      login: {
        running: false,
        lastError: 'noise\nFailed to fetch',
      },
    }));

    await expect(waitForFeishuLogin({
      fetcher: fetcher as typeof fetch,
      sleep: async () => {},
    })).rejects.toThrow('Failed to fetch');
  });

  it('does not finish while the login window is still running', async () => {
    let now = 0;
    const responses = [
      { ok: true, enabled: true, loggedIn: true, login: { running: true } },
      { ok: true, enabled: true, loggedIn: true, login: { running: false } },
    ];
    const fetcher = vi.fn(async () => jsonResponse(responses.shift()));
    const sleep = vi.fn(async (ms: number) => { now += ms; });

    await expect(waitForFeishuLogin({
      fetcher: fetcher as typeof fetch,
      timeoutMs: 5000,
      pollMs: 1000,
      sleep,
      now: () => now,
    })).resolves.toMatchObject({ loggedIn: true });

    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
