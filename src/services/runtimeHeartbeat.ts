type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type WindowLike = {
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};

export function startRuntimeHeartbeat({
  fetcher = globalThis.fetch?.bind(globalThis) as FetchLike | undefined,
  windowRef = typeof window === 'undefined' ? undefined : window,
  intervalMs = 5_000,
}: {
  fetcher?: FetchLike;
  windowRef?: WindowLike;
  intervalMs?: number;
} = {}) {
  if (!fetcher) return () => {};

  let stopped = false;
  const send = () => {
    if (stopped) return;
    void fetcher('/__runtime/heartbeat', {
      method: 'POST',
      cache: 'no-store',
      keepalive: true,
    }).catch(() => {});
  };

  send();
  const interval = globalThis.setInterval(send, intervalMs);
  const finalHeartbeat = () => send();
  windowRef?.addEventListener('pagehide', finalHeartbeat);
  windowRef?.addEventListener('beforeunload', finalHeartbeat);

  return () => {
    stopped = true;
    globalThis.clearInterval(interval);
    windowRef?.removeEventListener('pagehide', finalHeartbeat);
    windowRef?.removeEventListener('beforeunload', finalHeartbeat);
  };
}
