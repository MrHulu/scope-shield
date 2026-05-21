import { afterEach, describe, expect, it, vi } from 'vitest';
import { startRuntimeHeartbeat } from '../runtimeHeartbeat';

function createWindowLike() {
  const listeners = new Map<string, () => void>();
  return {
    addEventListener: vi.fn((type: string, listener: () => void) => {
      listeners.set(type, listener);
    }),
    removeEventListener: vi.fn((type: string) => {
      listeners.delete(type);
    }),
    dispatch(type: string) {
      listeners.get(type)?.();
    },
  };
}

describe('runtime heartbeat', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('posts immediately and then on an interval', () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () => new Response('{}'));
    const windowRef = createWindowLike();

    const stop = startRuntimeHeartbeat({
      fetcher,
      windowRef,
      intervalMs: 1000,
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenLastCalledWith('/__runtime/heartbeat', {
      method: 'POST',
      cache: 'no-store',
      keepalive: true,
    });

    vi.advanceTimersByTime(2500);
    expect(fetcher).toHaveBeenCalledTimes(3);

    stop();
    vi.advanceTimersByTime(2000);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('sends a final heartbeat while the page is closing', () => {
    const fetcher = vi.fn(async () => new Response('{}'));
    const windowRef = createWindowLike();

    const stop = startRuntimeHeartbeat({ fetcher, windowRef });
    windowRef.dispatch('pagehide');

    expect(fetcher).toHaveBeenCalledTimes(2);
    stop();
    windowRef.dispatch('beforeunload');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('swallows heartbeat network failures', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('not served by vite');
    });

    expect(() => startRuntimeHeartbeat({ fetcher })).not.toThrow();
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
