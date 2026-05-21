export interface FeishuRuntimeStatus {
  ok?: boolean;
  enabled?: boolean;
  loggedIn?: boolean;
  login?: {
    running?: boolean;
    lastError?: string | null;
  };
}

type FetchLike = typeof fetch;

export const FEISHU_LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
export const FEISHU_LOGIN_POLL_MS = 1000;

export async function startFeishuLogin(fetcher: FetchLike = fetch) {
  const resp = await fetcher('/__feishu/login', { method: 'POST' });
  const json = await readJson(resp);
  if (!resp.ok || json?.ok === false) {
    throw new Error(asString(json?.error) || `HTTP ${resp.status}`);
  }
  return json;
}

export async function getFeishuRuntimeStatus(fetcher: FetchLike = fetch) {
  const resp = await fetcher('/__feishu/status', { cache: 'no-store' });
  const json = await readJson(resp);
  if (!resp.ok || json?.ok === false) {
    throw new Error(asString(json?.error) || `HTTP ${resp.status}`);
  }
  return json as FeishuRuntimeStatus;
}

export async function waitForFeishuLogin({
  fetcher = fetch,
  timeoutMs = FEISHU_LOGIN_TIMEOUT_MS,
  pollMs = FEISHU_LOGIN_POLL_MS,
  sleep = defaultSleep,
  now = () => Date.now(),
}: {
  fetcher?: FetchLike;
  timeoutMs?: number;
  pollMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
} = {}) {
  const deadline = now() + timeoutMs;

  while (now() <= deadline) {
    const status = await getFeishuRuntimeStatus(fetcher);
    if (status.enabled === false) {
      throw new Error('当前模式不支持飞书登录，请在自己电脑运行 start-local.cmd');
    }
    if (status.login?.running) {
      await sleep(Math.min(pollMs, Math.max(0, deadline - now())));
      continue;
    }
    if (status.login?.lastError && !status.login.running) {
      throw new Error(compactLoginError(status.login.lastError));
    }
    if (status.loggedIn) {
      return status;
    }
    await sleep(Math.min(pollMs, Math.max(0, deadline - now())));
  }

  throw new Error('登录窗口已打开，但 5 分钟内未检测到飞书登录状态');
}

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function readJson(resp: Response): Promise<Record<string, unknown> | null> {
  try {
    return await resp.json();
  } catch {
    return null;
  }
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function compactLoginError(error: string) {
  const trimmed = error.trim();
  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const lastUseful = [...lines].reverse().find((line) => !line.startsWith('═'));
  return lastUseful || trimmed || '飞书登录窗口已退出';
}
