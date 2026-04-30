/**
 * autoBackup tests run in vitest's `node` environment, so we stub localStorage
 * and the relevant window APIs ourselves. exportAllData is mocked because the
 * real one touches IndexedDB.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ExportData } from '../../types';

// --- Mocks -----------------------------------------------------------------

const exportAllDataMock = vi.fn<[], Promise<ExportData>>();
vi.mock('../exportImport', () => ({
  exportAllData: () => exportAllDataMock(),
}));

const dataChangeListeners: Array<() => void> = [];
vi.mock('../changeNotifier', () => ({
  onDataChange: (fn: () => void) => {
    dataChangeListeners.push(fn);
    return () => {
      const i = dataChangeListeners.indexOf(fn);
      if (i >= 0) dataChangeListeners.splice(i, 1);
    };
  },
  notifyDataChange: () => {
    for (const fn of dataChangeListeners) fn();
  },
}));

// --- localStorage stub ------------------------------------------------------

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  quotaBytes: number | null = null; // null = no quota
  get length(): number { return this.store.size; }
  clear(): void { this.store.clear(); }
  getItem(key: string): string | null { return this.store.get(key) ?? null; }
  key(i: number): string | null { return Array.from(this.store.keys())[i] ?? null; }
  removeItem(key: string): void { this.store.delete(key); }
  setItem(key: string, value: string): void {
    if (this.quotaBytes !== null) {
      let total = 0;
      for (const [k, v] of this.store) {
        if (k === key) continue;
        total += k.length + v.length;
      }
      total += key.length + value.length;
      if (total > this.quotaBytes) {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
    }
    this.store.set(key, value);
  }
}

let storage: MemoryStorage;
let beforeUnloadHandler: (() => void) | null;

beforeEach(() => {
  storage = new MemoryStorage();
  beforeUnloadHandler = null;
  dataChangeListeners.length = 0;
  vi.useFakeTimers();
  exportAllDataMock.mockReset();
  exportAllDataMock.mockResolvedValue({
    version: '1.0',
    exportedAt: '2026-04-30T00:00:00.000Z',
    projects: [],
    personNameCache: [],
  });

  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', {
    addEventListener: vi.fn((event: string, fn: () => void) => {
      if (event === 'beforeunload') beforeUnloadHandler = fn;
    }),
    removeEventListener: vi.fn((event: string) => {
      if (event === 'beforeunload') beforeUnloadHandler = null;
    }),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function makeProject(opts: {
  changes?: number;
  screenshotsPerChange?: number;
  bytesPerScreenshot?: number;
  snapshotBytes?: number;
}) {
  const { changes = 0, screenshotsPerChange = 0, bytesPerScreenshot = 0, snapshotBytes = 0 } = opts;
  const screenshots = Array.from({ length: screenshotsPerChange }, () => 'A'.repeat(bytesPerScreenshot));
  return {
    id: 'p1',
    name: 'P',
    startDate: '2026-04-01',
    status: 'active' as const,
    isDemo: false,
    createdAt: '',
    updatedAt: '',
    requirements: [],
    changes: Array.from({ length: changes }, (_, i) => ({
      id: `c${i}`, projectId: 'p1', type: 'add_days' as const, targetRequirementId: null,
      role: 'pm' as const, personName: null, description: 'd', daysDelta: 1, date: '2026-04-01',
      metadata: null, screenshots, createdAt: '', updatedAt: '',
    })),
    snapshots: Array.from({ length: snapshotBytes > 0 ? 1 : 0 }, () => ({
      id: 'snap1', projectId: 'p1', changeId: 'c0',
      data: { requirements: [], schedule: { totalDays: 0, originalTotalDays: 0, requirementSchedules: [] } } as any,
      totalDays: 0,
      createdAt: 'A'.repeat(snapshotBytes),
    })),
  };
}

describe('autoBackup', () => {
  describe('getLatestBackup / getBackupTime', () => {
    it('returns null when no backup exists', async () => {
      const m = await import('../autoBackup');
      expect(m.getLatestBackup()).toBeNull();
      expect(m.getBackupTime()).toBeNull();
    });

    it('returns parsed backup when one exists', async () => {
      storage.setItem('scope-shield-backup-latest', JSON.stringify({
        version: '1.0', createdAt: '2026-04-30T00:00:00.000Z',
        projectCount: 0, requirementCount: 0,
        data: { version: '1.0', exportedAt: '2026-04-30T00:00:00.000Z', projects: [], personNameCache: [] },
      }));
      const m = await import('../autoBackup');
      expect(m.getLatestBackup()?.createdAt).toBe('2026-04-30T00:00:00.000Z');
      expect(m.getBackupTime()).toBe('2026-04-30T00:00:00.000Z');
    });

    it('returns null when stored value is corrupt JSON', async () => {
      storage.setItem('scope-shield-backup-latest', '{not json');
      const m = await import('../autoBackup');
      expect(m.getLatestBackup()).toBeNull();
      expect(m.getBackupTime()).toBeNull();
    });
  });

  describe('startAutoBackup — debouncing', () => {
    it('does not back up before 5s have elapsed', async () => {
      const m = await import('../autoBackup');
      m.startAutoBackup();
      dataChangeListeners[0]();
      await vi.advanceTimersByTimeAsync(4999);
      expect(exportAllDataMock).not.toHaveBeenCalled();
    });

    it('backs up exactly once after 5s', async () => {
      const m = await import('../autoBackup');
      m.startAutoBackup();
      dataChangeListeners[0]();
      await vi.advanceTimersByTimeAsync(5000);
      expect(exportAllDataMock).toHaveBeenCalledTimes(1);
    });

    it('coalesces rapid writes — multiple notifies within 5s = 1 backup', async () => {
      const m = await import('../autoBackup');
      m.startAutoBackup();
      const notify = dataChangeListeners[0];
      notify();
      await vi.advanceTimersByTimeAsync(1000);
      notify();
      await vi.advanceTimersByTimeAsync(2000);
      notify();
      await vi.advanceTimersByTimeAsync(5000);
      expect(exportAllDataMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('startAutoBackup — slot rotation', () => {
    it('writes the first backup to KEY_LATEST and leaves KEY_PREV unset', async () => {
      const m = await import('../autoBackup');
      m.startAutoBackup();
      dataChangeListeners[0]();
      await vi.advanceTimersByTimeAsync(5000);
      expect(storage.getItem('scope-shield-backup-latest')).not.toBeNull();
      expect(storage.getItem('scope-shield-backup-previous')).toBeNull();
    });

    it('on the second backup, the prior latest moves to KEY_PREV', async () => {
      const m = await import('../autoBackup');
      m.startAutoBackup();
      const notify = dataChangeListeners[0];

      exportAllDataMock.mockResolvedValueOnce({
        version: '1.0', exportedAt: 'first', projects: [], personNameCache: [],
      });
      notify();
      await vi.advanceTimersByTimeAsync(5000);
      const firstSnapshot = storage.getItem('scope-shield-backup-latest');

      exportAllDataMock.mockResolvedValueOnce({
        version: '1.0', exportedAt: 'second', projects: [], personNameCache: [],
      });
      notify();
      await vi.advanceTimersByTimeAsync(5000);

      expect(storage.getItem('scope-shield-backup-previous')).toBe(firstSnapshot);
      expect(storage.getItem('scope-shield-backup-latest')).not.toBe(firstSnapshot);
    });
  });

  describe('startAutoBackup — two-tier trim', () => {
    it('L1 strips screenshots when total exceeds 4 MB', async () => {
      // ~5 MB worth of screenshots
      exportAllDataMock.mockResolvedValueOnce({
        version: '1.0', exportedAt: '',
        projects: [makeProject({
          changes: 10,
          screenshotsPerChange: 1,
          bytesPerScreenshot: 500_000,
        })] as any,
        personNameCache: [],
      });

      const m = await import('../autoBackup');
      m.startAutoBackup();
      dataChangeListeners[0]();
      await vi.advanceTimersByTimeAsync(5000);

      const stored = JSON.parse(storage.getItem('scope-shield-backup-latest')!);
      expect(stored.data.projects[0].changes.length).toBe(10);
      for (const c of stored.data.projects[0].changes) {
        expect(c.screenshots).toEqual([]);
      }
    });

    it('L2 drops changes + snapshots when L1 was insufficient', async () => {
      // 12 MB: L1 (strip screenshots) still leaves changes huge → L2 drops them
      exportAllDataMock.mockResolvedValueOnce({
        version: '1.0', exportedAt: '',
        projects: [makeProject({
          changes: 4,
          screenshotsPerChange: 1,
          bytesPerScreenshot: 100,
          // big description-equivalent: simulate via huge snapshot block
          snapshotBytes: 12 * 1024 * 1024,
        })] as any,
        personNameCache: [],
      });

      const m = await import('../autoBackup');
      m.startAutoBackup();
      dataChangeListeners[0]();
      await vi.advanceTimersByTimeAsync(5000);

      const stored = JSON.parse(storage.getItem('scope-shield-backup-latest')!);
      expect(stored.data.projects[0].changes).toEqual([]);
      expect(stored.data.projects[0].snapshots).toEqual([]);
    });

    it('does not trim when payload fits under 4 MB', async () => {
      exportAllDataMock.mockResolvedValueOnce({
        version: '1.0', exportedAt: '',
        projects: [makeProject({
          changes: 2,
          screenshotsPerChange: 1,
          bytesPerScreenshot: 1000,
        })] as any,
        personNameCache: [],
      });

      const m = await import('../autoBackup');
      m.startAutoBackup();
      dataChangeListeners[0]();
      await vi.advanceTimersByTimeAsync(5000);

      const stored = JSON.parse(storage.getItem('scope-shield-backup-latest')!);
      expect(stored.data.projects[0].changes[0].screenshots[0].length).toBe(1000);
    });
  });

  describe('startAutoBackup — error handling', () => {
    it('silently swallows quota errors (does not throw)', async () => {
      storage.quotaBytes = 1024; // tiny
      exportAllDataMock.mockResolvedValueOnce({
        version: '1.0', exportedAt: '',
        projects: [makeProject({
          changes: 5, screenshotsPerChange: 1, bytesPerScreenshot: 200_000,
        })] as any,
        personNameCache: [],
      });

      const m = await import('../autoBackup');
      m.startAutoBackup();
      dataChangeListeners[0]();
      await expect(vi.advanceTimersByTimeAsync(5000)).resolves.not.toThrow();
    });

    it('silently swallows exportAllData rejection', async () => {
      exportAllDataMock.mockRejectedValueOnce(new Error('IDB unavailable'));
      const m = await import('../autoBackup');
      m.startAutoBackup();
      dataChangeListeners[0]();
      await expect(vi.advanceTimersByTimeAsync(5000)).resolves.not.toThrow();
    });
  });

  describe('startAutoBackup — beforeunload flush', () => {
    it('flushes pending debounced backup when window unloads', async () => {
      const m = await import('../autoBackup');
      m.startAutoBackup();
      dataChangeListeners[0]();
      await vi.advanceTimersByTimeAsync(1000); // mid-debounce
      expect(exportAllDataMock).not.toHaveBeenCalled();
      expect(beforeUnloadHandler).not.toBeNull();
      beforeUnloadHandler!();
      // doBackup runs on the microtask queue; flush it
      await vi.runAllTimersAsync();
      expect(exportAllDataMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('startAutoBackup — cleanup', () => {
    it('returns a function that unsubscribes the data-change listener', async () => {
      const m = await import('../autoBackup');
      const cleanup = m.startAutoBackup();
      expect(dataChangeListeners.length).toBe(1);
      cleanup();
      expect(dataChangeListeners.length).toBe(0);
    });
  });
});
