import { onDataChange } from './changeNotifier';
import { exportAllData } from './exportImport';
import type { ExportData } from '../types';

const KEY_LATEST = 'scope-shield-backup-latest';
const KEY_PREV = 'scope-shield-backup-previous';
const DEBOUNCE_MS = 5000;
const MAX_SIZE_BYTES = 4 * 1024 * 1024;

export interface AutoBackup {
  version: '1.0';
  createdAt: string;
  projectCount: number;
  requirementCount: number;
  data: ExportData;
}

export function getLatestBackup(): AutoBackup | null {
  try {
    const raw = localStorage.getItem(KEY_LATEST);
    if (!raw) return null;
    return JSON.parse(raw) as AutoBackup;
  } catch {
    return null;
  }
}

export function getBackupTime(): string | null {
  try {
    const raw = localStorage.getItem(KEY_LATEST);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AutoBackup;
    return parsed.createdAt ?? null;
  } catch {
    return null;
  }
}

async function doBackup(): Promise<void> {
  try {
    const data = await exportAllData();
    const projectCount = data.projects.length;
    const requirementCount = data.projects.reduce(
      (sum, p) => sum + p.requirements.length,
      0,
    );

    const backup: AutoBackup = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      projectCount,
      requirementCount,
      data,
    };

    let json = JSON.stringify(backup);

    if (json.length > MAX_SIZE_BYTES) {
      for (const p of backup.data.projects) {
        for (const c of p.changes) {
          c.screenshots = [];
        }
      }
      json = JSON.stringify(backup);
    }

    if (json.length > MAX_SIZE_BYTES) {
      for (const p of backup.data.projects) {
        p.changes = [];
        p.snapshots = [];
      }
      json = JSON.stringify(backup);
    }

    const prev = localStorage.getItem(KEY_LATEST);
    if (prev) {
      localStorage.setItem(KEY_PREV, prev);
    }
    localStorage.setItem(KEY_LATEST, json);
  } catch {
    // localStorage full or other error — silent fail, best effort
  }
}

export function startAutoBackup(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debouncedBackup = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      doBackup();
    }, DEBOUNCE_MS);
  };

  const unsubscribe = onDataChange(debouncedBackup);

  const handleBeforeUnload = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    doBackup();
  };

  window.addEventListener('beforeunload', handleBeforeUnload);

  return () => {
    unsubscribe();
    if (timer) clearTimeout(timer);
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}
