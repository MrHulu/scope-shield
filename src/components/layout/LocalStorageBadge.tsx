import { useEffect, useState } from 'react';
import { Lock, AlertTriangle } from 'lucide-react';
import { getBackupTime } from '../../db/autoBackup';

interface QuotaInfo {
  usageMB: number;
  quotaMB: number;
  percent: number;
}

const FORMAT_OPTS: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

function formatBackupTime(iso: string | null): string {
  if (!iso) return '尚未备份';
  try {
    return new Date(iso).toLocaleTimeString('zh-CN', FORMAT_OPTS);
  } catch {
    return '尚未备份';
  }
}

async function readQuota(): Promise<QuotaInfo | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    if (!quota) return null;
    return {
      usageMB: usage / 1024 / 1024,
      quotaMB: quota / 1024 / 1024,
      percent: (usage / quota) * 100,
    };
  } catch {
    return null;
  }
}

export function LocalStorageBadge() {
  const [backupTime, setBackupTime] = useState<string | null>(() => getBackupTime());
  const [quota, setQuota] = useState<QuotaInfo | null>(null);

  useEffect(() => {
    // Poll for fresh values every 15s — autoBackup debounces 5s after writes,
    // so this lags at most 20s behind the latest blob, which matches Apple
    // Time Machine's coarse "last backup" cadence.
    const tick = async () => {
      setBackupTime(getBackupTime());
      setQuota(await readQuota());
    };
    tick();
    const id = setInterval(tick, 15_000);

    // storage event fires when *another* tab writes — useful when the user
    // has the same project open twice and we want them in sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'scope-shield-backup-latest') tick();
    };
    window.addEventListener('storage', onStorage);

    return () => {
      clearInterval(id);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // Quota status: warn when usage > 70%, danger > 90%, regardless of whether
  // we have a backup yet (a fresh user has 0 bytes, no warning).
  const quotaPercent = quota?.percent ?? 0;
  const isWarn = quotaPercent > 70 && quotaPercent <= 90;
  const isDanger = quotaPercent > 90;

  const ringColor = isDanger
    ? 'text-red-600'
    : isWarn
      ? 'text-amber-600'
      : 'text-emerald-600';

  // Tooltip line — packed with what an ops-minded user wants at a glance.
  const tooltip = quota
    ? `本地存储 · 上次备份 ${formatBackupTime(backupTime)} · 已用 ${quota.usageMB.toFixed(1)}MB / ${quota.quotaMB.toFixed(0)}MB (${quotaPercent.toFixed(1)}%)`
    : `本地存储 · 上次备份 ${formatBackupTime(backupTime)}`;

  return (
    <div
      data-testid="local-storage-badge"
      data-quota-state={isDanger ? 'danger' : isWarn ? 'warn' : 'ok'}
      title={tooltip}
      className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-gray-500 rounded-lg"
    >
      {isDanger || isWarn ? (
        <AlertTriangle size={11} className={ringColor} aria-hidden="true" />
      ) : (
        <Lock size={11} className={ringColor} aria-hidden="true" />
      )}
      <span className="truncate">
        <span className={`${ringColor} font-medium`}>100% 本地</span>
        <span className="text-gray-400 mx-1">·</span>
        {formatBackupTime(backupTime)}
        {quota && (
          <>
            <span className="text-gray-400 mx-1">·</span>
            <span>{quota.usageMB.toFixed(1)}MB</span>
          </>
        )}
      </span>
    </div>
  );
}
